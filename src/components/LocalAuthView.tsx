import { USERNAME_MAX_LENGTH } from "../lib/username";
import { useMemo, useState } from "react";
import { useAuth, isBadName } from "../lib/auth";
import { useToast } from "../lib/toast";
import { sfx } from "../lib/sound";
import { ParkScene } from "./Art";
import { ScrambleText, IconLock } from "./ui";

type Tab = "login" | "register";

function passStrength(p: string): { score: 0 | 1 | 2 | 3; label: string } {
  let s = 0;
  if (p.length >= 6) s++;
  if (p.length >= 10) s++;
  if (/[A-ZА-Я]/.test(p) && /[0-9]/.test(p)) s++;
  const label = p.length === 0 ? "" : s <= 1 ? "слабый" : s === 2 ? "средний" : "надёжный";
  return { score: Math.min(3, s) as 0 | 1 | 2 | 3, label };
}

export default function LocalAuthView() {
  const { register, login } = useAuth();
  const { push } = useToast();

  const [tab, setTab] = useState<Tab>("register");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // регистрация
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [agree, setAgree] = useState(false);

  // вход
  const [ident, setIdent] = useState("");
  const [lpass, setLpass] = useState("");

  const bad = name.trim().length >= 3 && isBadName(name);
  const strength = useMemo(() => passStrength(pass), [pass]);

  const submitRegister = async () => {
    setErr("");
    if (bad) {
      setErr("Имя заблокировано фильтром плохих слов.");
      sfx.deny();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setErr("Похоже, в почте ошибка.");
      sfx.deny();
      return;
    }
    if (pass.length < 6) {
      setErr("Пароль должен быть не короче 6 символов.");
      sfx.deny();
      return;
    }
    if (pass !== pass2) {
      setErr("Пароли не совпадают.");
      sfx.deny();
      return;
    }
    if (!agree) {
      setErr("Нужно согласиться с правилами парка.");
      sfx.deny();
      return;
    }
    setBusy(true);
    const e = await register(name, email, pass);
    setBusy(false);
    if (e) {
      setErr(e);
      sfx.deny();
      return;
    }
    sfx.level();
    push("ok", `Добро пожаловать, ${name.trim()}!`, "Локальный профиль создан.");
  };

  const submitLogin = async () => {
    setErr("");
    if (!ident.trim() || !lpass) {
      setErr("Введите ник (или почту) и пароль.");
      sfx.deny();
      return;
    }
    setBusy(true);
    const e = await login(ident, lpass);
    setBusy(false);
    if (e) {
      setErr(e);
      sfx.deny();
      return;
    }
    sfx.nav();
    push("ok", "С возвращением!", "Профиль загружен.");
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    setErr("");
  };

  return (
    <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-y-auto tl-scroll p-5">
      <div className="anim-border panel grid w-full max-w-[880px] overflow-hidden lg:grid-cols-[1fr_1.05fr]" style={{ borderRadius: 18, boxShadow: "0 40px 100px -30px rgba(0,0,0,0.85)" }}>
        {/* брендинг */}
        <div className="relative hidden min-h-[520px] overflow-hidden lg:block">
          <ParkScene className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-r from-[rgba(6,8,12,0.2)] via-[rgba(6,8,12,0.55)] to-[rgba(6,8,12,0.92)]" />
          <div className="relative flex h-full flex-col justify-between p-7">
            <div className="flex items-center gap-3">
              <svg width="38" height="38" viewBox="0 0 32 32" className="drop-shadow-[0_4px_14px_color-mix(in_srgb,var(--accent)_45%,transparent)]">
                <path d="M16 2 28 9v14L16 30 4 23V9z" fill="var(--accent)" />
                <path d="M10 12h12v3.4h-4.2V23h-3.6v-7.6H10z" fill="var(--bg0)" />
              </svg>
              <div>
                <p className="font-display text-[15px] font-extrabold leading-none">
                  TEMKA<span className="text-accent">.</span>
                </p>
                <p className="font-mono2 mt-1 text-[8.5px] font-bold uppercase tracking-[0.28em] text-[var(--tx3)]">launcher</p>
              </div>
            </div>
            <div>
              <p className="font-mono2 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--accent)]">добро пожаловать</p>
              <h1 className="font-display mt-3 text-[26px] font-extrabold leading-tight">
                Добро пожаловать
                <br />в <span className="text-accent">TemkaLauncher</span>
              </h1>
              <p className="mt-3 max-w-[38ch] text-[12.5px] leading-relaxed text-[var(--tx2)]">
                Единый портал в миры Temka: игры, новости, профиль и достижения — всё в одном месте.
              </p>
              <ul className="mt-5 flex flex-col gap-2.5">
                {[
                  "TemkaWorld и Fantazia RP в одной библиотеке",
                  "Вишлист в один клик — без почты",
                  "Кастомный курсор, темы и кастомизация профиля",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-[12.5px] font-semibold text-[var(--tx2)]">
                    <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <p className="font-mono2 text-[9px] font-semibold uppercase tracking-[0.24em] text-[var(--tx3)]">
              © 2026 temka studio · аккаунты хранятся локально
            </p>
          </div>
        </div>

        {/* форма */}
        <div className="p-6 sm:p-8">
          <div className="mb-6 lg:hidden">
            <p className="font-display text-[18px] font-extrabold">
              TEMKA<span className="text-accent">.</span>LAUNCHER
            </p>
          </div>

          <h2 className="font-display text-[22px] font-extrabold tracking-tight">
            <ScrambleText text={tab === "register" ? "РЕГИСТРАЦИЯ" : "ВХОД В АККАУНТ"} />
          </h2>
          <p className="mt-1.5 text-[13px] text-[var(--tx2)]">
            {tab === "register"
              ? "Создай игрока — система строго фильтрует плохие имена."
              : "Введи ник или почту, чтобы продолжить."}
          </p>

          {/* табы */}
          <div className="mt-5 flex gap-1 rounded-[11px] border border-[var(--line-2)] bg-[var(--bg1)] p-1">
            {(
              [
                { id: "register", label: "Регистрация" },
                { id: "login", label: "Вход" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className={`flex-1 rounded-[8px] py-2.5 text-[13px] font-extrabold transition-all ${
                  tab === t.id ? "bg-accent text-[var(--bg0)] shadow-[0_4px_16px_-4px_var(--accent)]" : "text-[var(--tx2)] hover:text-[var(--tx)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "register" ? (
            <div className="mt-5 flex flex-col gap-3.5">
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-[var(--tx3)]">
                  Ник игрока · {name.length}/{USERNAME_MAX_LENGTH}
                  {name.trim().length >= 3 && (
                    <span className={bad ? "text-[var(--danger)]" : "text-[var(--accent-2)]"}>
                      {bad ? "заблокировано фильтром" : "фильтр пройден · не проверка занятости"}
                    </span>
                  )}
                </span>
                <input
                  className={`input-tl w-full px-4 py-3 text-[14px] ${bad ? "!border-[var(--danger)]" : ""}`}
                  placeholder="Temka_Игрок"
                  value={name}
                  maxLength={USERNAME_MAX_LENGTH}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-[var(--tx3)]">E-mail</span>
                <input className="input-tl w-full px-4 py-3 text-[14px]" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-[var(--tx3)]">
                    Пароль
                    {strength.label && (
                      <span className={strength.score <= 1 ? "text-[var(--danger)]" : strength.score === 2 ? "text-[#ffd28a]" : "text-[var(--accent-2)]"}>
                        {strength.label}
                      </span>
                    )}
                  </span>
                  <input className="input-tl w-full px-4 py-3 text-[14px]" type="password" placeholder="••••••" value={pass} onChange={(e) => setPass(e.target.value)} />
                  <span className="mt-1.5 flex gap-1">
                    {[1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className="h-1 flex-1 rounded-full transition-colors duration-300"
                        style={{
                          background:
                            strength.score >= i
                              ? strength.score <= 1
                                ? "var(--danger)"
                                : strength.score === 2
                                  ? "#ffd28a"
                                  : "var(--accent-2)"
                              : "var(--bg3)",
                        }}
                      />
                    ))}
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-[var(--tx3)]">Повтори пароль</span>
                  <input
                    className={`input-tl w-full px-4 py-3 text-[14px] ${pass2 && pass !== pass2 ? "!border-[var(--danger)]" : ""}`}
                    type="password"
                    placeholder="••••••"
                    value={pass2}
                    onChange={(e) => setPass2(e.target.value)}
                  />
                </label>
              </div>
              <button onClick={() => setAgree(!agree)} className="flex items-start gap-2.5 text-left">
                <span
                  className={`mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border transition-all ${
                    agree ? "border-[var(--accent)] bg-accent text-[var(--bg0)]" : "border-[var(--line-2)]"
                  }`}
                >
                  {agree && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </span>
                <span className="text-[12px] leading-snug text-[var(--tx2)]">
                  Принимаю правила парка: не кормить Демона, слушаться Артёма, скины у Серёги покупать честно.
                </span>
              </button>
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-3.5">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-[var(--tx3)]">Ник или e-mail</span>
                <input className="input-tl w-full px-4 py-3 text-[14px]" placeholder="Temka_Игрок" value={ident} onChange={(e) => setIdent(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-[var(--tx3)]">Пароль</span>
                <input
                  className="input-tl w-full px-4 py-3 text-[14px]"
                  type="password"
                  placeholder="••••••"
                  value={lpass}
                  onChange={(e) => setLpass(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitLogin()}
                />
              </label>
              <p className="flex items-center gap-2 text-[11.5px] text-[var(--tx3)]">
                <IconLock /> Пароли хранятся в виде SHA-256 хэша, локально на этом устройстве.
              </p>
            </div>
          )}

          {err && (
            <p className="shake mt-3 rounded-[10px] border border-[color-mix(in_srgb,var(--danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-3.5 py-2.5 text-[12.5px] font-bold text-[var(--danger)]">
              {err}
            </p>
          )}

          <button
            onClick={tab === "register" ? submitRegister : submitLogin}
            disabled={busy}
            className="btn-primary mt-5 flex w-full items-center justify-center gap-2.5 py-3.5 text-[14px] disabled:opacity-70"
          >
            {busy ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="spin">
                  <path d="M21 12a9 9 0 1 1-6.2-8.56" />
                </svg>
                Секунду…
              </>
            ) : tab === "register" ? (
              "Создать аккаунт"
            ) : (
              "Войти в лаунчер"
            )}
          </button>

          <p className="mt-4 text-center text-[11.5px] text-[var(--tx3)]">
            {tab === "register" ? "Уже есть аккаунт? " : "Ещё нет аккаунта? "}
            <button onClick={() => switchTab(tab === "register" ? "login" : "register")} className="font-bold text-[var(--accent)] transition-colors hover:text-[var(--tx)]">
              {tab === "register" ? "Войти" : "Зарегистрироваться"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
