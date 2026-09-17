import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSettings } from "../lib/settings";
import { useToast } from "../lib/toast";
import { useProgress } from "../lib/progress";
import { useWaitlist } from "../lib/waitlist";
import { useAuth } from "../lib/auth";

/* ================= glare-блик за курсором ================= */
export const glareMove = (e: React.MouseEvent<HTMLElement>) => {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`);
  el.style.setProperty("--my", `${e.clientY - r.top}px`);
};

/* ================= line-mask reveal заголовков ================= */
export function MaskReveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add("in");
            io.disconnect();
          }
        });
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <span ref={ref} className={`mask-line ${className}`} style={{ "--rd": `${delay}ms` } as CSSProperties}>
      <span>{children}</span>
    </span>
  );
}

/* ================= scroll reveal ================= */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add("in");
            io.disconnect();
          }
        });
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} data-reveal className={className} style={{ "--rd": `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}

/* ================= scramble text ================= */
const CHARS = "ТЕМКАWORLD#/\\<>*+=ФНТЗР§ΞΔ";

export function ScrambleText({ text, className = "" }: { text: string; className?: string }) {
  const { s } = useSettings();
  const [out, setOut] = useState(text);
  const frame = useRef(0);

  useEffect(() => {
    if (s.reducedMotion) {
      setOut(text);
      return;
    }
    frame.current = 0;
    const total = text.length;
    const id = window.setInterval(() => {
      frame.current += 1;
      const solved = Math.floor(frame.current / 1.6);
      if (solved >= total) {
        setOut(text);
        window.clearInterval(id);
        return;
      }
      let str = "";
      for (let i = 0; i < total; i++) {
        const ch = text[i];
        if (ch === " ") str += " ";
        else if (i < solved) str += ch;
        else str += CHARS[Math.floor(Math.random() * CHARS.length)];
      }
      setOut(str);
    }, 28);
    return () => window.clearInterval(id);
  }, [text, s.reducedMotion]);

  return (
    <span className={className} aria-label={text}>
      {out}
    </span>
  );
}

/* ================= count up ================= */
export function CountUp({ to, suffix = "", prefix = "" }: { to: number; suffix?: string; prefix?: string }) {
  const { s } = useSettings();
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !started.current) {
            started.current = true;
            if (s.reducedMotion) {
              setVal(to);
              return;
            }
            const t0 = performance.now();
            const dur = 1400;
            const tick = (t: number) => {
              const p = Math.min(1, (t - t0) / dur);
              const eased = 1 - Math.pow(1 - p, 3);
              setVal(Math.round(to * eased));
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
            io.disconnect();
          }
        });
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, s.reducedMotion]);

  return (
    <span ref={ref}>
      {prefix}
      {val.toLocaleString("ru-RU")}
      {suffix}
    </span>
  );
}

/* ================= toggle ================= */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`tgl ${on ? "on" : ""}`}
    />
  );
}

