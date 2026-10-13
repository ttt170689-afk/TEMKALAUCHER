const { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage, dialog, session, net, clipboard } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createFolderPicker } = require('./folder-picker.cjs');
const { createClipboardWriter } = require('./clipboard.cjs');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const { createReleaseSource } = require('./release-source.cjs');
const { createUpdateController } = require('./update-controller.cjs');

log.initialize();
autoUpdater.logger = log;
const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
const indexUrl = pathToFileURL(indexPath).href;
let win = null;
let tray = null;
let forceQuit = false;
const updates = createUpdateController({
  updater: autoUpdater, version: app.getVersion(),
  resolveRelease: createReleaseSource({fetchImpl:(url,options)=>net.fetch(url,options)}),
  enabled: app.isPackaged && (process.platform === 'win32' || (process.platform === 'linux' && !!process.env.APPIMAGE)),
  disabledReason: process.platform === 'linux' ? 'Автообновления Linux доступны для запущенного AppImage. Пакет .deb обновляется установкой нового пакета из GitHub Releases.' : undefined,
  send: state => { if (win && !win.isDestroyed()) win.webContents.send('update:progress', state); },
  beforeInstall: () => { forceQuit = true; }
});

function trusted(event) {
  return !!win && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame
    && event.senderFrame.url.split('#')[0] === indexUrl;
}
function handle(channel, fn) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!trusted(event)) throw new Error('Недопустимый источник запроса.');
    return fn(...args);
  });
}
ipcMain.on('get-version-sync', event => { event.returnValue = trusted(event) ? app.getVersion() : ''; });
handle('update:check', () => updates.check());
handle('update:install', () => updates.install());
handle('update:relaunch', () => updates.relaunch());
handle('launch-updater', () => { showWindow(); win.webContents.send('temka-check-updates'); return true; });
const folderPicker = createFolderPicker({dialog,getWindow:()=>win,getDefaultPath:()=>app.getPath('documents')});
handle('folder:choose', currentPath => folderPicker.choose(currentPath));
handle('clipboard:write-text', createClipboardWriter(clipboard));
handle('app-quit', () => { forceQuit = true; app.quit(); });

function showWindow() {
  if (!win) createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}
function createWindow() {
  win = new BrowserWindow({
    width: 1380, height: 880, minWidth: 1024, minHeight: 640,
    title: 'TemkaLauncher', backgroundColor: '#0b0e14', autoHideMenuBar: true,
    icon: iconPath, show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, sandbox: true, nodeIntegration: false,
      webSecurity: true
    }
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(indexPath).catch(error => {
    log.error(error);
    dialog.showErrorBox('TemkaLauncher', 'Не удалось открыть интерфейс. Переустанови приложение.\n' + error.message);
    forceQuit = true;
    app.quit();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      if (['https:', 'http:'].includes(target.protocol)) shell.openExternal(target.href).catch(log.error);
    } catch { /* ignore malformed URLs */ }
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url.split('#')[0] !== indexUrl) event.preventDefault();
  });
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen()); event.preventDefault();
    }
  });
  win.on('close', event => {
    // If the tray could not be created, the close button must still close the app.
    if (!forceQuit && tray && process.platform === 'win32') { event.preventDefault(); win.hide(); }
    if (process.platform === 'linux') forceQuit = true;
  });
  win.on('closed', () => { win = null; });
}
function createTray() {
  try {
    const image = nativeImage.createFromPath(iconPath);
    if (image.isEmpty()) throw new Error('Missing tray icon');
    tray = new Tray(image.resize({ width: 32, height: 32 }));
    tray.setToolTip('TemkaLauncher — открыть двойным щелчком');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Открыть TemkaLauncher', click: showWindow },
      { label: 'Проверить обновления', click: () => { showWindow(); win.webContents.send('temka-check-updates'); } },
      { type: 'separator' },
      { label: 'Выход', click: () => { forceQuit = true; app.quit(); } }
    ]));
    tray.on('double-click', showWindow);
    tray.on('click', showWindow);
  } catch (error) { log.warn('Tray unavailable', error); tray = null; }
}
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    createTray(); createWindow();
  }).catch(error => { log.error(error); dialog.showErrorBox('TemkaLauncher', error.message); app.quit(); });
  app.on('activate', showWindow);
  app.on('window-all-closed', () => { if (!tray || process.platform === 'linux') app.quit(); });
  app.on('before-quit', () => { forceQuit = true; });
}
