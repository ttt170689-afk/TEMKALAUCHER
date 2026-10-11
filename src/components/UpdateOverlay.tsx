import { useEffect, useState } from "react";
import { APP_VERSION } from "../lib/version";
import { AnimatePresence, motion } from "framer-motion";
import { ScrambleText } from "./ui";

/* Кинематографичная встреча после обновления */
export default function UpdateOverlay() {
  const [notes, setNotes] = useState<string[]>([]);
  const [version, setVersion] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const w = window as unknown as { temka?: { version?: string } };
    const current = w.temka?.version || APP_VERSION;
    let seen = "";
    try {
      seen = localStorage.getItem("temka-seen-version") || "";
    } catch {
      /* noop */
    }
    if (!seen) {
      try {
        localStorage.setItem("temka-seen-version", current);
      } catch {
        /* noop */
      }
      return;
    }
    if (seen === current) return;

    setVersion(current);
    setNotes(["Обновление TemkaLauncher установлено."]);
    setOpen(true);
    const t = window.setTimeout(() => window.dispatchEvent(new CustomEvent("temka-levelup")), 650);
    return () => window.clearTimeout(t);
  }, []);

  const close = () => {
    try {
      localStorage.setItem("temka-seen-version", version || APP_VERSION);
    } catch {
      /* noop */
    }
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[290] flex items-center justify-center p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-[rgba(4,6,10,0.82)] backdrop-blur-[8px]"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            initial={{ opacity: 0, y: 34, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="anim-border panel relative w-full max-w-[520px] overflow-hidden p-8 text-center"
            style={{ borderRadius: 20, boxShadow: "0 40px 120px -30px rgba(0,0,0,0.9)" }}
          >
            <div
              className="pointer-events-none absolute -top-28 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full"
              style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 22%, transparent), transparent 65%)" }}
            />

            <motion.div
              initial={{ scale: 0.4, rotate: -30, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
              className="relative mx-auto flex h-20 w-20 items-center justify-center"
            >
              <svg viewBox="0 0 32 32" width="72" height="72" className="drop-shadow-[0_10px_30px_color-mix(in_srgb,var(--accent)_55%,transparent)]">
                <path d="M16 2 28 9v14L16 30 4 23V9z" fill="var(--accent)" />
                <path d="M10 12h12v3.4h-4.2V23h-3.6v-7.6H10z" fill="var(--bg0)" />
              </svg>
              <span className="pulse-dot absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-2)] text-[var(--bg0)] shadow-[0_0_18px_var(--accent-2)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
            </motion.div>

            <p className="font-mono2 relative mt-5 text-[10px] font-bold uppercase tracking-[0.34em] text-[var(--accent)]">
              temka studio // changelog
            </p>
            <h2 className="font-display relative mt-2 text-[30px] font-extrabold tracking-tight">
              <ScrambleText text="ОБНОВЛЕНО" />
            </h2>
            <p className="font-mono2 relative mt-2 inline-block rounded-full px-4 py-1.5 text-[13px] font-extrabold" style={{ color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)" }}>
              v{version || APP_VERSION}
            </p>

            <ul className="relative mx-auto mt-6 flex max-w-[40ch] flex-col gap-2.5 text-left">
              {notes.map((n, i) => (
                <motion.li
                  key={n}
                  initial={{ opacity: 0, x: -18 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-start gap-2.5 text-[13.5px] font-semibold text-[var(--tx2)]"
                >
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
                  {n}
                </motion.li>
              ))}
            </ul>

            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + notes.length * 0.1 }}
              onClick={close}
              className="btn-primary relative mt-7 w-full py-3.5 text-[14px]"
            >
              Погнали →
            </motion.button>
            <p className="font-mono2 relative mt-3 text-[9.5px] font-semibold uppercase tracking-[0.24em] text-[var(--tx3)]">
              спасибо, что остаёшься с нами в парке
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
