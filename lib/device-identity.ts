// An installation secret is deliberately separate from the Supabase session.
// The database stores its digest, never this reusable bearer secret.
const storageKey = "webvault-installation-secret-v1";

export function getDeviceSecret(): string {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(storageKey);
  if (existing && /^[a-f0-9]{64}$/.test(existing)) return existing;
  const bytes = window.crypto.getRandomValues(new Uint8Array(32));
  const secret = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  // If storage is unavailable, fail visibly instead of inventing a weak ID.
  window.localStorage.setItem(storageKey, secret);
  return secret;
}

export function deviceRequestHeaders(): Record<string, string> {
  const secret = getDeviceSecret();
  return secret ? { "X-WebVault-Device": secret } : {};
}

export function deviceLabel(): string {
  if (typeof navigator === "undefined") return "Web browser";
  const agent = navigator.userAgent;
  const platform = /Android/i.test(agent) ? "Android" : /iPhone|iPad/i.test(agent) ? "iPhone / iPad" : /Windows/i.test(agent) ? "Windows" : /Macintosh/i.test(agent) ? "Mac" : "Browser";
  const browser = /Edg\//.test(agent) ? "Edge" : /Firefox\//.test(agent) ? "Firefox" : /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : "WebVault";
  return `${platform} · ${browser}`;
}
