-- WebVault: privacy-conscious first-party product analytics.
-- Run this after 0001 through 0004 in the Supabase SQL editor.

create table if not exists public.marketing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  visitor_id text not null check (char_length(visitor_id) between 16 and 128),
  session_id text not null check (char_length(session_id) between 16 and 128),
  event_name text not null check (event_name in (
    'landing_view',
    'dashboard_view',
    'pricing_view',
    'return_visit',
    'auth_started',
    'signup_completed',
    'site_added',
    'site_opened',
    'checkout_started',
    'checkout_success'
  )),
  source text not null default 'direct' check (char_length(source) between 1 and 100),
  medium text not null default 'direct' check (char_length(medium) between 1 and 100),
  campaign text check (campaign is null or char_length(campaign) <= 120),
  content text check (content is null or char_length(content) <= 120),
  term text check (term is null or char_length(term) <= 120),
  referrer text check (referrer is null or char_length(referrer) <= 300),
  landing_path text not null default '/' check (char_length(landing_path) between 1 and 300),
  language text not null default 'en' check (language in ('en', 'bg')),
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists marketing_events_created_at_idx
  on public.marketing_events (created_at desc);

create index if not exists marketing_events_event_name_idx
  on public.marketing_events (event_name, created_at desc);

create index if not exists marketing_events_source_idx
  on public.marketing_events (source, medium, created_at desc);

create index if not exists marketing_events_user_id_idx
  on public.marketing_events (user_id, created_at desc);

alter table public.marketing_events enable row level security;
revoke all on table public.marketing_events from anon, authenticated;
grant insert on table public.marketing_events to anon, authenticated;
grant select, insert, update, delete on table public.marketing_events to service_role;

drop policy if exists "Anonymous visitors can record product events" on public.marketing_events;
create policy "Anonymous visitors can record product events"
on public.marketing_events for insert to anon
with check (user_id is null);

drop policy if exists "Signed-in users can record their product events" on public.marketing_events;
create policy "Signed-in users can record their product events"
on public.marketing_events for insert to authenticated
with check (user_id is null or user_id = (select auth.uid()));
