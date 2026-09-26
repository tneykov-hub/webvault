"use client";

import type { FormEvent, ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowRight, Check, LoaderCircle, LockKeyhole, LogIn, Mail, Play, Search, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import Link from "next/link";
import { supabase, supabaseConfigurationError } from "@/lib/supabase";
import { consumeNativeAuthUrl, NATIVE_AUTH_URL_EVENT, webVaultAuthRedirectUrl } from "@/lib/native-app";

type AuthContextValue = {
  session: Session;
  signOut: () => Promise<void>;
};

type AuthLanguage = "en" | "bg";

const googlePlayListingUrl = "https://play.google.com/store/apps/details?id=site.webvault.app";

const authEnglishCopy: Record<string, string> = {
  "Всичко важно на едно място": "Everything important in one place",
  Език: "Language",
  "Проверяваме сигурния ти вход…": "Checking your secure sign-in…",
  "Не успяхме да регистрираме това устройство.": "We could not register this device.",
  "Безплатният план е активен на друго устройство. Стани PRO, за да използваш WebVault навсякъде.": "Your FREE plan is active on another device. Go PRO to use WebVault everywhere.",
  Възстановяване: "Recovery",
  "Забравена парола?": "Forgot your password?",
  "Ще изпратим защитен линк на имейла ти.": "We will send a secure link to your email.",
  Имейл: "Email",
  "Изпрати линк": "Send link",
  "Назад към вход": "Back to sign in",
  "Личен достъп": "Private access",
  "Влез в WebVault": "Sign in to WebVault",
  "Създай личен достъп": "Create your account",
  "Сайтовете и категориите ти са достъпни само след вход.": "Your sites and categories are available after you sign in.",
  "Създай профил с имейл и парола. Данните ти ще останат само твои.": "Create an account with your email and password. Your data stays yours.",
  Име: "Name",
  "Въведи твоето име": "Enter your name",
  Парола: "Password",
  "Минимум 8 символа": "At least 8 characters",
  Вход: "Sign in",
  "Създай профил": "Create account",
  "Изпрати нов линк за потвърждение": "Send a new confirmation link",
  "Нямаш профил? Създай го": "No account? Create one",
  "Вече имаш профил? Влез": "Already have an account? Sign in",
  "Въведи имейла, с който се регистрира.": "Enter the email you used to register.",
  "Изпратихме нов линк. Използвай само последния имейл и го отвори веднага.": "We sent a new link. Use only the latest email and open it right away.",
  "Въведи имейл адреса на профила си.": "Enter your account email address.",
  "Не успяхме да изпратим имейла. Опитай отново.": "We could not send the email. Please try again.",
  "Изпратихме линк за промяна на паролата. Провери имейла си.": "We sent a password-reset link. Check your email.",
  "Въведи валиден имейл адрес.": "Enter a valid email address.",
  "Въведи име от поне 2 символа.": "Enter a name with at least 2 characters.",
  "Паролата трябва да е поне 8 символа.": "Your password must be at least 8 characters.",
  "Адресът за потвърждение не е разрешен в Supabase. Добави адреса на сайта в Auth → URL Configuration.": "This confirmation address is not allowed in Supabase. Add the site address in Auth → URL Configuration.",
  "Провери имейла си и използвай най-новия линк за потвърждение. Линковете са еднократни и изтичат.": "Check your email and use the newest confirmation link. Links can be used once and expire.",
  "Неправилен имейл или парола.": "Incorrect email or password.",
  "Потвърди имейла си, преди да влезеш.": "Confirm your email before signing in.",
  "Този имейл вече има профил. Влез или изпрати нов линк за потвърждение.": "This email already has an account. Sign in or send a new confirmation link.",
  "Твърде много изпратени имейли. Изчакай малко и опитай отново.": "Too many emails were sent. Please wait a little and try again.",
  "Нова парола": "New password",
  "Създай нова парола": "Create a new password",
  "Паролата е променена успешно. Вече можеш да използваш WebVault.": "Your password was changed. You can now use WebVault.",
  "Избери нова парола за сигурен достъп.": "Choose a new password for secure access.",
  "Повтори паролата": "Repeat password",
  "Паролите не съвпадат.": "Passwords do not match.",
  "Не успяхме да променим паролата.": "We could not change your password.",
  "Запази новата парола": "Save new password",
  Продължи: "Continue",
  "План и устройства": "Plan and devices",
  "Нужно е WebVault PRO": "WebVault PRO is required",
  "Стани PRO": "Go PRO",
  Изход: "Sign out",
  "Входът е успешен": "Sign-in successful",
  "Още една стъпка": "One more step",
  "Базата данни още не е подготвена за WebVault. Изпълни SQL схемата в Supabase и опитай отново.": "The database is not ready for WebVault yet. Apply the Supabase SQL schema and try again.",
  "Провери отново": "Check again",
  Подготовка: "Setup",
  "Връзката се настройва": "Connection is being configured",
  "Supabase връзката още не е налична. Обнови страницата след малко.": "The Supabase connection is not available yet. Refresh the page shortly.",
  "Линкът за потвърждение е изтекъл или вече е използван. Отвори регистрацията и изпрати нов линк.": "The confirmation link has expired or has already been used. Open registration and send a new link.",
  "Линкът за потвърждение не можа да бъде обработен. Изпрати нов линк и опитай отново.": "The confirmation link could not be processed. Send a new link and try again.",
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AuthLanguageContext = createContext<{
  language: AuthLanguage;
  setLanguage: (language: AuthLanguage) => void;
  t: (value: string) => string;
}>({ language: "en", setLanguage: () => undefined, t: (value) => value });

function useAuthLanguage() {
  return useContext(AuthLanguageContext);
}

function AuthLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AuthLanguage>(() => {
    if (typeof window === "undefined") return "en";
    return window.localStorage.getItem("webvault-language") === "bg" ? "bg" : "en";
  });

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  function setLanguage(nextLanguage: AuthLanguage) {
    setLanguageState(nextLanguage);
    window.localStorage.setItem("webvault-language", nextLanguage);
  }

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (text: string) => language === "en" ? authEnglishCopy[text] ?? text : text,
  }), [language]);

  return <AuthLanguageContext.Provider value={value}>{children}</AuthLanguageContext.Provider>;
}

