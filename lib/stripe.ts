import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe is not configured.");
  stripeClient ??= new Stripe(secretKey, { typescript: true });
  return stripeClient;
}

export function isConfiguredStripePrice(priceId: string) {
  const allowedPrices = [
    process.env.STRIPE_PRICE_MONTHLY,
    process.env.STRIPE_PRICE_YEARLY,
  ].filter((price): price is string => Boolean(price));
  return allowedPrices.includes(priceId);
}
