"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Mail, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { getDeviceAccess, revokeDevice, sendDeviceConfirmation, type DeviceAccess, type RegisteredDevice } from "@/lib/device-access";
import { supabase } from "@/lib/supabase";

const copy = {
  en: {
    heading: "Your devices", policy: "PRO: up to 3 approved devices, with one device active at a time. FREE: one approved device.",
    verify: "Confirm this device", verifyInfo: "Open the link sent to your account email. You can confirm on another phone or computer, then return here.",
    send: "Send confirmation email", sent: "Email sent. This screen will update after you confirm the device.",
    elsewhere: "WebVault is active on another device", transfer: "Use WebVault here", transferInfo: "Continuing here will stop access on the other device.",
    approve: "Approve a new device", approveInfo: "Confirm only a device you recognise. Anyone with access to it will be able to use your WebVault account.",
    confirm: "Confirm device", replace: "Choose a device to replace", choose: "Keep all existing devices", limit: "Your device limit is reached. Select a device to replace.",
    confirmed: "Device confirmed. Return to the device where you requested the email.", continue: "Continue", current: "This device", remove: "Remove", removeQuestion: "Remove this device? It will need email confirmation to access WebVault again.",
    failed: "The device check could not be completed. Please try again.", retry: "Try again", logout: "Sign out", lastSeen: "Last used", empty: "No approved devices yet.", expired: "Your session has expired. Sign in again.", wait: "Wait 60 seconds before requesting another email.",
  },
  bg: {
    heading: "Твоите устройства", policy: "PRO: до 3 потвърдени устройства, с едно активно в даден момент. FREE: едно потвърдено устройство.",
    verify: "Потвърди това устройство", verifyInfo: "Отвори линка, изпратен на имейла на акаунта. Можеш да потвърдиш от друг телефон или компютър и да се върнеш тук.",
    send: "Изпрати имейл за потвърждение", sent: "Имейлът е изпратен. Екранът ще се обнови след потвърждението.",
    elsewhere: "WebVault е активен на друго устройство", transfer: "Използвай WebVault тук", transferInfo: "Продължаването тук ще прекъсне достъпа на другото устройство.",
    approve: "Одобри ново устройство", approveInfo: "Потвърди само устройство, което разпознаваш. Всеки с достъп до него ще може да използва твоя WebVault акаунт.",
    confirm: "Потвърди устройството", replace: "Избери устройство за замяна", choose: "Запази всички налични устройства", limit: "Лимитът е достигнат. Избери устройство за замяна.",
    confirmed: "Устройството е потвърдено. Върни се към устройството, от което поиска имейла.", continue: "Продължи", current: "Това устройство", remove: "Премахни", removeQuestion: "Да премахна ли устройството? За нов достъп ще е нужно потвърждение по имейл.",
    failed: "Проверката на устройството не завърши. Опитай отново.", retry: "Опитай отново", logout: "Изход", lastSeen: "Последно използване", empty: "Все още няма потвърдени устройства.", expired: "Сесията ти е изтекла. Влез отново.", wait: "Изчакай 60 секунди, преди да поискаш нов имейл.",
  },
};

function formatDate(value: string, language: "en" | "bg") {
  return new Date(value).toLocaleString(language === "bg" ? "bg-BG" : "en-GB", { dateStyle: "short", timeStyle: "short" });
}

