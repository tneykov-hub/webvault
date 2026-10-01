import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";

export const testUser = "00000000-0000-4000-8000-000000000001";
export const testFounder = "00000000-0000-4000-8000-000000000002";

export async function securityDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key);
    create table public.profiles (
      id uuid primary key references auth.users(id), is_pro boolean not null default false,
      display_name text, theme text, open_links_in_new_tab boolean not null default true,
      stripe_customer_id text, stripe_subscription_id text, stripe_subscription_status text,
      stripe_price_id text, subscription_updated_at timestamptz
    );
    grant usage on schema public, auth to service_role;
    grant usage on schema public to authenticated;
    grant select, insert on public.profiles to authenticated;
    grant select, update on public.profiles to service_role;
    insert into auth.users values ('${testUser}'), ('${testFounder}');
    insert into public.profiles(id, is_pro, stripe_subscription_status)
      values ('${testUser}', false, null), ('${testFounder}', true, 'manual_founder');
  `);
  const directory = new URL("../../supabase/migrations/", import.meta.url);
  const filename = (await readdir(directory)).find((name) => name.endsWith("_harden_stripe_and_request_limits.sql"));
  if (!filename) throw new Error("Missing security migration");
  await db.exec(await readFile(new URL(filename, directory), "utf8"));
  return db;
}

const rpcArguments = {
  claim_webvault_stripe_event: ["p_event_id", "p_user_id"],
  finish_webvault_stripe_event: ["p_event_id", "p_user_id", "p_token", "p_customer_id", "p_subscription_id", "p_status", "p_price_id"],
  release_webvault_stripe_event: ["p_user_id", "p_token"],
  reserve_webvault_request: ["p_scope", "p_subject", "p_user_id"],
  release_webvault_request: ["p_token"],
};
export function databaseAdmin(db) {
  return {
    async rpc(name, args) {
      try {
        const keys = rpcArguments[name];
        if (!keys) throw new Error("Unexpected RPC");
        const placeholders = keys.map((_, index) => `$${index + 1}`).join(",");
        const { rows } = await db.query(`select public.${name}(${placeholders}) as result`, keys.map((key) => args[key] ?? null));
        return { data: rows[0].result, error: null };
      } catch (error) { return { data: null, error }; }
    },
    from(table) {
      if (table !== "profiles") throw new Error("Unexpected table");
      return { select: () => ({ eq: (column, value) => ({ maybeSingle: async () => {
        if (!["id", "stripe_customer_id", "stripe_subscription_id"].includes(column)) throw new Error("Unexpected column");
        const { rows } = await db.query(`select * from public.profiles where ${column} = $1`, [value]);
        return { data: rows[0] ?? null, error: null };
      } }) }) };
    },
  };
}
