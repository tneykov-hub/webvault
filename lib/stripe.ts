import Stripe from "stripe";
import { stripePriceIds } from "@/lib/stripe-prices";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe is not configured.");
  stripeClient ??= new Stripe(secretKey, { typescript: true, timeout: 10000, maxNetworkRetries: 1 });
  return stripeClient;
}

export function getConfiguredStripePrices() {
  return { ...stripePriceIds };
}

export function isConfiguredStripePrice(priceId: string) {
  const { monthlyPriceId, yearlyPriceId } = getConfiguredStripePrices();
  return priceId === monthlyPriceId || priceId === yearlyPriceId;
}
