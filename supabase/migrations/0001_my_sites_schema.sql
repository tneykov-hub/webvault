-- WebVault: initial Supabase schema
-- This migration is designed for Supabase PostgreSQL and Supabase Auth.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  open_links_in_new_tab boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 64),
  icon text not null default '🔖' check (char_length(icon) between 1 and 16),
  tone text not null default 'blue' check (tone in ('aqua', 'violet', 'amber', 'blue', 'rose', 'green')),
  position integer not null default 0 check (position >= 0),
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists categories_user_name_unique
  on public.categories (user_id, lower(name));

create index if not exists categories_user_position_idx
  on public.categories (user_id, position, created_at);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  url text not null check (url ~* '^https?://'),
  domain text not null check (char_length(btrim(domain)) between 1 and 255),
  description text check (char_length(description) <= 500),
  favicon_url text check (favicon_url is null or favicon_url ~* '^https?://'),
  custom_icon_url text check (custom_icon_url is null or custom_icon_url ~* '^https?://'),
  is_favorite boolean not null default false,
  position integer not null default 0 check (position >= 0),
  open_in_new_tab boolean,
  visit_count integer not null default 0 check (visit_count >= 0),
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sites_user_category_position_idx
  on public.sites (user_id, category_id, position, created_at);

create index if not exists sites_user_favorite_position_idx
  on public.sites (user_id, is_favorite, position, created_at);

create index if not exists sites_user_search_idx
  on public.sites (user_id, lower(name), lower(domain));

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
      (target_user_id, 'Работа', '💻', 'amber', 300, false),
      (target_user_id, 'Новини', '📰', 'blue', 400, false),
      (target_user_id, 'Пазаруване', '🛒', 'rose', 500, false),
      (target_user_id, 'Медия', '🎬', 'violet', 600, false),
      (target_user_id, 'Обучение', '📚', 'green', 700, false),
      (target_user_id, 'Други', '⭐', 'amber', 800, true);
  end if;
end;
$$;

create or replace function public.bootstrap_my_sites_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'You must be signed in to initialise WebVault.';
  end if;

  insert into public.profiles (id, display_name)
  values (current_user_id, coalesce(auth.jwt() ->> 'email', 'WebVault user'))
  on conflict (id) do nothing;

  perform public.seed_default_categories(current_user_id);
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, 'WebVault user'), '@', 1)
    )
  )
  on conflict (id) do nothing;

  perform public.seed_default_categories(new.id);
  return new;
end;
$$;

create or replace function public.ensure_site_category_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.category_id is not null and not exists (
    select 1
    from public.categories
    where id = new.category_id and user_id = new.user_id
  ) then
    raise exception 'A site can only be assigned to one of your own categories.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.touch_updated_at();

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row execute procedure public.touch_updated_at();

drop trigger if exists sites_set_updated_at on public.sites;
create trigger sites_set_updated_at
before update on public.sites
for each row execute procedure public.touch_updated_at();

drop trigger if exists sites_require_owned_category on public.sites;
create trigger sites_require_owned_category
before insert or update of user_id, category_id on public.sites
for each row execute procedure public.ensure_site_category_owner();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.sites enable row level security;

revoke all on table public.profiles, public.categories, public.sites from anon;
revoke all on table public.profiles, public.categories, public.sites from public;
grant select, insert, update, delete on table public.profiles, public.categories, public.sites to authenticated;

create policy "Users can read their profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "Users can create their profile"
on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update their profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users can read their categories"
on public.categories for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their categories"
on public.categories for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their categories"
on public.categories for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their non-system categories"
on public.categories for delete to authenticated
using ((select auth.uid()) = user_id and is_system = false);

create policy "Users can read their sites"
on public.sites for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their sites"
on public.sites for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their sites"
on public.sites for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their sites"
on public.sites for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on function public.touch_updated_at() from public;
revoke all on function public.seed_default_categories(uuid) from public;
revoke all on function public.bootstrap_my_sites_account() from public;
revoke all on function public.handle_new_user() from public;
revoke all on function public.ensure_site_category_owner() from public;
grant execute on function public.bootstrap_my_sites_account() to authenticated;
