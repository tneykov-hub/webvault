import { NextResponse } from "next/server";
import { nativeCorsHeaders } from "@/lib/native-api";
import { authenticateStripeRequest } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

type Source = { title: string; url: string };
type SearchResult = { answer: string; sources: Source[] };

const rateLimitWindowMs = 60_000;
const rateLimitMaxRequests = 8;
const rateLimitState = globalThis as typeof globalThis & {
  __webvaultAISearchUsage?: Map<string, { start: number; count: number }>;
};
const usageByUser = rateLimitState.__webvaultAISearchUsage ??= new Map();

function json(request: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: nativeCorsHeaders(request) });
}

function addSource(sources: Map<string, Source>, title: unknown, rawUrl: unknown) {
  if (typeof rawUrl !== "string") return;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return;
    sources.set(url.href, {
      title: typeof title === "string" && title.trim() ? title.trim().slice(0, 180) : url.hostname,
      url: url.href,
    });
  } catch {
    // Ignore malformed source URLs returned by a provider.
  }
}

function extractOpenAIResult(payload: unknown): SearchResult {
  if (!payload || typeof payload !== "object") return { answer: "", sources: [] };
  const response = payload as { output?: unknown; output_text?: unknown };
  const answerParts: string[] = [];
  const sources = new Map<string, Source>();
  if (Array.isArray(response.output)) {
    for (const item of response.output) {
      if (!item || typeof item !== "object" || (item as { type?: unknown }).type !== "message") continue;
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (!part || typeof part !== "object") continue;
        const block = part as { type?: unknown; text?: unknown; annotations?: unknown };
        if (block.type !== "output_text") continue;
        if (typeof block.text === "string") answerParts.push(block.text);
        if (Array.isArray(block.annotations)) {
          for (const annotation of block.annotations) {
            if (!annotation || typeof annotation !== "object") continue;
            const citation = annotation as { type?: unknown; title?: unknown; url?: unknown };
            if (citation.type === "url_citation") addSource(sources, citation.title, citation.url);
          }
        }
      }
    }
  }
  const answer = answerParts.join("\n\n").trim() || (typeof response.output_text === "string" ? response.output_text.trim() : "");
  return { answer, sources: [...sources.values()].slice(0, 8) };
}

async function searchWithOpenAI(query: string, language: "bg" | "en"): Promise<SearchResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("provider_not_configured");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      tools: [{ type: "web_search" }],
      input: [
        { role: "system", content: [{ type: "input_text", text: language === "bg" ? "Отговори на български. Използвай търсене в интернет за актуални факти. Напиши ясен, кратък отговор и включи източниците чрез цитирането на уеб търсенето." : "Answer in English. Use web search for current facts. Give a clear, concise answer and cite sources from web search." }] },
        { role: "user", content: [{ type: "input_text", text: query }] },
      ],
      max_output_tokens: 700,
      store: false,
    }),
    signal: AbortSignal.timeout(26_000),
  });
  if (!response.ok) {
    console.error("WebVault OpenAI search failed", response.status);
    throw new Error("provider_request_failed");
  }
  return extractOpenAIResult(await response.json());
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: nativeCorsHeaders(request) });
}

export async function POST(request: Request) {
  const auth = await authenticateStripeRequest(request);
  if ("error" in auth) {
    const code = auth.status === 401 ? "session_expired" : "request_failed";
    return json(request, { code }, auth.status);
  }

  if (Number(request.headers.get("content-length") ?? 0) > 2_000) return json(request, { code: "invalid_request" }, 413);
  let body: { provider?: unknown; query?: unknown; language?: unknown };
  try {
    const parsedBody: unknown = await request.json();
    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
      return json(request, { code: "invalid_request" }, 400);
    }
    body = parsedBody as { provider?: unknown; query?: unknown; language?: unknown };
  } catch {
    return json(request, { code: "invalid_request" }, 400);
  }
  const provider = body.provider;
  const query = typeof body.query === "string" ? body.query.trim() : "";
  const language = body.language === "bg" ? "bg" : "en";
  if ((provider !== undefined && provider !== "chatgpt") || query.length < 2 || query.length > 400) {
    return json(request, { code: "invalid_request" }, 400);
  }

  // Read the server-managed entitlement on every request. Browser state,
  // request bodies and user-editable auth metadata cannot grant AI access.
  try {
    const { data: profile, error } = await getSupabaseAdmin()
      .from("profiles")
      .select("is_pro")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (error) return json(request, { code: "subscription_check_failed" }, 503);
    if (profile?.is_pro !== true) return json(request, { code: "pro_required" }, 403);
  } catch {
    return json(request, { code: "subscription_check_failed" }, 503);
  }

  const now = Date.now();
  const limit = usageByUser.get(auth.user.id);
  if (limit && now - limit.start < rateLimitWindowMs && limit.count >= rateLimitMaxRequests) {
    return json(request, { code: "rate_limited" }, 429);
  }
  if (!limit || now - limit.start >= rateLimitWindowMs) usageByUser.set(auth.user.id, { start: now, count: 1 });
  else usageByUser.set(auth.user.id, { ...limit, count: limit.count + 1 });
  if (usageByUser.size > 5_000) {
    for (const [userId, entry] of usageByUser) if (now - entry.start >= rateLimitWindowMs) usageByUser.delete(userId);
  }

  try {
    const result = await searchWithOpenAI(query, language);
    if (!result.answer) return json(request, { code: "provider_request_failed" }, 502);
    return json(request, result);
  } catch (error) {
    if (error instanceof Error && error.message === "provider_not_configured") {
      return json(request, { code: "provider_not_configured" }, 503);
    }
    return json(request, { code: "provider_request_failed" }, 502);
  }
}