export function useWebVaultAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useWebVaultAuth must be used inside AuthGate");
  return value;
}

export function AuthGate({ children }: { children: ReactNode }) {
  return <AuthLanguageProvider><AuthGateContent>{children}</AuthGateContent></AuthLanguageProvider>;
}

function AuthGateContent({ children }: { children: ReactNode }) {
  const { setLanguage, t } = useAuthLanguage();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(() => !supabase);
  const [setupError, setSetupError] = useState(false);
  const [deviceLimitError, setDeviceLimitError] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authUrlError, setAuthUrlError] = useState(() => {
    if (typeof window === "undefined") return "";
    const urlError = getAuthUrlError(consumeNativeAuthUrl() || window.location.href);
    return urlError ? t(urlError) : "";
  });

  async function prepareAccount() {
    if (!supabase) return false;
    const bootstrap = await supabase.rpc("bootstrap_my_sites_account");
    if (bootstrap.error) {
      setSetupError(true);
      return false;
    }
    const deviceId = getOrCreateDeviceId();
    const device = await supabase.rpc("register_webvault_device", {
      p_device_id: deviceId,
      p_device_label: navigator.userAgent.slice(0, 120),
    });
    if (device.error) {
      const message = device.error.message || t("Не успяхме да регистрираме това устройство.");
      if (/one device|едно устройство/i.test(message)) {
        setDeviceLimitError(t("Безплатният план е активен на друго устройство. Стани PRO, за да използваш WebVault навсякъде."));
        setSetupError(false);
        return false;
      }
      setSetupError(true);
      return false;
    }
    setDeviceLimitError("");
    setSetupError(false);
    return true;
  }

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;
    const receiveNativeAuthUrl = (event: Event) => {
      const detail = (event as CustomEvent<{ url?: unknown }>).detail;
      const rawUrl = typeof detail?.url === "string" ? detail.url : "";
      const nativeUrlError = getAuthUrlError(rawUrl);
      if (nativeUrlError) setAuthUrlError(t(nativeUrlError));
    };
    const initialise = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);
      if (data.session) await prepareAccount();
      if (active) setReady(true);
    };

    void initialise();
    window.addEventListener(NATIVE_AUTH_URL_EVENT, receiveNativeAuthUrl);
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      if (nextSession) void prepareAccount();
      else { setSetupError(false); setDeviceLimitError(""); }
    });

    return () => {
      active = false;
      window.removeEventListener(NATIVE_AUTH_URL_EVENT, receiveNativeAuthUrl);
      listener.subscription.unsubscribe();
    };
  // Authentication initializes once; the selected language is synchronized on sign-out.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authUrlError) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, [authUrlError]);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setLanguage(window.localStorage.getItem("webvault-language") === "bg" ? "bg" : "en");
    setSession(null);
    setShowAuth(false);
    setDeviceLimitError("");
  }

  const value = useMemo(() => session ? ({ session, signOut }) : null, [session]);

  if (supabaseConfigurationError) return <ConfigurationMessage />;
  if (!ready) return <AuthFrame><div className="auth-loading"><LoaderCircle size={22} className="spin" /> {t("Проверяваме сигурния ти вход…")}</div></AuthFrame>;
  if (!session && !showAuth) return <PublicLanding onStart={() => setShowAuth(true)} />;
  if (!session) return <AuthForm initialError={authUrlError} />;
  if (recoveryMode) return <PasswordRecovery onDone={() => setRecoveryMode(false)} />;
  if (deviceLimitError) return <DeviceLimitMessage message={deviceLimitError} signOut={signOut} />;
  if (setupError) return <SetupMessage retry={prepareAccount} signOut={signOut} />;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function PublicLanding({ onStart }: { onStart: () => void }) {
  const { language, setLanguage } = useAuthLanguage();
  const copy = language === "en" ? {
    tagline: "Your sites. Organized.", eyebrow: "Personal web start", titleA: "Everything important online.", titleB: "In one place.", intro: "WebVault turns scattered bookmarks into a fast, beautiful and private dashboard.", start: "Start for free", googlePlay: "Get it on Google Play", login: "Log in", private: "Your data stays private", search: "Search your sites…", dashboard: "Your dashboard", sites: "sites", football: "Football", work: "Work", news: "News", synced: "Private and secure", findTitle: "Find it instantly", findText: "Search by name, address or category as you type.", secureTitle: "Private by design", secureText: "Your own account keeps your bookmarks yours.", anywhereTitle: "Grow when you need it", anywhereText: "Free starts on one device; PRO keeps your dashboard in sync everywhere.", planLabel: "GET STARTED", planTitle: "Start for free", planText: "Up to 30 sites and 3 categories. Upgrade whenever you need more.", sync: "Up to 30 saved sites", organize: "Up to 3 categories, favourites and search", backup: "Bookmark import and export included", create: "Create your account", footer: "Private access to your sites"
  } : {
    tagline: "Твоите сайтове. Подредени.", eyebrow: "Личен уеб старт", titleA: "Всичко важно в интернет.", titleB: "На едно място.", intro: "WebVault превръща разпилените отметки в бързо, красиво и лично табло.", start: "Започни безплатно", googlePlay: "Вземи от Google Play", login: "Вход", private: "Данните ти са лични", search: "Търси в сайтовете си…", dashboard: "Твоето табло", sites: "сайта", football: "Футбол", work: "Работа", news: "Новини", synced: "Лично и сигурно", findTitle: "Намираш веднага", findText: "Търсене по име, адрес и категория още докато пишеш.", secureTitle: "Само за теб", secureText: "Влизаш със собствен акаунт и твоите данни остават твои.", anywhereTitle: "Расте с теб", anywhereText: "Безплатно на едно устройство; PRO синхронизира твоето табло навсякъде.", planLabel: "СТАРТ", planTitle: "Започни безплатно", planText: "До 30 сайта и 3 категории. Надгради, когато имаш нужда от повече.", sync: "До 30 запазени сайта", organize: "До 3 категории, любими и търсене", backup: "Импорт и експорт на отметки", create: "Създай акаунт", footer: "Личен достъп до твоите сайтове"
  };
  return <main className="landing-page">
    <div className="landing-glow landing-glow-a" /><div className="landing-glow landing-glow-b" />
    <nav className="landing-nav"><div className="landing-brand"><span className="brand-mark"><i /><i /><i /><i /></span><span><strong>WebVault</strong><small>{copy.tagline}</small></span></div><div className="landing-nav-actions"><div className="landing-language" aria-label="Language"><button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button><button className={language === "bg" ? "active" : ""} onClick={() => setLanguage("bg")}>BG</button></div><button className="landing-login" onClick={onStart}>{copy.login} <ArrowRight size={16} /></button></div></nav>
    <section className="landing-hero"><div className="landing-copy"><div className="landing-eyebrow"><Sparkles size={15} /> {copy.eyebrow}</div><h1>{copy.titleA}<br /><em>{copy.titleB}</em></h1><p>{copy.intro}</p><div className="landing-actions"><button className="landing-cta" onClick={onStart}>{copy.start} <ArrowRight size={18} /></button><a className="landing-play-cta" href={googlePlayListingUrl} target="_blank" rel="noopener noreferrer"><Play size={17} fill="currentColor" aria-hidden="true" />{copy.googlePlay}</a><span className="landing-note"><ShieldCheck size={15} /> {copy.private}</span></div></div><div className="landing-preview" aria-label="WebVault preview"><div className="preview-top"><span className="preview-dots"><i /><i /><i /></span><span className="preview-title">WebVault</span><span className="preview-avatar">W</span></div><div className="preview-search"><Search size={15} /> {copy.search}</div><div className="preview-heading"><span>{copy.dashboard}</span><span>8 {copy.sites}</span></div><div className="preview-grid"><div className="preview-card aqua"><span>⚽</span><strong>{copy.football}</strong><small>12 {copy.sites}</small></div><div className="preview-card violet"><span>✦</span><strong>AI</strong><small>8 {copy.sites}</small></div><div className="preview-card amber"><span>💼</span><strong>{copy.work}</strong><small>15 {copy.sites}</small></div><div className="preview-card rose"><span>📰</span><strong>{copy.news}</strong><small>6 {copy.sites}</small></div></div><div className="preview-footer"><Check size={14} /> {copy.synced}</div></div></section>
    <section className="landing-benefits"><article><span className="benefit-icon"><Search size={19} /></span><h2>{copy.findTitle}</h2><p>{copy.findText}</p></article><article><span className="benefit-icon"><ShieldCheck size={19} /></span><h2>{copy.secureTitle}</h2><p>{copy.secureText}</p></article><article><span className="benefit-icon"><Sparkles size={19} /></span><h2>{copy.anywhereTitle}</h2><p>{copy.anywhereText}</p></article></section>
    <section className="landing-plan"><div><span className="landing-plan-label">{copy.planLabel}</span><h2>{copy.planTitle}</h2><p>{copy.planText}</p></div><ul><li><Check size={16} /> {copy.sync}</li><li><Check size={16} /> {copy.organize}</li><li><Check size={16} /> {copy.backup}</li></ul><button className="landing-plan-cta" onClick={onStart}>{copy.create} <ArrowRight size={17} /></button></section>
    <footer className="landing-footer">WebVault <span>·</span> {copy.footer}</footer>
  </main>;
}

