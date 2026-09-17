import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export interface WaitEntry {
  game: string; // id игры или "all"
  email: string;
  date: string;
}

const KEY = "temka-waitlist-v1";
export const WAITLIST_BASE = 12480; // игроков уже в листе ожидания

function load(): WaitEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as WaitEntry[];
  } catch {
    /* noop */
  }
  return [];
}

interface Ctx {
  entries: WaitEntry[];
  has: (game: string) => boolean;
  join: (game: string, email: string) => boolean;
  leave: (game: string) => void;
  position: (game: string) => number;
}

const WaitlistCtx = createContext<Ctx | null>(null);

export function WaitlistProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<WaitEntry[]>(load);

  const persist = useCallback((next: WaitEntry[]) => {
    setEntries(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* noop */
    }
  }, []);

  const has = useCallback((game: string) => entries.some((e) => e.game === game), [entries]);

  const join = useCallback(
    (game: string, email: string): boolean => {
      if (entries.some((e) => e.game === game)) return false;
      persist([...entries, { game, email, date: new Date().toISOString() }]);
      return true;
    },
    [entries, persist]
  );

  const leave = useCallback(
    (game: string) => {
      persist(entries.filter((e) => e.game !== game));
    },
    [entries, persist]
  );

  // «позиция» в очереди: базовое число + локальные записи + хэш от игры для стабильности
  const position = useCallback(
    (game: string) => {
      const idx = entries.findIndex((e) => e.game === game);
      const salt = game.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 97;
      return WAITLIST_BASE + 1 + salt + Math.max(0, idx);
    },
    [entries]
  );

  const value = useMemo(() => ({ entries, has, join, leave, position }), [entries, has, join, leave, position]);
  return <WaitlistCtx.Provider value={value}>{children}</WaitlistCtx.Provider>;
}

export function useWaitlist() {
  const ctx = useContext(WaitlistCtx);
  if (!ctx) throw new Error("useWaitlist outside provider");
  return ctx;
}
