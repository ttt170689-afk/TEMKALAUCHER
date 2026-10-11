import { version } from "../../package.json";
/* package.json is the single source of truth. */
export const APP_VERSION = version;
export const APP_CHANNEL = "stable";

export const runtimeMode = (): "Electron" | "Neutralino" | "Web" => {
  const w = window as unknown as { temka?: unknown; NL_OS?: string };
  if (w.temka) return "Electron";
  if (w.NL_OS) return "Neutralino";
  return "Web";
};