function AuthForm({ initialError = "" }: { initialError?: string }) {
  const { t } = useAuthLanguage();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [canResend, setCanResend] = useState(Boolean(initialError));

  async function resendConfirmation() {
    if (!supabase) return;
    setError(""); setNotice("");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError(t("Въведи имейла, с който се регистрира."));
    setBusy(true);
    const authRedirectUrl = webVaultAuthRedirectUrl();
    const result = await supabase.auth.resend({
      type: "signup",
      email,
      options: authRedirectUrl ? { emailRedirectTo: authRedirectUrl } : undefined,
    });
    setBusy(false);
    if (result.error) return setError(formatAuthError(result.error, t));
    setNotice(t("Изпратихме нов линк. Използвай само последния имейл и го отвори веднага."));
  }

  async function sendReset() {
    if (!supabase) return;
    setError(""); setNotice("");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError(t("Въведи имейл адреса на профила си."));
    setBusy(true);
    const authRedirectUrl = webVaultAuthRedirectUrl();
    const result = await supabase.auth.resetPasswordForEmail(email, authRedirectUrl ? { redirectTo: authRedirectUrl } : undefined);
    setBusy(false);
    if (result.error) return setError(formatAuthError(result.error, t));
    setNotice(t("Изпратихме линк за промяна на паролата. Провери имейла си."));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setError("");
    setNotice("");

    const normalizedName = fullName.trim().replace(/\s+/g, " ");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError(t("Въведи валиден имейл адрес."));
    if (mode === "sign-up" && normalizedName.length < 2) return setError(t("Въведи име от поне 2 символа."));
    if (password.length < 8) return setError(t("Паролата трябва да е поне 8 символа."));

    setBusy(true);
    const authRedirectUrl = webVaultAuthRedirectUrl();
    const result = mode === "sign-in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: normalizedName },
          ...(authRedirectUrl ? { emailRedirectTo: authRedirectUrl } : {}),
        },
      });
    setBusy(false);

    if (result.error) {
      if (/already registered|already exists|user already/i.test(result.error.message)) setCanResend(true);
      if (/redirect_to.*not allowed|redirect url/i.test(result.error.message)) {
        return setError(t("Адресът за потвърждение не е разрешен в Supabase. Добави адреса на сайта в Auth → URL Configuration."));
      }
      return setError(formatAuthError(result.error, t));
    }
    if (mode === "sign-up" && !result.data.session) {
      setCanResend(true);
      setNotice(t("Провери имейла си и използвай най-новия линк за потвърждение. Линковете са еднократни и изтичат."));
    }
  }

  const isSignIn = mode === "sign-in";
  if (forgotMode) return <AuthFrame>
    <div className="auth-badge"><Mail size={15} /> {t("Възстановяване")}</div>
    <h1>{t("Забравена парола?")}</h1><p>{t("Ще изпратим защитен линк на имейла ти.")}</p>
    <form onSubmit={(event) => { event.preventDefault(); void sendReset(); }} className="auth-form">
      <label>{t("Имейл")}<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="you@example.com" required /></label>
      {error && <p className="auth-error">{error}</p>}{notice && <p className="auth-notice">{notice}</p>}
      <button className="auth-primary" disabled={busy} type="submit">{busy ? <LoaderCircle size={18} className="spin" /> : <Mail size={18} />}{t("Изпрати линк")}</button>
    </form>
    <button className="auth-switch" type="button" onClick={() => { setForgotMode(false); setError(""); setNotice(""); }}>{t("Назад към вход")}</button>
  </AuthFrame>;
  return <AuthFrame>
    <div className="auth-badge"><LockKeyhole size={15} /> {t("Личен достъп")}</div>
    <h1>{isSignIn ? t("Влез в WebVault") : t("Създай личен достъп")}</h1>
    <p>{isSignIn ? t("Сайтовете и категориите ти са достъпни само след вход.") : t("Създай профил с имейл и парола. Данните ти ще останат само твои.")}</p>
    <form onSubmit={submit} className="auth-form">
      {!isSignIn && <label>{t("Име")}<input value={fullName} onChange={(event) => setFullName(event.target.value)} type="text" autoComplete="name" placeholder={t("Въведи твоето име")} minLength={2} maxLength={80} required /></label>}
      <label>{t("Имейл")}<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="you@example.com" required /></label>
      <label>{t("Парола")}<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={isSignIn ? "current-password" : "new-password"} placeholder={t("Минимум 8 символа")} minLength={8} required /></label>
      {error && <p className="auth-error">{error}</p>}
      {notice && <p className="auth-notice">{notice}</p>}
      <button className="auth-primary" disabled={busy} type="submit">{busy ? <LoaderCircle size={18} className="spin" /> : isSignIn ? <LogIn size={18} /> : <UserPlus size={18} />}{isSignIn ? t("Вход") : t("Създай профил")}</button>
    </form>
    {!isSignIn && canResend && <button className="auth-switch" type="button" onClick={() => void resendConfirmation()} disabled={busy}>{t("Изпрати нов линк за потвърждение")}</button>}
    {isSignIn && <button className="auth-switch" type="button" onClick={() => { setForgotMode(true); setError(""); setNotice(""); }}>{t("Забравена парола?")}</button>}
    <button className="auth-switch" type="button" onClick={() => { setMode(isSignIn ? "sign-up" : "sign-in"); setError(""); setNotice(""); setCanResend(false); }}>{isSignIn ? t("Нямаш профил? Създай го") : t("Вече имаш профил? Влез")}</button>
  </AuthFrame>;
}

