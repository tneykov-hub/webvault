-- Staged rollout: install with enforcement OFF, deploy the web/native clients,
-- verify email approval, then enable explicitly. Existing accounts/data are kept.
create schema if not exists webvault_private;
revoke all on schema webvault_private from public, anon;
grant usage on schema webvault_private to authenticated, service_role;

create table webvault_private.device_security_settings (
  singleton boolean primary key default true check (singleton),
  enforced boolean not null default false
);
insert into webvault_private.device_security_settings(singleton,enforced) values(true,false);

create table webvault_private.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  secret_hash text not null check (length(secret_hash)=64),
  label text not null check (length(label) between 1 and 120),
  approved_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(user_id,secret_hash)
);
create index webvault_devices_owner_idx on webvault_private.devices(user_id) where revoked_at is null;

create table webvault_private.device_leases (
  user_id uuid primary key references auth.users(id) on delete cascade,
  device_id uuid not null references webvault_private.devices(id) on delete cascade,
  session_id uuid not null,
  expires_at timestamptz not null
);

create table webvault_private.device_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  secret_hash text not null,
  label text not null check (length(label) between 1 and 120),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp()+interval '10 minutes',
  used_at timestamptz
);
create index webvault_confirmation_owner_idx on webvault_private.device_confirmations(user_id,created_at desc);

alter table webvault_private.device_security_settings enable row level security;
alter table webvault_private.devices enable row level security;
alter table webvault_private.device_leases enable row level security;
alter table webvault_private.device_confirmations enable row level security;
revoke all on all tables in schema webvault_private from public, anon, authenticated;
grant select,insert,update,delete on all tables in schema webvault_private to service_role;

create function webvault_private.device_hash(p_secret text)
returns text language sql immutable strict set search_path='' as $$
  select case when p_secret ~ '^[a-f0-9]{64}$' then encode(sha256(convert_to(p_secret,'UTF8')),'hex') end;
$$;

create function webvault_private.live_session()
returns uuid language sql stable security definer set search_path='' as $$
  select s.id from auth.sessions s where s.id=nullif(auth.jwt()->>'session_id','')::uuid
    and s.user_id=auth.uid() and (s.not_after is null or s.not_after>now());
$$;

create function webvault_private.fresh_email_proof(p_after timestamptz default now()-interval '10 minutes')
returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) m
    where m->>'method' in ('otp','magiclink','recovery','email/signup','email_change')
    and (m->>'timestamp') ~ '^[0-9]{1,12}$'
    and to_timestamp((m->>'timestamp')::double precision)>=date_trunc('second',p_after)
    and to_timestamp((m->>'timestamp')::double precision)<=now()+interval '30 seconds'
    and to_timestamp((m->>'timestamp')::double precision)>now()-interval '10 minutes');
$$;

create function webvault_private.device_list(p_secret text)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'label',d.label,'approved_at',d.approved_at,
    'last_seen_at',d.last_seen_at,'current',coalesce(d.secret_hash=webvault_private.device_hash(p_secret),false))
    order by d.last_seen_at desc),'[]'::jsonb)
  from webvault_private.devices d where d.user_id=auth.uid() and d.revoked_at is null;
$$;

-- This internal predicate is also called by the server-only API guard. Its caller
-- must already have verified the JWT; clients cannot supply another user/session.
create function webvault_private.access_allowed(p_user_id uuid,p_session_id uuid,p_secret text)
returns boolean language sql stable security definer set search_path='' as $$
  select case when p_user_id is null then false
    when not (select enforced from webvault_private.device_security_settings where singleton) then true
    else exists(select 1 from webvault_private.device_leases l
      join webvault_private.devices d on d.id=l.device_id and d.user_id=l.user_id
      join auth.sessions s on s.id=l.session_id and s.user_id=l.user_id
      where l.user_id=p_user_id and l.session_id=p_session_id and l.expires_at>now()
        and d.revoked_at is null and d.secret_hash=webvault_private.device_hash(p_secret)
        and (s.not_after is null or s.not_after>now())
        and d.id in (select permitted.id from webvault_private.devices permitted
          where permitted.user_id=p_user_id and permitted.revoked_at is null order by permitted.approved_at,permitted.id
          limit (select case when is_pro then 3 else 1 end from public.profiles where id=p_user_id))) end;
