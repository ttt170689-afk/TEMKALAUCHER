import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DLC_STATUS, GAMES } from "../data/games";
import type { Game } from "../data/games";
import { useToast } from "../lib/toast";
import { ArtSurface, ShotPlaceholder } from "./Art";
import {
  Reveal,
  ScrambleText,
  PreRegisterModal,
  DevChip,
  DlcIcon,
  MaskReveal,
  glareMove,
  IconLock,
  IconBell,
  IconClock,
  IconCheck,
  IconSearch,
} from "./ui";

function GameCard({ game, active, onSelect, delay }: { game: Game; active: boolean; onSelect: () => void; delay: number }) {
  return (
    <Reveal delay={delay}>
      <button
        onClick={onSelect}
        onMouseMove={glareMove}
        className={`with-glare group relative block w-full overflow-hidden rounded-[14px] border text-left transition-all duration-300 ${
          active
            ? "border-[color-mix(in_srgb,var(--accent)_55%,var(--line))] shadow-[0_10px_40px_-12px_color-mix(in_srgb,var(--accent)_40%,transparent)]"
            : "border-[var(--line)] hover:border-[var(--line-2)] hover:shadow-[0_10px_36px_-14px_rgba(0,0,0,0.7)]"
        }`}
        style={{ background: "linear-gradient(180deg, var(--bg2), var(--bg1))" }}
      >
        <div className="relative h-32 overflow-hidden">
          <ArtSurface game={game} className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.07]" />
          <span className="absolute inset-0 bg-gradient-to-t from-[var(--bg1)] via-[rgba(10,13,19,0.25)] to-transparent" />
          {/* in-dev watermark */}
          <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-[rgba(6,8,12,0.72)] px-2.5 py-1 text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-[var(--tx2)] backdrop-blur-sm">
            <IconLock /> недоступно
          </span>
          {active && (
            <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: game.accent, boxShadow: `0 0 12px ${game.accent}` }} />
          )}
        </div>
        <div className="p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-display text-[15.5px] font-extrabold">{game.title}</h3>
            <span className="font-mono2 text-[11px] font-bold" style={{ color: game.accent }}>
              {game.progress}%
            </span>
          </div>
          <p className="mt-0.5 text-[11.5px] font-semibold text-[var(--tx3)]">{game.genre}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--bg3)]">
            <div className="progress-fill h-full rounded-full" style={{ width: `${game.progress}%` }} />
          </div>
          <p className="font-mono2 mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--tx3)]">
            готовность сборки · {game.version}
          </p>
        </div>
      </button>
    </Reveal>
  );
}

