"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowLeft, Check, Crown, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { FREE_CATEGORY_LIMIT, FREE_SITE_LIMIT, freeSubscriptionProfile, type SubscriptionProfile } from "@/lib/plans";
import { supabase } from "@/lib/supabase";
import { isNativeApp } from "@/lib/native-app";
import { getPricingCopy, type PricingLanguage } from "@/lib/pricing-copy";

type PriceOption = {
  id: string;
  period: string;
  price: string;
  note: string;
  highlight?: boolean;
};

function subscribeToPricingLanguage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function getStoredPricingLanguage(): PricingLanguage {
  if (typeof window === "undefined") return "en";
  const languageInUrl = new URLSearchParams(window.location.search).get("lang");
  if (languageInUrl === "en" || languageInUrl === "bg") return languageInUrl;
  try {
    return window.localStorage.getItem("webvault-language") === "bg" ? "bg" : "en";
  } catch {
    return "en";
  }
}

function getServerPricingLanguage(): PricingLanguage {
  return "en";
}

function profileFromRow(row: Record<string, unknown> | null): SubscriptionProfile {
  if (!row) return freeSubscriptionProfile;
  return {
    isPro: row.is_pro === true,
    stripeCustomerId: typeof row.stripe_customer_id === "string" ? row.stripe_customer_id : null,
    stripeSubscriptionId: typeof row.stripe_subscription_id === "string" ? row.stripe_subscription_id : null,
    subscriptionStatus: typeof row.stripe_subscription_status === "string" ? row.stripe_subscription_status : null,
  };
}