export function DeviceSecurityGate({ access, email, language, onRefresh, onSignOut }: {
  access: DeviceAccess; email: string; language: "en" | "bg";
  onRefresh: (takeover?: boolean) => Promise<boolean>; onSignOut: () => Promise<void>;
}) {
  const c = copy[language];
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [replace, setReplace] = useState("");
  const confirmation = access.confirmation;
  const expired = access.status === "sign_in_required";

  async function act() {
    setBusy(true); setError("");
    try {
      if (confirmation) {
        const { data, error: e } = await supabase.rpc("confirm_webvault_device", { p_challenge: confirmation.id, p_replace_device: replace || null });
        if (e) throw e;
        if (data?.status === "device_limit") { setError(c.limit); return; }
        if (data?.status !== "confirmed") throw new Error("Invalid device approval result");
        setConfirmed(true);
        const url = new URL(window.location.href);
        url.searchParams.delete("device_confirmation");
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      } else if (access.status === "active_elsewhere") await onRefresh(true);
      else { await sendDeviceConfirmation(email); setSent(true); }
    } catch (e) { setError(e && typeof e === "object" && "message" in e && /60 seconds/.test(String(e.message)) ? c.wait : c.failed); }
    finally { setBusy(false); }
  }

  return <section className="device-security-stack" aria-live="polite">
    <div className="auth-badge"><ShieldCheck size={15} />WebVault</div>
    <h1>{confirmed ? c.confirmed : expired ? c.expired : confirmation ? c.approve : access.status === "active_elsewhere" ? c.elsewhere : c.verify}</h1>
    {!confirmed && !expired && <>
      <p>{confirmation ? c.approveInfo : access.status === "active_elsewhere" ? c.transferInfo : c.verifyInfo}</p>
      <p className="device-security-label">{confirmation?.label ?? access.active_label ?? email}</p><small>{c.policy}</small>
      {confirmation && access.devices.length >= access.limit && <label className="device-replacement-label">{c.replace}
        <select value={replace} onChange={(e) => setReplace(e.target.value)}><option value="">{c.choose}</option>
          {access.devices.map((d) => <option key={d.id} value={d.id}>{d.label} · {formatDate(d.last_seen_at, language)}</option>)}
        </select></label>}
      {sent && <p className="import-success">{c.sent}</p>}{error && <p className="form-error">{error}</p>}
      <button className="auth-primary" type="button" disabled={busy || (!confirmation && access.status !== "active_elsewhere" && !email)} onClick={() => void act()}>
        {busy ? <LoaderCircle size={17} className="spin" /> : confirmation ? <ShieldCheck size={17} /> : <Mail size={17} />}
        {confirmation ? c.confirm : access.status === "active_elsewhere" ? c.transfer : c.send}</button>
    </>}
    {confirmed && <button className="auth-primary" onClick={() => { setConfirmed(false); void onRefresh(); }}>{c.continue}</button>}
    <button className="auth-switch" onClick={() => void onSignOut()}>{c.logout}</button>
  </section>;
}

export function DeviceManager({ language }: { language: "en" | "bg" }) {
  const c = copy[language];
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    try { setDevices((await getDeviceAccess(false, false)).devices); setError(""); }
    catch { setError(c.failed); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let mounted = true;
    void getDeviceAccess(false, false).then((result) => {
      if (mounted) { setDevices(result.devices); setError(""); }
    }).catch(() => { if (mounted) setError(c.failed); })
      .finally(() => { if (mounted) setBusy(false); });
    return () => { mounted = false; };
  }, [c.failed]);
  async function remove(id: string) {
    if (!window.confirm(c.removeQuestion)) return;
    setBusy(true);
    try {
      await revokeDevice(id);
      window.dispatchEvent(new Event("focus"));
      await load();
    }
    catch { setError(c.failed); setBusy(false); }
  }
  return <section className="profile-card device-manager">
    <div className="profile-card-heading"><Smartphone size={18} /><strong>{c.heading}</strong></div><small>{c.policy}</small>
    {busy && <LoaderCircle size={18} className="spin" aria-label={c.heading} />}
    {error && <p className="form-error">{error}<button className="text-button" onClick={() => void load()}>{c.retry}</button></p>}
    {!busy && !devices.length && <small>{c.empty}</small>}
    {devices.map((d) => <div className="device-manager-row" key={d.id}>
      <div><strong>{d.label}</strong>{d.current && <span className="device-current-badge">{c.current}</span>}<small>{c.lastSeen}: {formatDate(d.last_seen_at, language)}</small></div>
      <button type="button" className="profile-choice danger-item" disabled={busy} onClick={() => void remove(d.id)} aria-label={`${c.remove}: ${d.label}`}><Trash2 size={15} />{c.remove}</button>
    </div>)}
  </section>;
}
