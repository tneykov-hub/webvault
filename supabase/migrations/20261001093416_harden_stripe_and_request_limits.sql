-- Server-only, durable concurrency controls. No existing profile is modified here.
-- Profile creation must not let a client supply PRO or Stripe/founder entitlement.
-- Auth triggers and the bootstrap function continue to create profiles as their owner.
revoke insert on public.profiles from anon, authenticated;
grant insert (id, display_name, theme, open_links_in_new_tab) on public.profiles to authenticated;

create table public.webvault_stripe_sync_locks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  lock_token uuid,
  locked_until timestamptz
);
create table public.webvault_stripe_events (
  event_id text primary key check (length(event_id) between 1 and 255),
  user_id uuid not null references public.profiles(id) on delete cascade,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.webvault_request_usage (
  scope text not null check (scope in ('ai', 'metadata')),
  subject text not null check (length(subject) between 1 and 100),
  user_id uuid references auth.users(id) on delete cascade,
  day_start date not null,
  month_start date not null,
  minute_start timestamptz not null,
  day_count integer not null default 0,
  month_count integer not null default 0,
  minute_count integer not null default 0,
  primary key (scope, subject)
);
create table public.webvault_request_leases (
  token uuid primary key default gen_random_uuid(),
  scope text not null,
  subject text not null,
  expires_at timestamptz not null,
  foreign key (scope, subject) references public.webvault_request_usage(scope, subject) on delete cascade
);
create index webvault_stripe_events_user_idx on public.webvault_stripe_events(user_id);
create index webvault_request_usage_user_idx on public.webvault_request_usage(user_id);
create index webvault_request_leases_subject_idx on public.webvault_request_leases(scope, subject, expires_at);
alter table public.webvault_stripe_sync_locks enable row level security;
alter table public.webvault_stripe_events enable row level security;
alter table public.webvault_request_usage enable row level security;
alter table public.webvault_request_leases enable row level security;
create policy "Server controls Stripe synchronization" on public.webvault_stripe_sync_locks for all to service_role using (true) with check (true);
create policy "Server controls Stripe receipts" on public.webvault_stripe_events for all to service_role using (true) with check (true);
create policy "Server controls request counters" on public.webvault_request_usage for all to service_role using (true) with check (true);
create policy "Server controls request leases" on public.webvault_request_leases for all to service_role using (true) with check (true);
revoke all on public.webvault_stripe_sync_locks, public.webvault_stripe_events,
  public.webvault_request_usage, public.webvault_request_leases from public, anon, authenticated;
grant select, insert, update, delete on public.webvault_stripe_sync_locks, public.webvault_stripe_events,
  public.webvault_request_usage, public.webvault_request_leases to service_role;

create function public.claim_webvault_stripe_event(p_event_id text, p_user_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_lock public.webvault_stripe_sync_locks%rowtype;
  v_event public.webvault_stripe_events%rowtype;
  v_token uuid := gen_random_uuid();
begin
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Unknown subscription profile';
  end if;
  -- Founder entitlements are never controlled by Stripe.
  if exists (select 1 from public.profiles where id = p_user_id and stripe_subscription_status = 'manual_founder') then
    return jsonb_build_object('state', 'founder');
  end if;
  insert into public.webvault_stripe_sync_locks(user_id) values (p_user_id) on conflict do nothing;
  select * into v_lock from public.webvault_stripe_sync_locks where user_id = p_user_id for update;
  select * into v_event from public.webvault_stripe_events where event_id = p_event_id;
  if found and v_event.user_id <> p_user_id then raise exception 'Event owner mismatch'; end if;
  if v_event.processed_at is not null then return jsonb_build_object('state', 'duplicate'); end if;
  if v_lock.locked_until > clock_timestamp() then return jsonb_build_object('state', 'busy'); end if;
  insert into public.webvault_stripe_events(event_id, user_id) values (p_event_id, p_user_id) on conflict do nothing;
  update public.webvault_stripe_sync_locks set lock_token = v_token,
    locked_until = clock_timestamp() + interval '120 seconds' where user_id = p_user_id;
  return jsonb_build_object('state', 'acquired', 'token', v_token);
end;
$$;

create function public.finish_webvault_stripe_event(
  p_event_id text, p_user_id uuid, p_token uuid, p_customer_id text,
  p_subscription_id text, p_status text, p_price_id text
)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  v_lock public.webvault_stripe_sync_locks%rowtype;
  v_profile public.profiles%rowtype;
  v_result text := 'applied';
begin
  select * into v_lock from public.webvault_stripe_sync_locks where user_id = p_user_id for update;
  if v_lock.lock_token is distinct from p_token or v_lock.locked_until <= clock_timestamp() then
    raise exception 'Subscription synchronization lease expired';
  end if;
  if not exists (select 1 from public.webvault_stripe_events where event_id = p_event_id and user_id = p_user_id and processed_at is null) then
    raise exception 'Subscription event not claimed';
  end if;
  select * into strict v_profile from public.profiles where id = p_user_id for update;
  if v_profile.stripe_subscription_status = 'manual_founder' then
    v_result := 'founder';
  else
    if p_customer_id is null or p_subscription_id is null or p_status not in
      ('active', 'trialing', 'canceled', 'unpaid', 'past_due', 'incomplete', 'incomplete_expired', 'paused') then
      raise exception 'Invalid subscription state';
    end if;
    if v_profile.stripe_customer_id is not null and v_profile.stripe_customer_id <> p_customer_id then
      raise exception 'Subscription customer mismatch';
    end if;
    update public.profiles set is_pro = p_status in ('active', 'trialing'),
      stripe_customer_id = p_customer_id, stripe_subscription_id = p_subscription_id,
      stripe_subscription_status = p_status, stripe_price_id = p_price_id,
      subscription_updated_at = clock_timestamp() where id = p_user_id;
  end if;
  update public.webvault_stripe_events set processed_at = clock_timestamp() where event_id = p_event_id and user_id = p_user_id;
  update public.webvault_stripe_sync_locks set lock_token = null, locked_until = null where user_id = p_user_id;
  return v_result;
end;
$$;

create function public.release_webvault_stripe_event(p_user_id uuid, p_token uuid)
returns void language sql security invoker set search_path = '' as $$
  update public.webvault_stripe_sync_locks set lock_token = null, locked_until = null
    where user_id = p_user_id and lock_token = p_token;
$$;

create function public.reserve_webvault_request(p_scope text, p_subject text, p_user_id uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_usage public.webvault_request_usage%rowtype;
  v_now timestamptz := clock_timestamp();
  v_day date := (v_now at time zone 'UTC')::date;
  v_month date := date_trunc('month', v_now at time zone 'UTC')::date;
  v_minute timestamptz := date_trunc('minute', v_now);
  v_daily integer;
  v_monthly integer;
  v_per_minute integer;
  v_concurrent integer;
  v_lease_seconds integer;
  v_token uuid := gen_random_uuid();
  v_reason text;
  v_retry integer;
begin
  if p_scope = 'ai' then
    if p_user_id is null or p_subject <> p_user_id::text then raise exception 'Invalid AI subject'; end if;
    -- Recheck protected entitlement in the same reservation transaction.
    if not exists (select 1 from public.profiles where id = p_user_id and is_pro
      and stripe_subscription_status in ('active', 'trialing', 'manual_founder')) then
      return jsonb_build_object('allowed', false, 'reason', 'forbidden', 'retry_after', 0);
    end if;
    v_daily := 20; v_monthly := 200; v_per_minute := 6; v_concurrent := 1; v_lease_seconds := 45;
  elsif p_scope = 'metadata' then
    if p_user_id is not null or p_subject !~ '^(shared|[a-f0-9]{64})$' then raise exception 'Invalid metadata subject'; end if;
    v_daily := 300; v_monthly := 5000; v_per_minute := 30; v_concurrent := 3; v_lease_seconds := 15;
  else raise exception 'Invalid request scope'; end if;
  insert into public.webvault_request_usage(scope, subject, user_id, day_start, month_start, minute_start)
    values (p_scope, p_subject, p_user_id, v_day, v_month, v_minute) on conflict do nothing;
  select * into strict v_usage from public.webvault_request_usage where scope = p_scope and subject = p_subject for update;
  v_now := clock_timestamp();
  v_day := (v_now at time zone 'UTC')::date;
  v_month := date_trunc('month', v_now at time zone 'UTC')::date;
  v_minute := date_trunc('minute', v_now);
  if v_usage.day_start <> v_day then v_usage.day_count := 0; end if;
  if v_usage.month_start <> v_month then v_usage.month_count := 0; end if;
  if v_usage.minute_start <> v_minute then v_usage.minute_count := 0; end if;
  delete from public.webvault_request_leases where scope = p_scope and subject = p_subject and expires_at <= v_now;
  if v_usage.month_count >= v_monthly then
    v_reason := 'monthly'; v_retry := ceil(extract(epoch from ((v_month + interval '1 month') at time zone 'UTC' - v_now)));
  elsif v_usage.day_count >= v_daily then
    v_reason := 'daily'; v_retry := ceil(extract(epoch from ((v_day + 1)::timestamp at time zone 'UTC' - v_now)));
  elsif v_usage.minute_count >= v_per_minute then
    v_reason := 'minute'; v_retry := ceil(extract(epoch from (v_minute + interval '1 minute' - v_now)));
  elsif (select count(*) from public.webvault_request_leases where scope = p_scope and subject = p_subject) >= v_concurrent then
    v_reason := 'concurrent';
    select ceil(extract(epoch from (min(expires_at) - v_now)))::integer into v_retry
      from public.webvault_request_leases where scope = p_scope and subject = p_subject;
  end if;
  if v_reason is not null then
    return jsonb_build_object('allowed', false, 'reason', v_reason, 'retry_after', greatest(1, v_retry));
  end if;
  update public.webvault_request_usage set day_start = v_day, month_start = v_month, minute_start = v_minute,
    day_count = v_usage.day_count + 1, month_count = v_usage.month_count + 1, minute_count = v_usage.minute_count + 1
    where scope = p_scope and subject = p_subject;
  insert into public.webvault_request_leases(token, scope, subject, expires_at)
    values (v_token, p_scope, p_subject, v_now + make_interval(secs => v_lease_seconds));
  return jsonb_build_object('allowed', true, 'token', v_token,
    'daily_remaining', v_daily - v_usage.day_count - 1, 'monthly_remaining', v_monthly - v_usage.month_count - 1);
end;
$$;

create function public.release_webvault_request(p_token uuid)
returns void language sql security invoker set search_path = '' as $$
  delete from public.webvault_request_leases where token = p_token;
$$;

revoke all on function public.claim_webvault_stripe_event(text, uuid),
  public.finish_webvault_stripe_event(text, uuid, uuid, text, text, text, text),
  public.release_webvault_stripe_event(uuid, uuid), public.reserve_webvault_request(text, text, uuid),
  public.release_webvault_request(uuid) from public, anon, authenticated;
grant execute on function public.claim_webvault_stripe_event(text, uuid),
  public.finish_webvault_stripe_event(text, uuid, uuid, text, text, text, text),
  public.release_webvault_stripe_event(uuid, uuid), public.reserve_webvault_request(text, text, uuid),
  public.release_webvault_request(uuid) to service_role;
