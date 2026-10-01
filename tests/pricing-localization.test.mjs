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

test("pricing receives the verified server plan IDs even with duplicated legacy env values", async () => {
  const keys = ["STRIPE_PRICE_MONTHLY", "STRIPE_PRICE_YEARLY", "NEXT_PUBLIC_STRIPE_PRICE_MONTHLY", "NEXT_PUBLIC_STRIPE_PRICE_YEARLY"];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.STRIPE_PRICE_MONTHLY = "price_bad_legacy_monthly";
    process.env.STRIPE_PRICE_YEARLY = "price_bad_legacy_monthly";
    delete process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY;
    delete process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY;
    const { default: PricingPage } = await vite.ssrLoadModule("/app/pricing/page.tsx");
    const { isConfiguredStripePrice } = await vite.ssrLoadModule("/lib/stripe.ts");
    const page = PricingPage();
    assert.deepEqual(page.props, { monthlyPriceId: "price_1UDVBqHYeWxWMio9LdnWNeq9", yearlyPriceId: "price_1UDVBzHYeWxWMio93h07quSg" });
    assert.equal(isConfiguredStripePrice(page.props.monthlyPriceId), true);
    assert.equal(isConfiguredStripePrice(page.props.yearlyPriceId), true);
    assert.equal(isConfiguredStripePrice("price_attacker_supplied"), false);
  } finally {
    for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test("missing legacy environment values cannot blank pricing or allow an empty Checkout price", async () => {
  const keys = ["STRIPE_PRICE_MONTHLY", "STRIPE_PRICE_YEARLY"];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    const { default: PricingPage } = await vite.ssrLoadModule("/app/pricing/page.tsx");
    const { isConfiguredStripePrice } = await vite.ssrLoadModule("/lib/stripe.ts");
    const props = PricingPage().props;
    assert.ok(props.monthlyPriceId); assert.ok(props.yearlyPriceId);
    assert.notEqual(props.monthlyPriceId, props.yearlyPriceId);
    assert.equal(isConfiguredStripePrice(""), false);
  } finally {
    for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
