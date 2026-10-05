import test from "node:test";
import assert from "node:assert/strict";
import { sourceModules } from "./helpers/load-source.mjs";

const user="00000000-0000-4000-8000-000000000101";
const session="00000000-0000-4000-8000-000000000001";
const token=(claims={session_id:session})=>"header."+Buffer.from(JSON.stringify(claims)).toString("base64url")+".signature";
function fixture({allowed=true,error=null,authError=null}={}) {
  const calls=[];
  const load=sourceModules({
    "@supabase/supabase-js":{createClient:()=>({auth:{getUser:async t=>{calls.push(["verify",t]);return{data:{user:authError?null:{id:user}},error:authError};}}})},
    "@/lib/supabase-admin":{getSupabaseAdmin:()=>({rpc:async(name,args)=>{calls.push([name,args]);return{data:allowed,error};}})},
  },{process:{env:{NEXT_PUBLIC_SUPABASE_URL:"https://test.invalid",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"public-test"}}});
  return{calls,auth:load("@/lib/server-auth").authenticateStripeRequest};
}
const request=t=>new Request("https://webvault.site/api/ai/search",{headers:{Authorization:`Bearer ${t}`,"X-WebVault-Device":"a".repeat(64)}});

test("protected API validates authentication before forwarding the verified user/session and installation secret",async()=>{
  const f=fixture();const result=await f.auth(request(token()),undefined,true);
  assert.equal(result.user.id,user);assert.equal(f.calls[0][0],"verify");
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[1])),["check_webvault_device_access",{p_user_id:user,p_session_id:session,p_device_secret:"a".repeat(64)}]);
});
test("protected API rejects blocked devices and fails closed on database errors",async()=>{
  assert.equal((await fixture({allowed:false}).auth(request(token()),undefined,true)).status,403);
  assert.equal((await fixture({error:new Error("Unavailable")}).auth(request(token()),undefined,true)).status,503);
});
test("unverified or malformed tokens never invoke the device authorization RPC",async()=>{
  for(const [f,t] of [[fixture({authError:new Error("Bad signature")}),token()],[fixture(),token({session_id:"not-a-uuid"})]]) {
    assert.equal((await f.auth(request(t),undefined,true)).status,401);assert.equal(f.calls.length,1);
  }
});
test("billing remains available while device admission is blocked",async()=>{
  const f=fixture({allowed:false});assert.equal((await f.auth(request(token()))).user.id,user);assert.equal(f.calls.length,1);
});
