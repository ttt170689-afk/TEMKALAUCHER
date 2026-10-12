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
    const labels = ['Главная', 'Новости', 'Библиотека', 'Профиль', 'Настройки'];
    for (const label of labels) await page.getByRole('button', { name: label, exact: true }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Профиль', exact: true }).click();
    const profileName = page.locator('input[maxlength="25"]').last();
    await profileName.waitFor();
    assert.equal(await profileName.inputValue(), nick);
    const renamed = 'temka_play_official_65432';
    await profileName.fill(renamed + '7');
    assert.equal(await profileName.inputValue(), renamed);
    await page.getByRole('button', { name: 'Сохранить', exact: true }).first().click();
    await page.waitForFunction(expected => {
      const store = JSON.parse(localStorage.getItem('temka-accounts-v1') || '{}');
      return store.users?.some(user => user.id === store.session && user.username === expected);
    }, renamed);
    if (await page.getByLabel('Загрузить свою аватарку', { exact: true }).count()) {
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
    }
    phase('compact settings and error reporting');
    await page.getByRole('button', { name: 'Настройки', exact: true }).click();
    await page.getByText('Настройки лаунчера', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Проверить обновления лаунчера', exact: true }).click();
    await page.getByText('Проверка не удалась', { exact: true }).waitFor();
    phase('wide navigation');
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const label of labels) await page.getByRole('button', { name: label, exact: true }).waitFor({ state: 'visible' });
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
    console.log('PASS: compact + wide navigation, 25-character registration/rename, settings, IPC, persistence.');
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
