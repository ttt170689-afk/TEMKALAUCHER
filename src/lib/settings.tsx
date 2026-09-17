import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export interface Settings {
  accent: string;
  theme: "graphite" | "deep";
  particles: boolean;
  particleDensity: number; // 20..120
  customCursor: boolean;
  cursorTrail: boolean;
  cursorRibbon: boolean;
  cursorCharge: boolean;
  cursorGlow: boolean;
  playerTag: boolean;
  ringSize: number; // 28..64
  reducedMotion: boolean;
  notifications: boolean;
  sounds: boolean;
  autoUpdates: boolean;
  periodicCheck: boolean;
  autoInstall: boolean;
  closeOnLaunch: boolean;
  downloadPath: string;
  speedLimit: number; // 0 = без лимита, МБ/с
}

export const ACCENTS = [
  { hex: "#ff7a2f", name: "Огонь" },
  { hex: "#ff4d5e", name: "Лава" },
  { hex: "#3ddcc2", name: "Мята" },
  { hex: "#a3e635", name: "Лайм" },
  { hex: "#4da3ff", name: "Азур" },
];

export const DEFAULTS: Settings = {
  accent: "#ff7a2f",
  theme: "graphite",
  particles: true,
  particleDensity: 70,
  customCursor: true,
  cursorTrail: true,
  cursorRibbon: true,
  cursorCharge: true,
  cursorGlow: true,
  playerTag: true,
  ringSize: 38,
  reducedMotion: false,
  notifications: true,
  sounds: true,
  autoUpdates: true,
  periodicCheck: true,
  autoInstall: true,
  closeOnLaunch: true,
  downloadPath: "C:\\Games\\TemkaLauncher",
  speedLimit: 0,
};

const KEY = "temka-launcher-settings-v1";

interface Ctx {
  s: Settings;
  set: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  reset: () => void;
  savedTick: number;
}

const SettingsCtx = createContext<Ctx | null>(null);

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULTS;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Settings>(load);
  const [savedTick, setSavedTick] = useState(0);

  const set = useCallback(<K extends keyof Settings>(k: K, v: Settings[K]) => {
    setS((prev) => ({ ...prev, [k]: v }));
  }, []);

  const reset = useCallback(() => {
    setS(DEFAULTS);
    setSavedTick((t) => t + 1);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* noop */
    }
    setSavedTick((t) => t + 1);
  }, [s]);

  // apply to DOM
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", s.accent);
    root.setAttribute("data-theme", s.theme);
    if (s.reducedMotion) root.setAttribute("data-reduced", "1");
    else root.removeAttribute("data-reduced");
    const fine = window.matchMedia("(pointer: fine)").matches;
    document.body.classList.toggle("tl-cursor-none", s.customCursor && fine);
  }, [s.accent, s.theme, s.reducedMotion, s.customCursor]);

  const value = useMemo(() => ({ s, set, reset, savedTick }), [s, set, reset, savedTick]);
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error("useSettings outside provider");
  return ctx;
}
