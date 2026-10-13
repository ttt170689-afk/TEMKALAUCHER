// Local browser tests ONLY. All Supabase calls are intercepted; no real mail/account writes.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.FRIEND_TEST_URL||'http://127.0.0.1:8090',shots=process.env.FRIEND_TEST_SHOTS||'/home/user/.cache/notification-shots';fs.mkdirSync(shots,{recursive:true});
let checks=0;function ok(msg,value){assert(value,msg);checks++;console.log('PASS',msg);}
const me='11111111-1111-4111-8111-111111111111',a='22222222-2222-4222-8222-222222222222',b='33333333-3333-4333-8333-333333333333',c='44444444-4444-4444-8444-444444444444',d='55555555-5555-4555-8555-555555555555';
const ids=['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'];
function row(id,other,name,status='pending',outgoing=false){return {request_id:id,requester_id:outgoing?me:other,receiver_id:outgoing?other:me,status,other_id:other,username:name,has_avatar:false,avatar_version:0,is_creator:false};}
(async()=>{for(const [site,width,height] of [['desktop',1280,850],['mobile',320,740],['mobile',390,844]]){
 const browser=await chromium.launch(),context=await browser.newContext({viewport:{width,height},hasTouch:site==='mobile'}),page=await context.newPage();page.setDefaultTimeout(16000);
 let rows=[row(ids[0],a,'FriendOne'),row(ids[1],b,'FriendTwo'),row(ids[2],c,'OutgoingFriend','pending',true),row(ids[3],d,'AcceptedFriend','accepted')],confirmed=true,failPatch=false,failList=false,raceDelete=false,otp=0,mutations=0,listCalls=0;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(req.url().startsWith(base))return route.continue();
  if(!url.hostname.endsWith('.supabase.co'))return route.fulfill({status:503,body:'offline test'});
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS'};
  const send=(data,status=200)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(data)});
  if(req.method()==='OPTIONS')return send({},204);
  const body=req.postData()?JSON.parse(req.postData()):{};
  if(url.pathname==='/auth/v1/otp'){otp++;return send({});}
  if(url.pathname==='/auth/v1/verify'){if(body.token!=='123456')return send({message:'Неверный или просроченный код'},400);return send({access_token:'test-access',refresh_token:'test-refresh',expires_in:3600,user:{id:me,email:'receiver@example.invalid'}});}
  if(url.pathname==='/auth/v1/user')return send({id:me,email_confirmed_at:confirmed?'2026-10-13T12:00:00Z':null});
  if(url.pathname==='/auth/v1/logout')return send({});
  if(url.pathname.endsWith('/my_profile'))return send([{id:me,username:'Receiver',has_avatar:false,avatar_version:0,is_creator:false}]);
  if(url.pathname.endsWith('/list_my_friends')){listCalls++;if(failList)return send({message:'Не удалось получить список: тестовый сбой'},503);return send(rows);}
  if(url.pathname==='/rest/v1/friendships'){
   mutations++;const id=(url.searchParams.get('id')||'').replace('eq.','');const r=rows.find(r=>r.request_id===id);
   if(req.method()==='PATCH'){
    if(failPatch)return send({message:'Сбой тестового сервера'},503);
    if(!r||r.status!=='pending'||r.receiver_id!==me)return send([]);r.status='accepted';return send([{id,status:'accepted'}]);
   }
   if(req.method()==='DELETE'){
    if(raceDelete&&r){r.status='accepted';raceDelete=false;}
    if(!r||url.searchParams.get('status')==='eq.pending'&&r.status!=='pending')return send([]);
    rows=rows.filter(r=>r.request_id!==id);return send([{id}]);
   }
  }
  throw Error('Unexpected backend request '+req.method()+' '+url.pathname);
 });
 try{
  await page.goto(base+'/'+site+'/');await page.getByPlaceholder('Temka_Игрок').fill('LocalPlayer');await page.getByPlaceholder('you@example.com').fill('local@example.invalid');for(const el of await page.locator('input[type=password]').all())await el.fill('TestOnly123!');await page.getByRole('button',{name:/Принимаю правила/}).click();await page.getByRole('button',{name:/Создать аккаунт/}).click();
  const bell=page.getByRole('button',{name:/^Уведомления/});await bell.waitFor();await bell.click();let dialog=page.getByRole('dialog',{name:'Уведомления',exact:true});await dialog.getByText('Сначала подтверди почту',{exact:true}).waitFor();ok(site+' '+width+': bell available but unverified user sees no requests',await dialog.locator('[data-request-id]').count()===0);ok('no automatic OTP or mutation',otp===0&&mutations===0);
  await dialog.getByRole('button',{name:'Подтвердить почту в профиле'}).click();await page.getByLabel('Почта для онлайн-профиля',{exact:true}).fill('receiver@example.invalid');await page.getByRole('button',{name:'Получить код на почту',exact:true}).click();await page.getByLabel('Код из письма',{exact:true}).fill('000000');await page.getByRole('button',{name:'Подтвердить почту',exact:true}).click();await page.getByRole('alert').filter({hasText:'Неверный или просроченный код'}).waitFor();ok('wrong email code does not unlock friends',await page.getByRole('button',{name:'Найти друга',exact:true}).count()===0);
  await page.getByLabel('Код из письма',{exact:true}).fill('123456');await page.getByRole('button',{name:'Подтвердить почту',exact:true}).click();await page.getByText('✓ Почта подтверждена',{exact:true}).waitFor();await page.getByRole('button',{name:'Уведомления, входящих заявок: 2',exact:true}).waitFor();ok('OTP login enables friends and shared header session',await page.getByRole('button',{name:'Найти друга',exact:true}).isVisible());ok('only explicit request sends OTP',otp===1);
  await bell.click();dialog=page.getByRole('dialog',{name:'Уведомления',exact:true});await dialog.locator('[data-request-id]').nth(1).waitFor();await dialog.getByRole('button',{name:'Принять',exact:true}).first().waitFor();ok('only incoming pending requests displayed',await dialog.locator('[data-request-id]').count()===2&&await dialog.getByText('@OutgoingFriend',{exact:true}).count()===0&&await dialog.getByText('@AcceptedFriend',{exact:true}).count()===0);
  await page.waitForTimeout(150);ok('dialog fits viewport',await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&el.scrollWidth<=el.clientWidth+1}));ok('header and app fit viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:shots+'/'+site+'-'+width+'.png'});
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});ok('escape closes and restores focus',await bell.evaluate(el=>el===document.activeElement));await bell.click();dialog=page.getByRole('dialog',{name:'Уведомления',exact:true});
  failPatch=true;await dialog.locator('[data-request-id="'+ids[0]+'"]').getByRole('button',{name:'Принять',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'Сбой тестового сервера'}).waitFor();ok('failed accept keeps real request, no fake success',rows[0].status==='pending'&&await dialog.locator('[data-request-id]').count()===2&&await dialog.getByText(/добавлен в друзья/).count()===0);
  failPatch=false;await dialog.locator('[data-request-id="'+ids[0]+'"]').getByRole('button',{name:'Принять',exact:true}).click();await dialog.getByText('@FriendOne добавлен в друзья.',{exact:true}).waitFor();await page.getByRole('button',{name:'Уведомления, входящих заявок: 1',exact:true}).waitFor();ok('accept persists and reduces counter',rows.find(r=>r.request_id===ids[0]).status==='accepted'&&await dialog.locator('[data-request-id]').count()===1);
  await dialog.locator('[data-request-id="'+ids[1]+'"]').getByRole('button',{name:'Отклонить',exact:true}).click();await dialog.getByText('Новых заявок нет',{exact:true}).waitFor();ok('decline removes request, counter clears',!rows.some(r=>r.request_id===ids[1])&&await bell.getAttribute('aria-label')==='Уведомления');
  await dialog.getByRole('button',{name:'Закрыть уведомления'}).click();await page.getByText('@FriendTwo',{exact:true}).waitFor({state:'hidden'});ok('profile list synchronizes with notification decisions',await page.getByText('@FriendOne',{exact:true}).isVisible());
  rows.push(row(ids[1],b,'FriendTwo'));if(site==='desktop'){await page.getByRole('button',{name:'Уведомления, входящих заявок: 1',exact:true}).waitFor({timeout:35000});ok('background polling updates the header without opening dialog',true);}await bell.click();dialog=page.getByRole('dialog',{name:'Уведомления',exact:true});await dialog.locator('[data-request-id]').waitFor();raceDelete=true;await dialog.getByRole('button',{name:'Отклонить',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'изменена или удалена'}).waitFor();ok('stale decline cannot delete an already accepted friendship',rows.find(r=>r.request_id===ids[1]).status==='accepted');
  failList=true;await dialog.getByRole('button',{name:'Обновить',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'тестовый сбой'}).waitFor();ok('network error is not presented as empty inbox',await dialog.getByText('Новых заявок нет',{exact:true}).count()===0);failList=false;confirmed=false;const before=listCalls;await dialog.getByRole('button',{name:'Обновить',exact:true}).click();await dialog.getByText('Сначала подтверди почту',{exact:true}).waitFor();ok('unconfirmed Auth account cannot fetch notifications',listCalls===before&&await dialog.getByRole('button',{name:'Принять',exact:true}).count()===0);
  confirmed=true;await dialog.getByRole('button',{name:'Закрыть уведомления'}).click();await page.getByRole('button',{name:'Выйти из онлайн-профиля',exact:true}).click();await page.getByLabel('Почта для онлайн-профиля',{exact:true}).waitFor();await bell.click();dialog=page.getByRole('dialog',{name:'Уведомления',exact:true});await dialog.getByText('Сначала подтверди почту',{exact:true}).waitFor();ok('logout immediately clears notification account',await dialog.locator('[data-request-id]').count()===0);ok('no renderer errors',errors.length===0);
 }finally{await browser.close();}
 }
 console.log('ALL '+checks+' NOTIFICATION BROWSER CHECKS PASSED (backend and emails mocked).');
})().catch(e=>{console.error(e);process.exit(1)});
