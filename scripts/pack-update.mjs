/* Пакует свежий dist/ в zip-пакет обновления и кладёт рядом с manifest.json.
   Запуск: node scripts/pack-update.mjs [версия]
   Пример: node scripts/pack-update.mjs 1.3.1            */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const updatesDir = path.join(root, "updates");
const manifestPath = path.join(updatesDir, "manifest.json");

if (!fs.existsSync(path.join(dist, "index.html"))) {
  console.error("✗ Сначала соберите лаунчер: npm run build");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const version = process.argv[2] || manifest.version;
const zipName = `TemkaLauncher-dist-${version}.zip`;
const zipPath = path.join(updatesDir, zipName);

if (fs.existsSync(zipPath)) fs.rmSync(zipPath);
fs.mkdirSync(updatesDir, { recursive: true });

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

console.log(`✓ Пакет собран: updates/${zipName}`);
console.log(`✓ Манифест обновлён до версии ${version}`);
console.log("  Загрузите updates/ на свой хостинг (GitHub Releases, S3…) или оставьте локально.");
