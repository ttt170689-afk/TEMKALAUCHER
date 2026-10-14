import { APP_VERSION } from "../lib/version";
import { hasLocalCreatorSignature, LOCAL_CREATOR_SIGNATURE_NOTE } from "../lib/creatorIdentity";
import { motion } from "framer-motion";
import OnlineIdentity from "./OnlineIdentity";
import { useAuth } from "../lib/auth";
import { AvatarSvg } from "./AvatarSvg";
import { IconHome, IconLibrary, IconSettings, IconFriends, IconNews, IconUser, IconShop, IconDev } from "./ui";

export type View = "home" | "news" | "library" | "shop" | "dev" | "friends" | "profile" | "settings";

const NAV: { id: View; label: string; icon: () => React.ReactNode }[] = [
  { id: "home", label: "Главная", icon: IconHome },
  { id: "news", label: "Новости", icon: IconNews },
  { id: "library", label: "Библиотека", icon: IconLibrary },
  { id: "shop", label: "Магазин", icon: IconShop },
  { id: "dev", label: "Dev", icon: IconDev },
  { id: "friends", label: "Друзья", icon: IconFriends },
  { id: "profile", label: "Профиль", icon: IconUser },
  { id: "settings", label: "Настройки", icon: IconSettings },
];



export default function Sidebar({ view, setView }: { view: View; setView: (v: View) => void }) {

  const { user } = useAuth();

  return (
    <aside className="relative z-10 flex h-full w-[76px] flex-none flex-col border-r border-[var(--line)] bg-[color-mix(in_srgb,var(--bg1)_82%,transparent)] backdrop-blur-md lg:w-[232px]">
      {/* logo */}
      <div className="flex items-center gap-3 px-4 py-5 lg:px-5">
        <svg width="36" height="36" viewBox="0 0 32 32" className="flex-none drop-shadow-[0_4px_14px_color-mix(in_srgb,var(--accent)_45%,transparent)]">
          <path d="M16 2 28 9v14L16 30 4 23V9z" fill="var(--accent)" />
          <path d="M10 12h12v3.4h-4.2V23h-3.6v-7.6H10z" fill="var(--bg0)" />
        </svg>
        <div className="hidden lg:block">
          <p className="font-display text-[15px] font-extrabold leading-none tracking-tight">
            TEMKA<span className="text-accent">.</span>
          </p>
          <p className="font-mono2 mt-1 text-[9px] font-bold uppercase tracking-[0.28em] text-[var(--tx3)]">launcher</p>
        </div>
      </div>

      {/* nav */}
      <nav aria-label="Разделы лаунчера" className="mt-2 flex flex-col gap-1 px-3">
        <p className="font-mono2 mb-1 hidden px-2 text-[9.5px] font-bold uppercase tracking-[0.24em] text-[var(--tx3)] lg:block">
          Меню
        </p>
        {NAV.map((n) => {
          const active = view === n.id;
          return (
            <button
              key={n.id}
              aria-label={n.label}
              title={n.label}
              aria-current={active ? "page" : undefined}
              onClick={() => setView(n.id)}
              className={`group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13.5px] font-bold transition-colors duration-200 ${
                active ? "text-[var(--tx)]" : "text-[var(--tx2)] hover:text-[var(--tx)]"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-[10px] border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className={`relative z-10 transition-colors ${active ? "text-[var(--accent)]" : "text-[var(--tx3)] group-hover:text-[var(--tx2)]"}`}>
                {n.icon()}
              </span>
              <span className="relative z-10 hidden lg:block">{n.label}</span>
              {active && (
                <span className="relative z-10 ml-auto hidden h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)] lg:block" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* user card */}
      <div className="border-t border-[var(--line)] p-3">
        <button
          onClick={() => setView("profile")}
          className="flex w-full items-center gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg2)] p-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--line-2))]"
          aria-label="Открыть профиль"
        >
          {user ? (
            <AvatarSvg variant={user.profile.avatar} color={user.profile.color} size={36} />
          ) : (
            <div
              className="font-display flex h-9 w-9 flex-none items-center justify-center rounded-full text-[13px] font-extrabold text-[var(--bg0)]"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
            >
              T
            </div>
          )}
          <div className="hidden min-w-0 flex-1 lg:block">
            <p className="truncate text-[13px] font-extrabold leading-tight">{user?.username ?? "Гость"}</p>
            <OnlineIdentity/>
            {hasLocalCreatorSignature(user?.username) && <p className="mt-1 text-[9px] text-[var(--accent)]" title={LOCAL_CREATOR_SIGNATURE_NOTE}>Разработчик · локально</p>}
            <p className="mt-1 text-[10px] text-[var(--tx3)]">АЛЬФА · {APP_VERSION}</p>
          </div>

        </button>
      </div>
    </aside>
  );
}
