import { useEffect, useRef, useState } from "react";
import { GAMES, TICKER } from "../data/games";
import { useWaitlist } from "../lib/waitlist";
import { useSettings } from "../lib/settings";
import { APP_VERSION, APP_CHANNEL, runtimeMode } from "../lib/version";
import { ArtSurface, ParkScene } from "./Art";
import {
  Reveal,
  ScrambleText,
  CountUp,
  PreRegisterModal,
  DevChip,
  MaskReveal,
  IconCheck,
  IconLock,
  IconClock,
} from "./ui";
import type { View } from "./Sidebar";

function ProgressBar({ value, color }: { value: number; color?: string }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = window.setTimeout(() => setW(value), 250);
    return () => window.clearTimeout(id);
  }, [value]);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg3)]">
      <div
        className="progress-fill h-full rounded-full"
        style={{ width: `${w}%`, ...(color ? { background: color, boxShadow: `0 0 12px ${color}88` } : {}) }}
      />
    </div>
  );
}

/* честный статус лаунчера — только реальные данные */
function SystemStatus() {
  const { s } = useSettings();
  const { entries } = useWaitlist();
  const mode = runtimeMode();
  const rows = [
    { label: "Версия лаунчера", value: `v${APP_VERSION} · ${APP_CHANNEL}`, dot: "var(--accent)" },
    { label: "Режим работы", value: mode === "Web" ? "браузер" : mode, dot: "var(--accent-2)" },
    {
      label: "Обновления",
      value: s.periodicCheck ? "автопроверка каждые 5 минут" : "вручную из настроек",
      dot: s.periodicCheck ? "var(--accent-2)" : "var(--tx3)",
    },
    { label: "Вишлист", value: `${entries.length} записей на этом устройстве`, dot: "var(--accent)" },
  ];

  return (
    <div className="panel relative overflow-hidden" style={{ borderRadius: 16 }}>
      <div
        className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 14%, transparent), transparent 65%)" }}
      />
      <div className="flex items-center gap-2.5 border-b border-[var(--line)] px-6 py-4">
        <span className="pulse-dot h-2 w-2 rounded-full bg-accent" />
        <p className="font-mono2 text-[10.5px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">
          статус лаунчера
        </p>
        <span className="font-mono2 ml-auto hidden text-[10.5px] font-semibold text-[var(--tx3)] sm:block">
          реальные данные · без симуляций
        </span>
      </div>
      <div className="grid divide-y divide-[var(--line)] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        {rows.map((r, i) => (
          <div key={r.label} className={`flex items-center gap-4 px-6 py-5 ${i >= 2 ? "sm:border-t sm:border-[var(--line)] lg:border-t-0" : ""}`}>
            <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: r.dot, boxShadow: `0 0 10px ${r.dot}` }} />
            <div className="min-w-0">
              <p className="text-[12px] font-extrabold uppercase tracking-wide text-[var(--tx3)]">{r.label}</p>
              <p className="font-mono2 mt-0.5 truncate text-[14px] font-bold text-[var(--tx)]">{r.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const MILESTONE_ICON = {
  done: (
    <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent-2)_16%,transparent)] text-[var(--accent-2)]">
      <IconCheck />
    </span>
  ),
  active: (
    <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]">
      <span className="pulse-dot h-2 w-2 rounded-full bg-accent" />
    </span>
  ),
  locked: (
    <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[var(--bg3)] text-[var(--tx3)]">
      <IconLock />
    </span>
  ),
};