export default function LibraryView({
  selectedId,
  setSelectedId,
  query,
}: {
  selectedId: string;
  setSelectedId: (id: string) => void;
  query: string;
}) {
  const { push } = useToast();
  const [shake, setShake] = useState(false);
  const [modal, setModal] = useState(false);
  const [reqTab, setReqTab] = useState<"min" | "rec">("min");

  const openBrowser = () => {
    if (!shownGame.liveUrl) return;
    window.open(shownGame.liveUrl, "_blank", "noopener");
  };

  const q = query.trim().toLowerCase();
  const games = GAMES.filter(
    (g) => !q || g.title.toLowerCase().includes(q) || g.genre.toLowerCase().includes(q) || g.tagline.toLowerCase().includes(q)
  );
  const game = GAMES.find((g) => g.id === selectedId) ?? GAMES[0];
  const visible = games.some((g) => g.id === game.id) || !q;
  const shownGame = games.length ? (games.some((g) => g.id === game.id) ? game : games[0]) : game;

  useEffect(() => {
    if (games.length && !games.some((g) => g.id === selectedId)) setSelectedId(games[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const tryPlay = () => {
    setShake(true);
    window.setTimeout(() => setShake(false), 450);
    push("warn", `${game.title} — игра недоступна`, "Сейчас она в разработке. Запуск откроется вместе с релизом.");
  };

  return (
    <div className="mx-auto max-w-[1180px] px-5 pb-14 pt-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* ===== left: game list ===== */}
        <div className="flex flex-col gap-4">
          <Reveal>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[15px] font-extrabold uppercase tracking-wide">Мои игры</h2>
              <span className="chip font-mono2 px-2.5 py-1 text-[10.5px] font-bold text-[var(--tx2)]">{games.length} / {GAMES.length}</span>
            </div>
          </Reveal>
          {games.length === 0 ? (
            <Reveal>
              <div className="panel flex flex-col items-center p-6 text-center">
                <span className="text-[var(--tx3)]">
                  <IconSearch />
                </span>
                <p className="mt-3 text-[13.5px] font-bold">Ничего не нашлось</p>
                <p className="mt-1 text-[12px] text-[var(--tx3)]">По запросу «{query}» игр нет.</p>
              </div>
            </Reveal>
          ) : (
            games.map((g, i) => (
              <GameCard key={g.id} game={g} active={g.id === shownGame.id} onSelect={() => setSelectedId(g.id)} delay={i * 90} />
            ))
          )}
          <Reveal delay={220}>
            <div className="panel border-dashed p-4 text-center" style={{ borderStyle: "dashed" }}>
              <p className="font-mono2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--tx3)]">скоро в библиотеке</p>
              <p className="font-display mt-2 text-[14px] font-bold text-[var(--tx2)]">Temka Kart · ???</p>
              <p className="mt-1 text-[11.5px] text-[var(--tx3)]">Третий проект студии. Тизер — весной.</p>
            </div>
          </Reveal>
        </div>

        {/* ===== right: detail ===== */}
        {visible && (
          <AnimatePresence mode="wait">
            <motion.div
              key={shownGame.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="min-w-0"
            >
              {/* banner */}
              <Reveal>
                <div
                  onMouseMove={(e) => {
                    const el = e.currentTarget;
                    const r = el.getBoundingClientRect();
                    el.style.setProperty("--bx", String((e.clientX - r.left) / r.width - 0.5));
                    el.style.setProperty("--by", String((e.clientY - r.top) / r.height - 0.5));
                  }}
                  className="relative h-[260px] overflow-hidden rounded-[16px] border border-[var(--line-2)] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] sm:h-[300px]"
                >
                  <div
                    className="absolute -inset-3 transition-transform duration-200 ease-out"
                    style={{ transform: "translate3d(calc(var(--bx, 0) * -12px), calc(var(--by, 0) * -9px), 0)" }}
                  >
                    <ArtSurface game={shownGame} className="h-full w-full" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-[rgba(6,8,12,0.95)] via-[rgba(6,8,12,0.25)] to-transparent" />
                  <div className="absolute left-5 top-5 flex flex-wrap items-center gap-2">
                    <DevChip />
                    <span className="chip font-mono2 px-2.5 py-1 text-[10.5px] font-bold text-[var(--tx2)]">{shownGame.version}</span>
                    {shownGame.liveUrl && (
                      <span className="chip flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--accent-2)]">
                        <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[var(--accent-2)]" />
                        играбельно в браузере
                      </span>
                    )}
                  </div>
                  <div className="absolute inset-x-5 bottom-4 sm:inset-x-7">
                    <h1 className="font-display text-[30px] font-extrabold tracking-tight drop-shadow-[0_4px_16px_rgba(0,0,0,0.7)] sm:text-[38px]">
                      <ScrambleText text={shownGame.title} />
                    </h1>
                    <p className="mt-1 text-[14px] font-semibold text-[var(--tx2)]">{shownGame.tagline}</p>
                  </div>
                </div>
              </Reveal>

              {/* meta chips */}
              <Reveal delay={80}>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[shownGame.genre, shownGame.developer, shownGame.engine].map((c) => (
                    <span key={c} className="chip px-3 py-1.5 text-[11.5px] font-bold text-[var(--tx2)]">
                      {c}
                    </span>
                  ))}
                </div>
              </Reveal>

              {/* actions */}
              <Reveal delay={140}>
                <div className={`mt-5 flex flex-wrap items-center gap-3 ${shake ? "shake" : ""}`}>
                  <button
                    aria-disabled="true"
                    onClick={tryPlay}
                    className="btn-primary is-disabled flex items-center gap-3 px-8 py-3.5 text-[15px]"
                  >
                    <IconLock />
                    ИГРАТЬ — НЕДОСТУПНО
                  </button>
                  <button onClick={() => setModal(true)} className="btn-ghost flex items-center gap-2 px-5 py-3.5 text-[13.5px]">
                    <IconClock />В вишлист
                  </button>
                  <button
                    onClick={() => setModal(true)}
                    className="btn-ghost flex h-[50px] w-[50px] items-center justify-center"
                    aria-label="Добавить игру в вишлист"
                  >
                    <IconBell />
                  </button>
                  {shownGame.liveUrl && (
                    <button
                      onClick={openBrowser}
                      className="btn-ghost flex items-center gap-2 border-[color-mix(in_srgb,var(--accent-2)_40%,var(--line-2))] px-5 py-3.5 text-[13.5px] text-[var(--accent-2)]"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z" />
                      </svg>
                      Открыть веб-проект
                    </button>
                  )}
                </div>
              </Reveal>

              {/* сюжет + персонажи (TemkaWorld) */}
              {shownGame.id === "temkaworld" && (
                <>
                  <Reveal delay={80}>
                    <div className="mt-8 flex items-end justify-between">
                      <div>
                        <p className="font-mono2 text-[10.5px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">история</p>
                        <h2 className="font-display mt-1 text-[21px] font-extrabold tracking-tight">
                          <MaskReveal>Сюжет по главам</MaskReveal>
                        </h2>
                      </div>
                      <span className="chip font-mono2 px-3 py-1.5 text-[11px] font-bold text-[var(--tx2)]">4 главы</span>
                    </div>
                  </Reveal>
                  <div className="mt-4 flex flex-col gap-3">
                    {[
                      {
                        n: "01",
                        title: "Пролог: Детство и Катастрофа",
                        text: "Воспоминания, выбор имени с фильтром мата и открытие грандиозного парка. Затем сирена, атака Демона и гермозатвор, захлопнутый Артёмом.",
                        state: "done",
                        label: "основа сюжета",
                      },
                      {
                        n: "02",
                        title: "Два года спустя: Возвращение",
                        text: "Записка ведёт к тайному лазу на заброшке. Никита учит выживанию — и уходит на передовую к Саше, охранять жуткие стыки парка.",
                        state: "active",
                        label: "текущая глава",
                      },
                      {
                        n: "03",
                        title: "Сетевая игра: Первая миссия",
                        text: "Портал за сценой, лавка скинов Серёги и задание Артёма: Золотой Ключ, обрушение стены и адреналиновая погоня Гигантского Монстра.",
                        state: "locked",
                        label: "в разработке",
                      },
                      {
                        n: "04",
                        title: "Финал вступления: Секретный Бункер",
                        text: "Секретный Бункер — часть задуманного сюжета. Его механики ещё в разработке; уровни лаунчера для доступа не требуются.",
                        state: "locked",
                        label: "финал",
                      },
                    ].map((c, i) => (
                      <Reveal key={c.n} delay={i * 70}>
                        <div
                          onMouseMove={glareMove}
                          className={`with-glare panel group relative flex gap-4 overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 ${
                            c.state === "active" ? "border-[color-mix(in_srgb,var(--accent)_45%,var(--line))]" : ""
                          }`}
                        >
                          <span
                            className={`font-display flex h-12 w-12 flex-none items-center justify-center rounded-[12px] text-[15px] font-extrabold ${
                              c.state === "locked" ? "text-[var(--tx3)]" : "text-[var(--bg0)]"
                            }`}
                            style={{
                              background: c.state === "locked" ? "var(--bg3)" : "var(--accent)",
                              boxShadow: c.state === "locked" ? "none" : "0 6px 18px -6px color-mix(in srgb, var(--accent) 70%, transparent)",
                            }}
                          >
                            {c.n}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-[15px] font-extrabold">{c.title}</h4>
                              {c.state === "active" && (
                                <span className="chip flex items-center gap-1.5 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-widest text-[var(--accent)]">
                                  <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" />
                                  {c.label}
                                </span>
                              )}
                              {c.state === "done" && (
                                <span className="chip flex items-center gap-1 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-widest text-[var(--accent-2)]">
                                  <IconCheck /> {c.label}
                                </span>
                              )}
                              {c.state === "locked" && (
                                <span className="chip flex items-center gap-1 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-widest text-[var(--tx3)]">
                                  <IconLock /> {c.label}
                                </span>
                              )}
                            </div>
                            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--tx2)]">{c.text}</p>
                          </div>
                        </div>
                      </Reveal>
                    ))}
                  </div>

                  <Reveal delay={80}>
                    <div className="mt-8 flex items-end justify-between">
                      <div>
                        <p className="font-mono2 text-[10.5px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">действующие лица</p>
                        <h2 className="font-display mt-1 text-[21px] font-extrabold tracking-tight">
                          <MaskReveal>Персонажи</MaskReveal>
                        </h2>
                      </div>
                      <span className="chip font-mono2 px-3 py-1.5 text-[11px] font-bold text-[var(--tx2)]">5 в досье</span>
                    </div>
                  </Reveal>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {[
                      { glyph: "А", name: "Артём", role: "Лидер парка", status: "Жив · на базе", color: "#ff7a2f", live: true },
                      { glyph: "₽", name: "Серёга", role: "Торговец скинами", status: "Жив · лавка", color: "#3ddcc2", live: true },
                      { glyph: "С", name: "Саша", role: "Боец · тяжёлая броня", status: "На передовой", color: "#ffd28a", live: true },
                      { glyph: "Н", name: "Никита", role: "Наставник", status: "На передовой", color: "#ffd28a", live: true },
                      { glyph: "dem", name: "Демон", role: "Угроза парка", status: "На свободе", color: "#ff5d5d", live: true, danger: true },
                    ].map((p, i) => (
                      <Reveal key={p.name} delay={i * 60}>
                        <div onMouseMove={glareMove} className="with-glare panel group relative flex h-full flex-col items-center overflow-hidden p-4 text-center transition-all duration-300 hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--line))]">
                          <div
                            className="font-display relative flex h-14 w-14 items-center justify-center rounded-full text-[17px] font-extrabold transition-transform duration-300 group-hover:scale-110"
                            style={{
                              color: p.color,
                              background: `color-mix(in srgb, ${p.color} 12%, transparent)`,
                              border: `1.5px solid color-mix(in srgb, ${p.color} 45%, transparent)`,
                              boxShadow: `0 6px 20px -8px ${p.color}aa`,
                            }}
                          >
                            {p.glyph === "dem" ? (
                              <svg width="26" height="26" viewBox="0 0 32 32" fill="none" stroke={p.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 13 6 4l6 5M23 13l3-9-6 5" fill={`color-mix(in srgb, ${p.color} 25%, transparent)`} />
                                <circle cx="16" cy="19" r="8" />
                                <path d="M12.5 18h.01M19.5 18h.01" strokeWidth="3" />
                              </svg>
                            ) : (
                              p.glyph
                            )}
                            {p.danger && (
                              <span className="pulse-dot absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg1)] bg-[var(--danger)]" />
                            )}
                          </div>
                          <p className="font-display mt-3 text-[13.5px] font-extrabold leading-tight">{p.name}</p>
                          <p className="mt-0.5 text-[10.5px] font-semibold text-[var(--tx3)]">{p.role}</p>
                          <span
                            className="chip mt-2.5 px-2.5 py-1 text-[9.5px] font-extrabold uppercase tracking-wider"
                            style={{
                              color: p.danger ? "var(--danger)" : p.color,
                              borderColor: `color-mix(in srgb, ${p.color} 35%, transparent)`,
                            }}
                          >
                            {p.status}
                          </span>
                        </div>
                      </Reveal>
                    ))}
                  </div>
                </>
              )}

              {/* about + features */}
              <div className="mt-5 grid gap-5 md:grid-cols-[1.35fr_1fr]">
                <Reveal delay={100}>
                  <div className="panel h-full p-6">
                    <h3 className="font-display text-[15px] font-extrabold uppercase tracking-wide">Об игре</h3>
                    <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--tx2)]">{shownGame.description}</p>
                    <div className="mt-4">
                      <div className="flex items-center justify-between">
                        <span className="font-mono2 text-[10.5px] font-bold uppercase tracking-[0.2em] text-[var(--tx3)]">готовность</span>
                        <span className="font-mono2 text-[12px] font-bold" style={{ color: shownGame.accent }}>{shownGame.progress}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg3)]">
                        <div className="progress-fill h-full rounded-full" style={{ width: `${shownGame.progress}%` }} />
                      </div>
                    </div>
                  </div>
                </Reveal>
                <Reveal delay={170}>
                  <div className="panel h-full p-6">
                    <h3 className="font-display text-[15px] font-extrabold uppercase tracking-wide">Ключевое</h3>
                    <ul className="mt-3 flex flex-col gap-2.5">
                      {shownGame.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-[13px] font-semibold leading-snug text-[var(--tx2)]">
                          <span className="mt-0.5 flex h-4.5 w-4.5 flex-none items-center justify-center rounded-full text-[var(--accent)]" style={{ background: "color-mix(in srgb, var(--accent) 13%, transparent)", width: 18, height: 18 }}>
                            <IconCheck />
                          </span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              </div>

              {/* DLC */}
              <Reveal delay={80}>
                <div className="mt-8 flex items-end justify-between">
                  <div>
                    <p className="font-mono2 text-[10.5px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">дополнения</p>
                    <h2 className="font-display mt-1 text-[21px] font-extrabold tracking-tight">
                      <MaskReveal>DLC к игре</MaskReveal>
                    </h2>
                  </div>
                  <span className="chip font-mono2 px-3 py-1.5 text-[11px] font-bold text-[var(--tx2)]">
                    {shownGame.dlcs.length ? `${shownGame.dlcs.length} шт.` : "пусто"}
                  </span>
                </div>
              </Reveal>

              {shownGame.dlcs.length === 0 ? (
                <Reveal delay={100}>
                  <div
                    className="relative mt-4 flex flex-col items-center overflow-hidden rounded-[14px] border border-dashed border-[var(--line-2)] bg-[var(--bg1)] px-6 py-10 text-center"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(45deg, color-mix(in srgb, var(--accent) 4%, transparent) 0 16px, transparent 16px 32px)",
                    }}
                  >
                    <span
                      className="flex h-14 w-14 items-center justify-center rounded-[14px]"
                      style={{
                        color: shownGame.accent,
                        background: `color-mix(in srgb, ${shownGame.accent} 11%, transparent)`,
                        border: `1px dashed color-mix(in srgb, ${shownGame.accent} 40%, transparent)`,
                      }}
                    >
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14" />
                        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" opacity="0.4" />
                      </svg>
                    </span>
                    <p className="shimmer font-display mt-4 text-[14px] font-extrabold uppercase tracking-[0.14em]">
                      DLC пока нет
                    </p>
                    <p className="mt-1.5 max-w-[46ch] text-[12.5px] leading-relaxed text-[var(--tx2)]">
                      Разработчик добавит дополнения к «{shownGame.title}» сам — витрина уже готова и ждёт первый пакет.
                    </p>
                    <span className="font-mono2 mt-3 text-[9.5px] font-bold uppercase tracking-[0.22em] text-[var(--tx3)]">
                      слот свободен · src/data/games.ts
                    </span>
                  </div>
                </Reveal>
              ) : (
              <div className="mt-4 flex flex-col gap-3">
                {shownGame.dlcs.map((d, i) => {
                  const st = DLC_STATUS[d.status];
                  return (
                    <Reveal key={d.id} delay={i * 80}>
                      <div onMouseMove={glareMove} className="with-glare panel group relative flex flex-col gap-4 overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--line))] sm:flex-row sm:items-center">
                        <div
                          className="flex h-12 w-12 flex-none items-center justify-center rounded-[12px] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                          style={{
                            color: shownGame.accent,
                            background: `color-mix(in srgb, ${shownGame.accent} 12%, transparent)`,
                            border: `1px solid color-mix(in srgb, ${shownGame.accent} 28%, transparent)`,
                          }}
                        >
                          <DlcIcon type={d.icon} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-[15px] font-extrabold">{d.title}</h4>
                            <span className={`chip px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest ${st.cls}`}>{st.label}</span>
                          </div>
                          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--tx2)]">{d.desc}</p>
                        </div>
                        <div className="flex flex-none items-center gap-5 sm:flex-col sm:items-end sm:gap-1.5">
                          <div className="text-left sm:text-right">
                            <p className="font-display text-[15px] font-extrabold">{d.price}</p>
                            <p className="font-mono2 text-[10px] font-semibold text-[var(--tx3)]">{d.size}</p>
                          </div>
                          <button
                            onClick={() => push("ok", `Напомним о «${d.title}»`, "Уведомление придёт, когда DLC станет доступно.")}
                            className="btn-ghost flex items-center gap-1.5 px-3.5 py-2 text-[12px]"
                          >
                            <IconBell /> Напомнить
                          </button>
                        </div>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
              )}
              {shownGame.dlcs.length > 0 && (
                <Reveal delay={100}>
                  <p className="mt-3 text-[11.5px] text-[var(--tx3)]">
                    * Все дополнения выйдут после релиза основной игры и недоступны для покупки, пока игра в разработке.
                  </p>
                </Reveal>
              )}

              {/* screenshots */}
              <Reveal delay={60}>
                <h2 className="font-display mt-8 text-[21px] font-extrabold tracking-tight">
                  <MaskReveal>Скриншоты</MaskReveal>
                </h2>
              </Reveal>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {shownGame.screenshots.map((sc, i) => (
                  <Reveal key={`${sc.kind}-${i}`} delay={i * 90}>
                    <ShotPlaceholder label={sc.label} sub="арт добавит разработчик" />
                  </Reveal>
                ))}
              </div>

              {/* requirements */}
              <Reveal delay={60}>
                <div className="mt-8 flex items-center justify-between gap-3">
                  <h2 className="font-display text-[21px] font-extrabold tracking-tight">
                    <MaskReveal>Требования · предварительно</MaskReveal>
                  </h2>
                  <div className="flex gap-1 rounded-[10px] border border-[var(--line-2)] bg-[var(--bg2)] p-1">
                    {(["min", "rec"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setReqTab(t)}
                        className={`rounded-[7px] px-3.5 py-1.5 text-[12px] font-extrabold transition-all ${
                          reqTab === t ? "bg-accent text-[var(--bg0)]" : "text-[var(--tx2)] hover:text-[var(--tx)]"
                        }`}
                      >
                        {t === "min" ? "Минимальные" : "Рекомендуемые"}
                      </button>
                    ))}
                  </div>
                </div>
              </Reveal>
              <Reveal delay={100}>
                <div className="panel mt-4 overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={reqTab}
                      initial={{ opacity: 0, x: reqTab === "min" ? -14 : 14 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: reqTab === "min" ? 14 : -14 }}
                      transition={{ duration: 0.22 }}
                    >
                      {shownGame.requirements.map((r, i) => (
                        <div
                          key={r.label}
                          className={`grid grid-cols-[130px_1fr] gap-3 px-5 py-3 text-[13px] sm:grid-cols-[180px_1fr] ${
                            i % 2 ? "bg-[color-mix(in_srgb,var(--bg2)_60%,transparent)]" : ""
                          } ${i ? "border-t border-[var(--line)]" : ""}`}
                        >
                          <span className="font-bold text-[var(--tx3)]">{r.label}</span>
                          <span className="font-mono2 font-semibold text-[var(--tx2)]">{reqTab === "min" ? r.min : r.rec}</span>
                        </div>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </Reveal>

              <div className="h-6" />
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <PreRegisterModal open={modal} onClose={() => setModal(false)} gameTitle={shownGame.title} gameId={shownGame.id} />
    </div>
  );
}