/* ================= tilt hook ================= */
export function useTilt(max = 7) {
  const ref = useRef<HTMLDivElement>(null);
  const { s } = useSettings();
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || s.reducedMotion) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${px * max}deg) rotateX(${-py * max}deg) translateY(-3px)`;
  };
  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "";
  };
  return { ref, onMouseMove: onMove, onMouseLeave: onLeave };
}

/* ================= modal ================= */
export function Modal({
  open,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-[rgba(4,6,10,0.72)] backdrop-blur-[6px]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            initial={{ opacity: 0, y: 26, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className={`panel relative max-h-[86vh] w-full overflow-y-auto tl-scroll ${wide ? "max-w-3xl" : "max-w-md"}`}
            style={{ borderRadius: 16, boxShadow: "0 30px 80px -20px rgba(0,0,0,0.8)" }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ================= pre-register modal (реальный лист ожидания) ================= */
export function PreRegisterModal({
  open,
  onClose,
  gameTitle,
  gameId = "all",
}: {
  open: boolean;
  onClose: () => void;
  gameTitle?: string;
  gameId?: string;
}) {
  const { push } = useToast();
  const { grant, unlockAch } = useProgress();
  const { has, join, leave, position } = useWaitlist();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const already = has(gameId);

  useEffect(() => {
    if (open) {
      setEmail(user?.email ?? "");
      setErr("");
      setDone(false);
    }
  }, [open, user]);

  const submit = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setErr("Похоже, в адресе ошибка — проверьте и попробуйте ещё раз.");
      return;
    }
    setErr("");
    join(gameId, email);
    setDone(true);
    push("ok", "Вы в списке ожидания!", gameTitle ? `Сообщим, когда «${gameTitle}» выйдет в релиз.` : "Сообщим, когда игра выйдет в релиз.");
    grant("waitlist", 50, "Запись в лист ожидания");
    unlockAch("waitlist");
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6">
        {already && !done ? (
          /* уже записан */
          <div className="flex flex-col items-center py-4 text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: "color-mix(in srgb, var(--accent-2) 15%, transparent)" }}
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--accent-2)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h3 className="font-display mt-4 text-lg font-bold">Вы уже в списке</h3>
            <p className="mt-2 max-w-xs text-[13.5px] leading-relaxed text-[var(--tx2)]">
              {gameTitle ? `«${gameTitle}» ждёт вас.` : "Игра ждёт вас."} Ваша позиция в очереди:
            </p>
            <p className="font-display mt-2 text-[26px] font-extrabold text-accent">#{position(gameId).toLocaleString("ru-RU")}</p>
            <div className="mt-5 flex items-center gap-2.5">
              <button
                onClick={() => {
                  leave(gameId);
                  push("info", "Запись отменена", "Место в листе ожидания освобождено.");
                }}
                className="btn-ghost border-[color-mix(in_srgb,var(--danger)_40%,var(--line-2))] px-4 py-2.5 text-[12.5px] text-[var(--danger)]"
              >
                Отписаться
              </button>
              <button className="btn-primary px-5 py-2.5 text-[13px]" onClick={onClose}>
                Понятно
              </button>
            </div>
          </div>
        ) : done ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: "color-mix(in srgb, var(--accent-2) 15%, transparent)" }}
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--accent-2)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path className="check-draw" d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h3 className="font-display mt-4 text-lg font-bold">Место забронировано</h3>
            <p className="mt-2 max-w-xs text-[13.5px] leading-relaxed text-[var(--tx2)]">
              Письмо-подтверждение уже летит на <span className="font-bold text-[var(--tx)]">{email}</span>.
            </p>
            <p className="font-mono2 chip mt-4 px-4 py-2 text-[12px] font-extrabold text-[var(--accent)]">
              ваша позиция · #{position(gameId).toLocaleString("ru-RU")}
            </p>
            <button className="btn-ghost mt-5 px-5 py-2.5 text-sm" onClick={onClose}>
              Отлично
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono2 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                  Ранний доступ
                </p>
                <h3 className="font-display mt-1.5 text-xl font-bold leading-tight">
                  {gameTitle ? `Лист ожидания «${gameTitle}»` : "Лист ожидания Temka"}
                </h3>
              </div>
              <button onClick={onClose} className="btn-ghost flex h-8 w-8 items-center justify-center" aria-label="Закрыть">
                <IconX />
              </button>
            </div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--tx2)]">
              Игра ещё в разработке и недоступна для запуска. Оставьте почту — пришлём уведомление о выходе в первой волне. Запись сохраняется в лаунчере.
            </p>
            <label className="mt-5 block">
              <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider text-[var(--tx3)]">E-mail</span>
              <input
                className="input-tl w-full px-4 py-3 text-[14px]"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                autoFocus
              />
            </label>
            {err && <p className="shake mt-2 text-[12.5px] font-semibold text-[var(--danger)]">{err}</p>}
            <button className="btn-primary mt-4 w-full py-3 text-[14px]" onClick={submit}>
              Забронировать место · +50 XP
            </button>
            <p className="mt-3 text-center text-[11.5px] text-[var(--tx3)]">Никакого спама — только новости о релизе.</p>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ================= icons ================= */
const st = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const IconHome = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" {...st}>
    <path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <path d="M9 22V14h6v8" />
  </svg>
);
export const IconUser = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" {...st}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 21c0-4.2 3.2-6.8 7.5-6.8s7.5 2.6 7.5 6.8" />
  </svg>
);
export const IconNews = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" {...st}>
    <path d="M4 5h13v14H6a2 2 0 0 1-2-2V5Z" />
    <path d="M17 8h3v9a2 2 0 0 1-2 2h-1" />
    <path d="M7 9h7M7 12.5h7M7 16h4" />
  </svg>
);
export const IconLibrary = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" {...st}>
    <path d="M6 12h4M8 10v4M15 13h.01M18 11h.01" />
    <path d="M17.32 5H6.68a4 4 0 0 0-3.98 3.6L2 17a2.4 2.4 0 0 0 4.1 1.9L8.5 16h7l2.4 2.9A2.4 2.4 0 0 0 22 17l-.7-8.4A4 4 0 0 0 17.32 5Z" />
  </svg>
);
export const IconSettings = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" {...st}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" />
  </svg>
);
export const IconLock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" {...st}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
export const IconPlay = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 4.5v15a1 1 0 0 0 1.5.87l13-7.5a1 1 0 0 0 0-1.74l-13-7.5A1 1 0 0 0 7 4.5Z" />
  </svg>
);
export const IconBell = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" {...st}>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);
export const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" {...st} strokeWidth={2.6}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
export const IconClock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" {...st}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);
export const IconX = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" {...st} strokeWidth={2.2}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
export const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...st}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4-4" />
  </svg>
);
export const IconDownload = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" {...st}>
    <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);
export const IconSpark = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...st}>
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.8 2.8M16.2 16.2 19 19M5 19l2.8-2.8M16.2 7.8 19 5" />
  </svg>
);

/* DLC icons */
export function DlcIcon({ type }: { type: string }) {
  switch (type) {
    case "island":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" {...st}>
          <path d="m12 8-7 9h14l-7-9Z" />
          <path d="M5 5h3M7 3v4M16 4h4" />
        </svg>
      );
    case "gear":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" {...st}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
        </svg>
      );
    case "snow":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" {...st}>
          <path d="M12 2v20M4 6l16 12M20 6 4 18" />
        </svg>
      );
    case "crown":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" {...st}>
          <path d="m3 8 4 4 5-6 5 6 4-4v10H3V8Z" />
        </svg>
      );
    case "abyss":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" {...st}>
          <path d="M12 3a9 9 0 1 0 9 9" />
          <path d="M12 8a4 4 0 1 0 4 4" />
        </svg>
      );
    case "ship":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" {...st}>
          <path d="M3 15h18l-3 5H6l-3-5Z" />
          <path d="M12 15V3l6 9" />
        </svg>
      );
    default:
      return null;
  }
}

/* small status chip */
export function DevChip({ label = "В разработке" }: { label?: string }) {
  return (
    <span
      className="chip inline-flex items-center gap-1.5 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.12em]"
      style={{ color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)", background: "color-mix(in srgb, var(--accent) 10%, transparent)" }}
    >
      <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-accent" />
      {label}
    </span>
  );
}
