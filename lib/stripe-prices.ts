// Non-secret WebVault live prices, verified against the active Stripe product
// on 1 October 2026. Pricing and the Checkout allow-list share these IDs so
// missing or duplicated legacy environment values cannot change the plan.
export const stripePriceIds = {
  monthlyPriceId: "price_1UDVBqHYeWxWMio9LdnWNeq9", // EUR 3.99 / month
  yearlyPriceId: "price_1UDVBzHYeWxWMio93h07quSg", // EUR 29.00 / year
} as const;
