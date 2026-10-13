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
    await app.context().route(/^https?:/,route=>{externalRequests.push(route.request().url());return route.fulfill({status:503,contentType:'application/json',body:'{"message":"External services blocked in native smoke test"}'});});
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
    console.log('PASS: compact + wide six-section navigation, 25-character registration/rename, required avatar persistence, settings, friends/bell/beta gates, IPC, session persistence; no real OTP.');
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
