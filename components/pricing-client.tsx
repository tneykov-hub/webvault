"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowLeft, Check, Crown, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { FREE_CATEGORY_LIMIT, FREE_SITE_LIMIT, freeSubscriptionProfile, type SubscriptionProfile } from "@/lib/plans";
import { supabase } from "@/lib/supabase";
import { trackWebVaultEvent, trackWebVaultVisit } from "@/lib/telemetry";

type PricingLanguage = "en" | "bg";

type PriceOption = {
  id: string;
  period: string;
  price: string;
  note: string;
  highlight?: boolean;
};

const pricingCopy: Record<PricingLanguage, {
  tagline: string;
  back: string;
  language: string;
  eyebrow: string;
  title: string;
  intro: string;
  active: string;
  activeDescription: string;
  manage: string;
  feature: string;
  sites: string;
  categories: string;
  devices: string;
  sync: string;
  backup: string;
  customisation: string;
  pwa: string;
  support: string;
  free: string;
  pro: string;
  unlimited: string;
  included: string;
  monthly: string;
  monthlyPrice: string;
  monthlyNote: string;
  yearly: string;
  yearlyPrice: string;
  yearlyNote: string;
  bestValue: string;
  flexible: string;
  signInToActivate: string;
  choosePlan: string;
  proActive: string;
  footer: string;
  checkoutError: string;
  missingPrice: string;
  portalError: string;
  cancelled: string;
  confirming: string;
  activated: string;
  accepted: string;
}> = {
  en: {
    tagline: "Everything important in one place",
    back: "Back to dashboard",
    language: "Language",
    eyebrow: "WEBVAULT PLANS",
    title: "More room. Full control.",
    intro: "Start free, then unlock PRO when WebVault becomes part of your everyday workflow.",
    active: "PRO is active",
    activeDescription: "Manage payment details, invoices, or cancellation in the Stripe Customer Portal.",
    manage: "Manage subscription",
    feature: "Feature",
    sites: "Sites",
    categories: "Categories",
    devices: "Devices",
    sync: "Sync across devices",
    backup: "Backup / Export / Import",
    customisation: "Custom icons and colours",
    pwa: "PWA installation",
    support: "Priority support",
    free: "FREE",
    pro: "PRO",
    unlimited: "Unlimited",
    included: "Included",
    monthly: "Monthly plan",
    monthlyPrice: "€3.99",
    monthlyNote: "per month",
    yearly: "Yearly plan",
    yearlyPrice: "€29",
    yearlyNote: "per year · save €18.88",
    bestValue: "BEST VALUE",
    flexible: "FLEXIBLE",
    signInToActivate: "Sign in to activate",
    choosePlan: "Choose plan",
    proActive: "PRO is active",
    footer: "Payments are processed securely by Stripe. You can manage or cancel your subscription at any time from the Customer Portal.",
    checkoutError: "We could not open Stripe Checkout. Please try again.",
    missingPrice: "This plan is not configured yet. Please try again later.",
    portalError: "We could not open the billing portal. Please try again.",
    cancelled: "Payment was cancelled. You can choose a plan whenever you are ready.",
    confirming: "Confirming your payment and activating PRO…",
    activated: "PRO is active. All premium features are unlocked.",
    accepted: "Payment was accepted. If PRO is not visible yet, refresh in a few seconds.",
  },
  bg: {
    tagline: "Всичко важно на едно място",
    back: "Към таблото",
    language: "Език",
    eyebrow: "ПЛАНОВЕ ЗА WEBVAULT",
    title: "Повече място. Пълен контрол.",
    intro: "Започни безплатно, а когато WebVault стане част от ежедневието ти — отключи PRO.",
    active: "PRO е активен",
    activeDescription: "Управлявай плащанията, фактурите или отказа от абонамента в Stripe Customer Portal.",
    manage: "Управлявай абонамента",
    feature: "Функция",
    sites: "Сайтове",
    categories: "Категории",
    devices: "Устройства",
    sync: "Синхронизация между устройства",
    backup: "Backup / Export / Import",
    customisation: "Собствени икони и цветове",
    pwa: "PWA инсталация",
    support: "Приоритетна поддръжка",
    free: "FREE",
    pro: "PRO",
    unlimited: "Неограничено",
    included: "Включено",
    monthly: "Месечен план",
    monthlyPrice: "3,99 €",
    monthlyNote: "на месец",
    yearly: "Годишен план",
    yearlyPrice: "29 €",
    yearlyNote: "на година · спестяваш 18,88 €",
    bestValue: "НАЙ-ДОБРА СТОЙНОСТ",
    flexible: "ГЪВКАВ ПЛАН",
    signInToActivate: "Влез, за да активираш",
    choosePlan: "Избери план",
    proActive: "PRO е активен",
    footer: "Плащането се обработва сигурно от Stripe. Можеш да управляваш или откажеш абонамента по всяко време от Customer Portal.",
    checkoutError: "Не успяхме да отворим Stripe Checkout. Опитай отново.",
    missingPrice: "Този план още не е настроен. Опитай отново по-късно.",
    portalError: "Не успяхме да отворим портала за плащане. Опитай отново.",
    cancelled: "Плащането беше отменено. Можеш да избереш план, когато си готов.",
    confirming: "Потвърждаваме плащането ти и активираме PRO…",
    activated: "PRO е активиран. Всички premium функции са отключени.",
    accepted: "Плащането е прието. Ако PRO още не се вижда, обнови след няколко секунди.",
  },
};

