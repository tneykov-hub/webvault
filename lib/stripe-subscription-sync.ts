import type Stripe from "stripe";
import { subscriptionGrantsProAccess } from "@/lib/plans";
import { getStripe, isConfiguredStripePrice } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export function stripeId(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") return value.id;
  return null;
}

function isWebVaultSubscription(subscription: Stripe.Subscription) {
  return subscription.metadata.product === "webvault_pro"
    || subscription.items.data.some(({ price }) => isConfiguredStripePrice(price.id));
}

export async function resolveStripeUser(customerId: string, subscriptionId: string, fallbackUserId: string | null) {
  const admin = getSupabaseAdmin();
  for (const [column, value] of [["stripe_customer_id", customerId], ["stripe_subscription_id", subscriptionId]]) {
    const { data, error } = await admin.from("profiles").select("id").eq(column, value).maybeSingle();
    if (error) throw error;
    if (typeof data?.id === "string") return data.id;
  }
  return fallbackUserId;
}

export async function syncStripeSubscription(eventId: string, userId: string, customerId: string, subscriptionId: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("claim_webvault_stripe_event", { p_event_id: eventId, p_user_id: userId });
  if (error) throw error;
  const claim = data && typeof data === "object" ? data as Record<string, unknown> : {};
  if (claim.state === "founder" || claim.state === "duplicate") return null;
  if (claim.state !== "acquired" || typeof claim.token !== "string") throw new Error("Subscription synchronization is busy");
  const token = claim.token;
  try {
    const stripe = getStripe();
    // Fetch canonical state after acquiring the per-profile lease. Event
    // payloads and event.created are never used as entitlement state.
    const current = await stripe.subscriptions.retrieve(subscriptionId);
    if (stripeId(current.customer) !== customerId || !isWebVaultSubscription(current)) throw new Error("Unrelated subscription");
    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
    if (subscriptions.has_more) throw new Error("Subscription reconciliation requires pagination");
    const candidates = subscriptions.data.filter(isWebVaultSubscription);
    if (!candidates.some(({ id }) => id === current.id)) candidates.push(current);
    for (const candidate of candidates) {
      const linkedUser = candidate.metadata.supabase_user_id;
      if (linkedUser && linkedUser !== userId) throw new Error("Subscription owner mismatch");
    }
    // An old cancellation cannot revoke a newer active subscription. Among
    // eligible subscriptions prefer the most recently created one.
    candidates.sort((a, b) => Number(subscriptionGrantsProAccess(b.status)) - Number(subscriptionGrantsProAccess(a.status)) || b.created - a.created || b.id.localeCompare(a.id));
    const subscription = candidates[0];
    const { data: applied, error: writeError } = await admin.rpc("finish_webvault_stripe_event", {
      p_event_id: eventId, p_user_id: userId, p_token: token, p_customer_id: customerId,
      p_subscription_id: subscription.id, p_status: subscription.status,
      p_price_id: subscription.items.data[0]?.price.id ?? null,
    });
    if (writeError) throw writeError;
    return applied === "applied" ? subscription : null;
  } finally {
    const { error: releaseError } = await admin.rpc("release_webvault_stripe_event", { p_user_id: userId, p_token: token });
    if (releaseError) console.error("WebVault subscription lease release failed");
  }
}
