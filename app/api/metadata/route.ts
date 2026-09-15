import { NextResponse } from "next/server";

const requestTimeoutMs = 7000;

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

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host === "::1") return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  const private172 = host.match(/^172\.(\d+)\./);
  if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return true;
  return false;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: unknown };
    const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol) || isBlockedHost(parsed.hostname)) {
      return NextResponse.json({ error: "Unsupported URL" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    let response: Response;
    try {
      response = await fetch(parsed.href, {
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "WebVault metadata preview/1.0",
        },
        redirect: "follow",
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) throw new Error(`Metadata request failed with ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("xhtml")) {
      return NextResponse.json({
        title: parsed.hostname.replace(/^www\./i, ""),
        description: "",
        faviconUrl: `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(parsed.origin)}`,
      });
    }

    const html = (await response.text()).slice(0, 2_000_000);
    const title = metaContent(html, "og:title") || pageTitle(html) || parsed.hostname.replace(/^www\./i, "");
    const description = metaContent(html, "og:description") || metaContent(html, "description");
    const faviconUrl = `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(parsed.origin)}`;

    return NextResponse.json({
      title: title.slice(0, 120),
      description: description.slice(0, 500),
      faviconUrl,
    });
  } catch {
    return NextResponse.json({ error: "Metadata unavailable" }, { status: 502 });
  }
}