function PasswordRecovery({ onDone }: { onDone: () => void }) {
  const { t } = useAuthLanguage();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    if (password.length < 8) return setError(t("Паролата трябва да е поне 8 символа."));
    if (password !== confirm) return setError(t("Паролите не съвпадат."));
    setBusy(true);
    const result = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (result.error) return setError(formatAuthError(result.error, t));
    setDone(true);
  }
  return <AuthFrame><div className="auth-badge"><LockKeyhole size={15} /> {t("Нова парола")}</div><h1>{t("Създай нова парола")}</h1><p>{done ? t("Паролата е променена успешно. Вече можеш да използваш WebVault.") : t("Избери нова парола за сигурен достъп.")}</p>{done ? <button className="auth-primary" onClick={onDone}>{t("Продължи")}</button> : <form onSubmit={submit} className="auth-form"><label>{t("Нова парола")}<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={8} required /></label><label>{t("Повтори паролата")}<input value={confirm} onChange={(event) => setConfirm(event.target.value)} type="password" minLength={8} required /></label>{error && <p className="auth-error">{error}</p>}<button className="auth-primary" disabled={busy} type="submit">{busy ? <LoaderCircle size={18} className="spin" /> : <LockKeyhole size={18} />}{t("Запази новата парола")}</button></form>}</AuthFrame>;
}

