import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const routeSource = await readFile(new URL("../app/api/ai/search/route.ts", import.meta.url), "utf8");
const plansSource = await readFile(new URL("../lib/plans.ts", import.meta.url), "utf8");
const bodySource = await readFile(new URL("../lib/limited-body.ts", import.meta.url), "utf8");
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const routeCode = compile(routeSource);
const plans = { exports: {} };
vm.runInNewContext(compile(plansSource), { exports: plans.exports });
const bodies = { exports: {} };
vm.runInNewContext(compile(bodySource), { exports: bodies.exports, AbortSignal, TextDecoder, SyntaxError, Error });

function createRoute({ profile, authError, databaseError, apiKey = "test-provider-key", providerFailure, reservation, quotaError, providerTimeout }) {
  const calls = { provider: 0, database: 0, reserved: 0, released: 0, errors: [] };
  const route = { exports: {} };
  const userId = "verified-auth-user";
  const modules = {
    "next/server": { NextResponse: Response },
    "@/lib/native-api": { nativeCorsHeaders: () => ({}) },
    "@/lib/plans": plans.exports,
    "@/lib/limited-body": bodies.exports,
    "@/lib/request-limits": {
      reserveRequest: async (scope, subject, id) => {
        assert.equal(scope, "ai"); assert.equal(subject, userId); assert.equal(id, userId);
        calls.reserved += 1;
        if (quotaError) throw new Error("Quota database unavailable");
        return reservation || { allowed: true, token: "test-reservation" };
      },
      releaseRequest: async (token) => { if (token) calls.released += 1; },
    },
    "@/lib/server-auth": {
      authenticateStripeRequest: async () => authError || { user: { id: userId } },
    },
    "@/lib/supabase-admin": {
      getSupabaseAdmin: () => ({
        from(table) {
          assert.equal(table, "profiles");
          calls.database += 1;
          return {
            select(columns) {
              assert.equal(columns, "is_pro,stripe_subscription_status");
              return {
                eq(column, value) {
                  assert.equal(column, "id");
                  assert.equal(value, userId);
                  return { maybeSingle: async () => ({ data: profile, error: databaseError }) };
                },
              };
            },
          };
        },
      }),
    },
  };
  vm.runInNewContext(routeCode, {
    exports: route.exports,
    require(name) {
      assert.ok(Object.hasOwn(modules, name), `Unexpected import: ${name}`);
      return modules[name];
    },
    process: { env: { OPENAI_API_KEY: apiKey } },
    console: { error: (...args) => calls.errors.push(args) },
    Map,
    AbortSignal: providerTimeout ? { timeout: () => AbortSignal.timeout(5) } : AbortSignal,
    SyntaxError,
    fetch: async (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      calls.provider += 1;
      assert.equal(JSON.parse(options.body).model, "gpt-6-luna");
      assert.equal(JSON.parse(options.body).max_tool_calls, 1);
      assert.ok(options.signal);
      if (providerTimeout) return new Promise((_, reject) => {
        options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
      });
      if (providerFailure) {
        return Response.json({ error: providerFailure }, { status: 429 });
      }
      return Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: "Search answer", annotations: [] }] }] });
    },
  });
  return { post: route.exports.POST, calls };
}

async function search(options, extraBody = {}) {
  const route = createRoute(options);
  const response = await route.post(new Request("https://webvault.site/api/ai/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "test search", language: "en", ...extraBody }),
  }));
  return { response, calls: route.calls };
}

for (const status of ["active", "trialing", "manual_founder"]) {
  test(`permits PRO search for the protected ${status} entitlement`, async () => {
    const { response, calls } = await search({ profile: { is_pro: true, stripe_subscription_status: status } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).answer, "Search answer");
    assert.equal(calls.provider, 1);
  });
}

for (const status of [null, "canceled", "past_due", "unpaid", "incomplete", "manual_founder "]) {
  test(`denies PRO search with a missing or ineligible ${String(status)} status`, async () => {
    const { response, calls } = await search({ profile: { is_pro: true, stripe_subscription_status: status } });
    assert.equal(response.status, 403);
    assert.equal(calls.provider, 0);
  });
}

for (const status of [null, "active", "manual_founder"]) {
  test(`denies a Free profile even with ${String(status)} as its status`, async () => {
    const { response, calls } = await search({ profile: { is_pro: false, stripe_subscription_status: status } });
    assert.equal(response.status, 403);
    assert.equal(calls.provider, 0);
  });
}

