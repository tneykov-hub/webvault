import { createClient, type User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type AuthenticationResult =
  | { user: User; error?: never; status?: never }
  | { user?: never; error: string; status: number };

export async function authenticateStripeRequest(request: Request, requestedUserId?: unknown, requireDeviceAccess = false): Promise<AuthenticationResult> {
  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!accessToken) return { error: "Authentication is required.", status: 401 };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return { error: "Supabase is not configured.", status: 500 };

  const client = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) return { error: "Your session has expired. Please sign in again.", status: 401 };
  if (typeof requestedUserId === "string" && requestedUserId && requestedUserId !== data.user.id) {
    return { error: "You cannot manage another user's subscription.", status: 403 };
  }
  if (requireDeviceAccess) {
    // getUser above verifies the token before any decoded claim is trusted.
    let sessionId: string;
    try {
      const claims = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"));
      if (typeof claims.session_id !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(claims.session_id)) throw new Error("Missing session");
      sessionId = claims.session_id;
    } catch { return { error: "Sign in again to verify your device.", status: 401 }; }
    const { data: allowed, error: deviceError } = await getSupabaseAdmin().rpc("check_webvault_device_access", {
      p_user_id: data.user.id, p_session_id: sessionId, p_device_secret: request.headers.get("x-webvault-device") ?? "",
    });
    if (deviceError) return { error: "Device verification is temporarily unavailable. Please try again.", status: 503 };
    if (allowed !== true) return { error: "Use your active, approved device to continue.", status: 403 };
  }
  return { user: data.user };
}
