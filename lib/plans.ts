export const FREE_SITE_LIMIT = 30;
export const FREE_CATEGORY_LIMIT = 3;

export type SubscriptionProfile = {
  isPro: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
};

export const freeSubscriptionProfile: SubscriptionProfile = {
  isPro: false,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  subscriptionStatus: null,
};

export function subscriptionGrantsProAccess(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}