function profileFromRow(row: Record<string, unknown> | null): SubscriptionProfile {
  if (!row) return freeSubscriptionProfile;
  return {
    isPro: row.is_pro === true,
    stripeCustomerId: typeof row.stripe_customer_id === "string" ? row.stripe_customer_id : null,
    stripeSubscriptionId: typeof row.stripe_subscription_id === "string" ? row.stripe_subscription_id : null,
    subscriptionStatus: typeof row.stripe_subscription_status === "string" ? row.stripe_subscription_status : null,
  };
}

function languageFromValue(value: string | null): PricingLanguage | null {
  return value === "bg" || value === "en" ? value : null;
}

export function PricingClient() {
  const [language, setLanguage] = useState<PricingLanguage>("en");
  const [session, setSession] = useState<Session | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionProfile>(freeSubscriptionProfile);
  const [ready, setReady] = useState(false);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const checkoutTracked = useRef(false);
  const checkoutState = useMemo(() => typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("checkout"), []);
  const requestedLanguage = useMemo(() => typeof window === "undefined" ? null : languageFromValue(new URLSearchParams(window.location.search).get("lang")), []);
  const copy = pricingCopy[language];
  const monthlyPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY ?? "";
  const yearlyPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY ?? "";
  const priceOptions: PriceOption[] = [
    { id: monthlyPriceId, period: copy.monthly, price: copy.monthlyPrice, note: copy.monthlyNote },
    { id: yearlyPriceId, period: copy.yearly, price: copy.yearlyPrice, note: copy.yearlyNote, highlight: true },
  ];

  useEffect(() => {
    const storedLanguage = typeof window === "undefined" ? null : languageFromValue(window.localStorage.getItem("webvault-language"));
    const nextLanguage = requestedLanguage ?? storedLanguage ?? "en";
    // The selected language is hydrated from browser storage after the initial server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLanguage(nextLanguage);
    if (requestedLanguage) window.localStorage.setItem("webvault-language", requestedLanguage);
  }, [requestedLanguage]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === "bg" ? "WebVault PRO | Планове" : "WebVault PRO | Plans and pricing";
  }, [language]);

  const refreshSubscription = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    setSession(sessionData.session);
    if (!sessionData.session) {
      setSubscription(freeSubscriptionProfile);
      setReady(true);
      return false;
    }
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("is_pro,stripe_customer_id,stripe_subscription_id,stripe_subscription_status")
      .eq("id", sessionData.session.user.id)
      .maybeSingle();
    if (profileError) {
      setError(copy.portalError);
      setReady(true);
      return false;
    }
    const nextSubscription = profileFromRow(data as Record<string, unknown> | null);
    setSubscription(nextSubscription);
    setReady(true);
    return nextSubscription.isPro;
  }, [copy.portalError]);

  useEffect(() => {
    // Subscription state is synchronized with Supabase after the initial render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshSubscription();
    const { data: listener } = supabase.auth.onAuthStateChange(() => void refreshSubscription());
    return () => listener.subscription.unsubscribe();
  }, [refreshSubscription]);

  useEffect(() => {
    void trackWebVaultVisit("pricing");
  }, []);

  useEffect(() => {
    if (checkoutState !== "success") {
      // Checkout status is synchronized from the return URL after the initial render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (checkoutState === "cancelled") setNotice(copy.cancelled);
      return;
    }
    if (!checkoutTracked.current) {
      checkoutTracked.current = true;
      void trackWebVaultEvent("checkout_success");
    }
    let attempts = 0;
    const check = async () => {
      attempts += 1;
      const isPro = await refreshSubscription();
      if (isPro) {
        setNotice(copy.activated);
      } else if (attempts < 8) {
        window.setTimeout(() => void check(), 1800);
      } else {
        setNotice(copy.accepted);
      }
    };
    const startTimer = window.setTimeout(() => {
      setNotice(copy.confirming);
      void check();
    }, 0);
    return () => window.clearTimeout(startTimer);
  }, [checkoutState, copy, refreshSubscription]);

  async function startCheckout(priceId: string) {
    setError("");
    setNotice("");
    if (!session) {
      setError(copy.signInToActivate);
      return;
    }
    if (!priceId) {
      setError(copy.missingPrice);
      return;
    }
    setBusyPlan(priceId);
    void trackWebVaultEvent("checkout_started", { plan: priceId === monthlyPriceId ? "monthly" : "yearly" });
    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ priceId, userId: session.user.id, language }),
      });
      const result = await response.json() as { checkoutUrl?: unknown };
      if (!response.ok || typeof result.checkoutUrl !== "string") throw new Error(copy.checkoutError);
      window.location.assign(result.checkoutUrl);
    } catch {
      setError(copy.checkoutError);
      setBusyPlan(null);
    }
  }

  async function openPortal() {
    if (!session || !subscription.stripeCustomerId) return;
    setError("");
    setBusyPlan("portal");
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ customerId: subscription.stripeCustomerId, userId: session.user.id, language }),
      });
      const result = await response.json() as { portalUrl?: unknown };
      if (!response.ok || typeof result.portalUrl !== "string") throw new Error(copy.portalError);
      window.location.assign(result.portalUrl);
    } catch {
      setError(copy.portalError);
      setBusyPlan(null);
    }
  }

  return (
    <main className="pricing-page">
      <div className="ambient one" /><div className="ambient two" />
      <header className="pricing-header">
        <Link className="brand" href={`/?lang=${language}`}><span className="brand-mark"><i /><i /><i /><i /></span><span><strong>WebVault</strong><small>{copy.tagline}</small></span></Link>
        <div className="pricing-header-actions">
          <div className="pricing-language" aria-label={copy.language}><button type="button" className={language === "en" ? "active" : ""} onClick={() => { setLanguage("en"); window.localStorage.setItem("webvault-language", "en"); }}>EN</button><button type="button" className={language === "bg" ? "active" : ""} onClick={() => { setLanguage("bg"); window.localStorage.setItem("webvault-language", "bg"); }}>BG</button></div>
          <Link className="pricing-back" href={`/?lang=${language}`}><ArrowLeft size={16} />{copy.back}</Link>
        </div>
      </header>
      <section className="pricing-hero"><span className="pricing-eyebrow"><Sparkles size={15} /> {copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.intro}</p></section>
      {notice && <p className="pricing-notice">{notice}</p>}
      {error && <p className="pricing-error">{error}</p>}
      {subscription.isPro && <section className="pricing-active-pro"><span><Crown size={19} /> {copy.active}</span><p>{copy.activeDescription}</p><button className="add-button" onClick={() => void openPortal()} disabled={busyPlan === "portal"}>{busyPlan === "portal" ? <LoaderCircle size={17} className="spin" /> : <ShieldCheck size={17} />}{copy.manage}</button></section>}
      <section className="pricing-comparison" aria-label={copy.feature}>
        <div className="pricing-column pricing-feature-column"><div className="pricing-column-heading"><span>{copy.feature}</span></div><div>{copy.sites}</div><div>{copy.categories}</div><div>{copy.devices}</div><div>{copy.sync}</div><div>{copy.backup}</div><div>{copy.customisation}</div><div>{copy.pwa}</div><div>{copy.support}</div></div>
        <div className="pricing-column"><div className="pricing-column-heading"><strong>{copy.free}</strong><small>0€</small></div><div>{FREE_SITE_LIMIT}</div><div>{FREE_CATEGORY_LIMIT}</div><div>1</div><div>—</div><div><Check size={16} /> {copy.included}</div><div>—</div><div>—</div><div>—</div></div>
        <div className="pricing-column pricing-pro-column"><div className="pricing-column-heading"><strong><Crown size={15} /> {copy.pro}</strong><small>{language === "bg" ? "от 3,99 €" : "from €3.99"}</small></div><div><Check size={16} /> {copy.unlimited}</div><div><Check size={16} /> {copy.unlimited}</div><div><Check size={16} /> {copy.unlimited}</div><div><Check size={16} /></div><div><Check size={16} /> {copy.unlimited}</div><div><Check size={16} /></div><div><Check size={16} /></div><div><Check size={16} /></div></div>
      </section>
      <section className="pricing-options">{priceOptions.map((option) => <article key={option.period} className={`pricing-option ${option.highlight ? "featured" : ""}`}><span>{option.highlight ? copy.bestValue : copy.flexible}</span><h2>{option.period}</h2><strong>{option.price}</strong><small>{option.note}</small><button className={option.highlight ? "add-button" : "category-button"} onClick={() => void startCheckout(option.id)} disabled={!ready || subscription.isPro || Boolean(busyPlan)}>{busyPlan === option.id ? <LoaderCircle size={18} className="spin" /> : <Crown size={17} />}{subscription.isPro ? copy.proActive : !session ? copy.signInToActivate : copy.choosePlan}</button></article>)}</section>
      <p className="pricing-footer-note">{copy.footer}</p>
    </main>
  );
}
