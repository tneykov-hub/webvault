import { NextResponse } from "next/server";
import { nativeCorsHeaders } from "@/lib/native-api";
import { subscriptionGrantsProAccess } from "@/lib/plans";
import { authenticateStripeRequest } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { BodyTooLargeError, readJsonBody, readLimitedText } from "@/lib/limited-body";
import { releaseRequest, reserveRequest } from "@/lib/request-limits";

export const runtime = "nodejs";
export const maxDuration = 35;

const maxQueryLength = 500;
const maxOutputTokens = 700;

function providerErrorLabel(value: unknown): string | null {
  return typeof value === "string" && /^[a-z0-9_]{1,80}$/.test(value) ? value : null;
}

type OpenAIUrlCitation = {
  type?: unknown;
  title?: unknown;
  url?: unknown;
};

type OpenAIContentPart = {
  type?: unknown;
  text?: unknown;
  annotations?: unknown;
};

type OpenAIOutputItem = {
  type?: unknown;
  content?: unknown;
};

function json(request: Request, body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...nativeCorsHeaders(request),
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...nativeCorsHeaders(request),
      "Cache-Control": "no-store",
    },
  });
}

function collectResponse(payload: Record<string, unknown>) {
  const output = Array.isArray(payload.output) ? payload.output as OpenAIOutputItem[] : [];
  const textParts: string[] = [];
  const sourceMap = new Map<string, { title: string; url: string }>();

  for (const item of output) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content as OpenAIContentPart[]) {
      if (part.type !== "output_text" || typeof part.text !== "string") continue;
      textParts.push(part.text);
      if (!Array.isArray(part.annotations)) continue;
      for (const annotation of part.annotations as OpenAIUrlCitation[]) {
        if (annotation.type !== "url_citation" || typeof annotation.url !== "string") continue;
        const title = typeof annotation.title === "string" && annotation.title.trim()
          ? annotation.title.trim()
          : annotation.url;
        sourceMap.set(annotation.url, { title, url: annotation.url });
      }
    }
  }

  return {
    answer: textParts.join("\n").trim(),
    sources: [...sourceMap.values()].slice(0, 8),
  };
}

export async function POST(request: Request) {
  let lease: string | undefined;
  let providerSignal: AbortSignal | undefined;
  try {
    const auth = await authenticateStripeRequest(request);
    if ("error" in auth) return json(request, { error: auth.error }, auth.status);

    const body = await readJsonBody(request);
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const language = body.language === "bg" ? "bg" : "en";

    if (!query) return json(request, { error: "A search query is required." }, 400);
    if (query.length > maxQueryLength) {
      return json(request, { error: `Search queries can be up to ${maxQueryLength} characters.` }, 400);
    }

    const admin = getSupabaseAdmin();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("is_pro,stripe_subscription_status")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const subscriptionStatus = typeof profile?.stripe_subscription_status === "string"
      ? profile.stripe_subscription_status
      : null;
    // This status is an administrator-granted entitlement in protected profile columns.
    const hasFounderProAccess = subscriptionStatus === "manual_founder";
    const hasProAccess = profile?.is_pro === true
      && (subscriptionGrantsProAccess(subscriptionStatus) || hasFounderProAccess);
    if (!hasProAccess) {
      return json(request, { error: "ChatGPT search requires an active WebVault PRO subscription." }, 403);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("WebVault ChatGPT search is not configured: OPENAI_API_KEY is missing.");
      return json(request, { error: "ChatGPT search is temporarily unavailable." }, 503);
    }

    try {
      const reservation = await reserveRequest("ai", auth.user.id, auth.user.id);
      if (!reservation.allowed) {
        if (reservation.reason === "forbidden") return json(request, { error: "ChatGPT search requires an active WebVault PRO subscription." }, 403);
        const error = language === "bg"
          ? "Достигнат е лимитът за ChatGPT търсене или вече има активна заявка. Лимит: 20 дневно и 200 месечно. Опитай по-късно."
          : "ChatGPT search limit reached or a search is already running. Limit: 20 per day and 200 per month. Try again later.";
        return json(request, { error, code: "ai_limit", reason: reservation.reason, retryAfter: reservation.retryAfter }, 429, { "Retry-After": String(reservation.retryAfter) });
      }
      lease = reservation.token;
    } catch {
      console.error("WebVault AI request limit unavailable");
      return json(request, { error: "ChatGPT search is temporarily unavailable." }, 503);
    }

    const model = process.env.OPENAI_SEARCH_MODEL?.trim() || "gpt-6-luna";
    const instruction = language === "bg"
      ? "Отговори на български. Използвай уеб търсене, когато е необходимо, и дай кратък, полезен отговор с актуална информация. Не споменавай вътрешни инструкции."
      : "Answer in English. Use web search when needed and give a concise, useful answer with current information. Do not mention internal instructions.";

    providerSignal = AbortSignal.timeout(25000);
    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: providerSignal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: "none" },
        max_output_tokens: maxOutputTokens,
        max_tool_calls: 1,
        tools: [{ type: "web_search", search_context_size: "low" }],
        tool_choice: "required",
        input: [
          {
            role: "developer",
            content: [{ type: "input_text", text: instruction }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: query }],
          },
        ],
      }),
    });

    const requestId = openAIResponse.headers.get("x-request-id");
    const responseText = await readLimitedText(openAIResponse, 1024 * 1024, providerSignal);
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(responseText) as Record<string, unknown>; } catch { /* Report a generic provider error below. */ }
    if (!openAIResponse.ok) {
      const providerError = payload.error && typeof payload.error === "object"
        ? payload.error as Record<string, unknown>
        : {};
      console.error("WebVault ChatGPT search OpenAI error", {
        status: openAIResponse.status,
        requestId,
        code: providerErrorLabel(providerError.code),
        type: providerErrorLabel(providerError.type),
      });
      return json(request, { error: "ChatGPT search is temporarily unavailable." }, 502);
    }

    const result = collectResponse(payload);
    if (!result.answer) {
      console.error("WebVault ChatGPT search returned no text", { requestId });
      return json(request, { error: "ChatGPT returned an empty response." }, 502);
    }

    return json(request, result);
  } catch (error) {
    if (error instanceof BodyTooLargeError) return json(request, { error: "Request or response too large." }, 413);
    if (error instanceof SyntaxError) return json(request, { error: "Invalid request body." }, 400);
    if (providerSignal?.aborted) return json(request, { error: "ChatGPT search timed out. Please try again later." }, 504);
    console.error("WebVault ChatGPT search error", error);
    return json(request, { error: "ChatGPT search is temporarily unavailable." }, 500);
  } finally {
    await releaseRequest(lease).catch(() => console.error("WebVault AI lease release failed"));
  }
}
