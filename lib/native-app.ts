import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { Keyboard, KeyboardResize } from "@capacitor/keyboard";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { supabase } from "@/lib/supabase";

export const WEBVAULT_WEB_ORIGIN = "https://webvault.site";
export const WEBVAULT_NATIVE_AUTH_CALLBACK = "webvault://auth/callback";
export const NATIVE_AUTH_URL_EVENT = "webvault:native-auth-url";

let didInitialise = false;

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function webVaultApiUrl(path: string) {
  if (!path.startsWith("/")) throw new Error("WebVault API paths must start with '/'.");
  return isNativeApp() ? `${WEBVAULT_WEB_ORIGIN}${path}` : path;
}

export function webVaultAuthRedirectUrl() {
  if (isNativeApp()) return WEBVAULT_NATIVE_AUTH_CALLBACK;
  return typeof window === "undefined" ? undefined : window.location.origin;
}

export function consumeNativeAuthUrl() {
  if (typeof window === "undefined") return "";
  try {
    const value = window.sessionStorage.getItem(NATIVE_AUTH_URL_EVENT) ?? "";
    window.sessionStorage.removeItem(NATIVE_AUTH_URL_EVENT);
    return value;
  } catch {
    return "";
  }
}

function isWebVaultAuthUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "webvault:" && url.hostname === "auth" && url.pathname === "/callback";
  } catch {
    return false;
  }
}

function announceNativeAuthUrl(url: string) {
  try {
    window.sessionStorage.setItem(NATIVE_AUTH_URL_EVENT, url);
  } catch {
    // The auth flow can still continue when private storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(NATIVE_AUTH_URL_EVENT, { detail: { url } }));
}

async function completeNativeAuth(url: string) {
  if (!isWebVaultAuthUrl(url)) return;
  announceNativeAuthUrl(url);

  const parsed = new URL(url);
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");

  if (accessToken && refreshToken && supabase) {
    await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    return;
  }

  const code = parsed.searchParams.get("code");
  if (code && supabase) await supabase.auth.exchangeCodeForSession(code);
}

export async function initialiseNativeApp() {
  if (!isNativeApp() || didInitialise) return;
  didInitialise = true;
  document.documentElement.dataset.webvaultPlatform = Capacitor.getPlatform();

  await App.addListener("appUrlOpen", ({ url }) => {
    void completeNativeAuth(url).catch(() => undefined);
  });

  const launchUrl = await App.getLaunchUrl();
  if (launchUrl?.url) void completeNativeAuth(launchUrl.url).catch(() => undefined);

  await Promise.allSettled([
    StatusBar.setOverlaysWebView({ overlay: false }),
    StatusBar.setStyle({ style: Style.Dark }),
    Keyboard.setResizeMode({ mode: KeyboardResize.Native }),
    SplashScreen.hide(),
  ]);
}

export async function openInNativeBrowser(url: string) {
  if (!isNativeApp()) return false;
  await Browser.open({ url, presentationStyle: "fullscreen" });
  return true;
}
