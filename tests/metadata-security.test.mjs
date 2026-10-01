import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { sourceModules } from "./helpers/load-source.mjs";

const publicIp = "93.184.215.14";

function transport({ dns, responses, timeout = false }) {
  const calls = { lookups: 0, requests: [], streams: [] };
  const request = (url, options, callback) => {
    const req = new EventEmitter();
    let pinned;
    options.lookup(url.hostname, {}, (error, address) => { assert.equal(error, null); pinned = address; });
    calls.requests.push({ url: url.href, pinned, options });
    const spec = responses[calls.requests.length - 1] || {};
    const response = spec.slow ? new Readable({ read() {} }) : Readable.from(spec.chunks || [Buffer.from(spec.body || "<title>Public site</title>")]);
    response.statusCode = spec.status || 200;
    response.headers = { "content-type": "text/html", ...spec.headers };
    calls.streams.push(response);
    options.signal.addEventListener("abort", () => response.destroy(options.signal.reason), { once: true });
    req.end = () => queueMicrotask(() => callback(response));
    return req;
  };
  const load = sourceModules({
    "node:dns/promises": { lookup: async (host) => { calls.lookups += 1; return dns ? dns(host, calls.lookups) : [{ address: publicIp, family: 4 }]; } },
    "node:http": { request }, "node:https": { request },
  }, timeout ? { setTimeout: (fn, ms) => { assert.equal(ms, 7000); return setTimeout(fn, 10); } } : {});
  return { ...load("@/lib/safe-metadata-fetch"), calls };
}

const safe = sourceModules()("@/lib/safe-metadata-fetch");
for (const ip of ["0.0.0.0", "10.0.0.1", "100.64.0.1", "127.0.0.1", "169.254.169.254", "172.31.0.1", "192.168.1.1", "192.0.0.1", "198.19.1.1", "198.51.100.1", "203.0.113.1", "224.0.0.1", "255.255.255.255", "::", "::1", "::ffff:127.0.0.1", "64:ff9b::a00:1", "fc00::1", "fe80::1", "ff02::1", "2001:db8::1", "2001::1", "2002:a00:1::1", "3fff::1"]) {
  test(`blocks non-public address ${ip}`, () => assert.equal(safe.isPublicAddress(ip), false));
}
for (const ip of [publicIp, "8.8.8.8", "2001:4860:4860::8888", "2606:4700:4700::1111"]) {
  test(`permits public address ${ip}`, () => assert.equal(safe.isPublicAddress(ip), true));
}
for (const url of ["", "http://2130706433", "http://0x7f000001", "http://127.1", "http://[::ffff:7f00:1]", "https://user:pass@example.com", "http://localhost.", "http://host.local", "file:///etc/passwd", "ftp://example.com", "https://example.com:8443", "http://internal"]) {
  test(`rejects unsafe URL ${url}`, () => assert.throws(() => safe.parseMetadataUrl(url), /Unsupported URL/));
}

