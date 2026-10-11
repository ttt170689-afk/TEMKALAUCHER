import { USERNAME_MAX_LENGTH } from "../lib/username";
import { useState } from "react";
import { useAuth, TITLES, AVATAR_COLORS } from "../lib/auth";
import { AVATAR_VARIANTS, AvatarSvg } from "./AvatarSvg";
import { useProgress, ACHIEVEMENTS, XP_PER_LEVEL, BUNKER_LEVEL } from "../lib/progress";
import { useWaitlist } from "../lib/waitlist";
import { useToast } from "../lib/toast";
import { Reveal, MaskReveal, glareMove, IconLock, IconCheck } from "./ui";

const ACH_ICONS: Record<string, React.ReactNode> = {
  signup: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="8" r="4" />
      <path d="M3 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5M19 6v6M22 9h-6" />
    </svg>
  ),
  lvl1: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 14 7-7 7 7M5 20l7-7 7 7" />
    </svg>
  ),
  lvl5: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 20 6v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  lvl10: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="12" r="4.5" />
      <path d="M12.5 12H21M18 12v3M15 12v2" />
    </svg>
  ),
  waitlist: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  ),
  explorer: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5Z" />
    </svg>
  ),
};

export default function ProfileView() {
  const { user, updateProfile, rename, logout, deleteAccount } = useAuth();
  const { xp, level, into, hasAch, ach } = useProgress();
  const { entries, leave } = useWaitlist();
  const { push } = useToast();
  const [nameDraft, setNameDraft] = useState(user?.username ?? "");
  const [statusDraft, setStatusDraft] = useState(user?.profile.status ?? "");
  const [confirmDel, setConfirmDel] = useState(false);

  if (!user) return null;
  const p = user.profile;
  const titleName = TITLES.find((t) => t.id === p.title)?.name ?? "Новичок";
  const created = new Date(user.createdAt);

  const saveName = () => {
    const e = rename(nameDraft);
    if (e) {
      push("warn", "Не получилось сменить ник", e);
      return;
    }
    push("ok", "Ник обновлён", `Теперь ты — ${nameDraft.trim()}`);
  };

  const saveStatus = () => {
    updateProfile({ status: statusDraft.trim().slice(0, 60) || "Игрок миров Temka" });
    push("ok", "Статус сохранён");
  };

  return (
    <div className="mx-auto max-w-[1000px] px-5 pb-14 pt-6 lg:px-8">
      {/* ===== карточка игрока ===== */}
      <Reveal>
        <div onMouseMove={glareMove} className="with-glare panel relative overflow-hidden p-6 sm:p-8" style={{ borderRadius: 18 }}>
          <div
            className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full"
            style={{ background: `radial-gradient(circle, color-mix(in srgb, ${p.color} 16%, transparent), transparent 65%)` }}
          />
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="relative flex-none">
              <div
                className="rounded-full p-1.5"
                style={{ background: `color-mix(in srgb, ${p.color} 14%, transparent)`, boxShadow: `0 10px 40px -10px ${p.color}aa` }}
              >
                <AvatarSvg variant={p.avatar} color={p.color} size={104} />
              </div>
              <span
                className="font-display absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold text-[var(--bg0)]"
                style={{ background: p.color, boxShadow: `0 4px 14px ${p.color}88` }}
              >
                {level}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-[26px] font-extrabold tracking-tight">{user.username}</h1>
                <span
                  className="chip px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.14em]"
                  style={{ color: p.color, borderColor: `color-mix(in srgb, ${p.color} 45%, transparent)`, background: `color-mix(in srgb, ${p.color} 10%, transparent)` }}
                >
                  {titleName}
                </span>
              </div>
              <p className="mt-1 text-[13.5px] font-semibold text-[var(--tx2)]">{p.status}</p>
              <div className="font-mono2 mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-[var(--tx3)]">
                <span>{user.email}</span>
                <span className="text-[var(--accent)]">·</span>
                <span>
                  в парке с {created.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                </span>
                <span className="text-[var(--accent)]">·</span>
                <span>
                  достижений {ach.length} / {ACHIEVEMENTS.length}
                </span>
              </div>
            </div>
            <button onClick={logout} className="btn-ghost flex-none self-start px-5 py-2.5 text-[13px] sm:self-auto">
              Выйти из аккаунта
            </button>
          </div>

          {/* xp strip */}
          <div className="mt-6 grid gap-4 border-t border-[var(--line)] pt-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--tx3)]">
                  прогресс до {level + 1} уровня
                </span>
                <span className="font-mono2 text-[11px] font-bold text-[var(--accent)]">
                  {into} / {XP_PER_LEVEL} XP
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--bg3)]">
                <div className="progress-fill h-full rounded-full" style={{ width: `${into}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`flex h-8 w-8 items-center justify-center rounded-[9px] ${level >= BUNKER_LEVEL ? "text-[var(--bg0)]" : "text-[var(--tx3)]"}`} style={{ background: level >= BUNKER_LEVEL ? "var(--accent)" : "var(--bg3)" }}>
                <IconLock />
              </span>
              <div className="leading-tight">
                <p className="text-[12px] font-extrabold">{level >= BUNKER_LEVEL ? "Бункер открыт" : "Бункер: закрыт"}</p>
                <p className="font-mono2 text-[9.5px] font-semibold text-[var(--tx3)]">
                  {level >= BUNKER_LEVEL ? "защита отключена" : `нужен ${BUNKER_LEVEL} уровень`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ===== кастомизация ===== */}
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Reveal delay={80}>
          <div className="panel flex h-full flex-col p-6">
            <p className="font-mono2 text-[10.5px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">внешность</p>
            <h2 className="font-display mt-1 text-[20px] font-extrabold tracking-tight">
              <MaskReveal>Аватар игрока</MaskReveal>
            </h2>

            <div className="mt-5 flex items-center gap-5">
              <div
                className="rounded-full p-1.5 transition-all duration-300"
                style={{ background: `color-mix(in srgb, ${p.color} 14%, transparent)`, boxShadow: `0 8px 30px -10px ${p.color}aa` }}
              >
                <AvatarSvg variant={p.avatar} color={p.color} size={76} />
              </div>
              <p className="max-w-[26ch] text-[12px] leading-relaxed text-[var(--tx3)]">
                Аватар виден в профиле, сайдбаре и шапке лаунчера. Обновляется мгновенно.
              </p>
            </div>

            <p className="mt-5 text-[11px] font-extrabold uppercase tracking-wider text-[var(--tx3)]">Вариант</p>
            <div className="mt-2.5 grid grid-cols-8 gap-2">
              {AVATAR_VARIANTS.map((v) => (
                <button
                  key={v}
                  onClick={() => updateProfile({ avatar: v })}
                  className={`rounded-[12px] border p-1 transition-all duration-200 hover:-translate-y-0.5 ${
                    p.avatar === v
                      ? "border-[color-mix(in_srgb,var(--accent)_55%,var(--line))] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
                      : "border-[var(--line)] hover:border-[var(--line-2)]"
                  }`}
                  aria-label={`Аватар ${v}`}
                >
                  <AvatarSvg variant={v} color={p.color} size={34} />
                </button>
              ))}
            </div>

            <p className="mt-5 text-[11px] font-extrabold uppercase tracking-wider text-[var(--tx3)]">Цвет</p>
            <div className="mt-2.5 flex gap-2.5">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => updateProfile({ color: c })}
                  className="flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-200 hover:scale-110"
                  style={{ background: c, boxShadow: p.color === c ? `0 0 0 3px var(--bg1), 0 0 0 5px ${c}, 0 0 18px ${c}88` : `0 4px 12px ${c}55` }}
                  aria-label={`Цвет ${c}`}
                >
                  {p.color === c && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#14100b" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="flex flex-col gap-5">
          <Reveal delay={140}>
            <div className="panel p-6">
              <p className="font-mono2 text-[10.5px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">данные</p>
              <h2 className="font-display mt-1 text-[20px] font-extrabold tracking-tight">
                <MaskReveal>Ник и статус</MaskReveal>
              </h2>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-[var(--tx3)]">Ник · {nameDraft.length}/{USERNAME_MAX_LENGTH}</span>
                <div className="flex gap-2">
                  <input className="input-tl min-w-0 flex-1 px-4 py-2.5 text-[13.5px]" value={nameDraft} maxLength={USERNAME_MAX_LENGTH} onChange={(e) => setNameDraft(e.target.value)} />
                  <button onClick={saveName} className="btn-primary flex-none px-4 py-2.5 text-[12.5px]" disabled={nameDraft.trim() === user.username}>
                    Сохранить
                  </button>
                </div>
              </label>
              <label className="mt-3.5 block">
                <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-[var(--tx3)]">Статус</span>
                <div className="flex gap-2">
                  <input
                    className="input-tl min-w-0 flex-1 px-4 py-2.5 text-[13.5px]"
                    value={statusDraft}
                    maxLength={60}
                    placeholder="Чем живёшь в парке?"
                    onChange={(e) => setStatusDraft(e.target.value)}
                  />
                  <button onClick={saveStatus} className="btn-ghost flex-none px-4 py-2.5 text-[12.5px]">
                    ОК
                  </button>
                </div>
              </label>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="panel flex-1 p-6">
              <p className="font-mono2 text-[10.5px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">регалии</p>
              <h2 className="font-display mt-1 text-[20px] font-extrabold tracking-tight">
                <MaskReveal>Титулы</MaskReveal>
              </h2>
              <div className="mt-4 flex flex-col gap-2">
                {TITLES.map((t) => {
                  const unlocked = level >= t.req;
                  const active = p.title === t.id;
                  return (
                    <button
                      key={t.id}
                      disabled={!unlocked}
                      onClick={() => {
                        updateProfile({ title: t.id });
                        push("ok", `Титул «${t.name}» выбран`);
                      }}
                      className={`flex items-center gap-3 rounded-[11px] border px-4 py-2.5 text-left transition-all duration-200 ${
                        active
                          ? "border-[color-mix(in_srgb,var(--accent)_55%,var(--line))] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
                          : unlocked
                            ? "border-[var(--line)] hover:border-[var(--line-2)] hover:bg-[var(--bg2)]"
                            : "border-[var(--line)] opacity-50"
                      }`}
                    >
                      <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-full ${unlocked ? "text-[var(--accent)]" : "text-[var(--tx3)]"}`} style={{ background: unlocked ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--bg3)" }}>
                        {unlocked ? <IconCheck /> : <IconLock />}
                      </span>
                      <span className="flex-1">
                        <span className="block text-[13.5px] font-extrabold">{t.name}</span>
                        <span className="font-mono2 block text-[9.5px] font-semibold uppercase tracking-widest text-[var(--tx3)]">
                          {t.req === 0 ? "выдаётся при регистрации" : `с ${t.req} уровня`}
                        </span>
                      </span>
                      {active && (
                        <span className="font-mono2 rounded-full bg-accent px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-[var(--bg0)]">
                          выбран
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* ===== лист ожидания ===== */}
      <Reveal delay={60}>
        <div className="mt-8 flex items-end justify-between">
          <div>
            <p className="font-mono2 text-[10.5px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">подписки</p>
            <h2 className="font-display mt-1 text-[21px] font-extrabold tracking-tight">
              <MaskReveal>Лист ожидания</MaskReveal>
            </h2>
          </div>
          <span className="chip font-mono2 px-3 py-1.5 text-[11px] font-bold text-[var(--tx2)]">{entries.length}</span>
        </div>
      </Reveal>
      <Reveal delay={100}>
        {entries.length === 0 ? (
          <div className="panel mt-4 border-dashed p-5 text-center text-[13px] font-semibold text-[var(--tx3)]" style={{ borderStyle: "dashed" }}>
            Пока нет подписок — запишись в лист ожидания игры из библиотеки и получи +50 XP.
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2.5">
            {entries.map((e) => {
              const label = e.game === "temkaworld" ? "TemkaWorld" : e.game === "fantazia" ? "Fantazia RP" : "Все игры Temka";
              return (
                <div key={e.game} onMouseMove={glareMove} className="with-glare panel relative flex flex-wrap items-center gap-4 overflow-hidden px-5 py-3.5">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] text-[var(--accent)]" style={{ background: "color-mix(in srgb, var(--accent) 11%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)" }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 3" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-extrabold">{label}</p>
                    <p className="font-mono2 text-[10.5px] font-semibold text-[var(--tx3)]">
                      {e.email} · с {new Date(e.date).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                  <span className="chip px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[var(--accent-2)]">в очереди</span>
                  <button
                    onClick={() => {
                      leave(e.game);
                      push("info", "Подписка снята", `«${label}» убрана из листа ожидания.`);
                    }}
                    className="btn-ghost px-3.5 py-2 text-[12px] text-[var(--tx2)]"
                  >
                    Отписаться
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Reveal>

      {/* ===== достижения ===== */}
      <Reveal delay={80}>
        <div className="mt-8 flex items-end justify-between">
          <div>
            <p className="font-mono2 text-[10.5px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">трофеи</p>
            <h2 className="font-display mt-1 text-[21px] font-extrabold tracking-tight">
              <MaskReveal>Достижения</MaskReveal>
            </h2>
          </div>
          <span className="chip font-mono2 px-3 py-1.5 text-[11px] font-bold text-[var(--tx2)]">
            {ach.length} / {ACHIEVEMENTS.length}
          </span>
        </div>
      </Reveal>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ACHIEVEMENTS.map((a, i) => {
          const got = hasAch(a.id);
          return (
            <Reveal key={a.id} delay={i * 60}>
              <div
                onMouseMove={glareMove}
                className={`with-glare panel relative flex h-full flex-col items-center overflow-hidden p-4 text-center transition-all duration-300 ${got ? "hover:-translate-y-1" : "opacity-60"}`}
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-300 hover:scale-110"
                  style={{
                    color: got ? "var(--accent)" : "var(--tx3)",
                    background: got ? "color-mix(in srgb, var(--accent) 13%, transparent)" : "var(--bg3)",
                    border: `1px solid ${got ? "color-mix(in srgb, var(--accent) 40%, transparent)" : "var(--line-2)"}`,
                    boxShadow: got ? "0 6px 18px -6px color-mix(in srgb, var(--accent) 60%, transparent)" : "none",
                  }}
                >
                  {got ? ACH_ICONS[a.id] : <IconLock />}
                </span>
                <p className="mt-2.5 text-[12px] font-extrabold leading-tight">{a.name}</p>
                <p className="mt-1 text-[10px] leading-snug text-[var(--tx3)]">{a.desc}</p>
                {got && <span className="font-mono2 mt-2 text-[8.5px] font-extrabold uppercase tracking-[0.2em] text-[var(--accent)]">получено</span>}
              </div>
            </Reveal>
          );
        })}
      </div>

      {/* ===== опасность ===== */}
      <Reveal delay={100}>
        <div className="panel mt-8 flex flex-wrap items-center justify-between gap-4 border-[color-mix(in_srgb,var(--danger)_30%,var(--line))] p-5">
          <div>
            <p className="text-[14px] font-extrabold text-[var(--danger)]">Удаление аккаунта</p>
            <p className="mt-0.5 text-[12px] text-[var(--tx3)]">Профиль «{user.username}» будет стёрт с этого устройства. XP лаунчера сохранится.</p>
          </div>
          {confirmDel ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  deleteAccount();
                }}
                className="flex items-center gap-2 rounded-[10px] bg-[var(--danger)] px-4 py-2.5 text-[12.5px] font-extrabold text-white transition-transform hover:scale-[1.03]"
              >
                Да, удалить навсегда
              </button>
              <button onClick={() => setConfirmDel(false)} className="btn-ghost px-4 py-2.5 text-[12.5px]">
                Отмена
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDel(true)}
              className="btn-ghost border-[color-mix(in_srgb,var(--danger)_45%,var(--line-2))] px-4 py-2.5 text-[12.5px] text-[var(--danger)]"
            >
              Удалить аккаунт
            </button>
          )}
        </div>
      </Reveal>

      {/* сводка xp */}
      <Reveal delay={120}>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { l: "всего XP", v: xp.toLocaleString("ru-RU") },
            { l: "уровень", v: String(level) },
            { l: "до бункера", v: level >= BUNKER_LEVEL ? "0" : `${BUNKER_LEVEL - level} ур.` },
            { l: "титул", v: titleName },
          ].map((s) => (
            <div key={s.l} className="panel px-5 py-4">
              <p className="font-mono2 text-[9.5px] font-bold uppercase tracking-[0.2em] text-[var(--tx3)]">{s.l}</p>
              <p className="font-display mt-1.5 truncate text-[17px] font-extrabold">{s.v}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
