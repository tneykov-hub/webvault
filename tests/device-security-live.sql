-- Run as the database owner. All test users, registrations and policy-mode
-- changes are inside a transaction that is always rolled back on success.
-- No email, provider request, customer credential or persistent account change.
begin;
do $$
declare
  u uuid:=gen_random_uuid(); s1 uuid:=gen_random_uuid(); s2 uuid:=gen_random_uuid();
  secret1 text:=repeat('a',64); secret2 text:=repeat('b',64); claims jsonb;
  challenge uuid; result jsonb; n integer; denied boolean:=false; category uuid;
begin
  insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
    values(u,'webvault-device-test-'||u::text||'@example.invalid','{}','{}');
  update public.profiles set is_pro=true where id=u;
  insert into auth.sessions(id,user_id) values(s1,u),(s2,u);
  select id into category from public.categories where user_id=u limit 1;
  insert into public.sites(user_id,name,url,domain,category_id)
    values(u,'Temporary device test','https://example.invalid/','example.invalid',category);
  update webvault_private.device_security_settings set enforced=true;
  claims:=jsonb_build_object('sub',u,'role','authenticated','session_id',s1,
    'amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now())::bigint)));
  perform set_config('request.jwt.claims',claims::text,true);
  perform set_config('request.headers',jsonb_build_object('x-webvault-device',secret1)::text,true);
  execute 'set local role authenticated';
  result:=public.webvault_device_access(secret1,'Temporary phone',false,true);
  assert result->>'status'='verification_required','Password-only device unexpectedly admitted';
  select count(*) into n from public.sites where user_id=u;
  assert n=0,'Unapproved session bypassed RLS';
  result:=public.request_webvault_device_confirmation(secret1,'Temporary phone');
  challenge:=(result->>'challenge')::uuid;
  begin
    perform public.confirm_webvault_device(challenge,null);
  exception when raise_exception then denied:=true;
  end;
  assert denied,'Password-only approval unexpectedly succeeded';
  execute 'reset role';
  claims:=jsonb_set(claims,'{amr}',jsonb_build_array(jsonb_build_object('method','magiclink','timestamp',extract(epoch from now())::bigint)));
  perform set_config('request.jwt.claims',claims::text,true);
  execute 'set local role authenticated';
  result:=public.confirm_webvault_device(challenge,null);
  assert result->>'status'='confirmed','Fresh email proof failed';
  result:=public.webvault_device_access(secret1,'Temporary phone',false,true);
  assert result->>'status'='active','Approved device could not activate';
  select count(*) into n from public.sites where user_id=u;
  assert n=1,'Active installation could not read its test bookmark';
  execute 'reset role';
  insert into webvault_private.devices(user_id,secret_hash,label)
    values(u,webvault_private.device_hash(secret2),'Temporary computer');
  claims:=jsonb_set(claims,'{session_id}',to_jsonb(s2::text));
  perform set_config('request.jwt.claims',claims::text,true);
  perform set_config('request.headers',jsonb_build_object('x-webvault-device',secret2)::text,true);
  execute 'set local role authenticated';
  result:=public.webvault_device_access(secret2,'Temporary computer',false,true);
  assert result->>'status'='active_elsewhere','Second device was admitted simultaneously';
  result:=public.webvault_device_access(secret2,'Temporary computer',true,true);
  assert result->>'status'='active','Explicit transfer failed';
  execute 'reset role';
  claims:=jsonb_set(claims,'{session_id}',to_jsonb(s1::text));
  perform set_config('request.jwt.claims',claims::text,true);
  perform set_config('request.headers',jsonb_build_object('x-webvault-device',secret1)::text,true);
  execute 'set local role authenticated';
  select count(*) into n from public.sites where user_id=u;
  assert n=0,'Previous session retained data access after transfer';
  result:=public.webvault_device_access(secret1,'Temporary phone',false,false);
  assert result->>'status'='active_elsewhere','An old heartbeat stole the active session';
  assert not has_function_privilege('authenticated','public.check_webvault_device_access(uuid,uuid,text)','EXECUTE'),
    'Authenticated clients can call the server-only authorization API';
  execute 'reset role';
end;
$$;
rollback;
select (select enforced from webvault_private.device_security_settings) as enforced,
  (select count(*) from public.profiles) as profiles,
  (select md5(string_agg(to_jsonb(p)::text,',' order by id)) from public.profiles p) as profile_digest,
  (select count(*) from webvault_private.devices) as persisted_test_devices,
  (select count(*) from auth.users where email like 'webvault-device-test-%@example.invalid') as persisted_test_users;
