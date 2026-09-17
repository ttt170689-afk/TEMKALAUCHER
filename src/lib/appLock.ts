import { useEffect } from "react";

/* Защита лаунчера в «приложном» режиме (Neutralino / Electron / PWA):
   убираем контекстное меню, сохранение страницы, печать, просмотр кода и devtools.
   В обычном браузере (разработка) ничего не блокируется. */
export function useAppLock() {
  useEffect(() => {
    const w = window as unknown as { temka?: unknown; NL_OS?: string };
    const appMode =
      !!w.temka ||
      typeof w.NL_OS === "string" ||
      window.matchMedia?.("(display-mode: standalone)").matches;
    if (!appMode) return;

    document.body.classList.add("app-lock");

    const onCtx = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      // в полях ввода оставляем меню — там нужен «вставить»
      if (t?.closest?.("input, textarea")) return;
      e.preventDefault();
    };

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const c = e.ctrlKey || e.metaKey;
      const blocked =
        e.key === "F12" ||
        (c && k === "s") ||
        (c && k === "p") ||
        (c && k === "u") ||
        (c && e.shiftKey && (k === "i" || k === "j" || k === "c"));
      if (blocked) e.preventDefault();
    };

    const onDrag = (e: DragEvent) => e.preventDefault();

    window.addEventListener("contextmenu", onCtx);
    window.addEventListener("keydown", onKey);
    window.addEventListener("dragstart", onDrag);
    return () => {
      document.body.classList.remove("app-lock");
      window.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("dragstart", onDrag);
    };
  }, []);
}
