/* Самообновление сборки на Neutralino — без ручных архивов.
   Скачиваем пакет, пишем его на диск, распаковываем системным PowerShell,
   меняем файлы в resources/ и перезапускаем exe. Всё изнутри лаунчера. */

type Neu = {
  filesystem: {
    writeBinaryFile: (p: string, d: ArrayBuffer) => Promise<void>;
    writeFile: (p: string, d: string) => Promise<void>;
  };
  os: {
    execCommand: (c: string) => Promise<{ exitCode: number }>;
    spawnProcess: (c: string) => Promise<{ pid: number }>;
  };
  app: { exit: () => void };
};

const cmp = (a: string, b: string) => {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
};

let listeners: ((s: unknown) => void)[] = [];
const emit = (s: unknown) => listeners.forEach((l) => l(s));

export function installNeuUpdater() {
  const w = window as unknown as {
    Neutralino?: Neu;
    NL_PATH?: string;
    NL_APPVERSION?: string;
    NL_OS?: string;
    temka?: Record<string, unknown>;
  };
  const N = w.Neutralino;
  const exeDir = (w.NL_PATH || "").replace(/[\\/]$/, "");
  if (!N || !exeDir || w.temka?.update) return;

  const res = exeDir + "\\resources";
  const exe = exeDir + "\\TemkaLauncher.exe";

  w.temka = {
    version: w.NL_APPVERSION || "0.0.0",
    platform: w.NL_OS,
    quit: () => N.app.exit(),
    update: {
      onProgress: (cb: (s: unknown) => void) => {
        listeners.push(cb);
        return () => {
          listeners = listeners.filter((l) => l !== cb);
        };
      },
      check: async () => {
        try {
          const curRes = await fetch("version.json", { cache: "no-store" });
          const current = curRes.ok ? (await curRes.json()).version : "0.0.0";
          const mRes = await fetch("updates/manifest.json", { cache: "no-store" });
          if (!mRes.ok) throw new Error();
          const m = await mRes.json();
          return {
            ok: true,
            current,
            latest: m.version,
            date: m.date,
            notes: m.notes || [],
            available: cmp(m.version, current) > 0,
            source: "локально",
          };
        } catch {
          return { ok: false, current: "0.0.0", error: "offline" };
        }
      },
      install: async () => {
        try {
          const mRes = await fetch("updates/manifest.json", { cache: "no-store" });
          const m = await mRes.json();

          emit({ phase: "downloading", progress: 0 });
          const res2 = await fetch("updates/" + m.file, { cache: "no-store" });
          if (!res2.ok) throw new Error("Пакет не найден");
          const total = Number(res2.headers.get("content-length") || 0);
          const reader = res2.body!.getReader();
          const chunks: Uint8Array[] = [];
          let got = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            got += value.length;
            emit({ phase: "downloading", progress: total ? Math.min(99, (got / total) * 100) : 50, got, total, speed: 0 });
          }
          const buf = new Uint8Array(got);
          let o = 0;
          for (const c of chunks) {
            buf.set(c, o);
            o += c.length;
          }

          emit({ phase: "extracting", progress: 100 });
          const tmp = exeDir + "\\temka-update.zip";
          await N.filesystem.writeBinaryFile(tmp, buf.buffer as ArrayBuffer);
          const cmd = `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${tmp}' -DestinationPath '${res}' -Force; Remove-Item '${tmp}' -Force"`;
          const r = await N.os.execCommand(cmd);
          if (r.exitCode !== 0) throw new Error("Распаковка не удалась");

          await N.filesystem.writeFile(
            res + "\\version.json",
            JSON.stringify({ version: m.version, date: m.date || new Date().toISOString().slice(0, 10) }, null, 2)
          );

          emit({ phase: "done", progress: 100, latest: m.version });
          return { ok: true, latest: m.version };
        } catch (e) {
          emit({ phase: "error", error: String((e as Error).message || e) });
          return { ok: false, error: String((e as Error).message || e) };
        }
      },
      relaunch: async () => {
        try {
          await N.os.spawnProcess(`"${exe}"`);
        } catch {
          /* noop */
        }
        N.app.exit();
      },
    },
  };
}