export function PricingClient() {
  const nativeApp = isNativeApp();
  const language = useSyncExternalStore(subscribeToPricingLanguage, getStoredPricingLanguage, getServerPricingLanguage);
  const copy = getPricingCopy(language);
  const [session, setSession] = useState<Session | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionProfile>(freeSubscriptionProfile);
  const [ready, setReady] = useState(false);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const checkoutState = useMemo(() => typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("checkout"), []);
  const publicEnvironment = typeof process === "undefined" ? undefined : process.env;
  const monthlyPriceId = publicEnvironment?.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY ?? "";
  const yearlyPriceId = publicEnvironment?.NEXT_PUBLIC_STRIPE_PRICE_YEARLY ?? "";
  const priceOptions: PriceOption[] = [
    { id: monthlyPriceId, period: copy.monthlyPlan, price: language === "en" ? "€3.99" : "3.99€", note: copy.perMonth },
    { id: yearlyPriceId, period: copy.yearlyPlan, price: language === "en" ? "€29" : "29€", note: copy.perYear, highlight: true },
  ];

  useEffect(() => {
    document.documentElement.lang = language;
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
      setError(copy.profileLoadFailed);
      setReady(true);
      return false;
    }
    const nextSubscription = profileFromRow(data as Record<string, unknown> | null);
    setSubscription(nextSubscription);
    setReady(true);
    return nextSubscription.isPro;
  }, [copy]);

  useEffect(() => {
    // Subscription state is fetched from Supabase, an external system.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshSubscription();
    const { data: listener } = supabase.auth.onAuthStateChange(() => void refreshSubscription());
    return () => listener.subscription.unsubscribe();
  }, [refreshSubscription]);

  useEffect(() => {
    if (checkoutState !== "success") {
      if (checkoutState !== "cancelled") return;
      const cancelledTimer = window.setTimeout(() => setNotice(copy.checkoutCancelled), 0);
      return () => window.clearTimeout(cancelledTimer);
    }
    let attempts = 0;
    const check = async () => {
      attempts += 1;
      const isPro = await refreshSubscription();
      if (isPro) {
        setNotice(copy.proActivated);
      } else if (attempts < 8) {
        window.setTimeout(() => void check(), 1800);
      } else {
        setNotice(copy.paymentAccepted);
      }
    };
    const startTimer = window.setTimeout(() => {
      setNotice(copy.confirmingPayment);
      void check();
    }, 0);
    return () => window.clearTimeout(startTimer);
  }, [checkoutState, copy, refreshSubscription]);

  async function startCheckout(priceId: string) {
    setError("");
    setNotice("");
    if (nativeApp) {
      setError(copy.mobileCheckoutUnavailable);
      return;
    }
    if (!session) {
      setError(copy.signInRequired);
      return;
    }
    if (!priceId) {
      setError(copy.missingStripePrice);
      return;
    }
    setBusyPlan(priceId);
    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ priceId, userId: session.user.id, language }),
      });
      const result = await response.json() as { checkoutUrl?: unknown; error?: unknown };
      if (!response.ok || typeof result.checkoutUrl !== "string") {
        throw new Error(typeof result.error === "string" ? result.error : copy.checkoutFailed);
      }
      window.location.assign(result.checkoutUrl);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : copy.checkoutFailed);
      setBusyPlan(null);
    }
  }

  async function openPortal() {
    if (nativeApp) {
      setError(copy.portalUnavailable);
      return;
    }
    if (!session || !subscription.stripeCustomerId) return;
    setError("");
    setBusyPlan("portal");
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ customerId: subscription.stripeCustomerId, userId: session.user.id, language }),
      });
      const result = await response.json() as { portalUrl?: unknown; error?: unknown };
      if (!response.ok || typeof result.portalUrl !== "string") {
        throw new Error(typeof result.error === "string" ? result.error : copy.portalFailed);
      }
      window.location.assign(result.portalUrl);
    } catch (portalError) {
      setError(portalError instanceof Error ? portalError.message : copy.portalFailed);
      setBusyPlan(null);
    }
  }

  return (
    <main className="pricing-page" lang={language}>
      <div className="ambient one" /><div className="ambient two" />
      <header className="pricing-header"><Link className="brand" href="/"><span className="brand-mark"><i /><i /><i /><i /></span><span><strong>WebVault</strong><small>{copy.brandTagline}</small></span></Link><Link className="pricing-back" href="/"><ArrowLeft size={16} />{copy.backToDashboard}</Link></header>
      <section className="pricing-hero">
        <span className="pricing-eyebrow"><Sparkles size={15} /> {copy.eyebrow}</span>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </section>
      {nativeApp && <p className="pricing-notice">{copy.nativeNotice}</p>}
      {notice && <p className="pricing-notice">{notice}</p>}
      {error && <p className="pricing-error">{error}</p>}
      {subscription.isPro && <section className="pricing-active-pro"><span><Crown size={19} /> {copy.proActive}</span><p>{nativeApp ? copy.nativeProDescription : copy.stripeProDescription}</p>{!nativeApp && <button className="add-button" onClick={() => void openPortal()} disabled={busyPlan === "portal"}>{busyPlan === "portal" ? <LoaderCircle size={17} className="spin" /> : <ShieldCheck size={17} />}{copy.manageSubscription}</button>}</section>}
      <section className="pricing-comparison" aria-label={copy.comparisonAriaLabel}>
        <div className="pricing-column pricing-feature-column"><div className="pricing-column-heading"><span>{copy.feature}</span></div><div>{copy.sites}</div><div>{copy.categories}</div><div>{copy.devices}</div><div>{copy.deviceSync}</div><div>{copy.backup}</div><div>{copy.customIcons}</div><div>{copy.pwaInstall}</div><div>{copy.prioritySupport}</div></div>
        <div className="pricing-column"><div className="pricing-column-heading"><strong>{copy.freePlan}</strong><small>{language === "en" ? "€0" : "0€"}</small></div><div>{copy.upTo} {FREE_SITE_LIMIT}</div><div>{copy.upTo} {FREE_CATEGORY_LIMIT}</div><div>1</div><div>—</div><div><Check size={16} /> {copy.withinLimit}</div><div>—</div><div>—</div><div>—</div></div>
        <div className="pricing-column pricing-pro-column"><div className="pricing-column-heading"><strong><Crown size={15} /> {copy.proPlan}</strong><small>{copy.startingAt}</small></div><div><Check size={16} /> {copy.unlimited}</div><div><Check size={16} /> {copy.unlimited}</div><div><Check size={16} /> {copy.unlimited}</div><div><Check size={16} /></div><div><Check size={16} /> {copy.unlimited}</div><div><Check size={16} /></div><div><Check size={16} /></div><div><Check size={16} /></div></div>
      </section>
      <section className="pricing-options">
        {priceOptions.map((option) => <article key={option.period} className={`pricing-option ${option.highlight ? "featured" : ""}`}><span>{option.highlight ? copy.bestValue : copy.flexible}</span><h2>{option.period}</h2><strong>{option.price}</strong><small>{option.note}</small><button className={option.highlight ? "add-button" : "category-button"} onClick={() => void startCheckout(option.id)} disabled={!ready || subscription.isPro || Boolean(busyPlan) || nativeApp}>{busyPlan === option.id ? <LoaderCircle size={18} className="spin" /> : <Crown size={17} />}{nativeApp ? copy.mobileComingSoon : subscription.isPro ? copy.proAlreadyActive : !session ? copy.signInToActivate : copy.choosePlan}</button></article>)}
      </section>
      <p className="pricing-footer-note">{copy.paymentFooter}</p>
    </main>
  );
}
