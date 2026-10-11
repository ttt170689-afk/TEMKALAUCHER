import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "./settings";
import { useToast } from "./toast";
import { sfx } from "./sound";

export interface UpdateInfo {
  latest: string;
  current: string;
  date?: string;
  notes: string[];
  fileUrl?: string;
  source?: string;
}

export type UpdPhase =
  | "idle"
  | "checking"
  | "latest"
  | "available"
  | "downloading"
  | "extracting"
  | "ready"
  | "error";

interface TemkaApi {
  version?: string;
  update?: {
    check: () => Promise<{
      ok: boolean;
      current?: string;
      latest?: string;
      date?: string;
      notes?: string[];
      available?: boolean;
      error?: string;
    }>;
    install: () => Promise<{ ok: boolean; latest?: string; error?: string }>;
    relaunch: () => Promise<void>;
    onProgress: (cb: (s: { phase: string; progress?: number; got?: number; total?: number; speed?: number; latest?: string; error?: string }) => void) => () => void;
  };
}

const web = () => (typeof window !== "undefined" ? (window as unknown as { temka?: TemkaApi }).temka : undefined);

export function useAutoUpdate(auto = true) {
  const { s } = useSettings();
  const { push } = useToast();
  const [phase, setPhase] = useState<UpdPhase>("idle");
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [webMode, setWebMode] = useState(() => !web()?.update);
  const offRef = useRef<(() => void) | null>(null);

  // десктоп-движок (Electron/Neutralino) может подключиться чуть позже загрузки
  useEffect(() => {
    if (!webMode) return;
    const id = window.setInterval(() => {
      if (web()?.update) {
        setWebMode(false);
        window.clearInterval(id);
      }
    }, 350);
    const to = window.setTimeout(() => window.clearInterval(id), 8000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(to);
    };
  }, [webMode]);
  const phaseRef = useRef<UpdPhase>("idle");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const check = useCallback(async () => {
    // не дёргаем проверку, пока что-то уже качается или готово
    if (phaseRef.current === "downloading" || phaseRef.current === "extracting" || phaseRef.current === "ready") return;
    if (phaseRef.current === "checking") return;
    phaseRef.current = "checking";
    setPhase("checking");
    // десктоп: настоящая проверка через IPC
    const api = web();
    if (api?.update) {
      const r = await api.update.check().catch((error: unknown) => ({
        ok: false, error: String(error)
      } as Awaited<ReturnType<NonNullable<TemkaApi["update"]>["check"]>>));
      if (!r.ok) {
        phaseRef.current = "error";
        setPhase("error");
        return { available: false as const, error: r.error || "Не удалось проверить обновления." };
      }
      if (r.available) {
        setInfo({ latest: r.latest!, current: r.current!, date: r.date, notes: r.notes || [], source: (r as { source?: string }).source });
        setDismissed(false);
        phaseRef.current = "available";
        setPhase("available");
        sfx.nav();
        return { available: true as const };
      }
      phaseRef.current = "latest";
      setPhase("latest");
      return { available: false as const };
    }
    // Browser preview is not an installable Windows app: no simulated updates.
    phaseRef.current = "idle";
    setPhase("idle");
    return { available: false as const, error: "Обновления доступны в установленной Windows-версии." };
  }, []);

  const install = useCallback(async () => {
    if (!web()?.update) {
      push("info", "Это веб-превью", "В собранном EXE лаунчер обновит себя сам — скачает, заменит файлы и перезапустится.");
      return;
    }
    if (phaseRef.current === "downloading" || phaseRef.current === "ready") return;
    phaseRef.current = "downloading";
    setPhase("downloading");
    setProgress(0);
    const r = await web()!.update!.install().catch((error: unknown) => ({ ok: false, error: String(error) }));
    if (!r.ok) {
      setPhase("error");
      push("warn", "Не удалось обновиться", r.error || "Попробуй ещё раз через минуту.");
    }
  }, [push]);

  const relaunch = useCallback(() => {
    web()?.update?.relaunch();
  }, []);

  /* прямое скачивание пакета обновления в браузере */
  const download = useCallback(() => {
    const url = info?.fileUrl;
    if (!url) {
      push("warn", "Нет ссылки на пакет", "В манифесте обновления не указан файл.");
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = url.split("/").pop() || "TemkaLauncher-update.zip";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    sfx.level();
    push(
      "ok",
      "Скачивание началось",
      "Распакуй архив и замени файлы лаунчера — или просто запусти TemkaLauncher-Updater.exe рядом."
    );
  }, [info, push]);

  const later = useCallback(() => setDismissed(true), []);

  // прогресс установки
  useEffect(() => {
    const api = web();
    if (!api?.update) return;
    offRef.current = api.update.onProgress((st) => {
      if (st.phase === "downloading") {
        setPhase("downloading");
        setProgress(st.progress || 0);
        setSpeed(st.speed || 0);
      } else if (st.phase === "extracting") {
        setPhase("extracting");
      } else if (st.phase === "done") {
        setPhase("ready");
        sfx.level();
        push("ok", `Версия ${st.latest} скачана`, "Нажми «Перезапустить» для установки. Также обновление установится при выходе через меню трея.");
      } else if (st.phase === "error") {
        setPhase("error");
      }
    });
    return () => offRef.current?.();
  }, [push]);

  // автопроверка при запуске + по событию из настроек
  useEffect(() => {
    if (!auto || !s.autoUpdates) return;
    const t = window.setTimeout(() => check(), 1600);
    return () => window.clearTimeout(t);
  }, [auto, s.autoUpdates, check]);

  // фоновая проверка каждые 5 минут
  useEffect(() => {
    if (!auto || !s.autoUpdates || !s.periodicCheck) return;
    const id = window.setInterval(() => check(), 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [auto, s.autoUpdates, s.periodicCheck, check]);

  // автоустановка: нашли обновление → через пару секунд качаем сами
  useEffect(() => {
    if (phase !== "available" || webMode || !s.autoUpdates || !s.autoInstall || dismissed) return;
    const t = window.setTimeout(() => {
      install();
    }, 2500);
    return () => window.clearTimeout(t);
  }, [phase, webMode, s.autoUpdates, s.autoInstall, dismissed, install]);

  useEffect(() => {
    const on = () => {
      check().then((r) => {
        if (r && "error" in r) { push("warn", "Проверка не удалась", r.error || "Попробуй позднее."); return; }
        if (r && !r.available) push("ok", "Обновлений нет", "У тебя самая свежая версия TemkaLauncher.");
      });
    };
    window.addEventListener("temka-check-updates", on);
    return () => window.removeEventListener("temka-check-updates", on);
  }, [check, push]);

  return { phase, info, progress, speed, dismissed, webMode, check, install, relaunch, later, download };
}