test("ignores a client-supplied founder entitlement", async () => {
  const { response, calls } = await search(
    { profile: { is_pro: false, stripe_subscription_status: null } },
    { is_pro: true, stripe_subscription_status: "manual_founder", userId: "another-user" },
  );
  assert.equal(response.status, 403);
  assert.equal(calls.provider, 0);
});

for (const reason of ["daily", "monthly", "minute", "concurrent"]) {
  test(`blocks a ${reason} limit before any provider request and supplies Retry-After`, async () => {
    const { response, calls } = await search({
      profile: { is_pro: true, stripe_subscription_status: "active" },
      reservation: { allowed: false, reason, retryAfter: 60 },
    });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "60");
    assert.equal((await response.json()).code, "ai_limit");
    assert.equal(calls.provider, 0); assert.equal(calls.released, 0);
  });
}

test("fails closed if durable quota storage is unavailable", async () => {
  const { response, calls } = await search({ profile: { is_pro: true, stripe_subscription_status: "active" }, quotaError: true });
  assert.equal(response.status, 503); assert.equal(calls.provider, 0);
});

test("rechecks entitlement at reservation time", async () => {
  const { response, calls } = await search({ profile: { is_pro: true, stripe_subscription_status: "active" }, reservation: { allowed: false, reason: "forbidden" } });
  assert.equal(response.status, 403); assert.equal(calls.provider, 0);
});

test("aborts a slow provider and releases its concurrency slot", async () => {
  const keeper = setTimeout(() => {}, 100);
  try {
    const { response, calls } = await search({ profile: { is_pro: true, stripe_subscription_status: "active" }, providerTimeout: true });
    assert.equal(response.status, 504); assert.equal(calls.reserved, 1); assert.equal(calls.released, 1);
  } finally { clearTimeout(keeper); }
});

test("rejects oversized input without consuming a provider request", async () => {
  const { response, calls } = await search({ profile: { is_pro: true, stripe_subscription_status: "active" } }, { ignored: "x".repeat(9000) });
  assert.equal(response.status, 413); assert.equal(calls.reserved, 0); assert.equal(calls.provider, 0);
});

test("rejects an unauthenticated request before reading the profile or calling the provider", async () => {
  const { response, calls } = await search({ authError: { error: "Unauthorized", status: 401 } });
  assert.equal(response.status, 401);
  assert.equal(calls.database, 0);
  assert.equal(calls.provider, 0);
});

test("fails closed when the profile cannot be read", async () => {
  const { response, calls } = await search({ databaseError: new Error("Database unavailable") });
  assert.equal(response.status, 500);
  assert.equal(calls.provider, 0);
});

test("does not treat missing provider configuration as a Free-plan denial for the founder", async () => {
  const { response, calls } = await search({ profile: { is_pro: true, stripe_subscription_status: "manual_founder" }, apiKey: "" });
  assert.equal(response.status, 503);
  assert.equal(calls.provider, 0);
});

for (const code of ["insufficient_quota", "rate_limit_exceeded"]) {
  test(`records the provider's ${code} label without exposing its raw error message`, async () => {
    const { response, calls } = await search({
      profile: { is_pro: true, stripe_subscription_status: "manual_founder" },
      providerFailure: { code, type: "rate_limit_error", message: "Private provider message with query and credentials" },
    });
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error, "ChatGPT search is temporarily unavailable.");
    assert.equal(calls.provider, 1);
    assert.equal(calls.errors[0][1].code, code);
    assert.equal(calls.errors[0][1].type, "rate_limit_error");
    assert.ok(!JSON.stringify(calls.errors).includes("Private provider message"));
  });
}

test("discards unexpected provider error labels instead of logging arbitrary strings", async () => {
  const { response, calls } = await search({
    profile: { is_pro: true, stripe_subscription_status: "manual_founder" },
    providerFailure: { code: "sensitive value", type: "sensitive/value", message: "Private provider message" },
  });
  assert.equal(response.status, 502);
  assert.equal(calls.errors[0][1].code, null);
  assert.equal(calls.errors[0][1].type, null);
  assert.ok(!JSON.stringify(calls.errors).includes("sensitive"));
});
