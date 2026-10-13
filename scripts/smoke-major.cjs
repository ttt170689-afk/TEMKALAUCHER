// All mail/Auth/backend calls are intercepted. This is NOT a production integration test.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const base=process.env.MAJOR_TEST_URL||'http://127.0.0.1:8090',shots=process.env.MAJOR_TEST_SHOTS||path.resolve(__dirname,'..','test-results','major');fs.mkdirSync(shots,{recursive:true});
let checks=0;const ok=(label,yes)=>{assert(yes,label);console.log('PASS',++checks,label);};
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333';
const accounts={a:{id:A,email:'alpha@example.invalid',profile:null},b:{id:B,email:'brother@example.invalid',profile:null}};
const profile=(id,username,is_creator=false)=>({id,username,has_avatar:false,avatar_version:0,is_creator});
let relationships=[],otpCalls=0,invites=0,listFail=false,mutationFail=false,raceDelete=false,slowResolve=null,slowStarted=false,apiCalls=[],betaStates={};
const extra=profile(C,'SlowFriend');
function allProfiles(){return Object.values(accounts).map(a=>a.profile).filter(Boolean).concat([extra]);}
function status(uid,game){return {game_id:game,state:betaStates[uid+game]||'none',request_id:betaStates[uid+game]?C:null,updated_at:betaStates[uid+game]?'2026-10-13T12:00:00Z':null};}
async function routeAPI(route){
 const r=route.request(),url=new URL(r.url());if(r.url().startsWith(base))return route.continue();
 if(!url.hostname.endsWith('.supabase.co'))return route.fulfill({status:503,body:'external network disabled in test'});
 const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
 if(r.method()==='OPTIONS')return send(null,204);
 const body=r.postData()?JSON.parse(r.postData()):{},actor=accounts[(r.headers()['authorization']||'').replace('Bearer fixture-','')],path=url.pathname;apiCalls.push({path,actor:actor?.id});
 if(path==='/auth/v1/otp'){otpCalls++;return send({});}
 if(path==='/auth/v1/verify'){
  if(body.token!=='123456')return send({message:'Неверный или просроченный код'},400);
  const pair=Object.entries(accounts).find(([,a])=>a.email===body.email);if(!pair)return send({message:'Invalid fixture email'},400);
  return send({access_token:'fixture-'+pair[0],refresh_token:'test-refresh',expires_in:3600,user:{id:pair[1].id,email:body.email}});
 }
 if(!actor)return send({message:'Сначала подтверди почту'},401);
 if(path==='/auth/v1/user')return send({id:actor.id,email_confirmed_at:'2026-10-13T12:00:00Z'});
 if(path==='/auth/v1/logout')return send({});
 if(path.endsWith('/dm_threads'))return send([]);
 if(path.endsWith('/get_player_activity'))return send({playing:null,history:[]});
 if(path.endsWith('/my_profile'))return send(actor.profile?[actor.profile]:[]);
 if(path.endsWith('/set_username')){if(body.new_username==='temka_play_official')return send({message:'Этот юзернейм зарезервирован для создателя.'},400);actor.profile=profile(actor.id,body.new_username);return send(null);}
 if(path.endsWith('/get_player_card')){const p=allProfiles().find(p=>p.id===body.player_id);return send(p?{...p,display_name:p.username,bio:'',avatar_style:'cube',avatar_color:'#63e6be',games:[]}:null);}
 if(path.endsWith('/search_players')||path.endsWith('/find_player')){
  const query=body.query_text||body.exact_username;const result=allProfiles().filter(p=>body.query_text?p.username.toLowerCase().includes(query.toLowerCase()):p.username.toLowerCase()===query.toLowerCase());
  if(query==='SlowFriend'){slowStarted=true;await new Promise(resolve=>slowResolve=resolve);}return send(result);
 }
 if(path.endsWith('/list_my_friends')){
  if(listFail)return send({message:'Тестовая ошибка списка'},503);
  return send(relationships.filter(r=>[r.requester_id,r.receiver_id].includes(actor.id)).map(r=>{const id=r.requester_id===actor.id?r.receiver_id:r.requester_id,p=allProfiles().find(p=>p.id===id);return {...r,...p,request_id:r.id,other_id:id};}));
 }
 if(path==='/rest/v1/friendships'){
  if(mutationFail)return send({message:'Тестовый отказ сервера'},503);
  if(r.method()==='POST'){
   if(relationships.some(r=>[r.receiver_id,r.requester_id].includes(actor.id)&&[r.receiver_id,r.requester_id].includes(body.receiver_id)))return send({message:'duplicate'},409);
   assert.equal(body.requester_id,actor.id);const row={id:crypto.randomUUID(),...body};relationships.push(row);invites++;return send([row],201);
  }
  const id=url.searchParams.get('id')?.slice(3),row=relationships.find(r=>r.id===id);
  if(!row||![row.requester_id,row.receiver_id].includes(actor.id))return send([]);
  if(r.method()==='PATCH'){if(row.receiver_id!==actor.id||row.status!=='pending')return send([]);row.status='accepted';return send([row]);}
  if(r.method()==='DELETE'){
   if(raceDelete){row.status='accepted';raceDelete=false;}
   if(url.searchParams.get('status')==='eq.pending'&&row.status!=='pending')return send([]);
   relationships=relationships.filter(r=>r.id!==id);return send([row]);
  }
 }
 if(path.endsWith('/beta_status'))return send(status(actor.id,body.p_game));
 if(path.endsWith('/beta_redeem')){if(body.p_code!=='TEMKA-1234567890ABCDEF')return send({ok:false,error:'invalid_code'});betaStates[actor.id+body.p_game]='pending';return send({ok:true,status:status(actor.id,body.p_game)});}
 if(path.endsWith('/beta_admin_requests')||path.endsWith('/beta_admin_codes'))return actor.profile?.is_creator?send([]):send({message:'Только владелец'},403);
 throw Error('Unexpected request '+r.method()+' '+path);
}
async function nav(page,name){await page.getByRole('navigation',{name:'Разделы лаунчера'}).getByRole('button',{name,exact:true}).click();}
async function local(page,path,name,email){await page.goto(base+'/'+path+'/');await page.getByRole('button',{name:'Локальный режим',exact:true}).click();await page.getByPlaceholder('Temka_Игрок').fill(name);await page.getByPlaceholder('you@example.com').fill(email);for(const p of await page.locator('input[type=password]').all())await p.fill('TestOnly123!');await page.getByRole('button',{name:/Принимаю правила/}).click();await page.getByRole('button',{name:/Создать аккаунт/}).click();await page.getByRole('navigation',{name:'Разделы лаунчера'}).waitFor();}
async function login(page,email,username){await nav(page,'Профиль');await page.getByLabel('Почта для онлайн-профиля',{exact:true}).fill(email);await page.getByRole('button',{name:'Получить код на почту',exact:true}).click();await page.getByLabel('Код из письма',{exact:true}).fill('123456');await page.getByRole('button',{name:'Подтвердить почту',exact:true}).click();await page.getByLabel('Онлайн-юзернейм',{exact:true}).fill(username);await page.getByRole('button',{name:'Сохранить онлайн-ник',exact:true}).click();await page.locator('.social-handle').filter({hasText:'@'+username}).waitFor();}
async function openSearch(page,name){await nav(page,'Друзья');await page.getByRole('button',{name:'＋ Добавить друга',exact:true}).click();await page.getByLabel('Юзернейм друга',{exact:true}).fill(name);await page.getByRole('button',{name:'Найти друга',exact:true}).click();await page.locator('[data-search-result]').waitFor();}
(async()=>{
 const browser=await chromium.launch(),contexts=[],errors=[];let a,b;
 try{
  for(const viewport of [{width:1280,height:850},{width:390,height:844}]){const c=await browser.newContext({viewport,serviceWorkers:'block'});await c.route('**/*',routeAPI);contexts.push(c);}
  a=await contexts[0].newPage();b=await contexts[1].newPage();for(const p of [a,b]){p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));}
  await local(a,'desktop','LocalAlpha',accounts.a.email);ok('local start sends no email',otpCalls===0);await nav(a,'Друзья');await a.getByText('Сначала подтверди почту',{exact:true}).waitFor();ok('friends require confirmed online account',await a.getByRole('button',{name:'＋ Добавить друга',exact:true}).isDisabled());
  await a.getByRole('button',{name:'Подтвердить почту в профиле',exact:true}).click();await a.getByRole('button',{name:'Получить код на почту',exact:true}).click();await a.getByLabel('Код из письма',{exact:true}).waitFor();await nav(a,'Главная');await nav(a,'Профиль');await a.getByLabel('Код из письма',{exact:true}).waitFor();ok('OTP entry and cooldown survive navigation, no extra mail',otpCalls===1&&await a.getByRole('button',{name:/Повторить через/}).isDisabled());
  await a.getByLabel('Код из письма',{exact:true}).fill('000000');await a.getByRole('button',{name:'Подтвердить почту',exact:true}).click();await a.getByRole('alert').filter({hasText:'Неверный'}).waitFor();ok('bad OTP never unlocks online identity',await a.getByLabel('Онлайн-юзернейм',{exact:true}).count()===0);
  await a.getByLabel('Код из письма',{exact:true}).fill('123456');await a.getByRole('button',{name:'Подтвердить почту',exact:true}).click();await a.getByLabel('Онлайн-юзернейм',{exact:true}).waitFor();ok('local name is not silently promoted to online username',await a.getByLabel('Онлайн-юзернейм',{exact:true}).inputValue()==='');
  await a.getByLabel('Онлайн-юзернейм',{exact:true}).fill('temka_play_official');await a.getByRole('button',{name:'Сохранить онлайн-ник',exact:true}).click();await a.getByRole('alert').filter({hasText:'зарезервирован'}).waitFor();ok('creator nickname is reserved, not a local privilege',accounts.a.profile===null);
  await a.getByLabel('Онлайн-юзернейм',{exact:true}).fill('Alpha');await a.getByRole('button',{name:'Сохранить онлайн-ник',exact:true}).click();await a.locator('[data-online-handle="Alpha"]').first().waitFor();ok('name plus handle available in shared header/profile',await a.getByRole('heading',{name:'LocalAlpha',exact:true}).isVisible()&&await a.locator('[data-online-handle="Alpha"]').count()>=2);
  await a.getByLabel('Онлайн-юзернейм',{exact:true}).fill('DraftNotSaved');await a.evaluate(()=>window.dispatchEvent(new Event('focus')));await a.waitForTimeout(300);ok('background refresh does not overwrite username draft',await a.getByLabel('Онлайн-юзернейм',{exact:true}).inputValue()==='DraftNotSaved');
  await local(b,'mobile','LocalBrother',accounts.b.email);await login(b,accounts.b.email,'Brother');ok('second account has isolated identity',await b.locator('[data-online-handle="Alpha"]').count()===0);
  await openSearch(a,'@bRoThEr');await a.getByRole('button',{name:'Отправить заявку',exact:true}).click();await a.getByText('Заявка уже отправлена',{exact:true}).waitFor();ok('one server-confirmed request, duplicate invite replaced',invites===1&&await a.getByRole('button',{name:'Отправить заявку',exact:true}).count()===0);
  await a.getByRole('tab',{name:/Исходящие/}).click();ok('outgoing request has its own list and no notification count',await a.locator('[data-friend-row]').count()===1&&await a.getByRole('button',{name:'Уведомления',exact:true}).count()===1);
  await b.getByRole('button',{name:/^Уведомления/}).click();let dialog=b.getByRole('dialog',{name:'Уведомления',exact:true});await dialog.getByText('@Alpha',{exact:true}).waitFor();ok('mobile recipient sees actual sender in inbox',await dialog.locator('[data-request-id]').count()===1);await b.screenshot({path:shots+'/mobile-notifications.png'});
  mutationFail=true;await dialog.getByRole('button',{name:'Принять',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'Тестовый отказ'}).waitFor();ok('failed acceptance does not create friendship',relationships[0].status==='pending');mutationFail=false;
  await dialog.getByRole('button',{name:'Принять',exact:true}).click();await dialog.getByText('Новых заявок нет',{exact:true}).waitFor();ok('acceptance removes incoming count',relationships[0].status==='accepted');await dialog.getByRole('button',{name:'Все друзья и заявки →',exact:true}).click();await b.locator('[data-friend-row]').waitFor();ok('notification opens actual friends page',await b.locator('[data-friends-page]').isVisible());
  await nav(a,'Друзья');await a.getByRole('button',{name:'Обновить список',exact:true}).click();await a.getByRole('tab',{name:/Все друзья/}).click();await a.locator('[data-friend-row]').waitFor();ok('sender sees accepted friendship after refresh',await a.locator('[data-friend-row]').count()===1);await a.screenshot({path:shots+'/desktop-friends.png'});
  await a.getByRole('button',{name:'Удалить из друзей',exact:true}).first().click();ok('removing a friend requires confirmation',relationships.length===1&&await a.getByRole('button',{name:'Да, удалить',exact:true}).isVisible());await a.getByRole('button',{name:'Отмена',exact:true}).click();ok('cancelling removal preserves friendship',relationships.length===1);
  await a.getByLabel('Фильтр текущего списка',{exact:true}).fill('nomatch');await a.getByText('Совпадений нет',{exact:true}).waitFor();await a.getByRole('button',{name:'Сбросить фильтр'}).click();ok('filter reset restores friend list',await a.locator('[data-friend-row]').count()===1);
  await a.getByRole('button',{name:'Удалить из друзей',exact:true}).first().click();await a.getByRole('button',{name:'Да, удалить',exact:true}).click();await a.getByText('Здесь будут твои друзья',{exact:true}).waitFor();ok('confirmed removal really deletes server relation',relationships.length===0);
  await openSearch(a,'Alpha');await a.getByText('Это ты',{exact:true}).waitFor();ok('cannot invite self',await a.getByRole('button',{name:'Отправить заявку',exact:true}).count()===0);
  // A delayed search may not repaint results after the user types another query.
  await a.getByLabel('Юзернейм друга',{exact:true}).fill('SlowFriend');await a.getByRole('button',{name:'Найти друга',exact:true}).click();await a.waitForTimeout(100);assert(slowStarted);await a.getByLabel('Юзернейм друга',{exact:true}).fill('Brother');await a.getByRole('button',{name:'Найти друга',exact:true}).click();await a.locator('[data-search-result]').getByText('@Brother',{exact:true}).waitFor();slowResolve();await a.waitForTimeout(150);ok('stale search response cannot replace newer results',await a.locator('[data-search-result]').getByText('@SlowFriend',{exact:true}).count()===0);
  await a.getByRole('button',{name:'Отправить заявку',exact:true}).click();await a.getByText('Заявка уже отправлена',{exact:true}).waitFor();await b.getByRole('button',{name:/^Уведомления/}).click();dialog=b.getByRole('dialog',{name:'Уведомления',exact:true});await dialog.getByRole('button',{name:'Отклонить',exact:true}).click();await dialog.getByText('Новых заявок нет',{exact:true}).waitFor();ok('recipient declines real request',relationships.length===0);await b.keyboard.press('Escape');
  await a.getByRole('button',{name:'Обновить список',exact:true}).click();await a.getByRole('button',{name:'Отправить заявку',exact:true}).click();await a.getByText('Заявка уже отправлена',{exact:true}).waitFor();await a.locator('[data-search-result]').getByRole('button',{name:'Отменить заявку',exact:true}).click();await a.getByRole('button',{name:'Отправить заявку',exact:true}).waitFor();ok('sender can cancel without leaving a fake notification',relationships.length===0);
  await a.getByRole('button',{name:'Отправить заявку',exact:true}).click();await a.getByText('Заявка уже отправлена',{exact:true}).waitFor();await b.getByRole('button',{name:/^Уведомления/}).click();dialog=b.getByRole('dialog',{name:'Уведомления',exact:true});await dialog.locator('[data-request-id]').waitFor();raceDelete=true;await dialog.getByRole('button',{name:'Отклонить',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'изменена или удалена'}).waitFor();ok('stale decline cannot delete newly accepted relation',relationships[0].status==='accepted');await b.keyboard.press('Escape');
  listFail=true;await a.getByRole('button',{name:'Обновить список',exact:true}).click();await a.getByRole('alert').filter({hasText:'Тестовая ошибка списка'}).waitFor();ok('cannot re-invite against an unavailable relationship list',await a.getByRole('button',{name:'Отправить заявку',exact:true}).isDisabled());await nav(a,'Профиль');await a.getByLabel('Онлайн-юзернейм',{exact:true}).waitFor();ok('list failure does not invalidate confirmed email or force OTP',await a.getByLabel('Онлайн-юзернейм',{exact:true}).isVisible()&&await a.getByRole('button',{name:'Получить код на почту',exact:true}).count()===0);listFail=false;
  // Beta access, not download/launch; ordinary user has no management tab.
  await nav(a,'Библиотека');await a.getByRole('button',{name:'Меню игры Fantazia RP',exact:true}).click();await a.getByRole('button',{name:'Свойства',exact:true}).click();let beta=a.getByRole('dialog',{name:'Fantazia RP',exact:true});await beta.getByRole('tab',{name:'Бета-тест',exact:true}).click();await beta.getByText('Доступ не активирован',{exact:true}).waitFor();ok('ordinary confirmed account cannot access beta management',await beta.getByRole('tab',{name:'Управление',exact:true}).count()===0);
  await beta.getByLabel('Бета-код',{exact:true}).fill('TEMKA-0000000000000000');await beta.getByRole('button',{name:'Отправить код',exact:true}).click();await beta.getByRole('alert').filter({hasText:'Код недействителен'}).waitFor();ok('invalid beta code cannot unlock game',!betaStates[A+'fantazia']);
  await beta.getByLabel('Бета-код',{exact:true}).fill('TEMKA-1234567890ABCDEF');await beta.getByRole('button',{name:'Отправить код',exact:true}).click();await beta.getByText('Ожидает одобрения автора',{exact:true}).waitFor();ok('manual beta request waits for approval',betaStates[A+'fantazia']==='pending');
  betaStates[A+'fantazia']='approved';await beta.getByRole('button',{name:'Проверить статус',exact:true}).click();await beta.getByText('Доступ к бета-тесту одобрен',{exact:true}).waitFor();ok('approval does not invent a playable build',await beta.getByText(/Файл бета-сборки ещё не подключён/).isVisible());
  betaStates[A+'fantazia']='revoked';await beta.getByRole('button',{name:'Проверить статус',exact:true}).click();await beta.getByText('Доступ отозван автором',{exact:true}).waitFor();ok('revoked access explains that another code cannot bypass owner decision',await beta.getByText(/Новый код не отменяет/).isVisible());await a.keyboard.press('Escape');
  // Even the server creator has no administration inside this launcher.
  accounts.a.profile.is_creator=true;await a.evaluate(()=>window.dispatchEvent(new Event('focus')));await a.waitForTimeout(300);await a.getByRole('button',{name:'Меню игры Fantazia RP',exact:true}).click();await a.getByRole('button',{name:'Свойства',exact:true}).click();beta=a.getByRole('dialog',{name:'Fantazia RP',exact:true});
  ok('creator has only two player property tabs',await beta.getByRole('tab').count()===2&&await beta.getByRole('tab',{name:'Управление',exact:true}).count()===0);
  ok('no admin beta request leaves the launcher',!apiCalls.some(c=>c.path.includes('/beta_admin_')));await a.keyboard.press('Escape');
  await nav(b,'Друзья');await b.getByRole('button',{name:'Обновить список',exact:true}).click();await b.locator('[data-friend-row]').waitFor();await b.screenshot({path:shots+'/mobile-friends-390.png'});for(const width of [390,320]){await b.setViewportSize({width,height:844});ok('mobile '+width+' fits without horizontal overflow',await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));ok('six real navigation destinations at '+width,await b.getByRole('navigation',{name:'Разделы лаунчера'}).getByRole('button').count()===6);}await b.screenshot({path:shots+'/mobile-friends-320.png'});
  await nav(b,'Профиль');await b.getByRole('button',{name:'Выйти из онлайн-профиля',exact:true}).click();await b.getByRole('button',{name:'Получить код на почту',exact:true}).waitFor();await b.getByRole('button',{name:/^Уведомления/}).click();dialog=b.getByRole('dialog',{name:'Уведомления',exact:true});await dialog.getByText('Сначала подтверди почту',{exact:true}).waitFor();ok('logout clears friends, count and shared username',await b.locator('[data-online-handle="Brother"]').count()===0&&await dialog.locator('[data-request-id]').count()===0);await b.keyboard.press('Escape');
  // Local profile changes must not claim success when storage rejects the write.
  await nav(b,'Профиль');await b.getByLabel('Имя на устройстве',{exact:true}).fill('UnsavedName');
  await b.evaluate(()=>{const original=Storage.prototype.setItem;window.restoreTestStorage=()=>{Storage.prototype.setItem=original;};Storage.prototype.setItem=function(k,v){if(k==='temka-accounts-v1')throw new DOMException('test quota','QuotaExceededError');return original.call(this,k,v);};});
  await b.getByRole('button',{name:'Сохранить имя',exact:true}).click();await b.getByText('Не получилось сменить имя',{exact:true}).waitFor();ok('storage failure preserves original local display name',await b.getByRole('heading',{name:'LocalBrother',exact:true}).isVisible());await b.evaluate(()=>window.restoreTestStorage());
  // Current online session can be restored only by an explicit test login, not by stale caches.
  await login(b,accounts.b.email,'BrotherAgain');await nav(b,'Друзья');await b.locator('[data-friends-page]').waitFor();await b.getByRole('button',{name:'Обновить список',exact:true}).click();
  // Settle the preceding explicit refresh before injecting a new unseen request.
  await b.waitForFunction(()=>{const button=document.querySelector('[aria-label="Обновить список"]');return button&&!button.disabled;});await b.waitForTimeout(200);
  const beforePoll=apiCalls.filter(c=>c.actor===B&&c.path.endsWith('/list_my_friends')).length;
  // Real timer wait: no manual dialog opening/focus event to produce this notification.
  relationships.push({id:crypto.randomUUID(),requester_id:C,receiver_id:B,status:'pending'});
  await b.getByRole('button',{name:'Уведомления, входящих заявок: 1',exact:true}).waitFor({timeout:35000});ok('shared 30-second poll updates header and incoming tab',apiCalls.filter(c=>c.actor===B&&c.path.endsWith('/list_my_friends')).length>beforePoll&&await b.getByRole('tab',{name:'Входящие 1',exact:true}).isVisible());
  await nav(b,'Новости');await b.getByRole('heading',{name:'Что нового?',exact:true}).waitFor();ok('news describes this build, not obsolete mail setup',await b.getByText('Бета-тест: только код и статус',{exact:true}).isVisible());
  await nav(b,'Настройки');await b.locator('.mobile-settings').waitFor();ok('mobile settings retained',await b.locator('.mobile-settings').isVisible());await nav(b,'Главная');await b.getByRole('button',{name:'Открыть библиотеку',exact:true}).waitFor();ok('home and library access retained',await b.getByRole('button',{name:'Открыть библиотеку',exact:true}).isVisible());
  ok('empty Store/Mods launchers removed',await a.getByRole('button',{name:'Магазин',exact:true}).count()===0&&await a.getByRole('button',{name:'Моды',exact:true}).count()===0);
  ok('no renderer crashes',errors.length===0);console.log('ALL',checks,'MAJOR BROWSER CHECKS PASSED; MOCKED BACKEND, NO REAL EMAILS.');
 }catch(e){for(const [i,p] of [a,b].entries())if(p)await p.screenshot({path:shots+'/failure-'+i+'.png'});throw e;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
