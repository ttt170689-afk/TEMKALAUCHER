import { installNeuUpdater } from "./neuUpdate";

/* Интеграция с Neutralino (десктоп-обёртка):
   крестик сворачивает в трей, меню трея, надёжный выход.
   В браузере молча не подключается. */

type NL = {
  init: () => Promise<void>;
  os: {
    setTray?: (o: { icon: string; menuItems: { id?: string; text: string }[] }) => Promise<void>;
    setTrayIcon?: (o: { icon: string; menuItems: { id?: string; text: string }[] }) => Promise<void>;
    showNotification?: (o: { title: string; content: string }) => Promise<void>;
  };
  events: { on: (ev: string, cb: (e: { detail?: { id?: string } }) => void) => void };
  window: { hide: () => Promise<void>; show: () => Promise<void>; focus: () => Promise<void> };
  app: { exit: () => void };
};

let ready = false;

export function isNeutralino() {
  return !!(window as unknown as { Neutralino?: NL }).Neutralino;
}

/* Десктоп-режим определяется мгновенно по глобалам NL_*,
   которые Neutralino подставляет ещё до загрузки скриптов */
export function inDesktop() {
  const w = window as unknown as { NL_OS?: string; temka?: unknown };
  return !!w.NL_OS || !!w.temka;
}

/* Принудительный выход — для кнопки в настройках (Electron → Neutralino → окно) */
export function quitApp() {
  const w = window as unknown as { temka?: { quit?: () => Promise<boolean> }; Neutralino?: NL };
  if (w.temka?.quit) {
    void w.temka.quit();
    return true;
  }
  if (w.Neutralino) {
    try {
      w.Neutralino.app.exit();
      return true;
    } catch {
      /* fallthrough */
    }
  }
  window.close();
  return false;
}

export function initNeutralino() {
  if (ready) return;
  ready = true;

  const s = document.createElement("script");
  s.src = "neutralino.js";
  s.onload = () => {
    const N = (window as unknown as { Neutralino?: NL }).Neutralino;
    if (!N) return;
    N.init()
      .then(async () => {
        // включаем самообновление изнутри Neutralino
        installNeuUpdater();
        let trayOk = false;

        // 1) СРАЗУ вешаем обработчик крестика: трей ещё не готов → просто выходим.
        //    Никаких «зависаний»: окно всегда закрывается.
        N.events.on("windowClose", () => {
          if (trayOk) {
            N.window.hide();
            try {
              N.os.showNotification?.({
                title: "TemkaLauncher",
                content: "Свернут в трей — иконка справа внизу рядом с часами.",
              });
            } catch {
              /* noop */
            }
          } else {
            N.app.exit();
          }
        });

        // 2) Потом пробуем трей. Успех включает режим «крестик → трей».
        const setTray = N.os.setTray || N.os.setTrayIcon;
        if (setTray) {
          try {
            await setTray.call(N.os, {
              icon: "/icon.png",
              menuItems: [
                { id: "show", text: "Открыть TemkaLauncher" },
                { id: "sep", text: "-" },
                { id: "quit", text: "Выход" },
              ],
            });
            trayOk = true;
            N.events.on("trayMenuItemClicked", (e) => {
              if (e.detail?.id === "show") {
                N.window.show();
                N.window.focus();
              }
              if (e.detail?.id === "quit") N.app.exit();
            });
          } catch {
            trayOk = false;
          }
        }
      })
      .catch(() => {
        /* init не удался — крестик закроет окно штатно,
           только если в конфиге exitProcessOnClose=true */
      });
  };
  s.onerror = () => {
    /* веб-режим — Neutralino нет */
  };
  document.head.appendChild(s);
}
