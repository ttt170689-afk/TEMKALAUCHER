// Actual built renderer, mocked network identities/permissions; NOT live Supabase.
const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');
(async()=>{let checks=0;const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1280,height:900}});const page=await context.newPage();page.setDefaultTimeout(18000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const uid='bbfbdfcc-e453-472b-a188-5f8f07feb2da';let state='outsider',fail=false,issues=0,redemptions=0,devCalls=0;const secret='TEMKADEV-'+'B'.repeat(64);
 async function check(label,fn){await fn();checks++;console.log('PASS '+label);}
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
 await page.route('https://jubsgthkahxxexmibdwn.supabase.co/**',async r=>{const p=new URL(r.request().url()).pathname;let data=[];
  if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});
  if(p==='/auth/v1/user')data={id:uid,email:'fixture@example.invalid',email_confirmed_at:'2026-10-14T12:00:00Z'};
  else if(p.endsWith('/my_profile'))data=[{id:uid,username:'DevTester',has_avatar:false,avatar_version:0,is_creator:false}];
  else if(p==='/auth/v1/health')data={name:'GoTrue'};
  else if(p.endsWith('/get_player_activity'))data={current:null,history:[]};
  await r.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.route('https://zykpirbzgiylkkasrllk.supabase.co/**',async r=>{
  if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});devCalls++;
  assert.equal(new URL(r.request().url()).pathname,'/functions/v1/dev-gateway');assert.equal(r.request().headers().authorization,'Bearer fixture-main-token');
  const d=r.request().postDataJSON();if(fail)return r.fulfill({status:503,headers,contentType:'application/json',body:JSON.stringify({ok:false,error:'dev_connection_failed'})});
  let data={ok:true,allowed:state!=='outsider',owner:state==='owner',channel:'dev'};
  if(d.action==='redeem'){redemptions++;state='tester';data={ok:true,allowed:true,owner:false,channel:'dev'};}
  if(d.action==='builds')data={ok:true,builds:[]};
  if(d.action==='issue'){issues++;data={ok:true,code:secret,expires_at:'2026-10-15T12:00:00Z'};}
  if(d.action==='revoke_tester')data={ok:true};
  await r.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify(data)});
 });
 try{
  await page.goto('http://127.0.0.1:8094');await page.getByRole('button',{name:'Локальный режим',exact:true}).click();await page.getByPlaceholder('Temka_Игрок').fill('LocalDev');await page.getByPlaceholder('you@example.com').fill('fixture@example.invalid');for(const field of await page.locator('input[type=password]').all())await field.fill('TestOnly123!');await page.getByRole('button',{name:/Принимаю правила/}).click();await page.getByRole('button',{name:/Создать аккаунт/}).click();
  const nav=page.getByRole('navigation',{name:'Разделы лаунчера'});await nav.waitFor();
  await nav.getByRole('button',{name:'Dev',exact:true}).click();
  await check('local mode cannot access Dev or send gateway calls',async()=>{await page.getByText('Нужен подтверждённый основной онлайн-аккаунт.',{exact:false}).waitFor();assert.equal(devCalls,0);assert.equal(await page.getByLabel('Dev-приглашение').count(),0);});
  await page.evaluate(uid=>{const local=JSON.parse(localStorage.getItem('temka-accounts-v1'));local.users.find(u=>u.id===local.session).onlineUserId=uid;localStorage.setItem('temka-accounts-v1',JSON.stringify(local));localStorage.setItem('temka-online-v1:https://jubsgthkahxxexmibdwn.supabase.co:'+local.session,JSON.stringify({access_token:'fixture-main-token',refresh_token:'fixture-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:uid,email:'fixture@example.invalid'}}));},uid);
  await page.reload();await nav.waitFor();await nav.getByRole('button',{name:'Dev',exact:true}).click();await page.getByText('Нужно приглашение владельца',{exact:true}).waitFor();
  await check('existing main session opens invite form without second signup',async()=>{assert.equal(await page.locator('main input[type=email]').count(),0);assert.equal(await page.getByRole('button',{name:'Создать Dev-приглашение'}).count(),0);});
  await page.getByLabel('Dev-приглашение',{exact:true}).fill(secret);await page.getByRole('button',{name:'Войти в Dev по приглашению',exact:true}).click();await page.getByText('Dev-доступ: тестер',{exact:true}).waitFor();
  await check('single redemption gives tester badge and honest empty catalogue',async()=>{assert.equal(redemptions,1);await page.getByText('Пока нет доступных сборок.',{exact:false}).waitFor();assert.equal(await page.getByRole('button',{name:'Создать Dev-приглашение'}).count(),0);});
  await check('invite never persisted in local storage',async()=>assert.equal(await page.evaluate(secret=>Object.values(localStorage).some(v=>v.includes(secret)),secret),false));
  await nav.getByRole('button',{name:'Новости',exact:true}).click();await nav.getByRole('button',{name:'Dev',exact:true}).click();await page.getByText('Dev-доступ: тестер',{exact:true}).waitFor();await check('return to Dev does not ask code again',async()=>assert.equal(await page.getByLabel('Dev-приглашение').count(),0));
  fail=true;await page.getByRole('button',{name:'Проверить Dev-доступ'}).click();await page.getByRole('alert').waitFor();await check('failed access recheck clears stale tester badge',async()=>{assert.equal(await page.getByText('Dev-доступ: тестер',{exact:true}).count(),0);assert.equal(await page.getByRole('heading',{name:'Закрытые сборки'}).count(),0);});
  fail=false;state='owner';await page.getByRole('button',{name:'Проверить Dev-доступ'}).click();await page.getByText('Dev-доступ: владелец',{exact:true}).waitFor();await page.getByRole('button',{name:'Создать Dev-приглашение'}).click();await page.getByLabel('Выданное Dev-приглашение').waitFor();
  await check('owner issues once, code is in-memory only',async()=>{assert.equal(issues,1);assert.equal(await page.getByLabel('Выданное Dev-приглашение').inputValue(),secret);assert.equal(await page.evaluate(secret=>Object.values(localStorage).some(v=>v.includes(secret)),secret),false);});
  await check('desktop and compact viewport fit',async()=>{for(const size of [[1280,900],[800,700]]){await page.setViewportSize({width:size[0],height:size[1]});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}});
  await page.setViewportSize({width:1280,height:900});fs.mkdirSync('/home/user/diagnostics',{recursive:true});await page.screenshot({path:'/home/user/diagnostics/dev-main-account-ui.png'});
  await check('no renderer errors',async()=>assert.deepEqual(errors,[]));
  console.log('ALL '+checks+' BUILT PC RENDERER CHECKS PASSED; mocked identity/Dev API, no real device or live login.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
