/* Sandbox-safe preload: только ipcRenderer, без Node-модулей.
   Всю работу с файлами делает главный процесс (main.cjs). */
const { contextBridge, ipcRenderer } = require("electron");

let version = "0.0.0";
try {
  version = ipcRenderer.sendSync("get-version-sync") || "0.0.0";
} catch {
  /* noop */
}

contextBridge.exposeInMainWorld("temka", {
  version,
  game: {
    open: game => ipcRenderer.invoke('game:open',game),
    current: () => ipcRenderer.invoke('game:current'),
    close: () => ipcRenderer.invoke('game:close'),
    onState: cb => {const listener=(_e,state)=>cb(state);ipcRenderer.on('game:state',listener);return ()=>ipcRenderer.removeListener('game:state',listener);}
  },
  platform: process.platform,
  copyText: text => ipcRenderer.invoke("clipboard:write-text", text),
  chooseGameFolder: currentPath => ipcRenderer.invoke("folder:choose", currentPath),
  launchUpdater: () => ipcRenderer.invoke("launch-updater"),
  quit: () => ipcRenderer.invoke("app-quit"),
  update: {
    check: () => ipcRenderer.invoke("update:check"),
    install: () => ipcRenderer.invoke("update:install"),
    relaunch: () => ipcRenderer.invoke("update:relaunch"),
    onProgress: (cb) => {
      const fn = (_e, s) => cb(s);
      ipcRenderer.on("update:progress", fn);
      return () => ipcRenderer.removeListener("update:progress", fn);
    },
  },
});

// Bridge tray actions into the existing React event listener.
ipcRenderer.on("temka-check-updates", () => window.dispatchEvent(new Event("temka-check-updates")));
