const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'temka-smoke-'));
  const diagnostics = path.resolve(__dirname, '..', 'test-results', 'electron-smoke');
  const args = [path.resolve(__dirname, '..'), '--disable-gpu', `--user-data-dir=${profile}`];
  if (process.platform === 'linux') args.push('--no-sandbox'); // Linux CI only, never production.
  let app, page;
  let step = 'launch';
  const errors = [];
  const phase = name => { step = name; console.log('SMOKE:', name); };
  try {
    app = await electron.launch({ args, timeout: 60000 });
    // Native smoke must not send real mail or depend on an external service.
    const externalRequests=[];
    let clipboardAccount=false;
    const mockUser={id:'11111111-1111-4111-8111-111111111111',username:'copy_Тест',has_avatar:false,avatar_version:0,is_creator:false};
    const onlineBase=(process.env.VITE_TEMKA_SUPABASE_URL||require('../src/config/online.public.json').url).trim().replace(/\/+$/,'');
    const mockOther={...mockUser,id:'22222222-2222-4222-8222-222222222222',username:'copy_friend'};
    let mockAvatar=null,avatarUploads=0,failCard=false,failAvatar=false;
    const cardMeta={display_name:'Тестовый игрок',bio:'',avatar_style:'cube',avatar_color:'#63e6be'};
    const playerCard=id=>id===mockUser.id?{...mockUser,...cardMeta,games:[]}:
      id===mockOther.id?{...mockOther,display_name:'Друг из теста',bio:'Тестовый профиль, не реальный игрок.',avatar_style:'mage',avatar_color:'#63e6be',games:[{game_id:'fantazia',level:4,play_seconds:7260,last_played_at:'2026-10-13T00:00:00Z',updated_at:'2026-10-13T00:00:00Z',achievements:[{id:'first',title:'Первый шаг',earned_at:'2026-10-13T00:00:00Z'}],achievements_total:3}]}:null;
    const mockedEndpoints=new Set();
    await app.context().route(/^https?:/,route=>{
      const request=route.request(),url=request.url();externalRequests.push(url);
      if(clipboardAccount&&mockAvatar&&url.startsWith(onlineBase+'/storage/v1/object/public/avatars/'+mockUser.id+'/avatar.webp'))return route.fulfill({status:200,contentType:'image/webp',body:mockAvatar});
      // Explicit synthetic responses only. No route.continue(), production tokens, or OTP.
      if(clipboardAccount&&url.startsWith(onlineBase+'/')&&request.headers().authorization==='Bearer clipboard-smoke-token'){
        const endpoint=url.slice(onlineBase.length);let body={};try{body=request.postDataJSON()||{};}catch{}
        const respond=data=>{mockedEndpoints.add(endpoint);return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});};
        if(endpoint==='/rest/v1/rpc/get_player_card')return failCard?route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({message:'Could not find the function public.get_player_card in the schema cache'})}):respond(playerCard(body.player_id));
        if(endpoint==='/rest/v1/rpc/search_players')return respond([mockUser,mockOther].filter(p=>p.username.toLowerCase().includes(String(body.query_text).toLowerCase())));
        if(endpoint==='/rest/v1/rpc/save_player_card'){cardMeta.display_name=body.new_display_name;cardMeta.bio=body.new_bio;return respond(playerCard(mockUser.id));}
        if(endpoint==='/storage/v1/object/avatars/'+mockUser.id+'/avatar.webp'){if(failAvatar)return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Test upload failure"}'});mockAvatar=request.postDataBuffer();avatarUploads++;return respond({Key:'test-avatar'});}
        if(endpoint==='/rest/v1/rpc/set_avatar_visible'){mockUser.has_avatar=body.visible;mockUser.avatar_version++;return respond(null);}
        if(endpoint==='/storage/v1/object/avatars'){mockAvatar=null;return respond([]);}
        if(endpoint==='/rest/v1/rpc/set_player_avatar_style'){cardMeta.avatar_style=body.new_style;cardMeta.avatar_color=body.new_color;mockUser.has_avatar=false;return respond(null);}

        const result=endpoint==='/auth/v1/user'?{id:mockUser.id,email_confirmed_at:'2026-10-13T00:00:00Z'}:
          endpoint==='/rest/v1/rpc/my_profile'?[mockUser]:endpoint==='/rest/v1/rpc/list_my_friends'?[]:undefined;
        if(result!==undefined){mockedEndpoints.add(endpoint);return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});}
      }
      return route.fulfill({status:503,contentType:'application/json',body:'{"message":"External services blocked in native smoke test"}'});
    });
    await app.context().tracing.start({ screenshots: true, snapshots: true, sources: true });
    page = await app.firstWindow();
    page.setDefaultTimeout(30000);
    page.on('pageerror', e => errors.push(e.message));
    // Windows hosted runners can have a narrow desktop. Reproduce compact navigation deliberately.
    await page.setViewportSize({ width: 980, height: 700 });
    phase('preload and isolated renderer');
    await page.waitForFunction(() => !!window.temka);
    assert.equal(await page.evaluate(() => window.temka.version), require('../package.json').version);
    assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
    assert.equal((await page.evaluate(() => window.temka.update.check())).ok, false);
    phase('25-character registration');
    const nick = 'temka_play_official_12345';
    assert.equal(nick.length, 25);
    const nameInput = page.getByPlaceholder('Temka_Игрок');
    await nameInput.fill(nick + '7');
    assert.equal(await nameInput.inputValue(), nick);
    assert.equal(await nameInput.getAttribute('maxlength'), '25');
    await page.getByPlaceholder('you@example.com').fill('test@example.invalid');
    await page.locator('input[type=password]').nth(0).fill('DemoOnly123!');
    await page.locator('input[type=password]').nth(1).fill('DemoOnly123!');
    await page.getByRole('button', { name: /Принимаю правила/ }).click();
    await page.getByRole('button', { name: /Создать аккаунт/ }).click();
    // Separate registration failures from navigation/accessibility failures.
    await page.waitForFunction(expected => {
      const store = JSON.parse(localStorage.getItem('temka-accounts-v1') || '{}');
      return store.users?.some(user => user.id === store.session && user.username === expected);
    }, nick);
    phase('compact navigation has accessible names');
    assert((await page.evaluate(() => innerWidth)) < 1024);
    const labels = ['Главная', 'Новости', 'Библиотека', 'Друзья', 'Профиль', 'Настройки'];
    const nav = page.getByRole('navigation', {name:'Разделы лаунчера',exact:true});
    assert.equal(await nav.getByRole('button').count(),labels.length);
    for (const label of labels) await nav.getByRole('button', { name: label, exact: true }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Профиль', exact: true }).click();
    const profileName = page.getByRole('textbox', {name:'Имя на устройстве',exact:true});
    await profileName.waitFor();
    assert.equal(await profileName.inputValue(), nick);
    const renamed = 'temka_play_official_65432';
    await profileName.fill(renamed + '7');
    assert.equal(await profileName.inputValue(), renamed);
    await page.getByRole('button', { name: 'Сохранить имя', exact: true }).click();
    await page.waitForFunction(expected => {
      const store = JSON.parse(localStorage.getItem('temka-accounts-v1') || '{}');
      return store.users?.some(user => user.id === store.session && user.username === expected);
    }, renamed);
    phase('custom avatar upload and persistence');
    await page.getByLabel('Загрузить свою аватарку', { exact: true }).setInputFiles(path.resolve(__dirname, '..', 'assets', 'icon.png'));
    await page.waitForFunction(() => {
      const store = JSON.parse(localStorage.getItem('temka-accounts-v1') || '{}');
      return store.users?.find(u => u.id === store.session)?.profile.avatar?.startsWith('data:image/webp;base64,');
    });
    await page.reload();
    await page.getByRole('button', { name: 'Профиль', exact: true }).click();
    await page.getByRole('img', { name: 'Аватар игрока', exact: true }).first().waitFor();
    assert(await page.getByRole('img', { name: 'Аватар игрока', exact: true }).count() >= 2);
    phase('compact settings and error reporting');
    await page.getByRole('button', { name: 'Настройки', exact: true }).click();
    await page.getByText('Настройки лаунчера', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Проверить обновления лаунчера', exact: true }).click();
    await page.getByText('Проверка не удалась', { exact: true }).waitFor();
    phase('friends navigation and notifications without online login');
    await nav.getByRole('button',{name:'Друзья',exact:true}).click();
    await page.locator('[data-friends-page]').waitFor();
    await page.getByText('Сначала подтверди почту',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'＋ Добавить друга',exact:true}).isDisabled(),true);
    const bell=page.getByRole('button',{name:'Уведомления',exact:true});
    await bell.click();
    const inbox=page.getByRole('dialog',{name:'Уведомления',exact:true});
    await inbox.getByRole('button',{name:'Подтвердить почту в профиле',exact:true}).waitFor();
    assert.equal(await inbox.locator('[data-request-id]').count(),0);
    await page.keyboard.press('Escape');await inbox.waitFor({state:'hidden'});
    assert.equal(await bell.evaluate(el=>el===document.activeElement),true);
    phase('game properties beta gate uses actual native renderer');
    await nav.getByRole('button',{name:'Библиотека',exact:true}).click();
    await page.getByRole('button',{name:'Меню игры Fantazia RP',exact:true}).click();
    await page.getByRole('button',{name:'Свойства',exact:true}).click();
    const properties=page.getByRole('dialog',{name:'Fantazia RP',exact:true});
    await properties.getByRole('tab',{name:'Бета-тест',exact:true}).click();
    await properties.getByText('Нужен подтверждённый онлайн-аккаунт',{exact:true}).waitFor();
    assert.equal(await properties.getByRole('button',{name:'Отправить код',exact:true}).isDisabled(),true);
    assert.equal(await properties.getByRole('tab',{name:'Управление',exact:true}).count(),0);
    await properties.getByRole('button',{name:'Закрыть свойства',exact:true}).click();
    phase('wide navigation');
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const label of labels) await nav.getByRole('button', { name: label, exact: true }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Профиль', exact: true }).click();
    await profileName.waitFor();
    assert.equal(await profileName.inputValue(), renamed);
    phase('system clipboard IPC and copy buttons with mocked online identity');
    assert.equal(await page.evaluate(()=>typeof window.temka.copyText),'function');
    assert.equal(await page.evaluate(()=>typeof window.temka.readText),'undefined');
    const browserCopy=await page.evaluate(async()=>{try{await navigator.clipboard.writeText('browser-copy-must-be-blocked');return 'allowed';}catch(error){return error.name;}});
    assert.notEqual(browserCopy,'allowed','Browser clipboard permissions must remain denied');
    console.log('Browser clipboard denied as expected:',browserCopy);
    for(const text of ['@copy_Тест','TMK-ABC-123']){
      assert.equal((await page.evaluate(value=>window.temka.copyText(value),text)).ok,true);
      assert.equal(await app.evaluate(({clipboard})=>clipboard.readText()),text);
    }
    const beforeInvalid=await app.evaluate(({clipboard})=>clipboard.readText());
    for(const value of [null,{},'', 'a'.repeat(4097),'a\0b'])assert.equal((await page.evaluate(value=>window.temka.copyText(value),value)).ok,false);
    assert.equal(await app.evaluate(({clipboard})=>clipboard.readText()),beforeInvalid);
    // A foreign renderer with the same preload must not gain clipboard access.
    assert.equal(await app.evaluate(async({BrowserWindow},preloadPath)=>{
      const foreign=new BrowserWindow({show:false,webPreferences:{preload:preloadPath,sandbox:true,contextIsolation:true,nodeIntegration:false}});
      try{
        await foreign.loadURL('data:text/html,<title>Untrusted clipboard fixture</title>');
        return await foreign.webContents.executeJavaScript("window.temka.copyText('foreign-write').then(()=>false,error=>error.message.includes('Недопустимый источник'))");
      }finally{foreign.destroy();}
    },path.resolve(__dirname,'..','electron','preload.cjs')),true);
    assert.equal(await app.evaluate(({clipboard})=>clipboard.readText()),beforeInvalid);
    clipboardAccount=true;
    await page.evaluate(({base,id})=>{
      const local=JSON.parse(localStorage.getItem('temka-accounts-v1'));
      localStorage.setItem(`temka-online-v1:${base}:${local.session}`,JSON.stringify({access_token:'clipboard-smoke-token',refresh_token:'clipboard-smoke-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id,email:'clipboard@example.invalid'}}));
    },{base:onlineBase,id:mockUser.id});
    await page.reload();
    await nav.getByRole('button',{name:'Профиль',exact:true}).click();
    const profileCopy=page.getByRole('button',{name:'Скопировать @юзернейм',exact:true});
    await profileCopy.waitFor();
    await app.evaluate(({clipboard})=>clipboard.writeText('before-profile-copy'));
    await profileCopy.click();
    await page.getByText('Юзернейм скопирован.',{exact:true}).waitFor();
    assert.equal(await app.evaluate(({clipboard})=>clipboard.readText()),'@'+mockUser.username);
    await nav.getByRole('button',{name:'Друзья',exact:true}).click();
    await app.evaluate(({clipboard})=>clipboard.writeText('before-friends-copy'));
    await page.getByRole('button',{name:'Скопировать свой юзернейм',exact:true}).click();
    await page.getByText('Юзернейм скопирован.',{exact:true}).waitFor();
    assert.equal(await app.evaluate(({clipboard})=>clipboard.readText()),'@'+mockUser.username);
    phase('partial friend search and public player cards');
    await page.getByRole('button',{name:'＋ Добавить друга',exact:true}).click();
    const friendSearch=page.getByRole('textbox',{name:'Юзернейм друга',exact:true});
    await friendSearch.fill('c');assert.equal(await page.getByRole('button',{name:'Найти друга',exact:true}).isDisabled(),true);
    await friendSearch.fill('copy');await page.getByRole('button',{name:'Найти друга',exact:true}).click();
    await page.getByRole('button',{name:'Открыть профиль @copy_friend',exact:true}).waitFor();
    assert.equal(await page.locator('[data-search-result]').count(),2);
    await page.getByRole('button',{name:'Открыть профиль @copy_friend',exact:true}).click();
    const playerDialog=page.getByRole('dialog',{name:'Профиль игрока',exact:true});
    await playerDialog.getByText('Друг из теста',{exact:true}).waitFor();
    await playerDialog.getByText('2 ч 1 мин',{exact:true}).waitFor();
    await playerDialog.getByText('Первый шаг',{exact:true}).waitFor();
    assert.equal(await playerDialog.getByRole('button',{name:'Добавить в друзья',exact:true}).isEnabled(),true);
    assert(!(await playerDialog.innerText()).includes('example.invalid'));
    fs.mkdirSync(path.join(diagnostics,'previews'),{recursive:true});
    await playerDialog.screenshot({path:path.join(diagnostics,'previews','player-profile.png')});
    await page.keyboard.press('Escape');await playerDialog.waitFor({state:'hidden'});
    assert.equal(await page.getByRole('button',{name:'Открыть профиль @copy_friend',exact:true}).evaluate(el=>el===document.activeElement),true);
    failCard=true;await page.getByRole('button',{name:'Открыть профиль @copy_friend',exact:true}).click();
    await playerDialog.getByText('Обновление профилей ещё не подключено на сервере. Сообщи temka_play_official.',{exact:true}).waitFor();
    failCard=false;await playerDialog.getByRole('button',{name:'Повторить загрузку профиля',exact:true}).click();
    await playerDialog.getByText('Друг из теста',{exact:true}).waitFor();await page.keyboard.press('Escape');
    phase('one avatar picker and editable public identity');
    await nav.getByRole('button',{name:'Профиль',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Опубликовать аватарку для друзей',exact:true}).count(),0);
    assert.equal(avatarUploads,0,'Existing local avatar is not silently published on online login');
    await page.getByText('Как меня видят другие игроки',{exact:true}).click();
    await page.getByRole('textbox',{name:'Имя для других игроков',exact:true}).fill('Новое публичное имя');
    await page.getByRole('textbox',{name:'О себе',exact:true}).fill('Это мой тестовый профиль.');
    await page.getByRole('button',{name:'Сохранить публичный профиль',exact:true}).click();
    await page.getByText('Онлайн-профиль сохранён.',{exact:true}).waitFor();
    await page.getByLabel('Загрузить свою аватарку',{exact:true}).setInputFiles(path.resolve(__dirname,'..','assets','icon.png'));
    await page.getByText('Фото доступно в твоём онлайн-профиле.',{exact:true}).waitFor();
    assert.equal(avatarUploads,1);assert.equal(mockUser.has_avatar,true);
    // Profile editor may remount during shared account refresh; reopen its details if needed.
    const details=page.locator('.player-editor');if(!await details.evaluate(el=>el.open))await details.locator('summary').click();
    await page.getByRole('button',{name:'Открыть мой публичный профиль',exact:true}).click();
    await playerDialog.getByText('Новое публичное имя',{exact:true}).waitFor();
    const photo=playerDialog.getByRole('img',{name:'Аватар @'+mockUser.username,exact:true});await photo.waitFor();
    await page.waitForFunction(()=>{const img=document.querySelector('.player-photo');return img&&img.complete&&img.naturalWidth>0;});
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Аватар mage',exact:true}).click();
    await page.getByText('Изменение видно в онлайн-профиле.',{exact:true}).waitFor();
    assert.equal(mockUser.has_avatar,false);assert.equal(mockAvatar,null);assert.equal(cardMeta.avatar_style,'mage');
    failAvatar=true;
    await page.getByLabel('Загрузить свою аватарку',{exact:true}).setInputFiles(path.resolve(__dirname,'..','assets','icon.png'));
    await page.getByText('Фото сохранено только на устройстве',{exact:true}).waitFor();
    assert.equal(avatarUploads,1);assert.equal(mockUser.has_avatar,false);
    failAvatar=false;
    await page.getByLabel('Загрузить свою аватарку',{exact:true}).setInputFiles(path.resolve(__dirname,'..','assets','icon.png'));
    await page.waitForFunction(()=>{const input=document.querySelector('[aria-label="Загрузить свою аватарку"]');return input&&!input.disabled;});
    assert.equal(avatarUploads,2);assert.equal(mockUser.has_avatar,true);
    phase('new library selection filters tabs and honest game statistics');
    await nav.getByRole('button',{name:'Библиотека',exact:true}).click();
    await page.getByRole('button',{name:'Выбрать игру Fantazia RP',exact:true}).click();
    await page.locator('[data-selected-game="fantazia"]').waitFor();
    assert.equal(await page.getByRole('button',{name:'Скоро',exact:true}).isDisabled(),true);
    assert.equal(await page.getByRole('button',{name:/Открыть в браузере/}).count(),0);
    await page.screenshot({path:path.join(diagnostics,'previews','library-fantazia.png')});
    await page.locator('.library-overview').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(diagnostics,'previews','library-overview.png')});
    await page.getByRole('tab',{name:'Мой прогресс',exact:true}).click();
    await page.getByText('Статистику передаёт сама игра. Открытое окно лаунчера и переход по ссылке не добавляют часы.',{exact:true}).waitFor();
    assert.equal(await page.locator('.player-stats').getByText('Нет данных',{exact:true}).count(),3);
    await page.getByRole('tab',{name:'Разработка',exact:true}).click();await page.locator('.library-roadmap').waitFor();
    await page.getByRole('tab',{name:'Дополнения',exact:true}).click();await page.getByText('Сначала — сам мир',{exact:true}).waitFor();
    await page.getByRole('textbox',{name:'Поиск игр в библиотеке',exact:true}).fill('does-not-exist');
    await page.getByText('Найдём твой мир',{exact:true}).waitFor();assert.equal(await page.locator('[data-selected-game]').count(),0);
    await page.getByRole('textbox',{name:'Поиск игр в библиотеке',exact:true}).fill('');
    await page.getByRole('button',{name:'Выбрать игру TemkaWorld',exact:true}).click();
    await page.locator('[data-selected-game="temkaworld"]').waitFor();
    assert.equal(await page.getByRole('button',{name:'Скоро',exact:true}).isDisabled(),true);
    await page.setViewportSize({width:980,height:700});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.locator('[data-library-hub]').screenshot({path:path.join(diagnostics,'previews','library-compact.png')});
    await page.setViewportSize({width:1280,height:800});
    await nav.getByRole('button',{name:'Друзья',exact:true}).click();
    phase('copy failure does not claim success');
    await app.evaluate(async({clipboard})=>{
      await clipboard.writeText('unchanged-on-failure');
      globalThis.__smokeWriteText=clipboard.writeText;
      clipboard.writeText=()=>{throw Error('simulated OS clipboard failure');};
    });
    try{
      await page.getByRole('button',{name:'Скопировать свой юзернейм',exact:true}).click();
      await page.getByText('Скопируй вручную: @'+mockUser.username,{exact:true}).waitFor();
      assert.equal(await page.getByText('Юзернейм скопирован.',{exact:true}).count(),0);
      await nav.getByRole('button',{name:'Профиль',exact:true}).click();
      await profileCopy.click();
      await page.getByText('Не удалось скопировать. Твой юзернейм: @'+mockUser.username,{exact:true}).waitFor();
      assert.equal(await page.getByText('Юзернейм скопирован.',{exact:true}).count(),0);
      assert.equal(await app.evaluate(({clipboard})=>clipboard.readText()),'unchanged-on-failure');
    }finally{
      await app.evaluate(({clipboard})=>{clipboard.writeText=globalThis.__smokeWriteText;delete globalThis.__smokeWriteText;});
    }
    for(const endpoint of ['/auth/v1/user','/rest/v1/rpc/my_profile','/rest/v1/rpc/list_my_friends','/rest/v1/rpc/search_players','/rest/v1/rpc/get_player_card','/rest/v1/rpc/save_player_card','/rest/v1/rpc/set_avatar_visible'])assert(mockedEndpoints.has(endpoint),endpoint);
    await page.evaluate(()=>{for(const key of Object.keys(localStorage))if(key.startsWith('temka-online-v1:'))localStorage.removeItem(key);});
    clipboardAccount=false;
    await page.reload();
    phase('tray event bridge');
    await page.evaluate(() => {
      window.__trayEventSeen = false;
      window.addEventListener('temka-check-updates', () => { window.__trayEventSeen = true; }, { once: true });
    });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('temka-check-updates'));
    await page.waitForFunction(() => window.__trayEventSeen);
    phase('session persistence');
    await page.reload();
    await page.getByRole('button', { name: 'Настройки', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    assert.equal(externalRequests.filter(url=>/\/auth\/v1\/(otp|verify)/.test(url)).length,0,'Native smoke must not trigger automatic OTP');
    console.log('PASS: compact + wide six-section navigation, 25-character registration/rename, required avatar persistence, settings, friends/bell/beta gates, actual OS clipboard + denial/error paths, public profiles/search/stats, unified avatar, library filters/tabs, IPC, session persistence; mocked online identity, no real OTP.');
    await app.context().tracing.stop();
  } catch (error) {
    fs.mkdirSync(diagnostics, { recursive: true });
    const details = { step, error: String(error.stack || error), rendererErrors: errors };
    if (page && !page.isClosed()) {
      details.page = await page.evaluate(() => ({
        url: location.href, width: innerWidth, height: innerHeight,
        text: document.body.innerText.slice(0, 20000),
        buttons: Array.from(document.querySelectorAll('button')).map(b => ({
          label: b.getAttribute('aria-label'), text: b.textContent,
          visible: !!b.getClientRects().length, disabled: b.disabled
        }))
      })).catch(e => ({ diagnosticError: String(e) }));
      await page.screenshot({ path: path.join(diagnostics, 'failure.png'), timeout: 10000 }).catch(() => {});
    }
    fs.writeFileSync(path.join(diagnostics, 'failure.json'), JSON.stringify(details, null, 2));
    if (app) await app.context().tracing.stop({ path: path.join(diagnostics, 'trace.zip') }).catch(() => {});
    console.error('FAILED STEP:', step, '\nDiagnostics:', diagnostics);
    throw error;
  } finally {
    if (app) await app.close().catch(e => console.error('Electron cleanup:', String(e)));
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); }
    catch (error) { console.warn('Temporary profile cleanup:', String(error)); }
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
