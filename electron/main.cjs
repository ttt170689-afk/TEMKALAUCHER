/* ============================================================
   TemkaLauncher — Electron: окно + нативный трей + автообновление.
   Крестик сворачивает в трей, «Выход» в меню трея закрывает навсегда.
   ============================================================ */
const { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage, Notification } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const https = require("https");
const http = require("http");
const { spawn, execFile } = require("child_process");

const isPacked = app.isPackaged;

const DIST = isPacked
  ? path.join(process.resourcesPath, "app.asar.unpacked", "dist")
  : path.join(__dirname, "..", "dist");
const VERSION_FILE = isPacked
  ? path.join(process.resourcesPath, "app.asar.unpacked", "version.json")
  : path.join(__dirname, "..", "version.json");
const UPDATES_DIR = isPacked
  ? path.join(process.resourcesPath, "updates")
  : path.join(__dirname, "..", "updates");
const ICON_PATH = path.join(__dirname, "..", "build", "icon.png");

/* Ссылка на манифест обновлений в твоём GitHub-репозитории.
   Вставь сюда СВОЙ адрес после создания репозитория — и лаунчер будет
   брать обновления прямо оттуда. Пример:
   const MANIFEST_URL = "https://raw.githubusercontent.com/ТВОЙ_НИК/temkalaucher-updates/main/updates/manifest.json";
   Пока пусто — лаунчер проверяет локальную папку updates/. */
const MANIFEST_URL = "";

/* Файл-настройка рядом с exe: впиши туда raw-ссылку на manifest.json
   из своего GitHub — и лаунчер будет обновляться оттуда без пересборки.
   Пример содержимого (без #):
   https://raw.githubusercontent.com/ТВОЙ_НИК/temkalaucher/main/updates/manifest.json */
const SOURCE_FILE = isPacked
  ? path.join(process.resourcesPath, "updater-source.txt")
  : path.join(__dirname, "..", "updater-source.txt");

const readSourceUrl = () => {
  try {
    const txt = fs.readFileSync(SOURCE_FILE, "utf8");
    return (
      txt
        .split(/\r?\n/)
        .map((s) => s.trim())
        .find((s) => s && !s.startsWith("#")) || ""
    );
  } catch {
    return "";
  }
};

let win = null;
let tray = null;
let forceQuit = false;

/* ================= окно ================= */
function createWindow() {
  win = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#0b0e14",
    autoHideMenuBar: true,
    title: "TemkaLauncher",
    icon: ICON_PATH,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.loadFile(path.join(DIST, "index.html"));
  win.once("ready-to-show", () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11") {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
    if (input.key === "F12" && !isPacked) {
      win.webContents.toggleDevTools({ mode: "detach" });
      event.preventDefault();
    }
  });

  /* Крестик НЕ закрывает — прячет в трей. Закрыть можно только через «Выход». */
  win.on("close", (e) => {
    if (forceQuit) return;
    e.preventDefault();
    win.hide();
    try {
      if (tray) {
        tray.displayBalloon({
          icon: nativeImage.createFromPath(ICON_PATH),
          title: "TemkaLauncher",
          content: "Лаунчер свернут в трей. Иконка — справа внизу рядом с часами.",
        });
      }
    } catch {
      /* noop */
    }
  });

  win.on("closed", () => (win = null));
  if (!isPacked) win.webContents.openDevTools({ mode: "detach" });
}

function showWindow() {
  if (!win) {
    createWindow();
    return;
  }
  win.show();
  win.focus();
}

/* ================= нативный трей ================= */
function createTray() {
  try {
    const img = nativeImage.createFromPath(ICON_PATH).resize({ width: 32, height: 32 });
    tray = new Tray(img);
    tray.setToolTip("TemkaLauncher");

    const menu = Menu.buildFromTemplate([
      { label: "Открыть TemkaLauncher", click: showWindow },
      { type: "separator" },
      {
        label: "Проверить обновления",
        click: () => {
          showWindow();
          if (win) win.webContents.send("temka-check-updates");
        },
      },
      { type: "separator" },
      {
        label: "Выход",
        click: () => {
          forceQuit = true;
          app.quit();
        },
      },
    ]);
    tray.setContextMenu(menu);

    tray.on("click", showWindow);
    tray.on("double-click", showWindow);
  } catch {
    tray = null;
  }
}

