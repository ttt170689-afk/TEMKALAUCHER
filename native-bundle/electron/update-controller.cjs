const semver = require('semver');

// Separate from Electron so the update state machine can be tested without Windows.
function createUpdateController({ updater, version, enabled, send, resolveRelease, beforeInstall = () => {}, disabledReason = "Автообновления доступны в установленной Windows-версии или запущенном Linux AppImage." }) {
  let checkJob = null;
  let downloadJob = null;
  let available = null;
  let downloaded = false;
  let verified = null;
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = true;
  updater.allowDowngrade = false;
  updater.allowPrerelease = false;
  const errorText = e => String(e?.message || e);
  const newer = info => !!(semver.valid(info?.version) && semver.gt(info.version, version));
  const response = info => ({
    ok: true, current: version, latest: info?.version || version,
    date: info?.releaseDate, notes: ['Обновление приложения из GitHub Releases'],
    source: verified?.source || 'GitHub Releases', checkedAt: verified?.checkedAt, releaseUrl: verified?.releaseUrl, comparison: newer(info) ? 'newer' : semver.lt(info?.version || version, version) ? 'ahead' : 'same', available: newer(info), state: downloaded ? 'ready' : downloadJob ? 'downloading' : undefined
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

  async function query() {
    verified = resolveRelease ? await resolveRelease() : null;
    if (verified) {
      if (!semver.valid(verified.version)) throw Error('Некорректная версия GitHub.');
      if (!semver.gt(verified.version, version)) return {version:verified.version};
      updater.setFeedURL({provider:'generic',url:verified.feedUrl,channel:'latest',useMultipleRangeRequest:false});
      updater.requestHeaders = {...updater.requestHeaders,'Cache-Control':'no-cache'};
    }
    const result=await updater.checkForUpdates();
    if (!result?.updateInfo || !semver.valid(result.updateInfo.version)) throw Error('Сервер не вернул корректную версию обновления.');
    if (verified && (result.updateInfo.version !== verified.version || result.isUpdateAvailable === false)) throw Error(`GitHub сообщил ${verified.version}, но движок обновления не подтвердил этот пакет. Повтори проверку или открой релиз GitHub.`);
    if (verified?.expectedFile) {
      const expected=verified.expectedFiles || [verified.expectedFile],files=result.updateInfo.files;
      if (!Array.isArray(files)||files.length!==expected.length||!expected.every(want=>files.some(got=>got.url===want.url&&got.size===want.size&&got.sha512===want.sha512))) throw Error('Файл обновления изменился между проверками. Загрузка не разрешена; повтори проверку.');
    }
    return result.updateInfo;
  }

  async function check() {
    if (!enabled) return { ok: false, current: version, error: disabledReason };
    if (checkJob) return checkJob;
    if (downloadJob && !available) { await downloadJob; if (!available) return {ok:false,error:'Проверка пакета ещё не подтверждена.'}; }
    if (downloaded || downloadJob) return response(available);
    checkJob = (async () => {
      try {
        const info = await query();
        available = newer(info) ? info : null;
        return response(info);
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
          if (!enabled) throw new Error(disabledReason);
          const result = checkJob ? await checkJob : await (async () => {
            const info = await query();
            available = newer(info) ? info : null;
            return response(info);
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