test("rejects a DNS name resolving to a private address before opening a socket", async () => {
  const helper = transport({ dns: () => [{ address: "10.1.2.3", family: 4 }], responses: [] });
  await assert.rejects(helper.fetchSafeMetadata(helper.parseMetadataUrl("https://attacker.example.com")), /Unsupported URL/);
  assert.equal(helper.calls.requests.length, 0);
});
test("rejects mixed public/private DNS responses", async () => {
  const helper = transport({ dns: () => [{ address: publicIp, family: 4 }, { address: "::1", family: 6 }], responses: [] });
  await assert.rejects(helper.fetchSafeMetadata(helper.parseMetadataUrl("https://attacker.example.com")), /Unsupported URL/);
  assert.equal(helper.calls.requests.length, 0);
});
test("pins the socket to the validated DNS answer to prevent rebinding", async () => {
  const helper = transport({ dns: (_host, n) => [{ address: n === 1 ? publicIp : "127.0.0.1", family: 4 }], responses: [{}] });
  assert.match(await helper.fetchSafeMetadata(helper.parseMetadataUrl("https://example.com")), /Public site/);
  assert.equal(helper.calls.lookups, 1); assert.equal(helper.calls.requests[0].pinned, publicIp);
  assert.equal(helper.calls.requests[0].url, "https://example.com/");
  assert.equal(helper.calls.requests[0].options.agent, false);
});
test("blocks a redirect into cloud instance metadata", async () => {
  const helper = transport({ responses: [{ status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }] });
  await assert.rejects(helper.fetchSafeMetadata(helper.parseMetadataUrl("https://example.com")), /Unsupported URL/);
  assert.equal(helper.calls.requests.length, 1); assert.equal(helper.calls.streams[0].destroyed, true);
});
test("revalidates DNS on every redirect, including the same hostname", async () => {
  const helper = transport({ dns: (_host, n) => [{ address: n === 1 ? publicIp : "127.0.0.1", family: 4 }], responses: [{ status: 302, headers: { location: "/again" } }] });
  await assert.rejects(helper.fetchSafeMetadata(helper.parseMetadataUrl("https://example.com")), /Unsupported URL/);
  assert.equal(helper.calls.lookups, 2); assert.equal(helper.calls.requests.length, 1);
});
test("allows a bounded redirect to another public page", async () => {
  const helper = transport({ responses: [{ status: 302, headers: { location: "https://www.example.com/page" } }, { body: "<title>Redirected public page</title>" }] });
  assert.match(await helper.fetchSafeMetadata(helper.parseMetadataUrl("https://example.com")), /Redirected public page/);
  assert.equal(helper.calls.lookups, 2); assert.equal(helper.calls.requests.length, 2);
});
test("stops a streaming body before buffering more than 512 KiB", async () => {
  const helper = transport({ responses: [{ chunks: [Buffer.alloc(300000), Buffer.alloc(300000)] }] });
  await assert.rejects(helper.fetchSafeMetadata(helper.parseMetadataUrl("https://example.com")), /too large/);
  assert.equal(helper.calls.streams[0].destroyed, true);
});
test("rejects an oversized declared body and compressed bodies", async () => {
  for (const headers of [{ "content-length": "600000" }, { "content-encoding": "gzip" }]) {
    const helper = transport({ responses: [{ headers }] });
    await assert.rejects(helper.fetchSafeMetadata(helper.parseMetadataUrl("https://example.com")));
    assert.equal(helper.calls.streams[0].destroyed, true);
  }
});
test("keeps the total timeout active while reading the body", async () => {
  const helper = transport({ responses: [{ slow: true }], timeout: true });
  await assert.rejects(helper.fetchSafeMetadata(helper.parseMetadataUrl("https://example.com")), /Metadata timeout/);
  assert.equal(helper.calls.streams[0].destroyed, true);
});
test("ignores spoofable forwarding headers outside Vercel", () => {
  const helper = sourceModules({ "@/lib/supabase-admin": {} })("@/lib/request-limits");
  assert.equal(helper.metadataRequestSubject(new Request("https://webvault.site", { headers: { "x-forwarded-for": "8.8.8.8" } })), "shared");
});
test("canonicalises and hashes trusted Vercel IPs without retaining raw addresses", () => {
  const helper = sourceModules({ "@/lib/supabase-admin": {} }, { process: { env: { VERCEL: "1", SUPABASE_SERVICE_ROLE_KEY: "test-only-hmac-key" } } })("@/lib/request-limits");
  const subject = (ip) => helper.metadataRequestSubject(new Request("https://webvault.site", { headers: { "x-vercel-forwarded-for": ip } }));
  assert.match(subject("8.8.8.8"), /^[a-f0-9]{64}$/);
  assert.equal(subject("2606:4700:4700::1111"), subject("2606:4700:4700:0:0:0:0:1111"));
});
