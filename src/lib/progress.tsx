import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

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
  const [saved] = useState<Saved>(load);
  const value = useMemo(() => ({xp: saved.xp, level: levelOf(saved.xp), into: saved.xp % XP_PER_LEVEL,
    ach: saved.ach, hasAch: (id: string) => saved.ach.includes(id),
    grant: (_id: string, _amount: number, _reason: string) => {},
    unlockAch: (_id: string) => {}, daily: () => {}}), [saved]);
  return <ProgressCtx.Provider value={value}>{children}</ProgressCtx.Provider>;
}
export function useProgress() {
  const ctx = useContext(ProgressCtx);
  if (!ctx) throw new Error("useProgress outside provider");
  return ctx;
}
