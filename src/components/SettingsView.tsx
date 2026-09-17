import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ACCENTS, useSettings } from "../lib/settings";
import { useToast } from "../lib/toast";
import { usePwaInstall, isStandalone } from "../lib/pwa";
import { inDesktop, quitApp } from "../lib/neutralino";
import { Reveal, Toggle, MaskReveal, IconCheck, IconDownload, IconSpark } from "./ui";

/* ---------- helpers ---------- */
function Row({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-t border-[var(--line)] px-5 py-4 first:border-t-0">
      <div className="min-w-0">
        <p className="text-[14px] font-extrabold">{title}</p>
        {desc && <p className="mt-0.5 text-[12px] leading-snug text-[var(--tx3)]">{desc}</p>}
      </div>
      <div className="flex flex-none items-center gap-3">{children}</div>
    </div>
  );
}

function Section({ title, icon, children, delay = 0 }: { title: string; icon: ReactNode; children: ReactNode; delay?: number }) {
  return (
    <Reveal delay={delay}>
      <div className="panel overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg2)_70%,transparent)] px-5 py-3.5">
          <span className="text-[var(--accent)]">{icon}</span>
          <h3 className="font-display text-[13.5px] font-extrabold uppercase tracking-[0.12em]">{title}</h3>
        </div>
        {children}
      </div>
    </Reveal>
  );
}

function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        className="rng w-36"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--fill": `${pct}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="font-mono2 w-20 text-right text-[11.5px] font-bold text-[var(--tx2)]">
        {format ? format(value) : value}
      </span>
    </div>
  );
}

