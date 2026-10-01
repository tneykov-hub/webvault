import assert from "node:assert/strict";
import test from "node:test";
import { sourceModules } from "./helpers/load-source.mjs";
import { securityDatabase, databaseAdmin, testUser, testFounder } from "./helpers/security-db.mjs";

const db = await securityDatabase();
test.after(() => db.close());
const admin = databaseAdmin(db);
const customerId = "cus_test_webvault";
const priceId = "price_test_webvault";
function subscription(status, id = "sub_test", created = 100, user = testUser) {
  return { id, customer: customerId, status, created, metadata: { product: "webvault_pro", supabase_user_id: user }, items: { data: [{ price: { id: priceId } }] } };
}
function route({ current = subscription("canceled"), subscriptions = [current], retrieveError = false, onRetrieve } = {}) {
  const calls = { retrieve: 0, list: 0, notifications: [] };
  const stripe = {
    webhooks: { constructEvent: (body, signature) => { if (signature !== "valid") throw new Error("Invalid signature"); return JSON.parse(body); } },
    subscriptions: {
      retrieve: async () => { calls.retrieve += 1; if (retrieveError) throw new Error("Stripe unavailable"); if (onRetrieve) await onRetrieve(); return current; },
      list: async () => { calls.list += 1; return { data: subscriptions, has_more: false }; },
    },
    customers: { retrieve: async () => ({ email: "test@example.com" }) },
  };
  const load = sourceModules({
    "next/server": { NextResponse: Response },
    "@/lib/stripe": { getStripe: () => stripe, isConfiguredStripePrice: (id) => id === priceId },
    "@/lib/supabase-admin": { getSupabaseAdmin: () => admin },
    "@/lib/owner-notifications": { notifyOwner: async (value) => calls.notifications.push(value) },
  }, { process: { env: { STRIPE_WEBHOOK_SECRET: "test-only-webhook-secret" } }, console: { error() {} } });
  const handler = load("@/app/api/stripe/webhook/route");
  async function send(event, signature = "valid") {
    return handler.POST(new Request("https://webvault.site/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": signature }, body: JSON.stringify(event) }));
  }
  return { send, calls };
}
function event(id, status, type = "customer.subscription.updated", user = testUser) {
  return { id, type, created: 100, data: { object: subscription(status, "sub_test", 100, user) } };
}
async function profile(user = testUser) { return (await db.query("select * from public.profiles where id = $1", [user])).rows[0]; }
test.beforeEach(async () => {
  await db.exec(`delete from public.webvault_stripe_events; delete from public.webvault_stripe_sync_locks;
    update public.profiles set is_pro = false, stripe_customer_id = null, stripe_subscription_id = null, stripe_subscription_status = null, subscription_updated_at = null where id = '${testUser}';
    update public.profiles set is_pro = true, stripe_customer_id = null, stripe_subscription_id = null, stripe_subscription_status = 'manual_founder', subscription_updated_at = null where id = '${testFounder}';`);
});

