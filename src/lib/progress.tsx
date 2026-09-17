import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useToast } from "./toast";
import { sfx } from "./sound";
import { pointer } from "./pointer";

export const XP_PER_LEVEL = 100;
export const BUNKER_LEVEL = 10;
const KEY = "temka-progress-v1";

export const ACHIEVEMENTS: { id: string; name: string; desc: string }[] = [
  { id: "signup", name: "Новобранец", desc: "Создать аккаунт в TemkaLauncher" },
  { id: "lvl1", name: "Первые шаги", desc: "Достичь 1 уровня" },
  { id: "lvl5", name: "Ветеран парка", desc: "Достичь 5 уровня" },
  { id: "lvl10", name: "Ключ от Бункера", desc: "Достичь 10 уровня" },
  { id: "waitlist", name: "Сторонник", desc: "Записаться в лист ожидания игры" },
  { id: "explorer", name: "Исследователь", desc: "Посетить все разделы лаунчера" },
];

interface Saved {
  xp: number;
  granted: string[];
  lastDaily: string;
  ach: string[];
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { xp: 0, granted: [], lastDaily: "", ach: [], ...(JSON.parse(raw) as Partial<Saved>) };
  } catch {
    /* noop */
  }
  return { xp: 0, granted: [], lastDaily: "", ach: [] };
}

export const levelOf = (xp: number) => Math.floor(xp / XP_PER_LEVEL);

interface Ctx {
  xp: number;
  level: number;
  into: number; // xp внутри текущего уровня
  ach: string[];
  hasAch: (id: string) => boolean;
  grant: (id: string, amount: number, reason: string) => void;
  unlockAch: (id: string) => void;
  daily: () => void;
}

const ProgressCtx = createContext<Ctx | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Saved>(load);
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const { push } = useToast();

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {
      /* noop */
    }
  }, [saved]);

  const levelAchs = (lvl: number, have: string[]): string[] => {
    const add: string[] = [];
    if (lvl >= 1 && !have.includes("lvl1")) add.push("lvl1");
    if (lvl >= 5 && !have.includes("lvl5")) add.push("lvl5");
    if (lvl >= 10 && !have.includes("lvl10")) add.push("lvl10");
    return add;
  };

  const announceAch = useCallback(
    (ids: string[]) => {
      ids.forEach((id, i) => {
        const a = ACHIEVEMENTS.find((x) => x.id === id);
        if (!a) return;
        window.setTimeout(() => {
          sfx.level();
          push("info", `Достижение: ${a.name}`, a.desc);
        }, 700 + i * 500);
      });
    },
    [push]
  );

  const unlockAch = useCallback(
    (id: string) => {
      const prev = savedRef.current;
      if (prev.ach.includes(id)) return;
      setSaved({ ...prev, ach: [...prev.ach, id] });
      announceAch([id]);
    },
    [announceAch]
  );

  const grant = useCallback(
    (id: string, amount: number, reason: string) => {
      const prev = savedRef.current;
      if (prev.granted.includes(id)) return;
      const xp = prev.xp + amount;
      const before = levelOf(prev.xp);
      const after = levelOf(xp);
      sfx.xp();
      push("ok", `+${amount} XP · ${reason}`, `Всего опыта: ${xp}`);
      if (after > before) {
        window.setTimeout(() => sfx.level(), 220);
        window.dispatchEvent(new CustomEvent("temka-levelup", { detail: { level: after } }));
        window.setTimeout(
          () =>
            push(
              "info",
              `Уровень ${after}!`,
              after >= BUNKER_LEVEL
                ? "Секретный Бункер теперь открыт. Добро пожаловать внутрь!"
                : `До Секретного Бункера осталось ${BUNKER_LEVEL - after} ур.`
            ),
          450
        );
      }
      const newAch = levelAchs(after, prev.ach);
      if (newAch.length) announceAch(newAch);
      window.dispatchEvent(
        new CustomEvent("xp-float", { detail: { amount, x: pointer.x, y: pointer.y } })
      );
      setSaved({ ...prev, xp, granted: [...prev.granted, id], ach: [...prev.ach, ...newAch] });
    },
    [push, announceAch]
  );

  const daily = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const prev = savedRef.current;
    if (prev.lastDaily === today) return;
    const xp = prev.xp + 20;
    const before = levelOf(prev.xp);
    const after = levelOf(xp);
    sfx.xp();
    push("ok", "+20 XP · Ежедневный вход", "С возвращением в TemkaLauncher!");
    if (after > before) {
      window.setTimeout(() => sfx.level(), 220);
      window.dispatchEvent(new CustomEvent("temka-levelup", { detail: { level: after } }));
      window.setTimeout(() => push("info", `Уровень ${after}!`, `До Секретного Бункера осталось ${Math.max(0, BUNKER_LEVEL - after)} ур.`), 450);
    }
    window.dispatchEvent(new CustomEvent("xp-float", { detail: { amount: 20, x: pointer.x, y: pointer.y } }));
    setSaved({ ...prev, xp, lastDaily: today });
  }, [push]);

  const value = useMemo(
    () => ({
      xp: saved.xp,
      level: levelOf(saved.xp),
      into: saved.xp % XP_PER_LEVEL,
      ach: saved.ach,
      hasAch: (id: string) => saved.ach.includes(id),
      grant,
      unlockAch,
      daily,
    }),
    [saved, grant, unlockAch, daily]
  );

  return <ProgressCtx.Provider value={value}>{children}</ProgressCtx.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressCtx);
  if (!ctx) throw new Error("useProgress outside provider");
  return ctx;
}
