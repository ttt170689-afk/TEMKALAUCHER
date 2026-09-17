/* Публикация обновления в GitHub:
   1) пересобирает manifest.json (версия, дата, список изменений можно править руками)
   2) пакует dist/ в zip
   3) с флагом --push коммитит и пушит папку updates/ в твой репозиторий

   Использование:
     node scripts/publish-update.mjs 1.4.0            ← подготовить файлы
     node scripts/publish-update.mjs 1.4.0 --push     ← подготовить + залить на GitHub
*/
import fs from "fs";
import path from "path";
import { execFileSync, execSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const updatesDir = path.join(root, "updates");
const manifestPath = path.join(updatesDir, "manifest.json");
const doPush = process.argv.includes("--push");
const versionArg = process.argv.find((a) => /^\d+\.\d+\.\d+$/.test(a));

if (!fs.existsSync(path.join(dist, "index.html"))) {
  console.error("x Сначала соберите лаунчер: npm run build");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const version = versionArg || manifest.version;
const zipName = `TemkaLauncher-dist-${version}.zip`;
const zipPath = path.join(updatesDir, zipName);

// убираем старые zip-пакеты, чтобы в репозитории не копился мусор
for (const f of fs.readdirSync(updatesDir)) {
  if (f.endsWith(".zip") && f !== zipName) fs.rmSync(path.join(updatesDir, f));
}
if (fs.existsSync(zipPath)) fs.rmSync(zipPath);

console.log(`* Пакуем dist/ -> updates/${zipName}`);
if (process.platform === "win32") {
  execFileSync(
    "powershell.exe",
    ["-NoProfile", "-Command", `Compress-Archive -Path '${path.join(dist, "*")}' -DestinationPath '${zipPath}' -Force`],
    { stdio: "inherit" }
  );
} else {
  execFileSync("zip", ["-qr", zipPath, "."], { cwd: dist, stdio: "inherit" });
}

manifest.version = version;
manifest.file = zipName;
manifest.date = new Date().toISOString().slice(0, 10);
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`* manifest.json -> v${version}`);

// держим корневой version.json в тонусе, чтобы сборки шли с правильной версией
const versionFile = path.join(root, "version.json");
try {
  const v = JSON.parse(fs.readFileSync(versionFile, "utf8"));
  v.version = version;
  v.date = manifest.date;
  fs.writeFileSync(versionFile, JSON.stringify(v, null, 2) + "\n");
  console.log("* version.json -> v" + version);
} catch {
  /* noop */
}

if (doPush) {
  try {
    execSync("git rev-parse --is-inside-work-tree", { cwd: root, stdio: "pipe" });
  } catch {
    console.error("x Это не git-репозиторий. Сделайте один раз:");
    console.error("    git init && git remote add origin https://github.com/НИК/РЕПО.git");
    process.exit(1);
  }
  console.log("* Коммитим и пушим updates/ на GitHub...");
  execSync(`git add updates`, { cwd: root, stdio: "inherit" });
  try {
    execSync(`git commit -m "release v${version}"`, { cwd: root, stdio: "inherit" });
  } catch {
    console.log("! Нет новых изменений для коммита — пушим как есть.");
  }
  execSync("git push", { cwd: root, stdio: "inherit" });
  console.log(`\n  Готово! v${version} улетела на GitHub.`);
  console.log("  Лаунчеры игроков подтянут её сами при следующем запуске.");
} else {
  console.log("\n  Файлы готовы. Чтобы залить на GitHub:");
  console.log("    node scripts/publish-update.mjs " + version + " --push");
  console.log("  или руками: git add updates && git commit -m \"v" + version + "\" && git push");
}
