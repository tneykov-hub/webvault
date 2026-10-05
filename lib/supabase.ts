import { createClient } from "@supabase/supabase-js";
import { deviceRequestHeaders } from "@/lib/device-identity";

// These are intentionally public browser values. Database access remains protected
// by Supabase Auth and Row Level Security; no secret/service-role key is used here.
const nextPublicEnvironment =
  typeof process !== "undefined" ? process.env : undefined;
const supabaseUrl =
  nextPublicEnvironment?.NEXT_PUBLIC_SUPABASE_URL ||
  "https://imnekcjyzjzgskkplyri.supabase.co";
const supabasePublishableKey =
  nextPublicEnvironment?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_q7ESjkHYkxsCC7_upaRpEA_gII7ig__";

export const supabaseConfigurationError =
  !supabaseUrl || !supabasePublishableKey
    ? "Липсва връзката със Supabase."
    : null;

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  global: {
    fetch: (input, init) => {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      for (const [key, value] of Object.entries(deviceRequestHeaders())) headers.set(key, value);
      return fetch(input, { ...init, headers });
    },
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