export default function HomeView({
  setView,
  openGame,
}: {
  setView: (v: View) => void;
  openGame: (id: string) => void;
}) {
  const [modal, setModal] = useState(false);
  const paraRef = useRef<HTMLDivElement>(null);
  const { entries } = useWaitlist();
  const tw = GAMES[0];
  const fz = GAMES[1];

  const onStackMove = (e: React.MouseEvent) => {
    const el = paraRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--px", String((e.clientX - r.left) / r.width - 0.5));
    el.style.setProperty("--py", String((e.clientY - r.top) / r.height - 0.5));
  };
  const onStackLeave = () => {
    const el = paraRef.current;
    if (!el) return;
    el.style.setProperty("--px", "0");
    el.style.setProperty("--py", "0");
  };

  return (
    <div className="mx-auto max-w-[1180px] px-5 pb-14 pt-6 lg:px-8">
      {/* ===== opening spread ===== */}
      <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <Reveal>
            <p className="font-mono2 text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--accent)]">
              Temka Studio // единый лаунчер
            </p>
          </Reveal>
          <h1 className="font-display mt-4 text-[34px] font-extrabold leading-[1.04] tracking-tight sm:text-[46px] xl:text-[54px]">
            <ScrambleText text="ОДИН ЛАУНЧЕР." />
            <br />
            <span className="text-accent">
              <ScrambleText text="ДВА МИРА." />
            </span>
          </h1>
          <Reveal delay={120}>
            <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-[var(--tx2)]">
              TemkaWorld и Fantazia RP — миры от temka_play. Готовность указана автором
              и обновляется вместе с лаунчером. Обе игры пока{" "}
              <span className="font-bold text-[var(--tx)]">в разработке</span>, запуск откроется с релизом.
            </p>
          </Reveal>
          <Reveal delay={220}>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setView("library")}
                className="btn-primary flex items-center gap-2.5 px-6 py-3.5 text-[14px]"
              >
                Открыть библиотеку
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </button>
              <button onClick={() => setModal(true)} className="btn-ghost flex items-center gap-2.5 px-6 py-3.5 text-[14px]">
                <IconClock />В вишлист
              </button>
            </div>
          </Reveal>
          <Reveal delay={300}>
            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <span className="chip flex items-center gap-2 px-3 py-1.5 text-[11.5px] font-bold text-[var(--accent-2)]">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[var(--accent-2)]" />
                вишлист без почты
              </span>
              <span className="chip font-mono2 px-3 py-1.5 text-[11px] font-semibold text-[var(--tx2)]">v{APP_VERSION}</span>
              <span className="chip font-mono2 px-3 py-1.5 text-[11px] font-semibold text-[var(--tx2)]">
                2 игры · {GAMES.reduce((n, g) => n + g.dlcs.length, 0) || "DLC скоро"}
              </span>
            </div>
          </Reveal>
        </div>

        {/* art stack */}
        <Reveal delay={150}>
          <div
            ref={paraRef}
            onMouseMove={onStackMove}
            onMouseLeave={onStackLeave}
            className="relative h-[300px] sm:h-[360px]"
          >
            <button
              onClick={() => openGame(fz.id)}
              className="with-glare group absolute right-0 top-0 block h-[82%] w-[72%] overflow-hidden rounded-[16px] border border-[var(--line-2)] shadow-[0_30px_70px_-25px_rgba(0,0,0,0.85)] transition-transform duration-300 ease-out"
              style={{ transform: "rotate(-3deg) translate3d(calc(var(--px, 0) * -16px), calc(var(--py, 0) * -12px), 0)" }}
              aria-label="Открыть Fantazia RP"
            >
              <ArtSurface game={fz} className="absolute inset-0 transition-transform duration-700 group-hover:scale-105" />
              <span className="absolute inset-0 bg-gradient-to-t from-[rgba(6,8,12,0.9)] via-transparent to-transparent" />
              <span className="absolute left-4 top-3.5 flex items-center gap-1.5 rounded-full bg-[rgba(6,8,12,0.72)] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.16em] text-[var(--accent-2)] backdrop-blur-sm">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[var(--accent-2)]" />
                в разработке · Godot
              </span>
              <span className="font-display absolute bottom-3 left-4 text-[15px] font-extrabold">{fz.title}</span>
              <span className="font-mono2 absolute bottom-3.5 right-4 text-[10px] font-bold text-[var(--accent-2)]">{fz.progress}%</span>
            </button>
            <button
              onClick={() => openGame(tw.id)}
              className="with-glare group absolute bottom-0 left-0 block h-[86%] w-[76%] overflow-hidden rounded-[16px] border border-[var(--line-2)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] transition-transform duration-300 ease-out"
              style={{ transform: "rotate(2deg) translate3d(calc(var(--px, 0) * 20px), calc(var(--py, 0) * 15px), 0)" }}
              aria-label="Открыть TemkaWorld"
            >
              <ParkScene className="kenburns absolute inset-0 h-full w-full" />
              <span className="absolute inset-0 bg-gradient-to-t from-[rgba(6,8,12,0.92)] via-transparent to-transparent" />
              <span className="absolute left-4 top-3.5">
                <DevChip />
              </span>
              <span className="font-display absolute bottom-3 left-4 text-[15px] font-extrabold">{tw.title}</span>
              <span className="font-mono2 absolute bottom-3.5 right-4 text-[10px] font-bold text-[var(--accent)]">{tw.progress}%</span>
              <span className="absolute inset-x-4 bottom-9 h-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.14)]">
                <span className="progress-fill block h-full rounded-full" style={{ width: `${tw.progress}%` }} />
              </span>
            </button>
          </div>
        </Reveal>
      </section>

      {/* ===== ticker ===== */}
      <Reveal delay={100} className="mt-12">
        <div className="relative overflow-hidden border-y border-[var(--line)] py-2.5">
          <div className="marquee-track">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex flex-none items-center" aria-hidden={dup === 1}>
                {TICKER.map((t) => (
                  <span key={`${dup}-${t}`} className="font-mono2 flex items-center whitespace-nowrap text-[11px] font-semibold tracking-[0.18em] text-[var(--tx2)]">
                    <span className="px-5 text-[var(--accent)]">◆</span>
                    {t}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ===== stats ===== */}
      <Reveal className="mt-10">
        <div className="panel grid grid-cols-2 divide-x divide-[var(--line)] md:grid-cols-4" style={{ borderRadius: 16 }}>
          {[
            { v: entries.length, l: "игр в вашем вишлисте" },
            { v: 2, l: "игры в разработке" },
            { v: 1, l: "автор проекта" },
            { v: 0, l: "готовых игровых релизов" },
          ].map((s, i) => (
            <div key={s.l} className={`px-6 py-6 ${i >= 2 ? "border-t border-[var(--line)] md:border-t-0" : ""}`}>
              <p className="font-display text-[26px] font-extrabold tracking-tight">
                <CountUp to={s.v} />
              </p>
              <p className="mt-1 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[var(--tx3)]">{s.l}</p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* ===== статус лаунчера ===== */}
      <Reveal className="mt-12">
        <SystemStatus />
      </Reveal>

      {/* ===== roadmaps ===== */}
      <section className="mt-14">
        <Reveal>
          <p className="font-mono2 text-[10.5px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">дорожная карта</p>
          <h2 className="font-display mt-1.5 text-[24px] font-extrabold tracking-tight">
            <MaskReveal>Как идёт разработка</MaskReveal>
          </h2>
        </Reveal>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {GAMES.map((g, gi) => (
            <Reveal key={g.id} delay={gi * 110}>
              <div className="panel flex h-full flex-col p-6">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.accent, boxShadow: `0 0 10px ${g.accent}` }} />
                  <h3 className="font-display text-[17px] font-extrabold">{g.title}</h3>
                  <span className="font-mono2 ml-auto text-[13px] font-bold" style={{ color: g.accent }}>
                    {g.progress}%
                  </span>
                </div>
                <div className="mt-4">
                  <ProgressBar value={g.progress} color={g.accent} />
                </div>
                <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                  {g.roadmap.map((m) => (
                    <li key={m.label} className="flex items-center gap-3">
                      {MILESTONE_ICON[m.state]}
                      <span
                        className={`text-[13.5px] font-semibold ${
                          m.state === "done" ? "text-[var(--tx2)] line-through decoration-[var(--tx3)]" : m.state === "active" ? "text-[var(--tx)]" : "text-[var(--tx3)]"
                        }`}
                      >
                        {m.label}
                      </span>
                      {m.state === "active" && (
                        <span className="font-mono2 ml-auto rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-[var(--accent)]">
                          сейчас
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => openGame(g.id)}
                  className="btn-ghost mt-5 flex items-center justify-center gap-2 px-4 py-2.5 text-[13px]"
                >
                  Подробнее в библиотеке
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14m-6-6 6 6-6 6" />
                  </svg>
                </button>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <PreRegisterModal open={modal} onClose={() => setModal(false)} gameId="all" />
    </div>
  );
}