const send = (ch, data) => win && !win.isDestroyed() && win.webContents.send(ch, data);

/* ================= обновленческий движок ================= */
const cmp = (a, b) => {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
};

const readVersion = () => {
  try {
    return JSON.parse(fs.readFileSync(VERSION_FILE, "utf8")).version || "0.0.0";
  } catch {
    return "0.0.0";
  }
};

const fetchBuffer = (url, onProgress, redirects = 0) =>
  new Promise((resolve, reject) => {
    if (redirects > 4) return reject(new Error("Слишком много перенаправлений"));
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { headers: { "User-Agent": "TemkaLauncher" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return fetchBuffer(new URL(res.headers.location, url).toString(), onProgress, redirects + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`Сервер вернул ${res.statusCode}`));
      const total = parseInt(res.headers["content-length"] || "0", 10);
      const chunks = [];
      let got = 0;
      const t0 = Date.now();
      res.on("data", (c) => {
        chunks.push(c);
        got += c.length;
        onProgress && onProgress({ got, total, speed: (got / Math.max(1, Date.now() - t0)) * 1000 });
      });
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("Таймаут загрузки")));
  });

const loadLocalManifest = () => {
  const m = JSON.parse(fs.readFileSync(path.join(UPDATES_DIR, "manifest.json"), "utf8"));
  return { m, baseDir: UPDATES_DIR, baseUrl: null };
};

/* GitHub (или любой хост) — первым; если сеть недоступна, берём локальную папку */
const loadManifest = async () => {
  /* Ссылка берётся из updater-source.txt рядом с exe, иначе из MANIFEST_URL.
     GitHub недоступен — молча падаем на локальную папку updates/. */
  const url = readSourceUrl() || MANIFEST_URL;
  if (url) {
    try {
      const buf = await fetchBuffer(url);
      return { m: JSON.parse(buf.toString("utf8")), baseDir: null, baseUrl: url };
    } catch {
      /* офлайн — пробуем локально */
    }
  }
  return loadLocalManifest();
};

const packagePath = (m, baseDir, baseUrl) => {
  if (m.url) return m.url;
  if (baseDir) return path.join(baseDir, m.file);
  if (baseUrl) return new URL(m.file, baseUrl).toString();
  throw new Error("В манифесте нет ссылки на пакет");
};

const downloadToFile = async (src, dest, onProgress) => {
  if (!/^https?:/i.test(src)) {
    const total = fs.statSync(src).size;
    const t0 = Date.now();
    let got = 0;
    await new Promise((resolve, reject) => {
      const rd = fs.createReadStream(src);
      const wr = fs.createWriteStream(dest);
      rd.on("data", (c) => {
        got += c.length;
        onProgress && onProgress({ got, total, speed: (got / Math.max(1, Date.now() - t0)) * 1000 });
      });
      rd.on("error", reject);
      wr.on("error", reject);
      wr.on("finish", resolve);
      rd.pipe(wr);
    });
    return;
  }
  const buf = await fetchBuffer(src, onProgress);
  fs.writeFileSync(dest, buf);
};

const extractZip = (zip, dest) =>
  new Promise((resolve, reject) => {
    if (process.platform === "win32") {
      execFile(
        "powershell.exe",
        ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${dest}' -Force`],
        { timeout: 180000 },
        (err) => (err ? reject(err) : resolve())
      );
    } else {
      execFile("unzip", ["-o", zip, "-d", dest], { timeout: 180000 }, (err) => (err ? reject(err) : resolve()));
    }
  });

ipcMain.on("get-version-sync", (e) => {
  e.returnValue = readVersion();
});

