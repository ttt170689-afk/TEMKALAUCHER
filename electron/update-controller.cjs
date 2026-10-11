const semver = require('semver');

// Separate from Electron so the update state machine can be tested without Windows.
function createUpdateController({ updater, version, enabled, send, beforeInstall = () => {} }) {
  let checkJob = null;
  let downloadJob = null;
  let available = null;
  let downloaded = false;
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = true;
  updater.allowDowngrade = false;
  updater.allowPrerelease = false;
  const errorText = e => String(e?.message || e);
  const newer = info => !!(semver.valid(info?.version) && semver.gt(info.version, version));
  const response = info => ({
    ok: true, current: version, latest: info?.version || version,
    date: info?.releaseDate, notes: ['Обновление приложения из GitHub Releases'],
    source: 'GitHub Releases', available: newer(info)
  });
  updater.on('download-progress', p => send({
    phase: 'downloading', progress: p.percent, got: p.transferred,
    total: p.total, speed: p.bytesPerSecond
  }));
  updater.on('update-downloaded', info => {
    downloaded = true;
    available = info;
    send({ phase: 'done', progress: 100, latest: info.version });
  });
  // Required error listener: do not let a failed network request crash the app.
  updater.on('error', () => {});

  async function check() {
    if (!enabled) return { ok: false, current: version, error: 'Обновления доступны в установленной Windows-версии.' };
    if (downloaded || downloadJob) return response(available);
    if (checkJob) return checkJob;
    checkJob = (async () => {
      try {
        const result = await updater.checkForUpdates();
        if (!result?.updateInfo || !semver.valid(result.updateInfo.version)) throw new Error('Сервер не вернул корректную версию обновления.');
        available = newer(result.updateInfo) ? result.updateInfo : null;
        return response(result.updateInfo);
      } catch (e) {
        available = null;
        return { ok: false, current: version, error: errorText(e) };
      }
    })();
    try { return await checkJob; } finally { checkJob = null; }
  }

  async function install() {
    if (downloaded) {
      send({ phase: 'done', progress: 100, latest: available.version });
      return { ok: true, latest: available.version };
    }
    if (downloadJob) return downloadJob;
    downloadJob = (async () => {
      try {
        // Use a fresh check if the renderer requested installation before checking.
        if (!available) {
          // Call the updater directly here: check() deliberately does not race downloads.
          if (!enabled) throw new Error('Установи Windows-версию лаунчера.');
          const result = checkJob ? await checkJob : await (async () => {
            const r = await updater.checkForUpdates();
            available = newer(r?.updateInfo) ? r.updateInfo : null;
            return response(r?.updateInfo);
          })();
          if (!result.ok) throw new Error(result.error);
          if (!available) throw new Error('Новой версии пока нет.');
        }
        send({ phase: 'downloading', progress: 0 });
        await updater.downloadUpdate();
        if (!downloaded) throw new Error('Загрузка не завершена. Попробуй ещё раз.');
        return { ok: true, latest: available.version };
      } catch (e) {
        send({ phase: 'error', error: errorText(e) });
        return { ok: false, error: errorText(e) };
      }
    })();
    try { return await downloadJob; } finally { downloadJob = null; }
  }

  function relaunch() {
    if (!downloaded) return { ok: false, error: 'Сначала скачай обновление.' };
    beforeInstall();
    // NSIS replaces the entire application (including Electron), not just dist/.
    updater.quitAndInstall(false, true);
    return { ok: true };
  }
  return { check, install, relaunch };
}
module.exports = { createUpdateController };