test("an old active event cannot restore PRO after a cancellation", async () => {
  const handler = route();
  assert.equal((await handler.send(event("evt_deleted", "canceled", "customer.subscription.deleted"))).status, 200);
  assert.equal((await handler.send(event("evt_old_active", "active"))).status, 200);
  const result = await profile(); assert.equal(result.is_pro, false); assert.equal(result.stripe_subscription_status, "canceled");
  assert.equal(handler.calls.retrieve, 2);
  const providerCalls = [];
  const load = sourceModules({
    "next/server": { NextResponse: Response }, "@/lib/native-api": { nativeCorsHeaders: () => ({}) },
    "@/lib/server-auth": { authenticateStripeRequest: async () => ({ user: { id: testUser } }) },
    "@/lib/supabase-admin": { getSupabaseAdmin: () => admin },
  }, { process: { env: { OPENAI_API_KEY: "test-only-key" } }, fetch: (...args) => providerCalls.push(args), console: { error() {} } });
  const response = await load("@/app/api/ai/search/route").POST(new Request("https://webvault.site/api/ai/search", { method: "POST", body: JSON.stringify({ query: "test" }) }));
  assert.equal(response.status, 403); assert.equal(providerCalls.length, 0);
});
test("duplicate event IDs do not fetch again or notify again", async () => {
  const handler = route({ current: subscription("active") });
  const payload = event("evt_duplicate", "active");
  assert.equal((await handler.send(payload)).status, 200);
  assert.equal((await handler.send(payload)).status, 200);
  assert.equal(handler.calls.retrieve, 1); assert.equal(handler.calls.notifications.length, 1);
});
test("an old cancellation preserves a newer active WebVault subscription", async () => {
  const old = subscription("canceled"); const recent = subscription("active", "sub_new", 200);
  const handler = route({ current: old, subscriptions: [recent, old] });
  assert.equal((await handler.send(event("evt_old_deleted", "canceled", "customer.subscription.deleted"))).status, 200);
  const result = await profile(); assert.equal(result.is_pro, true); assert.equal(result.stripe_subscription_id, "sub_new");
});
test("checkout without a subscription or confirmed payment cannot grant PRO", async () => {
  const handler = route({ current: subscription("active") });
  for (const checkout of [
    { mode: "payment", payment_status: "paid", subscription: null },
    { mode: "subscription", payment_status: "unpaid", subscription: "sub_test" },
  ]) {
    assert.equal((await handler.send({ id: `evt_checkout_${checkout.mode}`, type: "checkout.session.completed", data: { object: { ...checkout, customer: customerId, client_reference_id: testUser } } })).status, 200);
  }
  assert.equal((await profile()).is_pro, false); assert.equal(handler.calls.retrieve, 0);
});
test("manual founder is never changed or looked up in Stripe", async () => {
  const before = await profile(testFounder);
  const handler = route({ current: subscription("canceled", "sub_test", 100, testFounder) });
  assert.equal((await handler.send(event("evt_founder", "canceled", "customer.subscription.deleted", testFounder))).status, 200);
  assert.deepEqual(await profile(testFounder), before);
  assert.equal(handler.calls.retrieve, 0); assert.equal(handler.calls.notifications.length, 0);
});
test("a founder entitlement granted during reconciliation is also protected", async () => {
  const handler = route({ current: subscription("canceled"), onRetrieve: () => db.query("update public.profiles set is_pro = true, stripe_subscription_status = 'manual_founder' where id = $1", [testUser]) });
  assert.equal((await handler.send(event("evt_midflight_founder", "canceled"))).status, 200);
  const result = await profile(); assert.equal(result.is_pro, true); assert.equal(result.stripe_subscription_status, "manual_founder");
  assert.equal(result.stripe_subscription_id, null); assert.equal(result.subscription_updated_at, null);
});
test("Stripe retrieval failure never grants access and releases the lease for retry", async () => {
  const handler = route({ retrieveError: true });
  assert.equal((await handler.send(event("evt_retry", "active"))).status, 500);
  assert.equal((await profile()).is_pro, false);
  assert.equal((await db.query("select locked_until from public.webvault_stripe_sync_locks")).rows[0].locked_until, null);
  const retry = route({ current: subscription("active") });
  assert.equal((await retry.send(event("evt_retry", "active"))).status, 200);
  assert.equal((await profile()).is_pro, true);
});
test("a concurrent event is deferred while the per-profile lease is held", async () => {
  const claim = await admin.rpc("claim_webvault_stripe_event", { p_event_id: "evt_hold", p_user_id: testUser });
  assert.equal(claim.data.state, "acquired");
  const handler = route({ current: subscription("active") });
  assert.equal((await handler.send(event("evt_overlap", "active"))).status, 500);
  assert.equal(handler.calls.retrieve, 0); assert.equal((await profile()).is_pro, false);
});
test("an expired worker cannot overwrite the replacement worker's cancellation", async () => {
  const first = (await admin.rpc("claim_webvault_stripe_event", { p_event_id: "evt_first", p_user_id: testUser })).data;
  await db.exec("update public.webvault_stripe_sync_locks set locked_until = now() - interval '1 second'");
  const second = (await admin.rpc("claim_webvault_stripe_event", { p_event_id: "evt_second", p_user_id: testUser })).data;
  const args = { p_user_id: testUser, p_customer_id: customerId, p_subscription_id: "sub_test", p_price_id: priceId };
  const stale = await admin.rpc("finish_webvault_stripe_event", { ...args, p_event_id: "evt_first", p_token: first.token, p_status: "active" });
  assert.ok(stale.error);
  const latest = await admin.rpc("finish_webvault_stripe_event", { ...args, p_event_id: "evt_second", p_token: second.token, p_status: "canceled" });
  assert.equal(latest.error, null); assert.equal((await profile()).is_pro, false);
});
test("invalid signatures cannot read or write subscription state", async () => {
  const handler = route();
  assert.equal((await handler.send(event("evt_bad", "active"), "invalid")).status, 400);
  assert.equal(handler.calls.retrieve, 0);
  assert.equal((await db.query("select count(*)::int n from public.webvault_stripe_events")).rows[0].n, 0);
});
