import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";

export const owner = "00000000-0000-4000-8000-000000000101";
export const other = "00000000-0000-4000-8000-000000000102";
export const sid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const secret = (n) => String(n).padStart(64, "0");

export async function deviceDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
    grant usage on schema public,auth,storage to authenticated,service_role;
    create table public.profiles(id uuid primary key references auth.users(id),is_pro boolean default false,display_name text);
    create table public.sites(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),name text);
    create table public.categories(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),name text);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,user_id uuid);
    alter table public.profiles enable row level security;
    alter table public.sites enable row level security;
    alter table public.categories enable row level security;
    alter table storage.objects enable row level security;
    create policy owner on public.profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
    create policy owner on public.sites for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
    create policy legacy_owner on public.sites for all to public using(user_id=auth.uid()) with check(user_id=auth.uid());
    create policy owner on public.categories for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
    create policy owner on storage.objects for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
    grant select,insert,update,delete on public.profiles,public.sites,public.categories,storage.objects to authenticated;
    insert into auth.users values('${owner}'),('${other}');
    insert into public.profiles values('${owner}',true,'Owner'),('${other}',true,'Other');
    insert into public.sites(user_id,name) values('${owner}','Private bookmark'),('${other}','Other bookmark');
    insert into public.categories(user_id,name) values('${owner}','Private category');
    insert into storage.objects(bucket_id,user_id) values('site-icons','${owner}');
  `);
  for (let n = 1; n <= 8; n++) await db.query("insert into auth.sessions values($1,$2,null)", [sid(n), n === 8 ? other : owner]);
  const directory = new URL("../../supabase/migrations/", import.meta.url);
  const filename = (await readdir(directory)).find((name) => name.endsWith("_enforce_device_access.sql"));
  await db.exec(await readFile(new URL(filename, directory), "utf8"));
  const privatePolicies = (await readdir(directory)).find((name) => name.endsWith("_device_security_private_policies.sql"));
  if (privatePolicies) await db.exec(await readFile(new URL(privatePolicies, directory), "utf8"));
  return db;
}

export async function identity(db, { user = owner, session = sid(1), device = secret(1), method = "password", timestamp = Math.floor(Date.now()/1000), metadata = {} } = {}) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false),set_config('request.headers',$2,false)", [
    JSON.stringify({ sub: user, session_id: session, role: "authenticated", amr: [{ method, timestamp }], user_metadata: metadata }),
    JSON.stringify({ "x-webvault-device": device }),
  ]);
  await db.exec("set role authenticated");
}

export async function asAdmin(db, sql, args = []) {
  await db.exec("reset role");
  return db.query(sql,args);
}

export async function rpc(db, fn, args = []) {
  const { rows } = await db.query(`select public.${fn}(${args.map((_,i)=>`$${i+1}`).join(",")}) as result`,args);
  return rows[0].result;
}

export async function approve(db, n) {
  await identity(db,{session:sid(n),device:secret(n)});
  // Bypass only the resend cooldown in the test fixture; the request and approval
  // run the real migration functions under the authenticated role.
  await asAdmin(db,"update webvault_private.device_confirmations set created_at=now()-interval '2 minutes',used_at=coalesce(used_at,now())");
  await identity(db,{session:sid(n),device:secret(n)});
  const { challenge } = await rpc(db,"request_webvault_device_confirmation",[secret(n),`Device ${n}`]);
  await identity(db,{session:sid(7),device:secret(7),method:"magiclink"});
  const result = await rpc(db,"confirm_webvault_device",[challenge,null]);
  await identity(db,{session:sid(n),device:secret(n)});
  return { challenge,result };
}
