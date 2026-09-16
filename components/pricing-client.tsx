"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowLeft, Check, Crown, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { FREE_CATEGORY_LIMIT, FREE_SITE_LIMIT, freeSubscriptionProfile, type SubscriptionProfile } from "@/lib/plans";
import { supabase } from "@/lib/supabase";
import { isNativeApp } from "@/lib/native-app";

type PriceOption = {
  id: string;
  period: string;
  price: string;
  note: string;
  highlight?: boolean;
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

export function PricingClient() {
  const nativeApp = isNativeApp();
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
    { id: monthlyPriceId, period: "Месечен план", price: "3.99€", note: "на месец" },
    { id: yearlyPriceId, period: "Годишен план", price: "29€", note: "на година · спестяваш 18.88€", highlight: true },
  ];

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
      setError("Не успяхме да заредим статуса на абонамента. Обнови страницата и опитай отново.");
      setReady(true);
      return false;
    }
    const nextSubscription = profileFromRow(data as Record<string, unknown> | null);
    setSubscription(nextSubscription);
    setReady(true);
    return nextSubscription.isPro;
  }, []);

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
      const cancelledTimer = window.setTimeout(() => setNotice("Плащането беше отменено. Можеш да избереш план, когато си готов."), 0);
      return () => window.clearTimeout(cancelledTimer);
    }
    let attempts = 0;
    const check = async () => {
      attempts += 1;
      const isPro = await refreshSubscription();
      if (isPro) {
        setNotice("PRO е активиран. Всички premium функции са отключени.");
      } else if (attempts < 8) {
        window.setTimeout(() => void check(), 1800);
      } else {
        setNotice("Плащането е прието. Ако PRO още не се вижда, обнови след няколко секунди.");
      }
    };
    const startTimer = window.setTimeout(() => {
      setNotice("Потвърждаваме плащането ти и активираме PRO…");
      void check();
    }, 0);
    return () => window.clearTimeout(startTimer);
  }, [checkoutState, refreshSubscription]);

  async function startCheckout(priceId: string) {
    setError("");
    setNotice("");
    if (nativeApp) {
      setError("Абонаментът в мобилното приложение ще бъде добавен с native in-app billing. До тогава PRO статусът ти се синхронизира автоматично, ако вече имаш активен план.");
      return;
    }
    if (!session) {
      setError("Влез в WebVault, за да активираш PRO.");
      return;
    }
    if (!priceId) {
      setError("Липсва Stripe price ID. Провери NEXT_PUBLIC_STRIPE_PRICE_MONTHLY и NEXT_PUBLIC_STRIPE_PRICE_YEARLY.");
      return;
    }
    setBusyPlan(priceId);
    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ priceId, userId: session.user.id }),
      });
      const result = await response.json() as { checkoutUrl?: unknown; error?: unknown };
      if (!response.ok || typeof result.checkoutUrl !== "string") {
        throw new Error(typeof result.error === "string" ? result.error : "Unable to start checkout.");
      }
      window.location.assign(result.checkoutUrl);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Не успяхме да отворим Stripe Checkout.");
      setBusyPlan(null);
    }
  }

  async function openPortal() {
    if (nativeApp) {
      setError("Управлението на абонаментите ще бъде добавено с native in-app billing.");
      return;
    }
    if (!session || !subscription.stripeCustomerId) return;
    setError("");
    setBusyPlan("portal");
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ customerId: subscription.stripeCustomerId, userId: session.user.id }),
      });
      const result = await response.json() as { portalUrl?: unknown; error?: unknown };
      if (!response.ok || typeof result.portalUrl !== "string") {
        throw new Error(typeof result.error === "string" ? result.error : "Unable to open billing portal.");
      }
      window.location.assign(result.portalUrl);
    } catch (portalError) {
      setError(portalError instanceof Error ? portalError.message : "Не успяхме да отворим Customer Portal.");
      setBusyPlan(null);
    }
  }

  return (
    <main className="pricing-page">
      <div className="ambient one" /><div className="ambient two" />
      <header className="pricing-header"><Link className="brand" href="/"><span className="brand-mark"><i /><i /><i /><i /></span><span><strong>WebVault</strong><small>Всичко важно на едно място</small></span></Link><Link className="pricing-back" href="/"><ArrowLeft size={16} />Към таблото</Link></header>
      <section className="pricing-hero">
        <span className="pricing-eyebrow"><Sparkles size={15} /> ПЛАНОВЕ ЗА WEBVAULT</span>
        <h1>Повече място. Пълен контрол.</h1>
        <p>Започни безплатно, а когато WebVault стане твоето ежедневие — отключи PRO.</p>
      </section>
      {nativeApp && <p className="pricing-notice">В тази iOS версия покупките не се извършват през външен Stripe Checkout. PRO статусът от вече активен план се показва и синхронизира нормално.</p>}
      {notice && <p className="pricing-notice">{notice}</p>}
      {error && <p className="pricing-error">{error}</p>}
      {subscription.isPro && <section className="pricing-active-pro"><span><Crown size={19} /> PRO е активен</span><p>{nativeApp ? "Абонаментът ти е синхронизиран с WebVault. Управлението от приложението ще бъде добавено с native in-app billing." : "Управлявай начина на плащане, фактурите или отказа от абонамента в Stripe Customer Portal."}</p>{!nativeApp && <button className="add-button" onClick={() => void openPortal()} disabled={busyPlan === "portal"}>{busyPlan === "portal" ? <LoaderCircle size={17} className="spin" /> : <ShieldCheck size={17} />}Управлявай абонамента</button>}</section>}
      <section className="pricing-comparison" aria-label="Сравнение на планове">
        <div className="pricing-column pricing-feature-column"><div className="pricing-column-heading"><span>Функция</span></div><div>Сайтове</div><div>Категории</div><div>Устройства</div><div>Sync между устройства</div><div>Backup / Export / Import</div><div>Custom иконки и цветове</div><div>PWA инсталация</div><div>Приоритетна поддръжка</div></div>
        <div className="pricing-column"><div className="pricing-column-heading"><strong>FREE</strong><small>0€</small></div><div>До {FREE_SITE_LIMIT}</div><div>До {FREE_CATEGORY_LIMIT}</div><div>1</div><div>—</div><div><Check size={16} /> До лимита</div><div>—</div><div>—</div><div>—</div></div>
        <div className="pricing-column pricing-pro-column"><div className="pricing-column-heading"><strong><Crown size={15} /> PRO</strong><small>от 3.99€</small></div><div><Check size={16} /> Неограничено</div><div><Check size={16} /> Неограничено</div><div><Check size={16} /> Неограничено</div><div><Check size={16} /></div><div><Check size={16} /> Неограничено</div><div><Check size={16} /></div><div><Check size={16} /></div><div><Check size={16} /></div></div>
      </section>
      <section className="pricing-options">
        {priceOptions.map((option) => <article key={option.period} className={`pricing-option ${option.highlight ? "featured" : ""}`}><span>{option.highlight ? "НАЙ-ДОБРА СТОЙНОСТ" : "FLEXIBLE"}</span><h2>{option.period}</h2><strong>{option.price}</strong><small>{option.note}</small><button className={option.highlight ? "add-button" : "category-button"} onClick={() => void startCheckout(option.id)} disabled={!ready || subscription.isPro || Boolean(busyPlan) || nativeApp}>{busyPlan === option.id ? <LoaderCircle size={18} className="spin" /> : <Crown size={17} />}{nativeApp ? "Скоро в приложението" : subscription.isPro ? "PRO е активен" : !session ? "Влез, за да активираш" : "Избери план"}</button></article>)}
      </section>
      <p className="pricing-footer-note">Плащането се обработва сигурно от Stripe. Можеш да управляваш или откажеш абонамента по всяко време от Customer Portal.</p>
    </main>
  );
}
