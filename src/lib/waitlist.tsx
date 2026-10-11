import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
export interface WaitEntry { game: string; date: string; }
const KEY = "temka-wishlist-v2", OLD = "temka-waitlist-v1";
const ids = ["temkaworld", "fantazia"];
function clean(raw: unknown): WaitEntry[] {
  if (!Array.isArray(raw)) return [];
  const result: WaitEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    for (const game of item.game === "all" ? ids : [item.game]) {
      if (!ids.includes(game) || result.some(e => e.game === game)) continue;
      result.push({game, date: typeof item.date === "string" && !isNaN(Date.parse(item.date)) ? item.date : new Date().toISOString()});
    }
  }
  return result;
}
function load(): WaitEntry[] {
  try {
    const current = localStorage.getItem(KEY);
    const result = clean(JSON.parse(current ?? localStorage.getItem(OLD) ?? "[]"));
    localStorage.setItem(KEY, JSON.stringify(result));
    localStorage.removeItem(OLD); // discard legacy wishlist email after successful migration
    return result;
  } catch { return []; }
}
interface Ctx {entries: WaitEntry[]; has: (game: string) => boolean; join: (game: string) => boolean; leave: (game: string) => boolean;}
const WaitlistCtx = createContext<Ctx | null>(null);
export function WaitlistProvider({children}: {children: ReactNode}) {
  const [entries, setEntries] = useState(load);
  const ref = useRef(entries);
  const persist = useCallback((next: WaitEntry[]) => {
    try { localStorage.setItem(KEY, JSON.stringify(next)); }
    catch {return false;}
    ref.current = next; setEntries(next); return true;
  }, []);
  const has = useCallback((game: string) => game === "all" ? ids.every(id => entries.some(e => e.game === id)) : entries.some(e => e.game === game), [entries]);
  const join = useCallback((game: string) => {
    const selected = game === "all" ? ids : ids.filter(id => id === game);
    if (!selected.length) return false;
    return persist([...ref.current, ...selected.filter(id => !ref.current.some(e => e.game === id)).map(id => ({game:id,date:new Date().toISOString()}))]);
  }, [persist]);
  const leave = useCallback((game: string) => persist(ref.current.filter(e => game !== "all" && e.game !== game)), [persist]);
  const value = useMemo(() => ({entries,has,join,leave}), [entries,has,join,leave]);
  return <WaitlistCtx.Provider value={value}>{children}</WaitlistCtx.Provider>;
}
export function useWaitlist() { const ctx = useContext(WaitlistCtx); if (!ctx) throw new Error("useWaitlist outside provider"); return ctx; }
