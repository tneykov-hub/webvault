export class BodyTooLargeError extends Error {}

export async function readLimitedText(source: Request | Response, maxBytes: number, signal: AbortSignal = AbortSignal.timeout(3000)) {
  const declared = source.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) {
    void source.body?.cancel().catch(() => undefined);
    throw new BodyTooLargeError("Response too large");
  }
  if (!source.body) return "";
  const reader = source.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  const abort = () => { void reader.cancel(signal.reason).catch(() => undefined); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    for (;;) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > maxBytes) throw new BodyTooLargeError("Response too large");
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    signal.removeEventListener("abort", abort);
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function readJsonBody(request: Request, maxBytes = 8192): Promise<Record<string, unknown>> {
  const data: unknown = JSON.parse(await readLimitedText(request, maxBytes));
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new SyntaxError("Invalid JSON object");
  return data as Record<string, unknown>;
}
