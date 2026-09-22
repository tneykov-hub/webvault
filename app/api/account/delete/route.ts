import { NextResponse } from "next/server";
import { nativeCorsHeaders } from "@/lib/native-api";
import { authenticateStripeRequest } from "@/lib/server-auth";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const iconBucket = "site-icons";
const storagePageSize = 1000;

function json(request: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: nativeCorsHeaders(request) });
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: nativeCorsHeaders(request) });
}

function shouldCancelSubscription(status: string | null) {
  return status !== "canceled" && status !== "incomplete_expired";
}

async function deleteUserSiteIcons(userId: string) {
  const storage = getSupabaseAdmin().storage.from(iconBucket);
  let offset = 0;

  while (true) {
    const { data: objects, error: listError } = await storage.list(userId, {
      limit: storagePageSize,
      offset,
    });
    if (listError) throw listError;

    const objectPaths = (objects ?? [])
      .filter((object) => Boolean(object.id))
      .map((object) => `${userId}/${object.name}`);
    if (objectPaths.length) {
      const { error: removeError } = await storage.remove(objectPaths);
      if (removeError) throw removeError;
    }

    if ((objects?.length ?? 0) < storagePageSize) return;
    offset += objects?.length ?? 0;
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateStripeRequest(request);
    if ("error" in auth) return json(request, { error: auth.error }, auth.status);

    const admin = getSupabaseAdmin();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("stripe_subscription_id,stripe_subscription_status")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const subscriptionId = typeof profile?.stripe_subscription_id === "string" ? profile.stripe_subscription_id : null;
    const subscriptionStatus = typeof profile?.stripe_subscription_status === "string" ? profile.stripe_subscription_status : null;
    if (subscriptionId && shouldCancelSubscription(subscriptionStatus)) {
      await getStripe().subscriptions.cancel(subscriptionId);
    }

    // Supabase Auth refuses to delete a user who still owns Storage objects.
    // The existing schema cascades the user's relational WebVault data on Auth deletion.
    await deleteUserSiteIcons(auth.user.id);

    const { error: deleteError } = await admin.auth.admin.deleteUser(auth.user.id);
    if (deleteError) throw deleteError;

    return json(request, { deleted: true });
  } catch (error) {
    console.error("WebVault account deletion error", error);
    return json(request, { error: "Unable to delete the account. Please try again or contact WebVault support." }, 500);
  }
}
