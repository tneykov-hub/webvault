import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

test("pricing translations include matching English and Bulgarian copy", async () => {
  const { getPricingCopy } = await vite.ssrLoadModule("/lib/pricing-copy.ts");
  const english = getPricingCopy("en");
  const bulgarian = getPricingCopy("bg");

  assert.deepEqual(Object.keys(english).sort(), Object.keys(bulgarian).sort());
  assert.equal(english.title, "More space. Full control.");
  assert.equal(english.monthlyPlan, "Monthly plan");
  assert.equal(english.choosePlan, "Choose plan");
  assert.equal(bulgarian.title, "Повече място. Пълен контрол.");
  assert.equal(bulgarian.monthlyPlan, "Месечен план");
  assert.equal(bulgarian.choosePlan, "Избери план");
});

test("pricing page server markup defaults to English copy", async () => {
  const { PricingClient } = await vite.ssrLoadModule("/components/pricing-client.tsx");
  const html = renderToStaticMarkup(React.createElement(PricingClient));

  assert.match(html, /<main class="pricing-page" lang="en">/);
  assert.match(html, /More space\. Full control\./);
  assert.match(html, /Monthly plan/);
  assert.match(html, /Sign in to activate/);
  assert.doesNotMatch(html, /Повече място|Месечен план|Влез, за да активираш/);
});
