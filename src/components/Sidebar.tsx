import { motion } from "framer-motion";
import { useToast } from "../lib/toast";
import { useProgress } from "../lib/progress";
import { useAuth } from "../lib/auth";
import { AvatarSvg } from "./AvatarSvg";
import { IconHome, IconLibrary, IconSettings, IconLock, IconNews, IconUser } from "./ui";

export type View = "home" | "news" | "library" | "profile" | "settings";

const NAV: { id: View; label: string; icon: () => React.ReactNode }[] = [
  { id: "home", label: "Главная", icon: IconHome },
  { id: "news", label: "Новости", icon: IconNews },
  { id: "library", label: "Библиотека", icon: IconLibrary },
  { id: "profile", label: "Профиль", icon: IconUser },
  { id: "settings", label: "Настройки", icon: IconSettings },
];

const SOON = ["Магазин", "Друзья", "Моды"];

export default function Sidebar({ view, setView }: { view: View; setView: (v: View) => void }) {
  const { push } = useToast();
  const { level, into } = useProgress();
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
      <nav className="mt-2 flex flex-col gap-1 px-3">
        <p className="font-mono2 mb-1 hidden px-2 text-[9.5px] font-bold uppercase tracking-[0.24em] text-[var(--tx3)] lg:block">
          Меню
        </p>
        {NAV.map((n) => {
          const active = view === n.id;
          return (
            <button
              key={n.id}
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

      {/* soon */}
      <div className="mt-6 hidden flex-col gap-1 px-3 lg:flex">
        <p className="font-mono2 mb-1 px-2 text-[9.5px] font-bold uppercase tracking-[0.24em] text-[var(--tx3)]">
          Скоро
        </p>
        {SOON.map((s) => (
          <button
            key={s}
            onClick={() => push("info", `«${s}» — в разработке`, "Раздел появится в следующих обновлениях лаунчера.")}
            className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13.5px] font-bold text-[var(--tx3)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--tx2)]"
          >
            <IconLock />
            <span>{s}</span>
            <span className="font-mono2 ml-auto text-[8.5px] font-bold uppercase tracking-widest text-[var(--tx3)]">
              soon
            </span>
          </button>
        ))}
      </div>

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
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--bg3)]">
                <div className="progress-fill h-full rounded-full" style={{ width: `${into}%` }} />
              </div>
              <span className="font-mono2 text-[9px] font-bold text-[var(--accent)]">LVL {level}</span>
            </div>
          </div>
          <span className="ml-auto hidden h-2 w-2 flex-none rounded-full bg-[var(--accent-2)] shadow-[0_0_8px_var(--accent-2)] lg:block" />
        </button>
      </div>
    </aside>
  );
}
