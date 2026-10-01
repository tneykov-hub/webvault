import assert from "node:assert/strict";
import test from "node:test";
import { securityDatabase, testUser, testFounder, databaseAdmin } from "./helpers/security-db.mjs";

const db = await securityDatabase();
test.after(() => db.close());
const admin = databaseAdmin(db);
async function rpc(name, args) { const result = await admin.rpc(name, args); if (result.error) throw result.error; return result.data; }
async function reserve() { return rpc("reserve_webvault_request", { p_scope: "ai", p_subject: testUser, p_user_id: testUser }); }
async function reset() {
  await db.exec(`delete from public.webvault_request_usage; update public.profiles set is_pro = true, stripe_subscription_status = 'active' where id = '${testUser}';`);
}
test.beforeEach(reset);

test("database allows exactly 20 daily attempts and denies the 21st", async () => {
  for (let i = 0; i < 20; i += 1) {
    await db.exec("update public.webvault_request_usage set minute_start = minute_start - interval '1 minute'");
    const result = await reserve(); assert.equal(result.allowed, true);
    await rpc("release_webvault_request", { p_token: result.token });
  }
  const result = await reserve(); assert.equal(result.allowed, false); assert.equal(result.reason, "daily");
  assert.ok(result.retry_after > 0);
  assert.equal((await db.query("select day_count from public.webvault_request_usage")).rows[0].day_count, 20);
});
test("database enforces the 200 monthly cap across different days", async () => {
  const first = await reserve(); await rpc("release_webvault_request", { p_token: first.token });
  await db.exec("update public.webvault_request_usage set month_count = 200, day_start = day_start - 1");
  const result = await reserve(); assert.equal(result.allowed, false); assert.equal(result.reason, "monthly");
});
test("daily and monthly boundaries reset the appropriate counters", async () => {
  const first = await reserve(); await rpc("release_webvault_request", { p_token: first.token });
  await db.exec("update public.webvault_request_usage set month_start = month_start - interval '1 month', day_start = day_start - 1, month_count = 200, day_count = 20");
  assert.equal((await reserve()).allowed, true);
  const usage = (await db.query("select * from public.webvault_request_usage")).rows[0];
  assert.equal(usage.day_count, 1); assert.equal(usage.month_count, 1);
});
test("only one AI lease can be active, even for two overlapping reservations", async () => {
  const results = await Promise.all([reserve(), reserve()]);
  assert.equal(results.filter((x) => x.allowed).length, 1);
  assert.equal(results.find((x) => !x.allowed).reason, "concurrent");
  await rpc("release_webvault_request", { p_token: results.find((x) => x.allowed).token });
  assert.equal((await reserve()).allowed, true);
});
test("six calls per minute cannot bypass the slower daily cap", async () => {
  for (let i = 0; i < 6; i += 1) {
    const result = await reserve(); assert.equal(result.allowed, true);
    await rpc("release_webvault_request", { p_token: result.token });
  }
  assert.equal((await reserve()).reason, "minute");
});
test("an expired lease recovers and a late release cannot delete its replacement", async () => {
  const first = await reserve();
  await db.exec("update public.webvault_request_leases set expires_at = now() - interval '1 second'");
  const second = await reserve(); assert.equal(second.allowed, true);
  await rpc("release_webvault_request", { p_token: first.token });
  assert.equal((await reserve()).reason, "concurrent");
});
test("revoked PRO is denied by the database before reserving any usage", async () => {
  await db.exec(`update public.profiles set stripe_subscription_status = 'canceled' where id = '${testUser}'`);
  assert.equal((await reserve()).reason, "forbidden");
  assert.equal((await db.query("select count(*)::int n from public.webvault_request_usage")).rows[0].n, 0);
});
test("founder entitlement remains unchanged while still receiving a bounded AI reservation", async () => {
  const before = (await db.query("select * from public.profiles where id = $1", [testFounder])).rows[0];
  const result = await rpc("reserve_webvault_request", { p_scope: "ai", p_subject: testFounder, p_user_id: testFounder });
  assert.equal(result.allowed, true);
  assert.deepEqual((await db.query("select * from public.profiles where id = $1", [testFounder])).rows[0], before);
});
test("metadata permits three leases and blocks a fourth from the same subject", async () => {
  const args = { p_scope: "metadata", p_subject: "shared" };
  for (let i = 0; i < 3; i += 1) assert.equal((await rpc("reserve_webvault_request", args)).allowed, true);
  assert.equal((await rpc("reserve_webvault_request", args)).reason, "concurrent");
});
test("a client cannot create a profile with PRO or manual founder entitlement", async () => {
  await db.exec("set role authenticated");
  try {
    await assert.rejects(db.query("insert into public.profiles(id, is_pro, stripe_subscription_status) values ($1, true, 'manual_founder')", [testUser]), /permission denied/);
  } finally { await db.exec("reset role"); }
});
test("ordinary profile creation retains safe defaults after the privilege restriction", async () => {
  const user = "00000000-0000-4000-8000-000000000003";
  await db.query("insert into auth.users(id) values ($1)", [user]);
  await db.exec("set role authenticated");
  try {
    await db.query("insert into public.profiles(id, display_name, theme, open_links_in_new_tab) values ($1, 'Test', 'light', true)", [user]);
  } finally { await db.exec("reset role"); }
  const profile = (await db.query("select is_pro, stripe_subscription_status from public.profiles where id = $1", [user])).rows[0];
  assert.equal(profile.is_pro, false); assert.equal(profile.stripe_subscription_status, null);
  await db.query("delete from public.profiles where id = $1", [user]);
  await db.query("delete from auth.users where id = $1", [user]);
});
test("clients cannot call quota or Stripe control RPCs or access control tables", async () => {
  for (const name of ["claim_webvault_stripe_event", "finish_webvault_stripe_event", "release_webvault_stripe_event", "reserve_webvault_request", "release_webvault_request"]) {
    const rows = (await db.query("select has_function_privilege('anon', oid, 'execute') a, has_function_privilege('authenticated', oid, 'execute') u, has_function_privilege('service_role', oid, 'execute') s from pg_proc where proname = $1", [name])).rows;
    assert.equal(rows.length, 1); assert.deepEqual(rows[0], { a: false, u: false, s: true });
  }
  const rows = (await db.query("select relrowsecurity, has_table_privilege('anon', oid, 'select') a, has_table_privilege('authenticated', oid, 'update') u from pg_class where relname in ('webvault_request_usage', 'webvault_request_leases', 'webvault_stripe_events', 'webvault_stripe_sync_locks')")).rows;
  assert.equal(rows.length, 4);
  for (const row of rows) assert.deepEqual(row, { relrowsecurity: true, a: false, u: false });
});
