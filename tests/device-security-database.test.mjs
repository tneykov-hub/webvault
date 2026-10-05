import test from "node:test";
import assert from "node:assert/strict";
import { deviceDatabase,identity,asAdmin,rpc,approve,owner,other,sid,secret } from "./helpers/device-db.mjs";

async function fixture(t) { const db=await deviceDatabase(); t.after(()=>db.close()); return db; }
async function activate(db,n,takeover=false,activate=true) {
  await identity(db,{session:sid(n),device:secret(n)});
  return rpc(db,"webvault_device_access",[secret(n),`Device ${n}`,takeover,activate]);
}

test("staged migration preserves existing owner access until enforcement is enabled",async t=>{
  const db=await fixture(t);
  await identity(db);
  assert.equal((await db.query("select * from public.sites")).rows.length,1);
  await asAdmin(db,"update webvault_private.device_security_settings set enforced=true");
  await identity(db);
  assert.equal((await db.query("select * from public.sites")).rows.length,0);
  assert.equal((await rpc(db,"webvault_device_access",[secret(1),"Phone",false,true])).status,"verification_required");
});

test("password and editable user_metadata cannot approve a device",async t=>{
  const db=await fixture(t); await identity(db);
  const {challenge}=await rpc(db,"request_webvault_device_confirmation",[secret(1),"Phone"]);
  await identity(db,{metadata:{amr:[{method:"magiclink",timestamp:Math.floor(Date.now()/1000)}],device_approved:true}});
  await assert.rejects(rpc(db,"confirm_webvault_device",[challenge,null]),/account email/);
  assert.equal((await asAdmin(db,"select * from webvault_private.devices")).rows.length,0);
});

test("fresh email approval is bound to the requested installation and user",async t=>{
  const db=await fixture(t);await identity(db);
  const {challenge}=await rpc(db,"request_webvault_device_confirmation",[secret(1),"Android"]);
  await identity(db,{user:other,session:sid(8),device:secret(8),method:"magiclink"});
  await assert.rejects(rpc(db,"confirm_webvault_device",[challenge,null]),/expired|used/);
  await identity(db,{session:sid(7),device:secret(7),method:"magiclink"});
  assert.equal((await rpc(db,"confirm_webvault_device",[challenge,null])).status,"confirmed");
  await assert.rejects(rpc(db,"confirm_webvault_device",[challenge,null]),/expired|used/);
  assert.equal((await activate(db,1)).status,"active");
  assert.equal((await activate(db,7)).status,"verification_required");
});

test("PRO allows three approvals and a fourth requires an explicit owned replacement",async t=>{
  const db=await fixture(t);
  for(let n=1;n<=3;n++) assert.equal((await approve(db,n)).result.status,"confirmed");
  const fourth=await approve(db,4);assert.equal(fourth.result.status,"device_limit");
  const registered=await asAdmin(db,"select id from webvault_private.devices where user_id=$1 order by label",[owner]);
  await identity(db,{session:sid(7),device:secret(7),method:"magiclink"});
  await assert.rejects(rpc(db,"confirm_webvault_device",[fourth.challenge,sid(99)]),/not registered/);
  assert.equal((await rpc(db,"confirm_webvault_device",[fourth.challenge,registered.rows[0].id])).status,"confirmed");
  const count=await asAdmin(db,"select count(*)::int as n from webvault_private.devices where revoked_at is null");
  assert.equal(count.rows[0].n,3);
  assert.equal((await activate(db,1)).status,"verification_required");
});

test("a single active session is enforced even through duplicate permissive RLS policies",async t=>{
  const db=await fixture(t);await approve(db,1);await approve(db,2);
  await asAdmin(db,"update webvault_private.device_security_settings set enforced=true");
  assert.equal((await activate(db,1)).status,"active");
  assert.equal((await db.query("select * from public.sites")).rows.length,1);
  assert.equal((await activate(db,2)).status,"active_elsewhere");
  assert.equal((await db.query("select * from public.sites")).rows.length,0);
  await assert.rejects(db.query("insert into public.sites(user_id,name) values($1,'Bypass')",[owner]),/row-level security/);
  assert.equal((await activate(db,2,true)).status,"active");
  assert.equal((await db.query("select * from public.sites")).rows.length,1);
  assert.equal((await activate(db,1,false,false)).status,"active_elsewhere");
  assert.equal((await db.query("select * from public.sites")).rows.length,0);
  assert.equal((await db.query("select * from public.categories")).rows.length,0);
  assert.equal((await db.query("select * from storage.objects")).rows.length,0);
});

