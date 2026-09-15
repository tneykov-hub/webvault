import { createClient, type User } from "@supabase/supabase-js";

type AuthenticationResult =
  | { user: User; error?: never; status?: never }
  | { user?: never; error: string; status: number };

export async function authenticateStripeRequest(request: Request, requestedUserId?: unknown): Promise<AuthenticationResult> {
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
  return { user: data.user };
}