function AuthFrame({ children }: { children: ReactNode }) {
  const { language, setLanguage, t } = useAuthLanguage();
  return <main className="auth-page"><div className="auth-orb one" /><div className="auth-orb two" /><section className="auth-card"><div className="auth-brand"><span className="brand-mark"><i /><i /><i /><i /></span><span><strong>WebVault</strong><small>{t("Всичко важно на едно място")}</small></span><div className="auth-language" aria-label={t("Език")}><button className={language === "en" ? "active" : ""} type="button" onClick={() => setLanguage("en")}>EN</button><button className={language === "bg" ? "active" : ""} type="button" onClick={() => setLanguage("bg")}>BG</button></div></div>{children}</section></main>;
}

function getOrCreateDeviceId() {
  const key = "webvault-device-id";
  try {
    const existing = window.localStorage.getItem(key);
    if (existing && existing.length >= 16) return existing;
    const next = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `browser-${navigator.userAgent.slice(0, 80)}`;
    window.localStorage.setItem(key, next);
    return next;
  } catch {
    return `browser-${navigator.userAgent.slice(0, 80)}`;
  }
}

function DeviceLimitMessage({ message, signOut }: { message: string; signOut: () => Promise<void> }) {
  const { t } = useAuthLanguage();
  return <AuthFrame><div className="auth-badge"><ShieldCheck size={15} /> {t("План и устройства")}</div><h1>{t("Нужно е WebVault PRO")}</h1><p>{message}</p><div className="auth-actions"><Link className="auth-primary" href="/pricing"><CrownIcon />{t("Стани PRO")}</Link><button className="auth-switch" onClick={() => void signOut()}>{t("Изход")}</button></div></AuthFrame>;
}

