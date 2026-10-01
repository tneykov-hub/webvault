import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe is not configured.");
  stripeClient ??= new Stripe(secretKey, { typescript: true, timeout: 10000, maxNetworkRetries: 1 });
  return stripeClient;
}

export function getConfiguredStripePrices() {
  return {
    monthlyPriceId: process.env.STRIPE_PRICE_MONTHLY ?? "",
    yearlyPriceId: process.env.STRIPE_PRICE_YEARLY ?? "",
  };
}

export function isConfiguredStripePrice(priceId: string) {
  const { monthlyPriceId, yearlyPriceId } = getConfiguredStripePrices();
  return Boolean(priceId) && [monthlyPriceId, yearlyPriceId].includes(priceId);
}
