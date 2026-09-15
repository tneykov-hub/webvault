import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { subscriptionGrantsProAccess } from "@/lib/plans";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { notifyOwner } from "@/lib/owner-notifications";

export const runtime = "nodejs";

function stripeId(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") return value.id;
  return null;
}

function metadataUserId(metadata: Stripe.Metadata | null | undefined) {
  const userId = metadata?.supabase_user_id;
  return typeof userId === "string" && userId ? userId : null;
}

async function findProfileUserId(customerId: string | null, subscriptionId: string | null) {
  const admin = getSupabaseAdmin();
  if (subscriptionId) {
    const { data, error } = await admin.from("profiles").select("id").eq("stripe_subscription_id", subscriptionId).maybeSingle();
    if (error) throw error;
    if (typeof data?.id === "string") return data.id;
  }
  if (customerId) {
    const { data, error } = await admin.from("profiles").select("id").eq("stripe_customer_id", customerId).maybeSingle();
    if (error) throw error;
    if (typeof data?.id === "string") return data.id;
  }
  return null;
}

async function syncSubscription(subscription: Stripe.Subscription, fallbackUserId: string | null = null) {
  const customerId = stripeId(subscription.customer);
  const userId = metadataUserId(subscription.metadata) ?? fallbackUserId ?? await findProfileUserId(customerId, subscription.id);
  if (!userId) throw new Error("Unable to resolve the WebVault user for this Stripe subscription.");

  const priceId = subscription.items.data[0]?.price.id ?? null;
  const { error } = await getSupabaseAdmin().from("profiles").update({
    is_pro: subscriptionGrantsProAccess(subscription.status),
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_subscription_status: subscription.status,
    stripe_price_id: priceId,
    subscription_updated_at: new Date().toISOString(),
  }).eq("id", userId);
  if (error) throw error;
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
  } catch (error) {
    console.error("Invalid WebVault Stripe webhook", error);
    return NextResponse.json({ error: "Invalid Stripe webhook signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const checkout = event.data.object as Stripe.Checkout.Session;
        const customerId = stripeId(checkout.customer);
        const subscriptionId = stripeId(checkout.subscription);
        const userId = checkout.client_reference_id ?? metadataUserId(checkout.metadata) ?? await findProfileUserId(customerId, subscriptionId);
        if (!userId) throw new Error("Checkout completed without a linked WebVault user.");

        if (subscriptionId) {
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
          await syncSubscription(subscription, userId);
        } else {
          const { error } = await getSupabaseAdmin().from("profiles").update({
            is_pro: true,
            stripe_customer_id: customerId,
            subscription_updated_at: new Date().toISOString(),
          }).eq("id", userId);
          if (error) throw error;
        }

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
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerEmail = await subscriptionCustomerEmail(subscription);
        await syncSubscription(subscription);
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
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerEmail = await subscriptionCustomerEmail(subscription);
        await syncSubscription(subscription);
        await notifyOwner({
          subject: "WebVault PRO subscription canceled",
          text: [
            "A WebVault PRO subscription was canceled.",
            `Customer: ${customerEmail}`,
            `Subscription: ${subscription.id}`,
          ].join("\n"),
          idempotencyKey: `webvault-subscription-canceled-${event.id}`,
        });
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.billing_reason !== "subscription_create") {
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
  } catch (error) {
    console.error("WebVault Stripe webhook processing error", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
