import { validateUsernameLength } from "./username";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export interface Profile {
  avatar: string;
  color: string;
  title: string;
  status: string;
}
export interface Account {
  id: string;
  username: string;
  email: string;
  passHash: string;
  createdAt: string;
  profile: Profile;
}
interface Store {
  users: Account[];
  session: string | null;
}

const KEY = "temka-accounts-v1";

/* строгий фильтр плохих слов — как в TemkaWorld */
const BAD_ROOTS = [
  "хуе", "хуя", "хуй", "хуё", "пизд", "ебан", "ебал", "ёбан", "бляд", "сука",
  "суки", "мудак", "мудил", "гандон", "долбо", "долбоеб", "шлюх", "мразь", "падл",
];

export function isBadName(name: string): boolean {
  const low = name.toLowerCase();
  return BAD_ROOTS.some((r) => low.includes(r));
}

export const TITLES: { id: string; name: string; req: number }[] = [
  { id: "newbie", name: "Новичок", req: 0 },
  { id: "explorer", name: "Исследователь парка", req: 2 },
  { id: "hunter", name: "Охотник на демонов", req: 4 },
  { id: "keeper", name: "Хранитель хранилища", req: 7 },
  { id: "key", name: "Ключ от Бункера", req: 10 },
  { id: "legend", name: "Легенда Temka", req: 15 },
];

export const AVATAR_COLORS = ["#ff7a2f", "#ff4d5e", "#3ddcc2", "#a3e635", "#4da3ff", "#ffd76a"];

async function hash(p: string): Promise<string> {
  const data = new TextEncoder().encode("temka::" + p);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { users: [], session: null, ...(JSON.parse(raw) as Partial<Store>) };
  } catch {
    /* noop */
  }
  return { users: [], session: null };
}

interface Ctx {
  user: Account | null;
  register: (username: string, email: string, pass: string) => Promise<string | null>;
  login: (ident: string, pass: string) => Promise<string | null>;
  logout: () => string | null;
  updateProfile: (patch: Partial<Profile>) => string | null;
  rename: (username: string) => string | null;
  deleteAccount: () => string | null;
}

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>(load);

  const persist = useCallback((next: Store):string|null => {
    try {localStorage.setItem(KEY,JSON.stringify(next));}
    catch {return "Не удалось сохранить профиль. Хранилище недоступно или заполнено.";}
    setStore(next);return null;
  }, []);

  const register = useCallback(
    async (username: string, email: string, pass: string): Promise<string | null> => {
      const name = username.trim();
      const lengthError = validateUsernameLength(name);
      if (lengthError) return lengthError;
      if (!/^[a-zа-я0-9_]+$/i.test(name)) return "Только буквы, цифры и «_» без пробелов.";
      if (isBadName(name)) return "Имя заблокировано фильтром. Система Temka такое не пропустит.";
      if (store.users.some((u) => u.username.toLowerCase() === name.toLowerCase()))
        return "Этот ник уже занят.";
      if (store.users.some((u) => u.email.toLowerCase() === email.toLowerCase()))
        return "Аккаунт с такой почтой уже существует.";
      const passHash = await hash(pass);
      const acc: Account = {
        id: `u${Date.now().toString(36)}`,
        username: name,
        email,
        passHash,
        createdAt: new Date().toISOString(),
        profile: { avatar: "cube", color: "#ff7a2f", title: "newbie", status: "Новый игрок в мирах Temka" },
      };
      return persist({ users: [...store.users, acc], session: acc.id });
    },
    [store, persist]
  );

  const login = useCallback(
    async (ident: string, pass: string): Promise<string | null> => {
      const idf = ident.trim().toLowerCase();
      const acc = store.users.find(
        (u) => u.username.toLowerCase() === idf || u.email.toLowerCase() === idf
      );
      if (!acc) return "Аккаунт не найден. Проверьте ник или почту.";
      const h = await hash(pass);
      if (h !== acc.passHash) return "Неверный пароль. Попробуйте ещё раз.";
      return persist({ ...store, session: acc.id });
    },
    [store, persist]
  );

  const logout = useCallback(() => {
    return persist({ ...store, session: null });
  }, [store, persist]);

  const updateProfile = useCallback(
    (patch: Partial<Profile>) => {
      if (!store.session) return "Сначала войди в локальный профиль.";
      const next = {
        ...store,
        users: store.users.map((u) =>
          u.id === store.session ? { ...u, profile: { ...u.profile, ...patch } } : u
        ),
      };
      try { localStorage.setItem(KEY, JSON.stringify(next)); }
      catch { return "Не удалось сохранить профиль. Хранилище недоступно или заполнено."; }
      setStore(next);
      return null;
    },
    [store, persist]
  );

  const rename = useCallback(
    (username: string): string | null => {
      const name = username.trim();
      const lengthError = validateUsernameLength(name);
      if (lengthError) return lengthError;
      if (!/^[a-zа-я0-9_]+$/i.test(name)) return "Только буквы, цифры и «_» без пробелов.";
      if (isBadName(name)) return "Имя заблокировано фильтром.";
      if (store.users.some((u) => u.id !== store.session && u.username.toLowerCase() === name.toLowerCase()))
        return "Этот ник уже занят.";
      return persist({
        ...store,
        users: store.users.map((u) => (u.id === store.session ? { ...u, username: name } : u)),
      });
    },
    [store, persist]
  );

  const deleteAccount = useCallback(() => {
    if (!store.session) return null;
    return persist({ users: store.users.filter((u) => u.id !== store.session), session: null });
  }, [store, persist]);

  const user = useMemo(
    () => store.users.find((u) => u.id === store.session) ?? null,
    [store]
  );

  const value = useMemo(
    () => ({ user, register, login, logout, updateProfile, rename, deleteAccount }),
    [user, register, login, logout, updateProfile, rename, deleteAccount]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
