import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSettings } from "./settings";

export type ToastKind = "ok" | "info" | "warn";

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  desc?: string;
}

interface Ctx {
  push: (kind: ToastKind, title: string, desc?: string) => void;
}

const ToastCtx = createContext<Ctx | null>(null);

const ICONS: Record<ToastKind, ReactNode> = {
  ok: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M12 11v5" />
    </svg>
  ),
  warn: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 9.5 16.5H2.5L12 3z" />
      <path d="M12 10v4M12 17.2h.01" />
    </svg>
  ),
};

const COLOR: Record<ToastKind, string> = {
  ok: "var(--accent-2)",
  info: "var(--accent)",
  warn: "#ffd28a",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);
  const { s } = useSettings();

  const push = useCallback(
    (kind: ToastKind, title: string, desc?: string) => {
      if (kind !== "warn" && !s.notifications) return;
      const id = idRef.current++;
      setToasts((t) => [...t.slice(-3), { id, kind, title, desc }]);
      window.setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, 3800);
    },
    [s.notifications]
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed bottom-12 right-4 z-[95] flex w-[320px] flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.button
              key={t.id}
              layout
              initial={{ opacity: 0, x: 80, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
              className="panel relative flex items-start gap-3 overflow-hidden p-3 text-left shadow-[0_16px_40px_-12px_rgba(0,0,0,0.65)]"
              style={{ borderRadius: 12 }}
            >
              <span
                className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full"
                style={{ color: COLOR[t.kind], background: `color-mix(in srgb, ${COLOR[t.kind]} 14%, transparent)` }}
              >
                {ICONS[t.kind]}
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-extrabold leading-tight text-[var(--tx)]">{t.title}</span>
                {t.desc && <span className="mt-0.5 block text-[12px] leading-snug text-[var(--tx2)]">{t.desc}</span>}
              </span>
              <span
                className="absolute inset-y-0 left-0 w-[3px]"
                style={{ background: COLOR[t.kind] }}
              />
              <span className="absolute bottom-0 left-0 h-[2px] rounded-full opacity-70" style={{ background: COLOR[t.kind], width: "100%" }}>
                <span className="toast-bar block h-full rounded-full" style={{ background: COLOR[t.kind] }} />
              </span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast outside provider");
  return ctx;
}
