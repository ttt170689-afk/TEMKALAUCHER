import { useEffect, useRef, useState } from "react";
import { useSettings } from "../lib/settings";
import { APP_VERSION } from "../lib/version";
import { ScrambleText } from "./ui";

const LINES = [
  "Инициализация ядра…",
  "Подключение к серверам Temka…",
  "Загрузка профиля игрока…",
  "Проверка сборок TemkaWorld и Fantazia RP…",
  "Запуск лаунчера…",
];

export default function Boot({ onDone }: { onDone: () => void }) {
  const { s } = useSettings();
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setLeaving(true);
    window.setTimeout(onDone, 520);
  };

  useEffect(() => {
    if (s.reducedMotion) {
      setProgress(100);
      const id = window.setTimeout(finish, 350);
      return () => window.clearTimeout(id);
    }
    const id = window.setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + 1.1 + Math.random() * 2.4);
        if (next >= 100) {
          window.clearInterval(id);
          window.setTimeout(finish, 320);
        }
        return next;
      });
    }, 38);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lineIdx = Math.min(LINES.length - 1, Math.floor((progress / 100) * LINES.length));

  return (
    <div
      onClick={finish}
      className={`fixed inset-0 z-[300] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-[var(--bg0)] transition-all duration-500 ${
        leaving ? "pointer-events-none -translate-y-[6%] opacity-0" : "opacity-100"
      }`}
      role="button"
      aria-label="Пропустить загрузку"
    >
      {/* фоновое зарево */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[70vmax] w-[70vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 10%, transparent) 0%, transparent 58%)" }}
      />
      <div className="grid-overlay" />

      {/* лого */}
      <svg width="92" height="92" viewBox="0 0 32 32" className="drop-shadow-[0_10px_36px_color-mix(in_srgb,var(--accent)_50%,transparent)]">
        <path
          d="M16 2 28 9v14L16 30 4 23V9z"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.6"
          className="boot-draw"
          style={{ strokeDasharray: 100 }}
          pathLength={100}
        />
        <path d="M10 12h12v3.4h-4.2V23h-3.6v-7.6H10z" fill="var(--accent)" className="boot-fill" />
      </svg>

      <h1 className="font-display mt-6 text-[22px] font-extrabold tracking-[0.18em] sm:text-[26px]">
        <ScrambleText text="TEMKALAUNCHER" />
      </h1>
      <p className="font-mono2 mt-2 text-[10px] font-bold uppercase tracking-[0.34em] text-[var(--tx3)]">
        temka studio · v{APP_VERSION}
      </p>

      {/* строки загрузки */}
      <div className="mt-9 w-[min(420px,86vw)]">
        <div className="flex flex-col gap-2">
          {LINES.map((l, i) => {
            const done = i < lineIdx || progress >= 100;
            const current = i === lineIdx && progress < 100;
            return (
              <div key={l} className="flex items-center gap-2.5">
                <span className="flex h-4 w-4 flex-none items-center justify-center">
                  {done ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-2)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : current ? (
                    <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" />
                  ) : (
                    <span className="h-1 w-1 rounded-full bg-[var(--bg3)]" />
                  )}
                </span>
                <span
                  className={`font-mono2 text-[11.5px] font-semibold transition-colors duration-300 ${
                    done ? "text-[var(--tx2)]" : current ? "text-[var(--tx)]" : "text-[var(--tx3)]"
                  }`}
                >
                  {l}
                  {current && <span className="ml-1 inline-block animate-pulse text-[var(--accent)]">▍</span>}
                </span>
              </div>
            );
          })}
        </div>

        {/* прогресс */}
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[var(--bg2)]">
          <div className="progress-fill h-full rounded-full" style={{ width: `${progress}%`, transition: "width .12s linear" }} />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-mono2 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--tx3)]">нажмите, чтобы пропустить</span>
          <span className="font-mono2 text-[11px] font-bold tabular-nums text-[var(--accent)]">{Math.floor(progress)}%</span>
        </div>
      </div>

      <p className="font-mono2 absolute bottom-5 left-6 text-[9.5px] font-semibold uppercase tracking-[0.24em] text-[var(--tx3)]">
        © 2026 temka studio
      </p>
      <p className="font-mono2 absolute bottom-5 right-6 text-[9.5px] font-semibold uppercase tracking-[0.24em] text-[var(--tx3)]">
        канал stable
      </p>
    </div>
  );
}
