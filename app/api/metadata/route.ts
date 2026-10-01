import { NextResponse } from "next/server";
import { nativeCorsHeaders } from "@/lib/native-api";
import { BodyTooLargeError, readJsonBody } from "@/lib/limited-body";
import { metadataRequestSubject, releaseRequest, reserveRequest } from "@/lib/request-limits";
import { fetchSafeMetadata, parseMetadataUrl, UnsafeMetadataUrlError } from "@/lib/safe-metadata-fetch";

export const runtime = "nodejs";

function decodeHtml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, key: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=[\\\"']${escapedKey}[\\\"'][^>]+content=[\\\"']([^\\\"']*)[\\\"'][^>]*>|<meta[^>]+content=[\\\"']([^\\\"']*)[\\\"'][^>]+(?:property|name)=[\\\"']${escapedKey}[\\\"'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  return decodeHtml(match?.[1] ?? match?.[2] ?? "");
}

function pageTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return decodeHtml(match?.[1] ?? "");
}

function json(request: Request, body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...nativeCorsHeaders(request), "Cache-Control": "no-store", ...headers } });
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: nativeCorsHeaders(request) });
}

export async function POST(request: Request) {
  let lease: string | undefined;
  try {
    const body = await readJsonBody(request, 4096);
    const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
    const parsed = parseMetadataUrl(rawUrl);
    try {
      const reservation = await reserveRequest("metadata", metadataRequestSubject(request));
      if (!reservation.allowed) return json(request, { error: "Too many metadata requests." }, 429, { "Retry-After": String(reservation.retryAfter) });
      lease = reservation.token;
    } catch {
      return json(request, { error: "Metadata unavailable" }, 503);
    }
    const html = await fetchSafeMetadata(parsed);
    const title = metaContent(html, "og:title") || pageTitle(html) || parsed.hostname.replace(/^www\./i, "");
    const description = metaContent(html, "og:description") || metaContent(html, "description");
    const faviconUrl = `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(parsed.origin)}`;

    return json(request, {
      title: title.slice(0, 120),
      description: description.slice(0, 500),
      faviconUrl,
    });
  } catch (error) {
    if (error instanceof UnsafeMetadataUrlError || error instanceof SyntaxError) return json(request, { error: "Unsupported URL" }, 400);
    if (error instanceof BodyTooLargeError) return json(request, { error: "Request too large" }, 413);
    return json(request, { error: "Metadata unavailable" }, 502);
  } finally {
    await releaseRequest(lease).catch(() => console.error("WebVault metadata lease release failed"));
  }
}
