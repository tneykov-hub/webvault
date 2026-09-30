import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const routeSource = await readFile(new URL("../app/api/ai/search/route.ts", import.meta.url), "utf8");
const compiledRoute = ts.transpileModule(routeSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function routeFixture({ profile = { is_pro: false }, profileError = null, adminThrows = false, configured = true } = {}) {
  const calls = [];
  const profileReads = [];
  const exports = {};
  const context = vm.createContext({
    exports,
    Request,
    Response,
    AbortSignal,
    URL,
    console,
    process: { env: configured ? { OPENAI_API_KEY: "test-only-key" } : {} },
    fetch: async (url, options) => {
      calls.push({ url, ...options, body: JSON.parse(options.body) });
      return Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: "A current answer.", annotations: [{ type: "url_citation", title: "Source", url: "https://example.com/source" }] }] }] });
    },
    require: (name) => {
      if (name === "next/server") return require("next/server");
      if (name === "@/lib/native-api") return { nativeCorsHeaders: () => ({}) };
      if (name === "@/lib/server-auth") return {
        authenticateStripeRequest: async (request) => request.headers.get("authorization") === "Bearer valid-test-session"
          ? { user: { id: "authenticated-user", user_metadata: { is_pro: true } } }
          : { error: "Authentication is required.", status: 401 },
      };
      if (name === "@/lib/supabase-admin") return {
        getSupabaseAdmin: () => {
          if (adminThrows) throw new Error("Missing server configuration");
          return {
            from: (table) => ({
              select: (columns) => ({
                eq: (column, value) => ({
                  maybeSingle: async () => {
                    profileReads.push({ table, columns, column, value });
                    return { data: profile, error: profileError };
                  },
                }),
              }),
            }),
          };
        },
      };
      throw new Error(`Unexpected route import: ${name}`);
    },
  });
  vm.runInContext(compiledRoute, context);
  return {
    calls,
    profileReads,
    setProfile: (next) => { profile = next; },
    post: (body = { query: "latest news", language: "en" }, authenticated = true) => exports.POST(new Request("https://webvault.site/api/ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(authenticated ? { Authorization: "Bearer valid-test-session" } : {}) },
      body: JSON.stringify(body),
    })),
  };
}

test("rejects unauthenticated AI requests without reading a plan or calling OpenAI", async () => {
  const route = routeFixture();
  assert.equal((await route.post(undefined, false)).status, 401);
  assert.equal(route.profileReads.length, 0);
  assert.equal(route.calls.length, 0);
});

test("FREE cannot claim PRO through the body or editable user metadata", async () => {
  const route = routeFixture();
  const response = await route.post({ query: "latest news", is_pro: true, isPro: true, userId: "another-pro-user" });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "pro_required");
  assert.deepEqual(route.profileReads, [{ table: "profiles", columns: "is_pro", column: "id", value: "authenticated-user" }]);
  assert.equal(route.calls.length, 0);
});

test("a missing profile has no AI access", async () => {
  const route = routeFixture({ profile: null });
  assert.equal((await route.post()).status, 403);
  assert.equal(route.calls.length, 0);
});

test("plan lookup failures deny AI access without spending provider credits", async () => {
  for (const options of [{ profile: { is_pro: true }, profileError: { message: "unavailable" } }, { adminThrows: true }]) {
    const route = routeFixture(options);
    const response = await route.post();
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "subscription_check_failed");
    assert.equal(route.calls.length, 0);
  }
});

test("PRO can search with OpenAI and receives the answer and source links", async () => {
  const route = routeFixture({ profile: { is_pro: true } });
  const response = await route.post({ query: "latest news", language: "bg" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { answer: "A current answer.", sources: [{ title: "Source", url: "https://example.com/source" }] });
  assert.equal(route.calls.length, 1);
  assert.equal(route.calls[0].url, "https://api.openai.com/v1/responses");
  assert.equal(route.calls[0].body.model, "gpt-5.6-luna");
  assert.equal(route.calls[0].body.tools[0].type, "web_search");
  assert.equal(route.calls[0].body.max_output_tokens, 700);
  assert.match(route.calls[0].body.input[0].content[0].text, /Отговори на български/);
});

test("rechecks entitlement after a PRO account is downgraded", async () => {
  const route = routeFixture({ profile: { is_pro: true } });
  assert.equal((await route.post()).status, 200);
  route.setProfile({ is_pro: false });
  assert.equal((await route.post()).status, 403);
  assert.equal(route.profileReads.length, 2);
  assert.equal(route.calls.length, 1);
});

test("rejects removed providers and invalid queries without calling OpenAI", async () => {
  const route = routeFixture({ profile: { is_pro: true } });
  for (const body of [{ provider: "gemini", query: "latest news" }, { query: "x" }, { query: "x".repeat(401) }]) {
    assert.equal((await route.post(body)).status, 400);
  }
  assert.equal(route.calls.length, 0);
});

test("accepts existing ChatGPT clients and limits repeated PRO requests", async () => {
  const route = routeFixture({ profile: { is_pro: true } });
  for (let index = 0; index < 8; index++) {
    assert.equal((await route.post({ provider: "chatgpt", query: "latest news" })).status, 200);
  }
  const response = await route.post();
  assert.equal(response.status, 429);
  assert.equal((await response.json()).code, "rate_limited");
  assert.equal(route.calls.length, 8);
});

test("an unconfigured key is reported only after the PRO check", async () => {
  const free = routeFixture({ configured: false });
  assert.equal((await free.post()).status, 403);
  const pro = routeFixture({ configured: false, profile: { is_pro: true } });
  const response = await pro.post();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "provider_not_configured");
  assert.equal(pro.calls.length, 0);
});
