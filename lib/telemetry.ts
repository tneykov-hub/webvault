import { supabase } from "@/lib/supabase";

export type WebVaultEventName =
  | "landing_view"
  | "dashboard_view"
  | "pricing_view"
  | "return_visit"
  | "auth_started"
  | "signup_completed"
  | "site_added"
  | "site_opened"
  | "checkout_started"
  | "checkout_success";

type EventProperties = Record<string, string | number | boolean | null | undefined>;
type Attribution = {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
  referrer: string;
  landingPath: string;
};

const visitorStorageKey = "webvault-analytics-visitor-id";
const sessionStorageKey = "webvault-analytics-session-id";
const attributionStorageKey = "webvault-analytics-attribution";
const lastVisitStorageKey = "webvault-analytics-last-visit";
const lastVisitSessionStorageKey = "webvault-analytics-last-visit-session";

function randomId(prefix: string) {
  const uuid = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${uuid}`.slice(0, 128);
}

function storageGet(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    // Private browsing modes can deny browser storage. Events remain optional.
  }
}

function visitorId() {
  const existing = storageGet(window.localStorage, visitorStorageKey);
  if (existing && existing.length >= 16) return existing;
  const next = randomId("visitor");
  storageSet(window.localStorage, visitorStorageKey, next);
  return next;
}

function sessionId() {
  const existing = storageGet(window.sessionStorage, sessionStorageKey);
  if (existing && existing.length >= 16) return existing;
  const next = randomId("session");
  storageSet(window.sessionStorage, sessionStorageKey, next);
  return next;
}

function limited(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function externalReferrer() {
  if (!document.referrer) return "";
  try {
    const referrer = new URL(document.referrer);
    if (referrer.origin === window.location.origin) return "";
    return `${referrer.origin}${referrer.pathname}`.slice(0, 300);
  } catch {
    return "";
  }
}

function currentAttribution(): Attribution {
  const stored = storageGet(window.localStorage, attributionStorageKey);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<Attribution>;
      if (parsed.source || parsed.referrer || parsed.campaign) {
        return {
          source: limited(parsed.source, 100),
          medium: limited(parsed.medium, 100),
          campaign: limited(parsed.campaign, 120),
          content: limited(parsed.content, 120),
          term: limited(parsed.term, 120),
          referrer: limited(parsed.referrer, 300),
          landingPath: limited(parsed.landingPath, 300) || window.location.pathname,
        };
      }
    } catch {
      // Replace invalid attribution data with the current visit.
    }
  }

  const params = new URLSearchParams(window.location.search);
  const referrer = externalReferrer();
  const source = limited(params.get("utm_source"), 100) || limited(params.get("ref"), 100) || (params.has("gclid") ? "google" : referrer ? new URL(referrer).hostname : "direct");
  const attribution: Attribution = {
    source,
    medium: limited(params.get("utm_medium"), 100) || (params.has("gclid") ? "cpc" : referrer ? "referral" : "direct"),
    campaign: limited(params.get("utm_campaign"), 120),
    content: limited(params.get("utm_content"), 120),
    term: limited(params.get("utm_term"), 120),
    referrer,
    landingPath: window.location.pathname.slice(0, 300),
  };
  storageSet(window.localStorage, attributionStorageKey, JSON.stringify(attribution));
  return attribution;
}

export function selectedWebVaultLanguage(): "en" | "bg" {
  return storageGet(window.localStorage, "webvault-language") === "bg" ? "bg" : "en";
}

function cleanProperties(properties: EventProperties) {
  return Object.fromEntries(
    Object.entries(properties)
      .slice(0, 20)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [limited(key, 60), typeof value === "string" ? limited(value, 160) : value]),
  );
}

export async function trackWebVaultEvent(eventName: WebVaultEventName, properties: EventProperties = {}) {
  if (typeof window === "undefined") return;
  try {
    const attribution = currentAttribution();
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id ?? null;
    await supabase.from("marketing_events").insert({
      event_name: eventName,
      user_id: userId,
      visitor_id: visitorId(),
      session_id: sessionId(),
      source: attribution.source,
      medium: attribution.medium,
      campaign: attribution.campaign || null,
      content: attribution.content || null,
      term: attribution.term || null,
      referrer: attribution.referrer || null,
      landing_path: attribution.landingPath,
      language: selectedWebVaultLanguage(),
      event_data: cleanProperties(properties),
    });
  } catch {
    // Product analytics must never block authentication or bookmark actions.
  }
}

export async function trackWebVaultVisit(page: "landing" | "dashboard" | "pricing", properties: EventProperties = {}) {
  if (typeof window === "undefined") return;
  const currentSessionId = sessionId();
  const pageVisitKey = `webvault-analytics-page:${page}:${currentSessionId}`;
  if (storageGet(window.sessionStorage, pageVisitKey)) return;
  storageSet(window.sessionStorage, pageVisitKey, "1");

  const previousVisit = Number(storageGet(window.localStorage, lastVisitStorageKey) ?? 0);
  const previousSessionId = storageGet(window.localStorage, lastVisitSessionStorageKey);
  const returning = previousVisit > 0 && previousSessionId !== currentSessionId;
  storageSet(window.localStorage, lastVisitStorageKey, String(Date.now()));
  storageSet(window.localStorage, lastVisitSessionStorageKey, currentSessionId);
  await trackWebVaultEvent(`${page}_view` as WebVaultEventName, { ...properties, returning });
  if (returning) await trackWebVaultEvent("return_visit", { page });
}
