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
  platform: process.platform,
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
