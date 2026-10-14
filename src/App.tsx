import ActivityTracker from './components/ActivityTracker';
import {MessagesProvider,MessagesButton} from './components/Messages';
import PlayerProfileHost from "./components/PlayerProfile";
import "./lib/nativeContract";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SettingsProvider, useSettings } from "./lib/settings";
import { ToastProvider } from "./lib/toast";
import { ProgressProvider } from "./lib/progress";
import { APP_VERSION, runtimeMode } from "./lib/version";
import { useAppLock } from "./lib/appLock";
import { initNeutralino } from "./lib/neutralino";
import { setSoundEnabled, sfx } from "./lib/sound";
import { AuthProvider, useAuth } from "./lib/auth";
import { WaitlistProvider } from "./lib/waitlist";
import { pointer } from "./lib/pointer";
import Boot from "./components/Boot";
import AuthView from "./components/AuthView";
import FriendNotifications from "./components/FriendNotifications";
import ProfileView from "./components/ProfileView";
import FriendsView from "./components/FriendsView";
import OnlineIdentity from "./components/OnlineIdentity";
import {OnlineAccountProvider} from "./lib/onlineAccount";
import UpdateBanner from "./components/UpdateBanner";
import UpdateOverlay from "./components/UpdateOverlay";
import { AvatarSvg } from "./components/AvatarSvg";
import Background from "./components/Background";
import Cursor from "./components/Cursor";
import Sidebar from "./components/Sidebar";
import type { View } from "./components/Sidebar";
import HomeView from "./components/HomeView";
import NewsView from "./components/NewsView";
import DevView from "./components/DevView";
import ShopView from "./components/ShopView";
import LibraryView from "./components/LibraryView";
import SettingsView from "./components/SettingsView";
import { ScrambleText, IconSearch } from "./components/ui";
import { GAMES } from "./data/games";

const VIEW_TITLES: Record<View, { title: string; sub: string }> = {
  home: { title: "Главная", sub: "обзор миров Temka" },
  news: { title: "Новости", sub: "что добавлено, исправлено и убрано" },
  library: { title: "Библиотека", sub: "игры и дополнения" },
  shop: { title: "Магазин", sub: "кристаллы для Fantazia RP" },
  dev: { title: "Dev — тестовые версии", sub: "закрытый доступ через основной аккаунт" },
  friends: { title: "Друзья", sub: "люди, приглашения и твой юзернейм" },
  profile: { title: "Профиль", sub: "аккаунт и кастомизация" },
  settings: { title: "Настройки", sub: "конфигурация лаунчера" },
};



function StatusBar() {
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const c = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(c);
  }, []);

  return (
    <footer className="relative z-10 flex h-8 flex-none items-center gap-4 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--bg1)_88%,transparent)] px-4 backdrop-blur-md">
      <span className="font-mono2 hidden text-[10.5px] font-semibold tracking-[0.14em] text-[var(--tx3)] md:block">
        ОБЕ ИГРЫ В РАЗРАБОТКЕ — ЗАПУСК ОТКРОЕТСЯ С РЕЛИЗОМ
      </span>
      <span className="font-mono2 text-[10.5px] font-semibold text-[var(--tx3)]">{runtimeMode()}</span>
      <span className="ml-auto flex items-center gap-4">
        <span className="font-mono2 text-[10.5px] font-bold text-[var(--tx3)]">v{APP_VERSION}</span>
        <span className="font-mono2 text-[11px] font-bold tabular-nums text-[var(--tx2)]">
          {clock.toLocaleTimeString("ru-RU")}
        </span>
      </span>
    </footer>
  );
}

