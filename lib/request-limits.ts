import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type RequestReservation = {
  allowed: boolean;
  token?: string;
  reason?: string;
  retryAfter: number;
};

export async function reserveRequest(scope: "ai" | "metadata", subject: string, userId: string | null = null): Promise<RequestReservation> {
  const { data, error } = await getSupabaseAdmin().rpc("reserve_webvault_request", {
    p_scope: scope, p_subject: subject, p_user_id: userId,
  });
  if (error) throw error;
  if (!data || typeof data !== "object") throw new Error("Invalid request reservation response");
  const result = data as Record<string, unknown>;
  if (typeof result.allowed !== "boolean" || (result.allowed && typeof result.token !== "string")) {
    throw new Error("Invalid request reservation response");
  }
  return {
    allowed: result.allowed,
    token: typeof result.token === "string" ? result.token : undefined,
    reason: typeof result.reason === "string" ? result.reason : undefined,
    retryAfter: typeof result.retry_after === "number" ? Math.max(1, Math.ceil(result.retry_after)) : 1,
  };
}

export async function releaseRequest(token: string | undefined) {
  if (!token) return;
  const { error } = await getSupabaseAdmin().rpc("release_webvault_request", { p_token: token });
  if (error) console.error("WebVault request lease release failed");
}

export function metadataRequestSubject(request: Request) {
  // Vercel overwrites these headers at its trusted ingress. Never trust
  // user-supplied forwarding headers when running elsewhere.
  if (process.env.VERCEL !== "1") return "shared";
  const raw = (request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "").trim();
  if (!isIP(raw)) return "shared";
  const ip = raw.includes(":") ? new URL(`http://[${raw}]/`).hostname : raw;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Request limits are not configured");
  // Only a keyed digest is stored; raw client IPs are not recorded.
  return createHmac("sha256", secret).update(`webvault-metadata:${ip}`).digest("hex");
}
