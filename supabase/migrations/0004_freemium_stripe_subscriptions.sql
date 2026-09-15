-- WebVault: Freemium limits, device access and Stripe subscription fields.
-- Run this after 0001, 0002 and 0003 in the Supabase SQL editor.

alter table public.profiles
  add column if not exists is_pro boolean not null default false,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_status text,
  add column if not exists stripe_price_id text,
  add column if not exists subscription_updated_at timestamptz;

create unique index if not exists profiles_stripe_customer_id_unique
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists profiles_stripe_subscription_id_unique
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- Subscription columns are only written by the server-side Stripe webhook.
revoke update on table public.profiles from authenticated;
grant update (display_name, theme, open_links_in_new_tab) on table public.profiles to authenticated;
grant select, insert, update, delete on table public.profiles to service_role;

-- New FREE accounts start with exactly the three useful baseline categories.
-- Existing accounts keep their existing categories and are not destructively changed.
create or replace function public.seed_default_categories(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.categories where user_id = target_user_id
  ) then
    insert into public.categories (user_id, name, icon, tone, position, is_system)
    values
      (target_user_id, 'Футбол', '⚽', 'aqua', 100, false),
      (target_user_id, 'AI', '✦', 'violet', 200, false),
      (target_user_id, 'Други', '⭐', 'amber', 300, true);
  end if;
end;
$$;

create or replace function public.enforce_free_site_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_plan_is_pro boolean := false;
begin
  -- Lock the profile row so two concurrent inserts cannot both become a 31st site.
  select coalesce(is_pro, false)
  into current_plan_is_pro
  from public.profiles
  where id = new.user_id
  for update;

  if not coalesce(current_plan_is_pro, false)
     and (select count(*) from public.sites where user_id = new.user_id) >= 30 then
    raise exception 'Free plan limit reached: upgrade to PRO for unlimited sites.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists sites_enforce_free_plan_limit on public.sites;
create trigger sites_enforce_free_plan_limit
before insert on public.sites
for each row execute procedure public.enforce_free_site_limit();

create or replace function public.enforce_free_category_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_plan_is_pro boolean := false;
begin
  select coalesce(is_pro, false)
  into current_plan_is_pro
  from public.profiles
  where id = new.user_id
  for update;

  if not coalesce(current_plan_is_pro, false)
     and (select count(*) from public.categories where user_id = new.user_id) >= 3 then
    raise exception 'Free plan limit reached: upgrade to PRO for unlimited categories.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists categories_enforce_free_plan_limit on public.categories;
create trigger categories_enforce_free_plan_limit
before insert on public.categories
for each row execute procedure public.enforce_free_category_limit();

create or replace function public.enforce_pro_category_customization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_plan_is_pro boolean := false;
begin
  if TG_OP = 'INSERT' then
    -- These are the only non-custom category styles allowed while seeding a
    -- new FREE account. Any user-created FREE category uses the neutral style.
    if (new.name, new.icon, new.tone) in (
      ('Футбол', '⚽', 'aqua'),
      ('AI', '✦', 'violet'),
      ('Други', '⭐', 'amber')
    ) or (new.icon = '🔖' and new.tone = 'blue') then
      return new;
    end if;
  elsif new.icon is not distinct from old.icon and new.tone is not distinct from old.tone then
    return new;
  end if;

  select coalesce(is_pro, false)
  into current_plan_is_pro
  from public.profiles
  where id = new.user_id;

  if not coalesce(current_plan_is_pro, false) then
    raise exception 'Custom category icons and colors are available with PRO.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists categories_require_pro_for_customization on public.categories;
create trigger categories_require_pro_for_customization
before insert or update of icon, tone on public.categories
for each row execute procedure public.enforce_pro_category_customization();

-- A persistent browser identifier is registered during sign-in. FREE users get
-- one active device; PRO users can use as many devices as they need.
create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id text not null check (char_length(device_id) between 16 and 128),
  device_label text check (device_label is null or char_length(device_label) <= 120),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, device_id)
);

create index if not exists user_devices_user_last_seen_idx
  on public.user_devices (user_id, last_seen_at desc);

alter table public.user_devices enable row level security;
revoke all on table public.user_devices from anon;
revoke all on table public.user_devices from authenticated;
grant select on table public.user_devices to authenticated;
grant select, insert, update, delete on table public.user_devices to service_role;

drop policy if exists "Users can read their devices" on public.user_devices;
create policy "Users can read their devices"
on public.user_devices for select to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.register_webvault_device(p_device_id text, p_device_label text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_plan_is_pro boolean := false;
  normalized_device_id text := btrim(coalesce(p_device_id, ''));
  normalized_device_label text := nullif(left(btrim(coalesce(p_device_label, '')), 120), '');
begin
  if current_user_id is null then
    raise exception 'You must be signed in to register a device.' using errcode = 'P0001';
  end if;
  if char_length(normalized_device_id) < 16 or char_length(normalized_device_id) > 128 then
    raise exception 'Invalid device identifier.' using errcode = 'P0001';
  end if;

  select coalesce(is_pro, false)
  into current_plan_is_pro
  from public.profiles
  where id = current_user_id
  for update;

  if not coalesce(current_plan_is_pro, false)
     and not exists (
       select 1 from public.user_devices
       where user_id = current_user_id and device_id = normalized_device_id
     )
     and (select count(*) from public.user_devices where user_id = current_user_id) >= 1 then
    raise exception 'Free plan allows one device. Upgrade to PRO to use WebVault on multiple devices.'
      using errcode = 'P0001';
  end if;

  insert into public.user_devices (user_id, device_id, device_label, last_seen_at)
  values (current_user_id, normalized_device_id, normalized_device_label, now())
  on conflict (user_id, device_id) do update
  set device_label = excluded.device_label,
      last_seen_at = now();
  return true;
end;
$$;

revoke all on function public.register_webvault_device(text, text) from public;
grant execute on function public.register_webvault_device(text, text) to authenticated;

-- The profile change made by Stripe needs to reach open dashboard tabs quickly.
do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;
end;
$$;

-- Only PRO users may upload or replace custom site icons. Existing icons remain
-- readable and can still be deleted by their owner after a downgrade.
drop policy if exists "Users can upload their site icons" on storage.objects;
create policy "Users can upload their site icons"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'site-icons'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_pro = true
  )
);

drop policy if exists "Users can update their site icons" on storage.objects;
create policy "Users can update their site icons"
on storage.objects for update to authenticated
using (
  bucket_id = 'site-icons'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_pro = true
  )
)
with check (
  bucket_id = 'site-icons'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_pro = true
  )
);