test("a copied JWT without the installation secret and a copied digest do not grant data access",async t=>{
  const db=await fixture(t);await approve(db,1);
  await asAdmin(db,"update webvault_private.device_security_settings set enforced=true");
  await activate(db,1);
  const hash=(await asAdmin(db,"select secret_hash from webvault_private.devices")).rows[0].secret_hash;
  for(const device of ["",secret(2),hash]) {
    await identity(db,{device}); assert.equal((await db.query("select * from public.sites")).rows.length,0);
  }
  await assert.rejects(db.query("select * from webvault_private.devices"),/permission denied/);
  await assert.rejects(rpc(db,"check_webvault_device_access",[owner,sid(1),secret(1)]),/permission denied/);
});

test("revocation and deleted auth sessions invalidate still-unexpired JWT access immediately",async t=>{
  const db=await fixture(t);await approve(db,1);await approve(db,2);
  await asAdmin(db,"update webvault_private.device_security_settings set enforced=true");
  await activate(db,1);
  const devices=(await asAdmin(db,"select id from webvault_private.devices order by label")).rows;
  await identity(db);await rpc(db,"revoke_webvault_device",[devices[1].id]);
  assert.equal((await activate(db,2,true)).status,"verification_required");
  await activate(db,1);
  await asAdmin(db,"delete from auth.sessions where id=$1",[sid(1)]);await identity(db);
  assert.equal((await db.query("select * from public.sites")).rows.length,0);
});

test("FREE and a PRO downgrade cannot access several previously approved devices",async t=>{
  const db=await fixture(t);await approve(db,1);await approve(db,2);
  await activate(db,1);
  await asAdmin(db,"update webvault_private.device_security_settings set enforced=true");
  await asAdmin(db,"update public.profiles set is_pro=false where id=$1",[owner]);
  assert.equal((await activate(db,2,true)).status,"verification_required");
  assert.equal((await activate(db,1,true)).status,"active");
  assert.equal((await approve(db,3)).result.status,"device_limit");
});

test("expired leases deny data and an inactive heartbeat cannot take over another device",async t=>{
  const db=await fixture(t);await approve(db,1);await approve(db,2);
  await asAdmin(db,"update webvault_private.device_security_settings set enforced=true");await activate(db,1);
  await asAdmin(db,"update webvault_private.device_leases set expires_at=now()-interval '1 second'");
  await identity(db);assert.equal((await db.query("select * from public.sites")).rows.length,0);
  assert.equal((await activate(db,2)).status,"active");
  assert.equal((await activate(db,1,false,false)).status,"active_elsewhere");
  await identity(db,{session:sid(2),device:secret(2)});
  assert.equal((await db.query("select * from public.sites")).rows.length,1);
});

test("expired, old and future email proofs fail and request bursts are bounded",async t=>{
  const db=await fixture(t);await identity(db);
  const {challenge}=await rpc(db,"request_webvault_device_confirmation",[secret(1),"Phone"]);
  await assert.rejects(rpc(db,"request_webvault_device_confirmation",[secret(2),"Other"]),/60 seconds/);
  for(const timestamp of [Math.floor(Date.now()/1000)-1000,Math.floor(Date.now()/1000)+1000]) {
    await identity(db,{method:"magiclink",timestamp});await assert.rejects(rpc(db,"confirm_webvault_device",[challenge,null]),/account email/);
  }
  await asAdmin(db,"update webvault_private.device_confirmations set expires_at=now()-interval '1 second'");
  await identity(db,{method:"magiclink"});await assert.rejects(rpc(db,"confirm_webvault_device",[challenge,null]),/expired|used/);
});

test("anonymous callers cannot use the elevated private or public functions",async t=>{
  const db=await fixture(t);await db.exec("set role anon");
  await assert.rejects(rpc(db,"webvault_device_access",[secret(1),"Phone",true,true]),/permission denied/);
  await assert.rejects(db.query("select webvault_private.access_allowed($1,$2,$3)",[owner,sid(1),secret(1)]),/permission denied/);
});