/* ---------- view ---------- */
export default function SettingsView() {
  const { s, set, reset, savedTick } = useSettings();
  const { push } = useToast();
  const pwa = usePwaInstall();
  const [checking, setChecking] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const first = useRef(true);

  // "сохранено" flash
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setShowSaved(true);
    const id = window.setTimeout(() => setShowSaved(false), 1400);
    return () => window.clearTimeout(id);
  }, [savedTick]);

  const checkUpdates = () => {
    // запуск встроенной проверки: плашка обновления внизу экрана покажет результат
    window.dispatchEvent(new CustomEvent("temka-check-updates"));
    setChecking(true);
    window.setTimeout(() => {
      setChecking(false);
      const w = window as unknown as { temka?: { launchUpdater?: () => Promise<boolean> } };
      // а в десктоп-версии по желанию можно открыть и отдельный апдейтер
      if (w.temka?.launchUpdater) {
        push("info", "Проверка запущена", "Плашка обновления появится внизу, если найдётся новая версия.");
      }
    }, 900);
  };

  return (
    <div className="mx-auto max-w-[860px] px-5 pb-14 pt-6 lg:px-8">
      {/* header */}
      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono2 text-[10.5px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">конфигурация</p>
            <h2 className="font-display mt-1.5 text-[26px] font-extrabold tracking-tight">
              <MaskReveal>Настройки лаунчера</MaskReveal>
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {showSaved && (
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="chip flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-extrabold text-[var(--accent-2)]"
                >
                  <IconCheck /> Сохранено
                </motion.span>
              )}
            </AnimatePresence>
            <button
              onClick={() => {
                reset();
                push("info", "Настройки сброшены", "Возвращены значения по умолчанию.");
              }}
              className="btn-ghost px-4 py-2 text-[12.5px]"
            >
              Сбросить всё
            </button>
          </div>
        </div>
        <p className="mt-2 text-[13px] text-[var(--tx3)]">Изменения применяются мгновенно и сохраняются автоматически на этом устройстве.</p>
      </Reveal>

      <div className="mt-7 flex flex-col gap-5">
        {/* ===== appearance ===== */}
        <Section title="Внешний вид" delay={60} icon={<IconSpark />}>
          <div className="px-5 py-4">
            <p className="text-[14px] font-extrabold">Акцентный цвет</p>
            <p className="mt-0.5 text-[12px] text-[var(--tx3)]">Окрашивает кнопки, прогресс, курсор и свечение лаунчера.</p>
            <div className="mt-3.5 flex flex-wrap gap-2.5">
              {ACCENTS.map((a) => {
                const active = s.accent === a.hex;
                return (
                  <button
                    key={a.hex}
                    onClick={() => set("accent", a.hex)}
                    className={`group flex items-center gap-2.5 rounded-[11px] border px-3 py-2 transition-all duration-200 ${
                      active ? "border-[var(--line-2)] bg-[var(--bg3)]" : "border-[var(--line)] hover:border-[var(--line-2)]"
                    }`}
                  >
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full transition-transform group-hover:scale-110"
                      style={{ background: a.hex, boxShadow: active ? `0 0 14px ${a.hex}aa` : "none" }}
                    >
                      {active && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#14100b" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </span>
                    <span className={`text-[12.5px] font-bold ${active ? "text-[var(--tx)]" : "text-[var(--tx2)]"}`}>{a.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <Row title="Тема оформления" desc="«Глубокая ночь» делает фон почти чёрным для ночных сессий.">
            <div className="flex gap-1 rounded-[10px] border border-[var(--line-2)] bg-[var(--bg1)] p-1">
              {(
                [
                  { id: "graphite", label: "Графит" },
                  { id: "deep", label: "Глубокая ночь" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => set("theme", t.id)}
                  className={`rounded-[7px] px-3.5 py-1.5 text-[12px] font-extrabold transition-all ${
                    s.theme === t.id ? "bg-accent text-[var(--bg0)]" : "text-[var(--tx2)] hover:text-[var(--tx)]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Row>
          <Row title="Фоновые частицы" desc="Парящие искры на заднем плане лаунчера.">
            <Slider
              value={s.particleDensity}
              min={20}
              max={140}
              step={10}
              onChange={(v) => set("particleDensity", v)}
              format={(v) => `${v} шт`}
            />
            <Toggle on={s.particles} onChange={(v) => set("particles", v)} label="Частицы" />
          </Row>
          <Row title="Уменьшить анимации" desc="Отключает параллакс, бегущие строки и плавные появления.">
            <Toggle on={s.reducedMotion} onChange={(v) => set("reducedMotion", v)} label="Уменьшить анимации" />
          </Row>
        </Section>

        {/* ===== cursor ===== */}
        <Section title="Кастомный курсор" delay={120} icon={
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="m4 4 7.5 16.5 2.2-6.8 6.8-2.2L4 4Z" />
          </svg>
        }>
          <Row title="Кастомный курсор" desc="Точка и кольцо вместо системного курсора. Работает на устройствах с мышью.">
            <Toggle on={s.customCursor} onChange={(v) => set("customCursor", v)} label="Кастомный курсор" />
          </Row>
          <Row title="Искры" desc="За курсором летят угасающие искры акцентных цветов.">
            <Toggle on={s.cursorTrail} onChange={(v) => set("cursorTrail", v)} label="Искры" />
          </Row>
          <Row title="Хвост кометы" desc="Гладкий светящийся шлейф из трёх слоёв, тянется за кольцом.">
            <Toggle on={s.cursorRibbon} onChange={(v) => set("cursorRibbon", v)} label="Хвост кометы" />
          </Row>
          <Row title="Энерго-заряд" desc="Движение заряжает дугу вокруг кольца. На 100% — взрыв искр.">
            <Toggle on={s.cursorCharge} onChange={(v) => set("cursorCharge", v)} label="Энерго-заряд" />
          </Row>
          <Row title="Аура-свечение" desc="Мягкое радиальное свечение вокруг кольца, растёт от скорости.">
            <Toggle on={s.cursorGlow} onChange={(v) => set("cursorGlow", v)} label="Аура" />
          </Row>
          <Row title="Тег игрока" desc="Игровая плашка «LVL 0» рядом с кольцом курсора.">
            <Toggle on={s.playerTag} onChange={(v) => set("playerTag", v)} label="Тег игрока" />
          </Row>
          <Row title="Размер кольца" desc="Диаметр кольца, реагирующего на наведение.">
            <Slider value={s.ringSize} min={26} max={64} step={2} onChange={(v) => set("ringSize", v)} format={(v) => `${v}px`} />
          </Row>
        </Section>

        {/* ===== downloads ===== */}
        <Section title="Загрузки и обновления" delay={180} icon={<IconDownload />}>
          <div className="px-5 py-4">
            <p className="text-[14px] font-extrabold">Папка для игр</p>
            <p className="mt-0.5 text-[12px] text-[var(--tx3)]">Сюда будут установлены TemkaWorld и Fantazia RP после релиза.</p>
            <div className="mt-3 flex gap-2">
              <input
                className="input-tl font-mono2 min-w-0 flex-1 px-4 py-2.5 text-[12.5px]"
                value={s.downloadPath}
                onChange={(e) => set("downloadPath", e.target.value)}
              />
              <button
                onClick={() => push("info", "Выбор папки", "Диалог выбора станет доступен вместе с установкой игр.")}
                className="btn-ghost flex-none px-4 py-2.5 text-[12.5px]"
              >
                Обзор…
              </button>
            </div>
          </div>
          <Row title="Ограничение скорости" desc="Чтобы стримить и качать одновременно без лагов.">
            <Slider
              value={s.speedLimit}
              min={0}
              max={100}
              step={5}
              onChange={(v) => set("speedLimit", v)}
              format={(v) => (v === 0 ? "без лимита" : `${v} МБ/с`)}
            />
          </Row>
          <Row title="Проверять при запуске" desc="Сразу после входа лаунчер спросит сервер обновлений.">
            <Toggle on={s.autoUpdates} onChange={(v) => set("autoUpdates", v)} label="Проверка при запуске" />
          </Row>
          <Row title="Проверять каждые 5 минут" desc="Фоновая проверка — новое обновление найдётся само, без кнопок.">
            <Toggle on={s.periodicCheck} onChange={(v) => set("periodicCheck", v)} label="Проверка каждые 5 минут" />
          </Row>
          <Row title="Устанавливать автоматически" desc="Нашёл обновление — сам скачал и заменил файлы. Тебе останется нажать «Перезапустить».">
            <Toggle on={s.autoInstall} onChange={(v) => set("autoInstall", v)} label="Автоустановка" />
          </Row>
          <Row title="Закрывать лаунчер при запуске игры" desc="Освобождает память под игровой клиент.">
            <Toggle on={s.closeOnLaunch} onChange={(v) => set("closeOnLaunch", v)} label="Закрывать при запуске" />
          </Row>
        </Section>

        {/* ===== notifications ===== */}
        <Section title="Уведомления" delay={240} icon={
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
        }>
          <Row title="Всплывающие уведомления" desc="Тосты о событиях лаунчера в правом нижнем углу.">
            <Toggle on={s.notifications} onChange={(v) => set("notifications", v)} label="Уведомления" />
          </Row>
          <Row title="Звуки интерфейса" desc="Клики, переходы и фанфары уровня — синтезируются на лету, без файлов.">
            <Toggle on={s.sounds} onChange={(v) => set("sounds", v)} label="Звуки" />
          </Row>
          <div className="border-t border-[var(--line)] px-5 py-4">
            <button
              onClick={checkUpdates}
              disabled={checking}
              className="btn-primary flex items-center gap-2.5 px-5 py-2.5 text-[13px] disabled:opacity-70"
            >
              {checking ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="spin">
                    <path d="M21 12a9 9 0 1 1-6.2-8.56" />
                  </svg>
                  Проверяем…
                </>
              ) : (
                <>Проверить обновления лаунчера</>
              )}
            </button>
          </div>
        </Section>

        {/* ===== about ===== */}
        <Reveal delay={280}>
          <div className="panel flex flex-col items-center gap-3 p-7 text-center">
            <svg width="40" height="40" viewBox="0 0 32 32">
              <path d="M16 2 28 9v14L16 30 4 23V9z" fill="var(--accent)" />
              <path d="M10 12h12v3.4h-4.2V23h-3.6v-7.6H10z" fill="var(--bg0)" />
            </svg>
            <div>
              <p className="font-display text-[15px] font-extrabold">TemkaLauncher</p>
              <p className="font-mono2 mt-1 text-[11.5px] font-semibold text-[var(--tx3)]">
                версия{" "}
                {(window as unknown as { temka?: { version?: string } }).temka?.version ?? "1.2.0"} · сборка 1247 ·
                канал stable ·{" "}
                {((window as unknown as { temka?: { platform?: string } }).temka?.platform ?? isStandalone() ? "app" : "web")}
              </p>
            </div>
            {(pwa.canInstall || pwa.installed) && (
              <div className="mt-4 flex items-center gap-3">
                {pwa.canInstall ? (
                  <button
                    onClick={async () => {
                      const ok = await pwa.promptInstall();
                      if (ok) push("ok", "Установка запущена", "Подтверди в появившемся окне — и лаунчер станет приложением.");
                    }}
                    className="btn-ghost flex items-center gap-2 border-[color-mix(in_srgb,var(--accent-2)_40%,var(--line-2))] px-4 py-2.5 text-[12.5px] text-[var(--accent-2)]"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
                      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                    </svg>
                    Установить как приложение
                  </button>
                ) : (
                  <span className="chip flex items-center gap-2 px-3.5 py-2 text-[12px] font-extrabold text-[var(--accent-2)]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    Работает как приложение
                  </span>
                )}
                <span className="text-[11px] text-[var(--tx3)]">
                  {pwa.installed ? "Отдельное окно, иконка, офлайн." : "Без Electron: своё окно, иконка и работа без сети."}
                </span>
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              {["История версий", "Лицензия", "Discord студии", "Сообщить о баге"].map((l) => (
                <button
                  key={l}
                  onClick={() => push("info", l, "Ссылка откроется в полной версии лаунчера.")}
                  className="chip px-3.5 py-1.5 text-[12px] font-bold text-[var(--tx2)] transition-colors hover:text-[var(--tx)]"
                >
                  {l}
                </button>
              ))}
            </div>
            <p className="text-[11.5px] text-[var(--tx3)]">© 2026 Temka Studio. Сделано с ♥ и кубометрами кофе.</p>
            {inDesktop() && (
              <button
                onClick={quitApp}
                className="btn-ghost mt-1 flex items-center gap-2 border-[color-mix(in_srgb,var(--danger)_40%,var(--line-2))] px-5 py-2.5 text-[12.5px] text-[var(--danger)]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="m16 17 5-5-5-5M21 12H9" />
                </svg>
                Закрыть лаунчер
              </button>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  );
}