ipcMain.handle("update:check", async () => {
  try {
    const current = readVersion();
    const { m, baseUrl } = await loadManifest();
    const srcUrl = readSourceUrl() || MANIFEST_URL;
    const source = srcUrl && baseUrl === srcUrl ? "GitHub" : "локально";
    return { ok: true, current, latest: m.version, date: m.date, notes: m.notes || [], available: cmp(m.version, current) > 0, source };
  } catch (e) {
    return { ok: false, current: readVersion(), error: String(e.message || e) };
  }
});

ipcMain.handle("update:install", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "temka-selfupd-"));
  const zip = path.join(tmp, "update.zip");
  try {
    const { m, baseDir, baseUrl } = await loadManifest();
    const src = packagePath(m, baseDir, baseUrl);

    send("update:progress", { phase: "downloading", progress: 0 });
    await downloadToFile(src, zip, (p) =>
      send("update:progress", {
        phase: "downloading",
        progress: p.total ? Math.min(99, (p.got / p.total) * 100) : 50,
        got: p.got,
        total: p.total,
        speed: p.speed,
      })
    );

    send("update:progress", { phase: "extracting", progress: 100 });
    const out = path.join(tmp, "out");
    await extractZip(zip, out);
    const root = fs.existsSync(path.join(out, "index.html")) ? out : path.join(out, "dist");
    if (!fs.existsSync(path.join(root, "index.html"))) throw new Error("В пакете не найден index.html");

    if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true, force: true });
    fs.cpSync(root, DIST, { recursive: true });

    const newUpdater = [path.join(out, "TemkaLauncher-Updater.exe"), path.join(root, "TemkaLauncher-Updater.exe")].find((f) =>
      fs.existsSync(f)
    );
    let updaterUpdated = false;
    if (newUpdater) {
      try {
        fs.copyFileSync(newUpdater, path.join(path.dirname(app.getPath("exe")), "TemkaLauncher-Updater.exe"));
        updaterUpdated = true;
      } catch {
        /* noop */
      }
    }

    const old = fs.existsSync(VERSION_FILE) ? JSON.parse(fs.readFileSync(VERSION_FILE, "utf8")) : {};
    fs.writeFileSync(
      VERSION_FILE,
      JSON.stringify({ ...old, version: m.version, date: m.date || new Date().toISOString().slice(0, 10) }, null, 2)
    );

    fs.rmSync(tmp, { recursive: true, force: true });
    send("update:progress", { phase: "done", progress: 100, latest: m.version, updaterUpdated });
    return { ok: true, latest: m.version, updaterUpdated };
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true });
    send("update:progress", { phase: "error", error: String(e.message || e) });
    return { ok: false, error: String(e.message || e) };
  }
});

ipcMain.handle("update:relaunch", () => {
  forceQuit = true;
  app.relaunch();
  app.exit(0);
});

ipcMain.handle("launch-updater", () => {
  const exeDir = path.dirname(app.getPath("exe"));
  const candidates = [path.join(exeDir, "TemkaLauncher-Updater.exe"), path.join(exeDir, "..", "TemkaLauncher-Updater.exe")];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      spawn(c, [`--target=${exeDir}`], { detached: true, stdio: "ignore" }).unref();
      return true;
    }
  }
  if (!isPacked) {
    const upd = path.join(__dirname, "..", "updater", "main.cjs");
    if (fs.existsSync(upd)) {
      spawn(process.execPath, [upd, `--target=${path.join(__dirname, "..")}`], { detached: true, stdio: "ignore" }).unref();
      return true;
    }
  }
  return false;
});

/* Принудительный выход из интерфейса лаунчера */
ipcMain.handle("app-quit", () => {
  forceQuit = true;
  app.quit();
});

/* ================= жизненный цикл ================= */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", showWindow);

  app.whenReady().then(() => {
    createTray();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    /* не выходим, пока жив трей — лаунчер работает в фоне */
  });

  app.on("before-quit", () => {
    forceQuit = true;
  });
}
