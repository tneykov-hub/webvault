import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("publishes a crawlable landing page with social sharing metadata", async () => {
  const [layout, robots, sitemap, authGate] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/robots.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/auth-gate.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /openGraph:/);
  assert.match(layout, /webvault-social\.png/);
  assert.match(layout, /twitter:/);
  assert.match(robots, /sitemap\.xml/);
  assert.match(sitemap, /webvault\.site/);
  assert.match(authGate, /if \(!ready\) return <PublicLanding/);
});
