import { NextResponse } from "next/server";
import { authenticateStripeRequest } from "@/lib/server-auth";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { customerId?: unknown; userId?: unknown; language?: unknown };
    const auth = await authenticateStripeRequest(request, body.userId);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const admin = getSupabaseAdmin();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    const customerId = typeof profile?.stripe_customer_id === "string" ? profile.stripe_customer_id : null;
    if (!customerId) return NextResponse.json({ error: "No Stripe customer was found for this account." }, { status: 404 });
    if (typeof body.customerId === "string" && body.customerId && body.customerId !== customerId) {
      return NextResponse.json({ error: "You cannot manage another user's billing portal." }, { status: 403 });
    }

    const language = body.language === "bg" ? "bg" : "en";
    const portal = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      locale: language,
      return_url: `${new URL(request.url).origin}/pricing?lang=${language}`,
    });
    return NextResponse.json({ portalUrl: portal.url });
  } catch (error) {
    console.error("WebVault billing portal error", error);
    return NextResponse.json({ error: "Unable to open the billing portal. Please try again." }, { status: 500 });
  }
}
