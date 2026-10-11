const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createUpdateController } = require('../electron/update-controller.cjs');
function fixture({ version = '1.6.0', enabled = true } = {}) {
  const updater = new EventEmitter();
  const events = [];
  let checks = 0, downloads = 0, restarts = 0, exits = 0;
  updater.checkForUpdates = async () => { checks++; return { updateInfo: { version } }; };
  updater.downloadUpdate = async () => {
    downloads++;
    updater.emit('download-progress', { percent: 50, transferred: 50, total: 100, bytesPerSecond: 10 });
    updater.emit('update-downloaded', { version });
  };
  updater.quitAndInstall = () => { restarts++; };
  const controller = createUpdateController({ updater, version: '1.5.0', enabled, send: e => events.push(e), beforeInstall: () => { exits++; } });
  return { updater, controller, events, counts: () => ({ checks, downloads, restarts, exits }) };
}
test('new version is available; checking does not download', async () => {
  const f = fixture(); const result = await f.controller.check();
  assert.equal(result.available, true); assert.equal(result.latest, '1.6.0');
  assert.equal(f.counts().downloads, 0);
  assert.equal(f.updater.autoDownload, false); assert.equal(f.updater.allowDowngrade, false);
});
test('same version and older versions are not installed', async () => {
  for (const version of ['1.5.0', '1.4.9']) {
    const f = fixture({ version });
    assert.equal((await f.controller.check()).available, false);
    assert.equal((await f.controller.install()).ok, false);
    assert.equal(f.counts().downloads, 0);
  }
});
test('invalid manifest is an error, not a false all-up-to-date result', async () => {
  const f = fixture({ version: 'broken' });
  const result = await f.controller.check();
  assert.equal(result.ok, false); assert.match(result.error, /корректную/);
});
test('network errors are visible and next check can recover', async () => {
  const f = fixture();
  f.updater.checkForUpdates = async () => { throw new Error('Network unavailable'); };
  assert.equal((await f.controller.check()).ok, false);
  f.updater.checkForUpdates = async () => ({ updateInfo: { version: '1.6.0' } });
  assert.equal((await f.controller.check()).available, true);
});
test('parallel checks share one request', async () => {
  const f = fixture(); await Promise.all([f.controller.check(), f.controller.check()]);
  assert.equal(f.counts().checks, 1);
});
test('parallel downloads share a job, progress is forwarded, apply requires download', async () => {
  const f = fixture(); assert.equal(f.controller.relaunch().ok, false);
  await f.controller.check();
  await Promise.all([f.controller.install(), f.controller.install()]);
  assert.equal(f.counts().downloads, 1);
  assert.equal(f.events[1].progress, 50);
  assert.equal(f.events.at(-1).phase, 'done');
  assert.equal(f.controller.relaunch().ok, true); assert.equal(f.counts().exits, 1);
  assert.equal(f.counts().restarts, 1);
});
test('install checks first when needed', async () => {
  const f = fixture(); assert.equal((await f.controller.install()).ok, true);
  assert.equal(f.counts().checks, 1);
});
test('install waits for an in-progress check', async () => {
  const f = fixture();
  const checking = f.controller.check(); const installing = f.controller.install();
  assert.equal((await checking).available, true); assert.equal((await installing).ok, true);
  assert.equal(f.counts().checks, 1);
});
test('download failure (including hash mismatch) does not enable apply; retry works', async () => {
  const f = fixture(); await f.controller.check();
  const download = f.updater.downloadUpdate;
  f.updater.downloadUpdate = async () => { throw new Error('SHA512 checksum mismatch'); };
  assert.equal((await f.controller.install()).ok, false);
  assert.equal(f.events.at(-1).phase, 'error');
  assert.equal(f.controller.relaunch().ok, false);
  f.updater.downloadUpdate = download;
  assert.equal((await f.controller.install()).ok, true);
});
test('already downloaded update is not downloaded again', async () => {
  const f = fixture(); await f.controller.install(); await f.controller.install();
  assert.equal(f.counts().downloads, 1);
});
test('development mode never calls the update server', async () => {
  const f = fixture({ enabled: false });
  assert.equal((await f.controller.check()).ok, false);
  assert.equal((await f.controller.install()).ok, false);
  assert.equal(f.counts().checks, 0);
});
