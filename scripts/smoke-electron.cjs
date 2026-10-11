const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'temka-smoke-'));
  const args = [path.resolve(__dirname, '..'), '--disable-gpu', `--user-data-dir=${profile}`];
  if (process.platform === 'linux') args.push('--no-sandbox'); // Linux CI only, not production.
  const app = await electron.launch({ args, timeout: 30000 });
  try {
    const page = await app.firstWindow();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.waitForFunction(() => !!window.temka);
    assert.equal(await page.evaluate(() => window.temka.version), require('../package.json').version);
    assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
    assert.equal((await page.evaluate(() => window.temka.update.check())).ok, false);
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
    await page.getByRole('button', { name: 'Профиль', exact: true }).click();
    const profileName = page.locator('input[maxlength="25"]');
    await profileName.waitFor();
    assert.equal(await profileName.inputValue(), nick);
    const renamed = 'temka_play_official_65432';
    await profileName.fill(renamed + '7');
    assert.equal(await profileName.inputValue(), renamed);
    await page.getByRole('button', { name: 'Сохранить', exact: true }).first().click();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('temka-accounts-v1')));
    assert.equal(stored.users[0].username, renamed);
    await page.getByRole('button', { name: 'Настройки', exact: true }).click();
    await page.getByText('Настройки лаунчера', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Проверить обновления лаунчера', exact: true }).click();
    await page.getByText('Проверка не удалась', { exact: true }).waitFor();
    // Verify tray IPC event is bridged to the renderer.
    await page.evaluate(() => { window.__trayEventSeen = false; window.addEventListener('temka-check-updates', () => { window.__trayEventSeen = true; }, { once: true }); });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('temka-check-updates'));
    await page.waitForFunction(() => window.__trayEventSeen);
    await page.reload();
    await page.getByRole('button', { name: 'Настройки', exact: true }).waitFor({ timeout: 20000 });
    assert.deepEqual(errors, []);
    console.log('PASS: Electron startup, version bridge, Node isolation, 25-character registration and rename, settings, error reporting, tray bridge, session persistence.');
  } finally {
    await app.close();
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  }
})().catch(e => { console.error(e); process.exit(1); });
