import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { resolveStripeUser, stripeId, syncStripeSubscription } from "@/lib/stripe-subscription-sync";
import { notifyOwner } from "@/lib/owner-notifications";

export const runtime = "nodejs";

function metadataUserId(metadata: Stripe.Metadata | null | undefined) {
  const userId = metadata?.supabase_user_id;
  return typeof userId === "string" && userId ? userId : null;
}

async function reconcile(eventId: string, customerId: string | null, subscriptionId: string | null, fallbackUserId: string | null) {
  if (!customerId || !subscriptionId) return null;
  const userId = await resolveStripeUser(customerId, subscriptionId, fallbackUserId);
  if (!userId) throw new Error("Unable to resolve subscription profile");
  return syncStripeSubscription(eventId, userId, customerId, subscriptionId);
}

function money(amount: number | null | undefined, currency: string | null | undefined) {
  if (typeof amount !== "number" || !currency) return "Not available";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);
}

async function subscriptionCustomerEmail(subscription: Stripe.Subscription) {
  const customerId = stripeId(subscription.customer);
  if (!customerId) return "Not available";
  const customer = await getStripe().customers.retrieve(customerId);
  return !customer.deleted && customer.email ? customer.email : "Not available";
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing Stripe webhook signature or secret." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    console.error("Invalid WebVault Stripe webhook signature");
    return NextResponse.json({ error: "Invalid Stripe webhook signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const checkout = event.data.object as Stripe.Checkout.Session;
        const customerId = stripeId(checkout.customer);
        const subscriptionId = stripeId(checkout.subscription);
        if (checkout.mode !== "subscription" || !subscriptionId
          || !["paid", "no_payment_required"].includes(checkout.payment_status)) break;
        const current = await reconcile(event.id, customerId, subscriptionId, checkout.client_reference_id ?? metadataUserId(checkout.metadata));
        if (!current) break;

        await notifyOwner({
          subject: "New WebVault PRO subscription",
          text: [
            "A customer has started a WebVault PRO subscription.",
            `Customer: ${checkout.customer_details?.email ?? "Not available"}`,
            `Amount: ${money(checkout.amount_total, checkout.currency)}`,
            `Stripe customer: ${customerId ?? "Not available"}`,
            `Subscription: ${subscriptionId ?? "Not available"}`,
          ].join("\n"),
          idempotencyKey: `webvault-checkout-${event.id}`,
        });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const snapshot = event.data.object as Stripe.Subscription;
        const subscription = await reconcile(event.id, stripeId(snapshot.customer), snapshot.id, metadataUserId(snapshot.metadata));
        if (!subscription) break;
        const customerEmail = await subscriptionCustomerEmail(subscription);
        await notifyOwner({
          subject: `WebVault PRO subscription updated: ${subscription.status}`,
          text: [
            "A WebVault PRO subscription was updated.",
            `Customer: ${customerEmail}`,
            `Status: ${subscription.status}`,
            `Subscription: ${subscription.id}`,
          ].join("\n"),
          idempotencyKey: `webvault-subscription-update-${event.id}`,
        });
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = stripeId(invoice.parent?.subscription_details?.subscription);
        if (!subscriptionId) break;
        const current = await reconcile(event.id, stripeId(invoice.customer), subscriptionId, null);
        if (!current) break;
        if (event.type === "invoice.paid" && invoice.billing_reason !== "subscription_create") {
          await notifyOwner({
            subject: "WebVault PRO subscription payment received",
            text: [
              "A recurring WebVault PRO subscription payment was received.",
              `Customer: ${invoice.customer_email ?? "Not available"}`,
              `Amount: ${money(invoice.amount_paid, invoice.currency)}`,
              `Invoice: ${invoice.id}`,
              `Subscription: ${stripeId(invoice.parent?.subscription_details?.subscription) ?? "Not available"}`,
            ].join("\n"),
            idempotencyKey: `webvault-invoice-paid-${event.id}`,
          });
        }
        break;
      }
      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch {
    console.error("WebVault Stripe webhook processing error");
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
