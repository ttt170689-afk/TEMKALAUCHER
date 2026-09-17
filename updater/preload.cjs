const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("temkaUpd", {
  check: () => ipcRenderer.invoke("check"),
  install: () => ipcRenderer.invoke("install"),
  launch: () => ipcRenderer.invoke("launch"),
  openFolder: () => ipcRenderer.invoke("open-folder"),
  close: () => ipcRenderer.send("close"),
  onState: (cb) => {
    const fn = (_e, s) => cb(s);
    ipcRenderer.on("state", fn);
    return () => ipcRenderer.removeListener("state", fn);
  },
});
