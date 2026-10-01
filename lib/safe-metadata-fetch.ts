import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpRequest, type IncomingMessage, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";

export class UnsafeMetadataUrlError extends Error {}
export const metadataMaxBytes = 512 * 1024;

export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99)))
      || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
      || (a === 203 && b === 0 && c === 113));
  }
  if (family !== 6) return false;
  // Allow global unicast only. This excludes loopback, link-local, ULA,
  // IPv4-mapped, NAT64, multicast and other transition/special-purpose ranges.
  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  const parts = canonical.split(":");
  const first = parseInt(parts[0] || "0", 16);
  const second = parseInt(parts[1] || "0", 16);
  return first >= 0x2000 && first <= 0x3fff
    && !(first === 0x2001 && (second < 0x200 || second === 0xdb8))
    && first !== 0x2002 && !(first === 0x3fff && second < 0x1000);
}

export function parseMetadataUrl(raw: string) {
  if (!raw || raw.length > 2048) throw new UnsafeMetadataUrlError("Unsupported URL");
  let url: URL;
  try { url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`); }
  catch { throw new UnsafeMetadataUrlError("Unsupported URL"); }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port
    || !host || /(^|\.)(localhost|local|internal|lan|home|invalid|test|onion)$/.test(host)
    || (!isIP(host) && !host.includes(".")) || (isIP(host) && !isPublicAddress(host))) {
    throw new UnsafeMetadataUrlError("Unsupported URL");
  }
  url.hash = "";
  return url;
}

async function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let abort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
  });
  try { return await Promise.race([promise, aborted]); }
  finally { signal.removeEventListener("abort", abort); }
}

async function requestPublicUrl(url: URL, signal: AbortSignal): Promise<IncomingMessage> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const family = isIP(hostname);
  const addresses = family ? [{ address: hostname, family }] : await abortable(lookup(hostname, { all: true, verbatim: true }), signal);
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new UnsafeMetadataUrlError("Unsupported URL");
  }
  const pinned = addresses.find(({ family: candidate }) => candidate === 4) ?? addresses[0];
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
    const options: RequestOptions & { autoSelectFamily: boolean } = {
      agent: false, signal, family: pinned.family, autoSelectFamily: false, maxHeaderSize: 16384,
      headers: { Accept: "text/html,application/xhtml+xml", "Accept-Encoding": "identity", "User-Agent": "WebVault metadata preview/1.0" },
      // The socket uses only the already validated IP. The original URL's
      // hostname is retained for Host, TLS SNI and certificate verification.
      lookup: (_host, _options, callback) => callback(null, pinned.address, pinned.family),
    };
    const req = transport(url, options, resolve);
    req.on("error", reject);
    req.end();
  });
}

export async function fetchSafeMetadata(url: URL) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Metadata timeout")), 7000);
  let response: IncomingMessage | undefined;
  try {
    let current = url;
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      response = await requestPublicUrl(current, controller.signal);
      if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
        const location = response.headers.location;
        response.destroy();
        if (!location || redirects === 3) throw new UnsafeMetadataUrlError("Unsupported redirect");
        current = parseMetadataUrl(new URL(location, current).href);
        continue;
      }
      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) throw new Error("Metadata unavailable");
      const type = response.headers["content-type"]?.split(";", 1)[0].trim().toLowerCase();
      if (type !== "text/html" && type !== "application/xhtml+xml") return "";
      const encoding = response.headers["content-encoding"]?.toLowerCase();
      if (encoding && encoding !== "identity") throw new Error("Unsupported metadata encoding");
      if (Number(response.headers["content-length"]) > metadataMaxBytes) throw new Error("Metadata too large");
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of response) {
        controller.signal.throwIfAborted();
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.length;
        if (size > metadataMaxBytes) throw new Error("Metadata too large");
        chunks.push(bytes);
      }
      controller.signal.throwIfAborted();
      return Buffer.concat(chunks, size).toString("utf8");
    }
    throw new Error("Metadata unavailable");
  } finally {
    response?.destroy();
    clearTimeout(timer);
  }
}
