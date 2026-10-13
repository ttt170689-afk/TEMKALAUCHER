// Isolated fake Auth/RPC server only. NEVER sends real OTP or touches production accounts.
const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.ENTRY_TEST_URL||'http://127.0.0.1:8090';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const origin=require('../src/config/online.public.json').url;
let checks=0;const ok=(label,value)=>{assert(value,label);console.log('PASS',++checks,label);};
(async()=>{for(const [engine,platform]of [[chromium,'pc'],[chromium,'mobile'],[webkit,'mobile']]){
 const browser=await engine.launch({headless:true});
 const fixtures=[];
 async function fixture(options={}){
  const context=await browser.newContext({viewport:platform==='pc'?{width:1180,height:820}:{width:390,height:844},...(platform==='mobile'?{isMobile:true,hasTouch:true}:{})});
  const page=await context.newPage();page.setDefaultTimeout(12000);const errors=[],calls=[];let profile=options.newUser?null:{id:A,username:'ServerName',has_avatar:false,avatar_version:0,is_creator:true};
  const state={page,context,calls,errors,verifying:false,release:null,failProfile:!!options.failProfile};fixtures.push(state);page.on('pageerror',e=>errors.push(e.message));
  await context.route(/^https?:/,async route=>{
   const r=route.request(),u=new URL(r.url());if(r.url().startsWith(base))return route.continue();
   if(u.origin!==origin)return route.fulfill({status:503,body:'No external network in test'});
   const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
   if(r.method()==='OPTIONS')return send(null,204);
   const body=r.postData()?JSON.parse(r.postData()):{},endpoint=u.pathname.split('/').pop();calls.push({endpoint,body});
   if(endpoint==='otp'){
    if(options.network)return route.abort('internetdisconnected');
    if(options.missing&&!body.create_user)return send({message:'Signups not allowed for otp'},400);
    return send({});
   }
   if(endpoint==='verify'){
    if(options.slow){state.verifying=true;await new Promise(resolve=>state.release=resolve);}
    if(body.token!=='123456')return send({message:'Token has expired or is invalid'},403);
    return send({access_token:'fixture-entry',refresh_token:'fixture-refresh',expires_in:3600,user:{id:A,email:body.email}});
   }
   if(endpoint==='user')return send({id:options.wrongIdentity?B:A,email:'account@example.invalid',email_confirmed_at:options.unconfirmed?null:'2026-10-13T00:00:00Z'});
   if(endpoint==='my_profile'){if(state.failProfile)return send({message:'temporary profile failure'},503);return send(profile?[profile]:[]);}
   if(endpoint==='set_username'){
    if(body.new_username==='Taken')return send({message:'username taken'},409);
    profile={id:A,username:body.new_username,has_avatar:false,avatar_version:0,is_creator:false};return send(null);
   }
   if(endpoint==='get_player_card')return send({...profile,display_name:'Общее имя',bio:'Серверный профиль',avatar_style:'cube',avatar_color:'#ff7a2f',games:[]});
   if(endpoint==='get_player_activity')return send({playing:null,history:[]});
   if(endpoint==='logout')return send(null);
   if(endpoint==='beta_status')return send({game_id:body.p_game,state:'none',request_id:null,updated_at:null});
   if(['list_my_friends','dm_threads','search_players'].includes(endpoint))return send([]);
   return send({message:'Unhandled fixture RPC: '+endpoint},400);
  });
  if(options.seed)await context.addInitScript(seed=>{if(!localStorage.getItem('seed-done')){localStorage.setItem('temka-accounts-v1',JSON.stringify(seed));localStorage.setItem('seed-done','1');}},options.seed);
  if(options.quota)await context.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='temka-accounts-v1')throw new DOMException('Quota','QuotaExceededError');return original.call(this,k,v);};});
  await page.goto(base+'/'+platform+'/');await page.locator('[data-cloud-entry]').waitFor();return state;
 }
 async function send(f,register=false){if(register)await f.page.getByRole('tab',{name:'Создать аккаунт',exact:true}).click();await f.page.getByPlaceholder('you@example.com').fill('account@example.invalid');await f.page.getByRole('button',{name:'Получить код',exact:true}).click();}
 async function verify(f,code='123456'){await f.page.getByPlaceholder('123456').fill(code);await f.page.getByRole('button',{name:'Подтвердить и войти',exact:true}).click();}
 async function opened(f){await f.page.getByRole('navigation',{name:'Разделы лаунчера'}).waitFor();}
 async function data(f){return f.page.evaluate(()=>({accounts:JSON.parse(localStorage.getItem('temka-accounts-v1')||'null'),keys:Object.keys(localStorage).filter(k=>k.startsWith('temka-online-v1:')),pending:localStorage.getItem('temka-entry-otp-v1')}));}
 try{
  const f=await fixture();ok(`${engine.name()} ${platform}: first screen defaults to email login without password or automatic OTP`,await f.page.getByRole('tab',{name:'Войти в аккаунт',exact:true}).getAttribute('aria-selected')==='true'&&await f.page.locator('input[type=password]').count()===0&&f.calls.length===0);
  for(const size of platform==='mobile'?[[320,568],[390,844],[844,390]]:[[1180,820]]){await f.page.setViewportSize({width:size[0],height:size[1]});ok('entry fits '+size.join('x'),await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  await f.page.setViewportSize(platform==='mobile'?{width:390,height:844}:{width:1180,height:820});
  await send(f);ok('existing-account OTP uses create_user=false',f.calls.find(c=>c.endpoint==='otp').body.create_user===false);ok('resend cooldown prevents immediate second request',await f.page.getByRole('button',{name:/Отправить снова через/}).isDisabled());
  await f.page.reload();await f.page.getByPlaceholder('123456').waitFor();ok('pending OTP survives reload without saved credentials',(await data(f)).keys.length===0);
  await verify(f,'000000');await f.page.getByRole('alert').filter({hasText:'Код неверный'}).waitFor();ok('bad/expired code keeps gate closed',(await data(f)).accounts===null);
  await verify(f);await opened(f);let saved=await data(f);ok('fresh device opens verified account without local registration',saved.accounts.users.length===1&&saved.accounts.users[0].onlineUserId===A&&saved.accounts.users[0].username==='ServerName'&&saved.pending===null);
  await f.page.reload();await opened(f);ok('verified session survives relaunch',(await data(f)).keys.length===1);
  await f.page.getByRole('navigation',{name:'Разделы лаунчера'}).getByRole('button',{name:'Профиль',exact:true}).click();await f.page.getByRole('button',{name:'Выйти из аккаунта',exact:true}).click();await f.page.locator('[data-cloud-entry]').waitFor();saved=await data(f);ok('logout removes cloud token and local active session, keeps UID binding',saved.keys.length===0&&saved.accounts.session===null&&saved.accounts.users[0].onlineUserId===A);
  await send(f);await verify(f);await opened(f);ok('repeated login does not duplicate account',(await data(f)).accounts.users.length===1);await f.context.close();
  const n=await fixture({newUser:true});await send(n,true);ok('only explicit registration enables create_user',n.calls.find(c=>c.endpoint==='otp').body.create_user===true);await verify(n);await n.page.getByPlaceholder('Temka_Игрок').waitFor();ok('new user chooses handle only after email verification',(await data(n)).keys.length===0&&(await data(n)).accounts===null);
  await n.page.getByPlaceholder('Temka_Игрок').fill('Taken');await n.page.getByRole('button',{name:'Сохранить и войти',exact:true}).click();await n.page.getByRole('alert').filter({hasText:'занят на сервере'}).waitFor();ok('server rejects occupied handle; no false available claim',await n.page.getByText('имя доступно',{exact:true}).count()===0);
  await n.page.getByPlaceholder('Temka_Игрок').fill('NewHandle');await n.page.getByRole('button',{name:'Сохранить и войти',exact:true}).click();await opened(n);ok('new shared account completes registration',(await data(n)).accounts.users[0].username==='NewHandle');await n.context.close();
  const legacy={id:'old',username:'ServerName',email:'account@example.invalid',passHash:'keep-me',createdAt:'2020-01-01',profile:{avatar:'cat',color:'#ff7a2f',title:'newbie',status:'old'}};
  const l=await fixture({seed:{users:[legacy],session:null}});await send(l,true);await verify(l);await opened(l);saved=await data(l);ok('signup with existing server profile never renames it or merges unverified legacy email',!l.calls.some(c=>c.endpoint==='set_username')&&saved.accounts.users.length===2&&saved.accounts.users[0].passHash==='keep-me');await l.context.close();
  for(const [options,text,label]of [[{missing:true},'Общий аккаунт','missing shared account suggests explicit signup'],[{network:true},'Нет связи','network failure is not account-not-found'],[{unconfirmed:true},'не подтвердил','unconfirmed email cannot open account'],[{wrongIdentity:true},'не подтвердил','mismatched server identity cannot open account'],[{quota:true},'Не удалось сохранить вход','storage failure rolls back token and stays at entry']]){
   const x=await fixture(options);await send(x);if(!options.missing&&!options.network)await verify(x);await x.page.getByRole('alert').filter({hasText:text}).waitFor();ok(label,(await data(x)).keys.length===0&&(await data(x)).accounts===null);await x.context.close();
  }
  const retry=await fixture({failProfile:true});await send(retry);await verify(retry);await retry.page.getByRole('alert').filter({hasText:'temporary profile failure'}).waitFor();retry.failProfile=false;await verify(retry);await opened(retry);ok('profile-service failure can retry without reusing consumed OTP',retry.calls.filter(c=>c.endpoint==='verify').length===1);await retry.context.close();
  const slow=await fixture({slow:true});await send(slow);await verify(slow);await slow.page.waitForTimeout(100);assert(slow.verifying);await slow.page.getByRole('button',{name:'Локальный режим',exact:true}).click();slow.release();await slow.page.waitForTimeout(150);ok('cancellation ignores late verify response and preserves explicit local mode',(await data(slow)).keys.length===0&&(await data(slow)).accounts===null&&await slow.page.getByText('Локальный режим · только это устройство.',{exact:false}).isVisible());await slow.context.close();
  const offline=await fixture();await offline.page.getByRole('button',{name:'Локальный режим',exact:true}).click();await offline.page.getByPlaceholder('Temka_Игрок').fill('OfflineTester');await offline.page.getByPlaceholder('you@example.com').fill('offline@example.invalid');for(const p of await offline.page.locator('input[type=password]').all())await p.fill('TestOnly123!');await offline.page.getByRole('button',{name:/Принимаю правила/}).click();await offline.page.getByRole('button',{name:'Создать аккаунт',exact:true}).click();await opened(offline);ok('explicit local registration remains available without Auth requests',offline.calls.length===0&&(await data(offline)).keys.length===0);await offline.context.close();
  ok('all scenarios have zero renderer errors',fixtures.every(f=>f.errors.length===0));
 }catch(error){for(const f of fixtures)if(!f.page.isClosed()){fs.mkdirSync('test-results/entry',{recursive:true});await f.page.screenshot({path:`test-results/entry/failure-${engine.name()}-${platform}.png`});console.log((await f.page.locator('body').innerText()).slice(-2500));}throw error;}finally{await browser.close();}
}console.log(`ALL ${checks} CLOUD-FIRST ENTRY CHECKS PASSED. Mock Auth only; no real mail or physical device.`);})().catch(e=>{console.error(e);process.exitCode=1;});
