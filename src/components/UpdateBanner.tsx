import { AnimatePresence, motion } from "framer-motion";
import { useAutoUpdate } from "../lib/updater";
import { IconX } from "./ui";

export default function UpdateBanner() {
  const u = useAutoUpdate();

  const show =
    !u.dismissed &&
    (u.phase === "available" || u.phase === "downloading" || u.phase === "extracting" || u.phase === "ready" || u.phase === "error");

  return (
    <AnimatePresence>
      {show && u.info && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="panel relative z-40 mx-4 mb-3 overflow-hidden sm:mx-6"
          style={{ borderRadius: 14, borderColor: "color-mix(in srgb, var(--accent) 40%, var(--line))", boxShadow: "0 18px 50px -16px rgba(0,0,0,0.8), 0 0 30px -8px color-mix(in srgb, var(--accent) 30%, transparent)" }}
        >
          <span
            className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full"
            style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 18%, transparent), transparent 65%)" }}
          />
          {/* бегущая полоса загрузки */}
          {(u.phase === "downloading" || u.phase === "extracting") && (
            <span className="absolute bottom-0 left-0 h-[3px] rounded-r-full" style={{ width: `${u.phase === "extracting" ? 100 : u.progress}%`, background: "linear-gradient(90deg, var(--accent), var(--accent-2))", boxShadow: "0 0 12px var(--accent)", transition: "width .2s linear" }} />
          )}

          <div className="relative flex flex-wrap items-center gap-4 p-4">
            <span
              className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px] text-[var(--accent)]"
              style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-[14px] font-extrabold">
                  {u.phase === "ready" ? "Обновление скачано" : u.phase === "error" ? "Ошибка обновления" : `Доступно обновление v${u.info.latest}`}
                </p>
                <span className="font-mono2 rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-widest" style={{ color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}>
                  v{u.info.current} → v{u.info.latest}
                </span>
                {u.info.source && (
                  <span className="font-mono2 rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-widest text-[var(--accent-2)]" style={{ background: "color-mix(in srgb, var(--accent-2) 10%, transparent)" }}>
                    {u.info.source}
                  </span>
                )}
              </div>
              <p className="mt-0.5 line-clamp-1 text-[12px] text-[var(--tx2)]">
                {u.phase === "downloading"
                  ? `Скачиваем пакет… ${Math.round(u.progress)}%${u.speed ? ` · ${(u.speed / 1048576).toFixed(1)} МБ/с` : ""}`
                  : u.phase === "extracting"
                    ? "Распаковываем и заменяем файлы…"
                    : u.phase === "ready"
                      ? "Загрузка завершена. Перезапусти лаунчер для установки."
                      : u.phase === "error"
                        ? "Не получилось. Попробуй ещё раз."
                        : u.info.notes[0]}
              </p>
            </div>

            <div className="flex flex-none items-center gap-2">
              {u.phase === "available" && (
                <>
                  <button onClick={u.later} className="btn-ghost px-3.5 py-2 text-[12px]">
                    Позже
                  </button>
                  <button
                    onClick={u.webMode ? u.download : u.install}
                    className="btn-primary flex items-center gap-2 px-4 py-2 text-[12.5px]"
                  >
                    {u.webMode ? "Скачать обновление" : "Установить"}
                    {u.webMode ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
                        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14m-6-6 6 6-6 6" />
                      </svg>
                    )}
                  </button>
                </>
              )}
              {(u.phase === "downloading" || u.phase === "extracting") && (
                <span className="font-mono2 text-[11px] font-bold tabular-nums text-[var(--accent)]">
                  {u.phase === "extracting" ? "…" : `${Math.round(u.progress)}%`}
                </span>
              )}
              {u.phase === "ready" && (
                <button onClick={u.relaunch} className="btn-primary pulse-soft flex items-center gap-2 px-4 py-2 text-[12.5px]">
                  Перезапустить
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6" />
                  </svg>
                </button>
              )}
              {u.phase === "error" && (
                <button onClick={() => u.install()} className="btn-ghost px-4 py-2 text-[12px]">
                  Повторить
                </button>
              )}
              <button onClick={u.later} className="btn-ghost flex h-8 w-8 items-center justify-center" aria-label="Скрыть">
                <IconX />
              </button>
            </div>
          </div>

          {/* список изменений в режиме доступности */}
          {u.phase === "available" && u.info.notes.length > 1 && (
            <div className="relative border-t border-[var(--line)] px-4 py-2.5">
              <ul className="flex flex-wrap gap-x-5 gap-y-1">
                {u.info.notes.slice(1, 4).map((n) => (
                  <li key={n} className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tx3)]">
                    <span className="h-1 w-1 rounded-full bg-accent" />
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
