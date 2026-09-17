import { useCallback, useEffect, useState } from "react";

interface BIPEvent extends Event {
  prompt: () => Promise<{ outcome: string }>;
}

/* Установка лаунчера как приложения (PWA) */
export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches
  );

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    setDeferred(null);
    return true;
  }, [deferred]);

  return { canInstall: !!deferred, installed, promptInstall };
}

export const isStandalone = () =>
  typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches;