$$;

create function webvault_private.has_device_access()
returns boolean language sql stable security definer set search_path='' as $$
  select webvault_private.access_allowed(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid,
    coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb)->>'x-webvault-device');
$$;

create function webvault_private.device_access(p_device_secret text,p_device_label text,p_takeover boolean,p_activate boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  u uuid:=auth.uid(); s uuid:=webvault_private.live_session(); lim integer;
  d webvault_private.devices%rowtype; l webvault_private.device_leases%rowtype;
  c webvault_private.device_confirmations%rowtype; payload jsonb; label_elsewhere text;
begin
  if u is null or s is null then return jsonb_build_object('status','sign_in_required','devices','[]'::jsonb,'limit',0); end if;
  if webvault_private.device_hash(p_device_secret) is null then raise exception 'Invalid installation secret'; end if;
  -- Every admission, approval and revocation locks the same account row.
  select case when is_pro then 3 else 1 end into lim from public.profiles where id=u for update;
  if lim is null then raise exception 'Account setup is required'; end if;
  payload:=jsonb_build_object('limit',lim,'devices',webvault_private.device_list(p_device_secret));
  select * into c from webvault_private.device_confirmations where user_id=u and used_at is null
    and expires_at>now() and webvault_private.fresh_email_proof(created_at) order by created_at desc limit 1;
  if found then payload:=payload||jsonb_build_object('confirmation',jsonb_build_object('id',c.id,'label',c.label)); end if;
  select * into d from webvault_private.devices where user_id=u
    and secret_hash=webvault_private.device_hash(p_device_secret) and revoked_at is null;
  if not found then return payload||jsonb_build_object('status','verification_required'); end if;
  -- Downgrades cannot retain a pool of previously approved PRO installations.
  if not exists(select 1 from (select id from webvault_private.devices where user_id=u and revoked_at is null
      order by approved_at,id limit lim) permitted where permitted.id=d.id) then
    return payload||jsonb_build_object('status','verification_required');
  end if;
  select * into l from webvault_private.device_leases where user_id=u;
  if l.session_id=s and l.device_id=d.id then
    update webvault_private.device_leases set expires_at=clock_timestamp()+interval '120 seconds' where user_id=u;
  elsif p_activate and (p_takeover or l.user_id is null or l.expires_at<=now()) then
    insert into webvault_private.device_leases(user_id,device_id,session_id,expires_at)
      values(u,d.id,s,clock_timestamp()+interval '120 seconds')
      on conflict(user_id) do update set device_id=excluded.device_id,session_id=excluded.session_id,expires_at=excluded.expires_at;
  else
    select label into label_elsewhere from webvault_private.devices where id=l.device_id;
    return payload||jsonb_build_object('status','active_elsewhere','active_label',label_elsewhere);
  end if;
  update webvault_private.devices set last_seen_at=clock_timestamp(),label=left(coalesce(nullif(p_device_label,''),label),120) where id=d.id;
  return payload||jsonb_build_object('status','active');
end;
$$;

create function webvault_private.request_confirmation(p_device_secret text,p_device_label text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); challenge uuid; h text:=webvault_private.device_hash(p_device_secret);
begin
  if u is null or webvault_private.live_session() is null then raise exception 'Sign in again to confirm a device'; end if;
  if h is null then raise exception 'Invalid installation secret'; end if;
  perform 1 from public.profiles where id=u for update;
  delete from webvault_private.device_confirmations where user_id=u and created_at<now()-interval '24 hours';
  if exists(select 1 from webvault_private.device_confirmations where user_id=u and created_at>now()-interval '60 seconds') then
    raise exception 'Please wait 60 seconds before requesting another confirmation'; end if;
  if (select count(*) from webvault_private.device_confirmations where user_id=u and created_at>now()-interval '1 hour')>=6 then
    raise exception 'Too many confirmation requests. Please try again later'; end if;
  update webvault_private.device_confirmations set used_at=now() where user_id=u and secret_hash=h and used_at is null;
  insert into webvault_private.device_confirmations(user_id,secret_hash,label)
    values(u,h,left(coalesce(nullif(p_device_label,''),'WebVault device'),120)) returning id into challenge;
  return jsonb_build_object('challenge',challenge);
end;
$$;

create function webvault_private.confirm_device(p_challenge uuid,p_replace_device uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); lim integer; c webvault_private.device_confirmations%rowtype;
begin
  if u is null or webvault_private.live_session() is null then raise exception 'Sign in again to confirm a device'; end if;
  select case when is_pro then 3 else 1 end into lim from public.profiles where id=u for update;
  select * into c from webvault_private.device_confirmations where id=p_challenge and user_id=u and used_at is null and expires_at>now();
  if not found then raise exception 'This confirmation has expired or has already been used'; end if;
  if not webvault_private.fresh_email_proof(c.created_at) then raise exception 'Open the confirmation link from your account email'; end if;
  if p_replace_device is not null then
    if not exists(select 1 from webvault_private.devices where id=p_replace_device and user_id=u and revoked_at is null) then
      raise exception 'The selected device is not registered to this account'; end if;
  end if;
  if not exists(select 1 from webvault_private.devices where user_id=u and secret_hash=c.secret_hash and revoked_at is null)
    and (select count(*) from webvault_private.devices where user_id=u and revoked_at is null and (p_replace_device is null or id<>p_replace_device))>=lim then
    -- A failed approval does not consume the link; the owner may select a slot.
    return jsonb_build_object('status','device_limit','limit',lim,'devices',webvault_private.device_list(null));
  end if;
  if p_replace_device is not null then
    update webvault_private.devices set revoked_at=clock_timestamp() where id=p_replace_device and user_id=u;
    delete from webvault_private.device_leases where user_id=u and device_id=p_replace_device;
  end if;
  insert into webvault_private.devices(user_id,secret_hash,label) values(u,c.secret_hash,c.label)
    on conflict(user_id,secret_hash) do update set approved_at=clock_timestamp(),revoked_at=null,label=excluded.label;
  update webvault_private.device_confirmations set used_at=clock_timestamp() where id=c.id;
  return jsonb_build_object('status','confirmed');
end;
$$;

create function webvault_private.revoke_device(p_device_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
  if webvault_private.live_session() is null or not webvault_private.has_device_access() then raise exception 'Use an active device to remove a registration'; end if;
  -- Even during staging, removal requires a real approved, active installation.
  if not exists(select 1 from webvault_private.device_leases l join webvault_private.devices d on d.id=l.device_id
      where l.user_id=u and l.session_id=webvault_private.live_session() and l.expires_at>now() and d.revoked_at is null
      and d.secret_hash=webvault_private.device_hash(coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}')->>'x-webvault-device')) then
    raise exception 'Use an active device to remove a registration'; end if;
  perform 1 from public.profiles where id=u for update;
  update webvault_private.devices set revoked_at=clock_timestamp() where id=p_device_id and user_id=u and revoked_at is null;
  if not found then raise exception 'The selected device is not registered to this account'; end if;
  delete from webvault_private.device_leases where user_id=u and device_id=p_device_id;
end;
$$;

create function webvault_private.release_access(p_device_secret text)
returns void language sql security definer set search_path='' as $$
  delete from webvault_private.device_leases l using webvault_private.devices d
    where l.user_id=auth.uid() and l.session_id=webvault_private.live_session() and d.id=l.device_id
      and d.secret_hash=webvault_private.device_hash(p_device_secret);
$$;

create function webvault_private.on_plan_downgrade()
returns trigger language plpgsql security definer set search_path='' as $$
declare keep_device uuid;
begin
  -- Keep the currently used installation when possible; otherwise the last used.
  select d.id into keep_device from webvault_private.devices d
    left join webvault_private.device_leases l on l.device_id=d.id and l.user_id=d.user_id and l.expires_at>now()
    where d.user_id=new.id and d.revoked_at is null order by (l.user_id is not null) desc,d.last_seen_at desc,d.id limit 1;
  update webvault_private.devices set revoked_at=clock_timestamp() where user_id=new.id and revoked_at is null and id<>keep_device;
  delete from webvault_private.device_leases where user_id=new.id and device_id<>keep_device;
  return new;
end;
$$;
create trigger webvault_device_plan_downgrade after update of is_pro on public.profiles
  for each row when (old.is_pro is true and new.is_pro is false) execute function webvault_private.on_plan_downgrade();

-- Public wrappers carry no elevated privileges. All elevated implementations are
-- private, check the authenticated identity, and have explicit EXECUTE grants.
create function public.webvault_device_access(p_device_secret text,p_device_label text default 'WebVault device',p_takeover boolean default false,p_activate boolean default true)
returns jsonb language sql security invoker set search_path='' as $$
  select webvault_private.device_access(p_device_secret,p_device_label,p_takeover,p_activate);
$$;
create function public.request_webvault_device_confirmation(p_device_secret text,p_device_label text default 'WebVault device')
returns jsonb language sql security invoker set search_path='' as $$
  select webvault_private.request_confirmation(p_device_secret,p_device_label);
$$;
create function public.confirm_webvault_device(p_challenge uuid,p_replace_device uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
  select webvault_private.confirm_device(p_challenge,p_replace_device);
$$;
create function public.revoke_webvault_device(p_device_id uuid)
returns void language sql security invoker set search_path='' as $$ select webvault_private.revoke_device(p_device_id); $$;
create function public.release_webvault_device_access(p_device_secret text)
returns void language sql security invoker set search_path='' as $$ select webvault_private.release_access(p_device_secret); $$;
create function public.check_webvault_device_access(p_user_id uuid,p_session_id uuid,p_device_secret text)
returns boolean language sql security invoker set search_path='' as $$
  select webvault_private.access_allowed(p_user_id,p_session_id,p_device_secret);
$$;

revoke all on all functions in schema webvault_private from public,anon,authenticated;
grant execute on function webvault_private.device_access(text,text,boolean,boolean),webvault_private.request_confirmation(text,text),
  webvault_private.confirm_device(uuid,uuid),webvault_private.revoke_device(uuid),webvault_private.release_access(text),
  webvault_private.has_device_access() to authenticated;
grant execute on function webvault_private.access_allowed(uuid,uuid,text) to service_role;
revoke all on function public.webvault_device_access(text,text,boolean,boolean),public.request_webvault_device_confirmation(text,text),
  public.confirm_webvault_device(uuid,uuid),public.revoke_webvault_device(uuid),public.release_webvault_device_access(text),
  public.check_webvault_device_access(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.webvault_device_access(text,text,boolean,boolean),public.request_webvault_device_confirmation(text,text),
  public.confirm_webvault_device(uuid,uuid),public.revoke_webvault_device(uuid),public.release_webvault_device_access(text) to authenticated;
grant execute on function public.check_webvault_device_access(uuid,uuid,text) to service_role;

-- Restrictive policies AND with every existing ownership policy, including the
-- legacy duplicate policies. No permissive owner policy can bypass this guard.
create policy "WebVault active device required" on public.sites as restrictive for all to authenticated
  using((select webvault_private.has_device_access())) with check((select webvault_private.has_device_access()));
create policy "WebVault active device required" on public.categories as restrictive for all to authenticated
  using((select webvault_private.has_device_access())) with check((select webvault_private.has_device_access()));
-- Own plan/billing status can still be read while blocked; personal-data writes
-- require the active device. Subscription/entitlement grants stay protected.
create policy "WebVault active device required for profile updates" on public.profiles as restrictive for update to authenticated
  using((select webvault_private.has_device_access())) with check((select webvault_private.has_device_access()));
create policy "WebVault active device required for icons" on storage.objects as restrictive for all to authenticated
  using(bucket_id<>'site-icons' or (select webvault_private.has_device_access()))
  with check(bucket_id<>'site-icons' or (select webvault_private.has_device_access()));