function Shell() {
  const [view, setViewRaw] = useState<View>("home");
  const [selectedId, setSelectedId] = useState(GAMES[0].id);
  const [query, setQuery] = useState("");
  const [booting, setBooting] = useState(true);
  useAppLock();
  useEffect(() => {
    initNeutralino();
  }, []);
  const scrollBarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  useEffect(()=>{if(contentRef.current)contentRef.current.scrollTop=0;},[view]);

  const { s } = useSettings();
  const { user } = useAuth();


  const setView = useCallback(
    (v: View) => {
      setViewRaw((prev) => {
        if (prev !== v) sfx.nav();
        return v;
      });
    },
    []
  );

  // звуки вкл/выкл
  useEffect(() => {
    setSoundEnabled(s.sounds);
  }, [s.sounds]);

  // глобальный клик-звук по кнопкам
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("button, a, [role='switch'], label")) sfx.click();
    };
    window.addEventListener("pointerdown", onDown, { passive: true });
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);

  // позиция указателя + магнитные кнопки
  useEffect(() => {
    let lastEl: HTMLElement | null = null;
    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      const el = (e.target as HTMLElement | null)?.closest?.("button") as HTMLElement | null;
      if (el && !el.hasAttribute("disabled")) {
        const r = el.getBoundingClientRect();
        const dx = Math.max(-6, Math.min(6, (e.clientX - (r.left + r.width / 2)) * 0.16));
        const dy = Math.max(-5, Math.min(5, (e.clientY - (r.top + r.height / 2)) * 0.22));
        el.style.setProperty("--mag-x", `${dx}px`);
        el.style.setProperty("--mag-y", `${dy}px`);
        if (lastEl && lastEl !== el) {
          lastEl.style.setProperty("--mag-x", "0px");
          lastEl.style.setProperty("--mag-y", "0px");
        }
        lastEl = el;
      } else if (lastEl) {
        lastEl.style.setProperty("--mag-x", "0px");
        lastEl.style.setProperty("--mag-y", "0px");
        lastEl = null;
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // звук механической клавиатуры при наборе в полях
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest?.("input, textarea, [contenteditable='true']")) return;
      if (e.repeat) return;
      if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter" || e.key === " ") sfx.key();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openGame = (id: string) => {
    setSelectedId(id);
    setView("library");
  };

  const onSearch = (v: string) => {
    setQuery(v);
    if (v && view !== "library") setView("library");
  };

  const meta = VIEW_TITLES[view];

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <Background />
      <Cursor />
      {booting && (
        <Boot
          onDone={() => {
            setBooting(false);
            sfx.boot();

          }}
        />
      )}

      {!user && !booting && <AuthView />}

      {user && (
        <OnlineAccountProvider key={user.id} localId={user.id}>
        <MessagesProvider><ActivityTracker/><PlayerProfileHost/>

      <div className="relative z-10 flex min-h-0 flex-1">
        <Sidebar view={view} setView={setView} />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* header */}
          <header className="flex h-[64px] flex-none items-center gap-4 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg1)_70%,transparent)] px-5 backdrop-blur-md lg:px-8">
            <div className="min-w-0">
              <h2 className="font-display truncate text-[16px] font-extrabold leading-tight tracking-tight">
                <ScrambleText key={view} text={meta.title} />
              </h2>
              <p className="font-mono2 text-[9.5px] font-bold uppercase tracking-[0.22em] text-[var(--tx3)]">{meta.sub}</p>
            </div>

            <div className="relative ml-auto w-full max-w-[260px]">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--tx3)]">
                <IconSearch />
              </span>
              <input
                value={query}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Поиск игр…"
                className="input-tl w-full py-2.5 pl-10 pr-4 text-[13px]"
              />
            </div>

            <MessagesButton/><FriendNotifications key={user.id} localId={user.id} onProfile={() => setView("profile")} onFriends={()=>setView("friends")} />

            {user && (
              <button onClick={() => setView("profile")} className="hidden items-center gap-2.5 rounded-full transition-opacity hover:opacity-85 sm:flex" aria-label="Открыть профиль">
                <AvatarSvg variant={user.profile.avatar} color={user.profile.color} size={36} />
                <span className="leading-tight text-left">
                  <span className="block max-w-[180px] truncate text-[12.5px] font-extrabold">{user.username}</span>
                  <OnlineIdentity/>
                </span>
              </button>
            )}
          </header>

          {/* content */}
          <main ref={contentRef}
            className="tl-scroll relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
            onScroll={(e) => {
              const el = e.currentTarget;
              const p = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight);
              if (scrollBarRef.current) scrollBarRef.current.style.transform = `scaleX(${p})`;
            }}
          >
            <div
              ref={scrollBarRef}
              className="pointer-events-none sticky top-0 z-40 h-[2.5px] origin-left"
              style={{
                background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
                transform: "scaleX(0)",
                boxShadow: "0 0 12px color-mix(in srgb, var(--accent) 60%, transparent)",
              }}
            />
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 26, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -18, filter: "blur(6px)" }}
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              >
                {view === "home" && <HomeView setView={setView} openGame={openGame} />}
                {view === "news" && <NewsView />}
                {view === "library" && (
                  <LibraryView onProfile={()=>setView("profile")} selectedId={selectedId} setSelectedId={setSelectedId} query={query} />
                )}
                {view === "shop" && <ShopView />}
                {view === "dev" && <DevView onProfile={()=>setView("profile")} />}
                {view === "friends" && <FriendsView onProfile={()=>setView("profile")}/>}
                {view === "profile" && <ProfileView onFriends={()=>setView("friends")} />}
                {view === "settings" && <SettingsView />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
          <UpdateOverlay />
        </MessagesProvider></OnlineAccountProvider>
      )}

      
      <UpdateBanner />
      <StatusBar />
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <ProgressProvider>
          <AuthProvider>
            <WaitlistProvider>
              <Shell />
            </WaitlistProvider>
          </AuthProvider>
        </ProgressProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}
