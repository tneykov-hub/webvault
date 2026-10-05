import { supabase } from "@/lib/supabase";
import { isNativeApp } from "@/lib/native-app";
import { deviceLabel, getDeviceSecret } from "@/lib/device-identity";

export type RegisteredDevice = {
  id: string;
  label: string;
  approved_at: string;
  last_seen_at: string;
  current: boolean;
};

export type DeviceAccess = {
  status: "active" | "verification_required" | "active_elsewhere" | "sign_in_required";
  limit: number;
  devices: RegisteredDevice[];
  active_label?: string;
  confirmation?: { id: string; label: string };
};

export async function getDeviceAccess(takeover = false, activate = true): Promise<DeviceAccess> {
  const { data, error } = await supabase.rpc("webvault_device_access", {
    p_device_secret: getDeviceSecret(), p_device_label: deviceLabel(), p_takeover: takeover, p_activate: activate,
  });
  if (error) throw error;
  if (!data || !["active", "verification_required", "active_elsewhere", "sign_in_required"].includes(data.status)) throw new Error("Device access could not be verified.");
  return data as DeviceAccess;
}

export async function sendDeviceConfirmation(email: string) {
  const { data, error } = await supabase.rpc("request_webvault_device_confirmation", {
    p_device_secret: getDeviceSecret(), p_device_label: deviceLabel(),
  });
  if (error) throw error;
  if (!data?.challenge) throw new Error("Device confirmation could not be created.");
  const redirect = new URL("/", isNativeApp() ? "https://webvault.site" : window.location.origin);
  redirect.searchParams.set("device_confirmation", data.challenge);
  const result = await supabase.auth.signInWithOtp({
    email, options: { shouldCreateUser: false, emailRedirectTo: redirect.toString() },
  });
  if (result.error) throw result.error;
  return String(data.challenge);
}

export async function releaseDeviceAccess() {
  await supabase.rpc("release_webvault_device_access", { p_device_secret: getDeviceSecret() });
}

export async function revokeDevice(id: string) {
  const { error } = await supabase.rpc("revoke_webvault_device", { p_device_id: id });
  if (error) throw error;
}
