import assert from "node:assert/strict";
import test from "node:test";
import { sourceModules } from "./helpers/load-source.mjs";

function checkout({ signedIn = true, isPro = false } = {}) {
  const sessions = [];
  const stripe = { checkout: { sessions: { create: async (parameters) => {
    sessions.push(parameters); return { url: "https://checkout.stripe.com/test-only-session" };
  } } } };
  const load = sourceModules({
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    stripe: { default: class { constructor() { return stripe; } } },
    "@/lib/server-auth": { authenticateStripeRequest: async () => signedIn
      ? { user: { id: "00000000-0000-4000-8000-000000000001", email: "test@example.com" } }
      : { error: "Authentication required", status: 401 } },
    "@/lib/supabase-admin": { getSupabaseAdmin: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_pro: isPro, stripe_customer_id: "cus_test_existing" }, error: null }) }) }) }) }) },
  }, { process: { env: { STRIPE_SECRET_KEY: "sk_test_fake", STRIPE_PRICE_YEARLY: "price_bad_legacy_monthly" } } });
  const route = load("@/app/api/stripe/create-checkout/route");
  const prices = load("@/lib/stripe").getConfiguredStripePrices();
  return { sessions, prices, post: (priceId) => route.POST(new Request("https://webvault.site/api/stripe/create-checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ priceId, language: "bg" }) })) };
}

for (const [period, key] of [["monthly", "monthlyPriceId"], ["yearly", "yearlyPriceId"]]) {
  test(`the actual Checkout route sends the verified ${period} price to Stripe`, async () => {
    const c = checkout(); const response = await c.post(c.prices[key]);
    assert.equal(response.status, 200); assert.equal(c.sessions.length, 1);
    assert.equal(c.sessions[0].line_items.length, 1);
    assert.equal(c.sessions[0].line_items[0].price, c.prices[key]);
    assert.equal(c.sessions[0].line_items[0].quantity, 1);
    assert.equal(c.sessions[0].mode, "subscription"); assert.equal(c.sessions[0].locale, "bg");
  });
}
test("unknown or empty plans never create a Checkout session", async () => {
  const c = checkout();
  for (const id of ["", "price_attacker_supplied"]) assert.equal((await c.post(id)).status, 400);
  assert.equal(c.sessions.length, 0);
});
test("unauthenticated callers never create a Checkout session", async () => {
  const c = checkout({ signedIn: false });
  assert.equal((await c.post(c.prices.monthlyPriceId)).status, 401); assert.equal(c.sessions.length, 0);
});
test("an existing PRO profile never purchases another Checkout subscription", async () => {
  const c = checkout({ isPro: true });
  assert.equal((await c.post(c.prices.yearlyPriceId)).status, 409); assert.equal(c.sessions.length, 0);
});