function CrownIcon() {
  return <Sparkles size={18} />;
}

function SetupMessage({ retry, signOut }: { retry: () => Promise<boolean>; signOut: () => Promise<void> }) {
  const { t } = useAuthLanguage();
  const [busy, setBusy] = useState(false);
  return <AuthFrame><div className="auth-badge"><Mail size={15} /> {t("Входът е успешен")}</div><h1>{t("Още една стъпка")}</h1><p>{t("Базата данни още не е подготвена за WebVault. Изпълни SQL схемата в Supabase и опитай отново.")}</p><div className="auth-actions"><button className="auth-primary" disabled={busy} onClick={async () => { setBusy(true); await retry(); setBusy(false); }}>{busy ? <LoaderCircle size={18} className="spin" /> : null}{t("Провери отново")}</button><button className="auth-switch" onClick={() => void signOut()}>{t("Изход")}</button></div></AuthFrame>;
}

function ConfigurationMessage() {
  const { t } = useAuthLanguage();
  return <AuthFrame><div className="auth-badge"><LockKeyhole size={15} /> {t("Подготовка")}</div><h1>{t("Връзката се настройва")}</h1><p>{t("Supabase връзката още не е налична. Обнови страницата след малко.")}</p></AuthFrame>;
}

function getAuthUrlError(rawUrl?: string) {
  if (!rawUrl && typeof window === "undefined") return "";
  let params: URLSearchParams;
  try {
    const url = new URL(rawUrl || window.location.href);
    params = new URLSearchParams(url.hash.replace(/^#/, ""));
    if (!params.get("error")) params = url.searchParams;
  } catch {
    return "";
  }
  if (!params.get("error")) return "";
  if (params.get("error_code") === "otp_expired") {
    return "Линкът за потвърждение е изтекъл или вече е използван. Отвори регистрацията и изпрати нов линк.";
  }
  return "Линкът за потвърждение не можа да бъде обработен. Изпрати нов линк и опитай отново.";
}

function formatAuthError(error: { message: string; code?: string }, t: (value: string) => string) {
  if (error.code === "invalid_credentials") return t("Неправилен имейл или парола.");
  if (error.code === "email_not_confirmed") return t("Потвърди имейла си, преди да влезеш.");
  if (error.code === "user_already_exists" || /already registered|already exists|user already/i.test(error.message)) return t("Този имейл вече има профил. Влез или изпрати нов линк за потвърждение.");
  if (/rate limit|over_email_send_rate_limit/i.test(error.code ?? error.message)) return t("Твърде много изпратени имейли. Изчакай малко и опитай отново.");
  return error.message;
}
