// Manual browser checks: real built React UI with mocked Auth/REST responses.
// Database/RLS and live rolled-back checks are separate, executable tests.
import { createRequire } from "node:module";
import { mkdir,writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const require=createRequire(import.meta.url);
let playwright;
try { playwright=require("playwright"); }
catch { playwright=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,"playwright")); }
const base=process.env.WEBVAULT_TEST_URL??"http://127.0.0.1:3000";
const output=path.resolve(process.env.WEBVAULT_TEST_OUTPUT_DIR??"docs/device-security/browser");
await mkdir(output,{recursive:true});
const launchOptions={headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]};
if(process.env.WEBVAULT_TEST_CHROMIUM_MODULE) {
  const chromiumModule=require(process.env.WEBVAULT_TEST_CHROMIUM_MODULE);
  const chromium=chromiumModule.default??chromiumModule;
  launchOptions.executablePath=await chromium.executablePath();
  launchOptions.args=chromium.args;
}
let browserVersion="";
const user={id:"00000000-0000-4000-8000-000000000101",aud:"authenticated",role:"authenticated",email:"device-tester@example.invalid",app_metadata:{provider:"email"},user_metadata:{full_name:"Device Tester"}};
const session={access_token:"header."+Buffer.from(JSON.stringify({sub:user.id,session_id:"00000000-0000-4000-8000-000000000001",exp:Math.floor(Date.now()/1000)+3600})).toString("base64url")+".signature",token_type:"bearer",expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:"test-only-refresh",user};
const ids=[1,2,3].map(n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`);
const devices=ids.map((id,i)=>({id,label:i===0?"Windows · Chrome":i===1?"Android · Chrome":"iPhone · Safari",current:i===0,approved_at:new Date().toISOString(),last_seen_at:new Date().toISOString()}));
const checks=[];
const pageErrors=[];

async function scenario(name,language,mobile,status,confirmation,fn) {
  const browser=await playwright.chromium.launch(launchOptions);
  browserVersion=await browser.version();
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile});
  const state={status,limit:3,devices:structuredClone(devices),confirmation};
  const calls=[];
  await context.addInitScript(({session,language})=>{
    if(!/^https?:$/.test(window.location.protocol))return;
    localStorage.setItem("sb-imnekcjyzjzgskkplyri-auth-token",JSON.stringify(session));
    localStorage.setItem("webvault-language",language);
    localStorage.setItem("webvault-installation-secret-v1","a".repeat(64));
  },{session,language});
  const page=await context.newPage();
  page.on("pageerror",e=>pageErrors.push({scenario:name,error:e.message}));
  await page.routeWebSocket(/supabase\.co/,ws=>ws.close());
  await page.route("**/*",async route=>{
    const req=route.request();const url=new URL(req.url());
    if(url.hostname==="127.0.0.1"||url.hostname==="localhost") return route.continue();
    if(!url.hostname.endsWith("supabase.co")) return route.fulfill({status:200,contentType:"image/png",body:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMp8AAAAASUVORK5CYII=","base64")});
    const body=req.postDataJSON();
    calls.push({pathname:url.pathname,body,device:req.headers()["x-webvault-device"]});
    let data=null;
    if(url.pathname.endsWith("/user")) data=user;
    else if(url.pathname.endsWith("/logout")) return route.fulfill({status:204});
    else if(url.pathname.endsWith("/otp")) data={user:null,session:null};
    else if(url.pathname.endsWith("/rpc/webvault_device_access")) {
      assert.equal(body.p_device_secret,"a".repeat(64));
      if(body.p_takeover) state.status="active";
      data=state;
    } else if(url.pathname.endsWith("/rpc/request_webvault_device_confirmation")) data={challenge:ids[2]};
    else if(url.pathname.endsWith("/rpc/confirm_webvault_device")) {
      if(!body.p_replace_device) data={status:"device_limit",devices:state.devices,limit:3};
      else { state.confirmation=undefined;data={status:"confirmed"}; }
    } else if(url.pathname.endsWith("/rpc/revoke_webvault_device")) {
      if(state.devices.some(d=>d.id===body.p_device_id&&d.current))state.status="verification_required";
      state.devices=state.devices.filter(d=>d.id!==body.p_device_id);data=null;
    } else if(url.pathname.endsWith("/profiles")) data={display_name:"Device Tester",is_pro:true,stripe_customer_id:null,stripe_subscription_id:null,stripe_subscription_status:"manual_founder"};
    else if(url.pathname.endsWith("/sites")) data=[{id:ids[0],user_id:user.id,name:"Private test bookmark",url:"https://example.invalid",domain:"example.invalid",category_id:ids[1],description:"Test-only content",is_favorite:false,position:1,open_in_new_tab:true,favicon_url:"https://www.google.com/favicon.ico"}];
    else if(url.pathname.endsWith("/categories")) data=[{id:ids[1],name:"Test category",icon:"⭐",tone:"blue",position:1,is_system:true}];
    else if(url.pathname.includes("/rpc/")) data=null;
    else data=[];
    if(Array.isArray(data)&&req.headers().accept?.includes("vnd.pgrst.object")) data=data[0]??null;
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
  });
  await page.goto(base,{waitUntil:"networkidle"});
  try { await fn(page,state,calls); }
  catch(error) {
    await page.screenshot({path:path.join(output,name+"-failed.png"),fullPage:true});
    console.error(await page.locator("body").innerText());
    await browser.close();
    throw error;
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"Horizontal overflow");
  assert.equal(await page.locator("[data-nextjs-dialog],.vite-error-overlay").count(),0);
  await page.screenshot({path:path.join(output,name+".png"),fullPage:true});
  checks.push({name,language,viewport:mobile?"mobile":"desktop",rpcCalls:calls.filter(c=>c.pathname.includes("/rpc/")).length});
  await browser.close();
}

{
  await scenario("new-device-en-desktop","en",false,"verification_required",null,async(page,state,calls)=>{
    await page.getByRole("heading",{name:"Confirm this device"}).waitFor();
    assert.equal(await page.getByText("Private test bookmark",{exact:true}).count(),0);
    await page.getByRole("button",{name:"Send confirmation email"}).click();
    await page.getByText("Email sent.",{exact:false}).waitFor();
    assert(calls.some(c=>c.pathname.endsWith("/otp")&&c.body.email===user.email));
  });
  await scenario("new-device-bg-mobile","bg",true,"verification_required",null,async page=>{
    await page.getByRole("heading",{name:"Потвърди това устройство"}).waitFor();
    await page.getByRole("button",{name:"Изпрати имейл за потвърждение"}).waitFor();
  });
  await scenario("transfer-bg-mobile","bg",true,"active_elsewhere",null,async(page,state,calls)=>{
    await page.getByRole("heading",{name:"WebVault е активен на друго устройство"}).waitFor();
    await page.getByRole("button",{name:"Използвай WebVault тук"}).click();
    await page.getByText("Private test bookmark",{exact:true}).waitFor();
    assert(calls.some(c=>c.body?.p_takeover===true));
    state.status="active_elsewhere";
    await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
    await page.getByRole("heading",{name:"WebVault е активен на друго устройство"}).waitFor();
    assert.equal(await page.getByText("Private test bookmark",{exact:true}).count(),0);
  });
  await scenario("email-approval-replacement","en",false,"verification_required",{id:ids[2],label:"New Android"},async(page,state,calls)=>{
    await page.getByRole("heading",{name:"Approve a new device"}).waitFor();
    await page.getByRole("button",{name:"Confirm device"}).click();
    await page.getByText("Your device limit is reached.",{exact:false}).waitFor();
    await page.getByRole("combobox").selectOption(ids[1]);
    await page.getByRole("button",{name:"Confirm device"}).click();
    await page.getByRole("heading",{name:/Device confirmed/}).waitFor();
    assert(calls.some(c=>c.body?.p_replace_device===ids[1]));
  });
  await scenario("profile-device-management","en",false,"active",null,async(page,state,calls)=>{
    await page.getByText("Private test bookmark",{exact:true}).waitFor();
    await page.locator("button.avatar").click();
    await page.getByText("Your devices",{exact:true}).waitFor();
    assert.equal(await page.locator(".device-manager-row").count(),3);
    page.on("dialog",dialog=>dialog.accept());
    await page.getByRole("button",{name:"Remove: Android · Chrome",exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll(".device-manager-row").length===2);
    assert(calls.some(c=>c.body?.p_device_id===ids[1]));
  });
  await scenario("expired-session","en",false,"sign_in_required",null,async page=>{
    await page.getByRole("heading",{name:"Your session has expired. Sign in again."}).waitFor();
    await page.getByRole("button",{name:"Sign out",exact:true}).click();
    await page.getByRole("button",{name:"Start for free"}).waitFor();
  });
  await scenario("remove-current-device","en",false,"active",null,async(page,state,calls)=>{
    await page.getByText("Private test bookmark",{exact:true}).waitFor();
    await page.locator("button.avatar").click();
    await page.getByText("Your devices",{exact:true}).waitFor();
    page.on("dialog",dialog=>dialog.accept());
    await page.getByRole("button",{name:"Remove: Windows · Chrome",exact:true}).click();
    await page.getByRole("heading",{name:"Confirm this device"}).waitFor();
    assert.equal(await page.getByText("Private test bookmark",{exact:true}).count(),0);
    assert(calls.some(c=>c.body?.p_device_id===ids[0]));
  });
  assert.equal(pageErrors.length,0,JSON.stringify(pageErrors));
  const http=[];
  for(const endpoint of ["/api/ai/search","/api/account/delete","/api/stripe/create-checkout","/api/stripe/portal"]) {
    const response=await fetch(base+endpoint,{method:"POST",headers:{"content-type":"application/json"},body:"{}"});
    assert.equal(response.status,401,endpoint);
    http.push({endpoint,status:response.status,authenticated:false});
  }
  const preflight=await fetch(base+"/api/ai/search",{method:"OPTIONS",headers:{Origin:"https://localhost","Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"authorization,content-type,x-webvault-device"}});
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get("access-control-allow-origin"),"https://localhost");
  assert.match(preflight.headers.get("access-control-allow-headers"),/X-WebVault-Device/i);
  http.push({endpoint:"/api/ai/search",method:"OPTIONS",status:preflight.status,deviceHeaderAllowed:true});
  const report={date:new Date().toISOString(),browser:browserVersion,checks,pageErrors,http,backend:"Mocked Supabase Auth/REST; executable PostgreSQL/RLS and live rollback checks are separate",realEmailDelivery:false,physicalPhone:false};
  await writeFile(path.join(output,"verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report,null,2));
}
