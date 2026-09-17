/* ============================================================
   TemkaLauncher Updater — отдельная программа обновления.
   Проверяет манифест, скачивает пакет, распаковывает и
   заменяет файлы лаунчера, затем перезапускает его.

   Запуск (dev):  npx electron updater/main.cjs --target=.
   Цель (--target) — папка, где лежит TemkaLauncher (dist/, version.json).
   ============================================================ */
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const https = require("https");
const http = require("http");
const { execFile, spawn } = require("child_process");

/* ===== НАСТРОЙКИ ===== */
// Сюда можно вписать ссылку на манифест (GitHub raw, свой сервер…):
// const MANIFEST_URL = "https://raw.githubusercontent.com/USER/REPO/main/updates/manifest.json";
const MANIFEST_URL = ""; // пусто = манифест из папки updates/ рядом с апдейтером

const targetArg = process.argv.find((a) => a.startsWith("--target="));
const TARGET = targetArg
  ? path.resolve(targetArg.split("=")[1])
  : path.resolve(__dirname, "..");
const UPDATES_DIR = path.resolve(__dirname, "..", "updates");

let win = null;

const send = (state) => win && !win.isDestroyed() && win.webContents.send("state", state);

function createWindow() {
  win = new BrowserWindow({
    width: 580,
    height: 660,
    resizable: false,
    frame: false,
    backgroundColor: "#0b0e14",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, "index.html"));
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => (win = null));
}

/* ===== утилиты ===== */
const cmp = (a, b) => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
};

const readCurrentVersion = () => {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(TARGET, "version.json"), "utf8"));
    return v.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
};

const fetchBuffer = (url, onProgress, redirects = 0) =>
  new Promise((resolve, reject) => {
    if (redirects > 4) return reject(new Error("Слишком много перенаправлений"));
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { headers: { "User-Agent": "TemkaLauncher-Updater" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        return fetchBuffer(next, onProgress, redirects + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`Сервер вернул ${res.statusCode}`));
      const total = parseInt(res.headers["content-length"] || "0", 10);
      const chunks = [];
      let got = 0;
      const t0 = Date.now();
      res.on("data", (c) => {
        chunks.push(c);
        got += c.length;
        const dt = Math.max(1, Date.now() - t0);
        onProgress && onProgress({ got, total, speed: (got / dt) * 1000 });
      });
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("Таймаут загрузки")));
  });

const loadManifest = async () => {
  if (MANIFEST_URL) {
    const buf = await fetchBuffer(MANIFEST_URL);
    const m = JSON.parse(buf.toString("utf8"));
    return { manifest: m, baseDir: null, baseUrl: MANIFEST_URL };
  }
  const p = path.join(UPDATES_DIR, "manifest.json");
  const m = JSON.parse(fs.readFileSync(p, "utf8"));
  return { manifest: m, baseDir: UPDATES_DIR, baseUrl: null };
};

const resolvePackagePath = (m, baseDir, baseUrl) => {
  if (m.url) return m.url; // прямая ссылка (http/https)
  if (baseDir) return path.join(baseDir, m.file); // локальный файл
  if (baseUrl) return new URL(m.file, baseUrl).toString();
  throw new Error("В манифесте нет ссылки на пакет");
};

const downloadToFile = async (src, dest, onProgress) => {
  // локальный файл — «скачиваем» копированием с живым прогрессом
  if (!/^https?:/i.test(src)) {
    const total = fs.statSync(src).size;
    const rd = fs.createReadStream(src);
    const wr = fs.createWriteStream(dest);
    const t0 = Date.now();
    let got = 0;
    await new Promise((resolve, reject) => {
      rd.on("data", (c) => {
        got += c.length;
        onProgress({ got, total, speed: (got / Math.max(1, Date.now() - t0)) * 1000 });
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
        { timeout: 120000 },
        (err) => (err ? reject(err) : resolve())
      );
    } else {
      execFile("unzip", ["-o", zip, "-d", dest], { timeout: 120000 }, (err) =>
        err ? reject(err) : resolve()
      );
    }
  });

/* ===== IPC ===== */
ipcMain.handle("check", async () => {
  send({ phase: "checking", current: readCurrentVersion() });
  try {
    const { manifest, baseDir, baseUrl } = await loadManifest();
    const current = readCurrentVersion();
    if (cmp(manifest.version, current) <= 0) {
      send({ phase: "up-to-date", current, latest: manifest.version });
      return;
    }
    send({
      phase: "available",
      current,
      latest: manifest.version,
      date: manifest.date,
      notes: manifest.notes || [],
    });
  } catch (e) {
    send({ phase: "error", error: String(e.message || e) });
  }
});

ipcMain.handle("install", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "temka-upd-"));
  const zip = path.join(tmp, "update.zip");
  try {
    const { manifest, baseDir, baseUrl } = await loadManifest();
    const src = resolvePackagePath(manifest, baseDir, baseUrl);
    send({ phase: "downloading", progress: 0 });
    await downloadToFile(src, zip, (p) => {
      const progress = p.total ? Math.min(99, (p.got / p.total) * 100) : 50;
      send({ phase: "downloading", progress, got: p.got, total: p.total, speed: p.speed });
    });

    send({ phase: "extracting", progress: 100 });
    const out = path.join(tmp, "out");
    await extractZip(zip, out);

    // корень пакета: либо сам dist, либо папка dist внутри
    const root = fs.existsSync(path.join(out, "index.html")) ? out : path.join(out, "dist");
    if (!fs.existsSync(path.join(root, "index.html")))
      throw new Error("В пакете обновления не найден index.html");

    // заменяем dist лаунчера
    const distDir = path.join(TARGET, "dist");
    if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true, force: true });
    fs.cpSync(root, distDir, { recursive: true });

    // обновляем версию
    const verPath = path.join(TARGET, "version.json");
    const old = fs.existsSync(verPath) ? JSON.parse(fs.readFileSync(verPath, "utf8")) : {};
    fs.writeFileSync(
      verPath,
      JSON.stringify({ ...old, version: manifest.version, date: manifest.date || new Date().toISOString().slice(0, 10) }, null, 2)
    );

    fs.rmSync(tmp, { recursive: true, force: true });
    send({ phase: "done", latest: manifest.version });
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true });
    send({ phase: "error", error: String(e.message || e) });
  }
});

ipcMain.handle("launch", () => {
  try {
    const exes = fs
      .readdirSync(TARGET)
      .filter((f) => /temka.*launcher.*\.exe$/i.test(f) && !/updater/i.test(f));
    if (exes.length) {
      spawn(path.join(TARGET, exes[0]), [], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {
    /* noop */
  }
  app.quit();
});

ipcMain.on("close", () => app.quit());
ipcMain.handle("open-folder", () => {
  const { shell } = require("electron");
  shell.openPath(TARGET);
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
