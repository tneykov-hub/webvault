import { NextResponse } from "next/server";
import { authenticateStripeRequest } from "@/lib/server-auth";
import { getStripe, isConfiguredStripePrice } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { priceId?: unknown; userId?: unknown; language?: unknown };
    const auth = await authenticateStripeRequest(request, body.userId);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const priceId = typeof body.priceId === "string" ? body.priceId.trim() : "";
    const language = body.language === "bg" ? "bg" : "en";
    if (!isConfiguredStripePrice(priceId)) {
      return NextResponse.json({ error: "Invalid subscription plan." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("is_pro,stripe_customer_id")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (profile?.is_pro) {
      return NextResponse.json({ error: "Your WebVault PRO subscription is already active." }, { status: 409 });
    }

    const stripe = getStripe();
    let customerId = typeof profile?.stripe_customer_id === "string" ? profile.stripe_customer_id : null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: auth.user.email ?? undefined,
        metadata: { supabase_user_id: auth.user.id, product: "webvault" },
      });
      customerId = customer.id;
      const { error } = await admin
        .from("profiles")
        .upsert({ id: auth.user.id, stripe_customer_id: customerId }, { onConflict: "id" });
      if (error) throw error;
    }

    const origin = new URL(request.url).origin;
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: auth.user.id,
      integration_identifier: `webvault_pro_${Math.random().toString(36).slice(2, 10)}`,
      line_items: [{ price: priceId, quantity: 1 }],
      locale: language,
      managed_payments: { enabled: false },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      customer_update: { address: "auto", name: "auto" },
      metadata: { supabase_user_id: auth.user.id, product: "webvault_pro", language },
      subscription_data: { metadata: { supabase_user_id: auth.user.id, product: "webvault_pro", language } },
      success_url: `${origin}/pricing?checkout=success&lang=${language}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?checkout=cancelled&lang=${language}`,
    });
    if (!checkout.url) throw new Error("Stripe did not return a checkout URL.");

    return NextResponse.json({ checkoutUrl: checkout.url });
  } catch (error) {
    console.error("WebVault checkout error", error);
    return NextResponse.json({ error: "Unable to start checkout. Please try again." }, { status: 500 });
  }
}
