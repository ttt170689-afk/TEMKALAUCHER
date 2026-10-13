import {useOnlineAccount} from '../lib/onlineAccount';
import { hasLocalCreatorSignature, LOCAL_CREATOR_SIGNATURE_NOTE } from "../lib/creatorIdentity";
import OnlineIdentity from "./OnlineIdentity";
import FriendsPanel from "./FriendsPanel";
import { prepareAvatar, isCustomAvatar } from "../lib/avatar";
import { USERNAME_MAX_LENGTH } from "../lib/username";
import { useEffect, useRef, useState } from "react";
import { useAuth, AVATAR_COLORS } from "../lib/auth";
import { AVATAR_VARIANTS, AvatarSvg } from "./AvatarSvg";
import { useWaitlist } from "../lib/waitlist";
import { useToast } from "../lib/toast";
import { Reveal, MaskReveal, glareMove } from "./ui";

export default function ProfileView({onFriends}:{onFriends:()=>void}) {
  const { user, updateProfile, rename, logout, deleteAccount } = useAuth();
  const { entries, leave } = useWaitlist();
  const { push } = useToast();
  const online=useOnlineAccount();
  const share=online.mode==='verified'&&!!online.profile;
  const [nameDraft, setNameDraft] = useState(user?.username ?? "");
  const [statusDraft, setStatusDraft] = useState(user?.profile.status ?? "");
  const [confirmDel, setConfirmDel] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarOperation = useRef(0),avatarLock=useRef(false);
  useEffect(() => () => {avatarOperation.current++;}, []);
  const chooseAvatar = async (file: File | undefined) => {
    if (!file||avatarLock.current) return;avatarLock.current=true;
    const expectedOnline=online.client.session?.user.id;
    const operation = ++avatarOperation.current;
    setAvatarBusy(true);
    try {
      const avatar = await prepareAvatar(file);
      if (operation !== avatarOperation.current) return;
      const error = updateProfile({avatar});
      if (error) throw new Error(error);
      if(share){
        try{if(expectedOnline!==online.client.session?.user.id)throw Error('Онлайн-аккаунт изменился. Выбери файл ещё раз.');await online.client.publishAvatar(avatar);await online.refresh();if(operation===avatarOperation.current)push("ok","Аватарка сохранена","Фото доступно в твоём онлайн-профиле.");}
        catch(error){if(operation===avatarOperation.current)push("warn","Фото сохранено только на устройстве","Онлайн-загрузка не завершилась: "+(error instanceof Error?error.message:String(error))+". Выбери файл ещё раз для повтора.");}
      }else push("ok","Аватарка сохранена","Пока только на устройстве. После входа и выбора онлайн-ника выбери фото ещё раз, чтобы сохранить его для других игроков.");
    } catch (error) { if (operation !== avatarOperation.current) return; push("warn", "Не удалось сохранить аватарку", String(error instanceof Error ? error.message : error)); }
    finally {avatarLock.current=false;if (operation === avatarOperation.current) setAvatarBusy(false);}
  };

  const chooseStyle=async(style:string,color=user?.profile.color||'#63e6be')=>{
    if(avatarLock.current)return;avatarLock.current=true;const operation=++avatarOperation.current,expectedOnline=online.client.session?.user.id;setAvatarBusy(true);
    try{
      if(share){await online.client.removePublishedAvatar();if(expectedOnline!==online.client.session?.user.id)throw Error('Онлайн-аккаунт изменился.');await online.client.saveAvatarStyle(style,color);await online.refresh();}
      if(operation!==avatarOperation.current)return;
      const error=updateProfile({avatar:style,color});if(error)throw Error(error);
      push('ok','Аватар обновлён',share?'Изменение видно в онлайн-профиле.':'Сохранён на этом устройстве.');
    }catch(error){push('warn','Не удалось обновить аватар',String(error instanceof Error?error.message:error));}
    finally{avatarLock.current=false;if(operation===avatarOperation.current)setAvatarBusy(false);}
  };

  if (!user) return null;
  const p = user.profile;
  const creatorSignature = hasLocalCreatorSignature(user.username);
  const titleName = "Игрок";
  const created = new Date(user.createdAt);

  const saveName = () => {
    const e = rename(nameDraft);
    if (e) {
      push("warn", "Не получилось сменить имя", e);
      return;
    }
    push("ok", "Имя обновлено", `Теперь ты — ${nameDraft.trim()}`);
  };

  const saveStatus = () => {
    const error = updateProfile({ status: statusDraft.trim().slice(0, 60) || "Игрок миров Temka" });
    if (error) {push("warn", "Ошибка", error); return;}
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
                АЛЬФА
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-[26px] font-extrabold tracking-tight">{user.username}</h1>
                <span
                  data-profile-badge
                  title={creatorSignature ? LOCAL_CREATOR_SIGNATURE_NOTE : "Локальный профиль"}
                  className="chip px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.14em]"
                  style={{ color: p.color, borderColor: `color-mix(in srgb, ${p.color} 45%, transparent)`, background: `color-mix(in srgb, ${p.color} 10%, transparent)` }}
                >
                  {creatorSignature ? "Разработчик" : titleName}
                </span>
              </div>
              <OnlineIdentity/>
              {creatorSignature && <p className="mt-1 text-[11px] text-[var(--tx3)]" title={LOCAL_CREATOR_SIGNATURE_NOTE}>Создатель Temka Studio · локальная подпись, без онлайн-прав</p>}
              <p className="mt-1 text-[13.5px] font-semibold text-[var(--tx2)]">{p.status}</p>
              <div className="font-mono2 mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-[var(--tx3)]">
                <span title="Почта, указанная при локальной регистрации">Локальная почта: {user.email}</span>
                <span className="text-[var(--accent)]">·</span>
                <span>
                  профиль с {created.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
            </div>
            <button onClick={()=>{const error=logout();if(error)push("warn","Не удалось выйти",error);}} className="btn-ghost flex-none self-start px-5 py-2.5 text-[13px] sm:self-auto">
              Выйти из аккаунта
            </button>
          </div>


        </div>
      </Reveal>

      <FriendsPanel key={user.id} localUser={user} onFriends={onFriends} />

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

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <label className="btn-ghost cursor-pointer px-4 py-2 text-[12px]">
                {avatarBusy ? "Обработка…" : "Загрузить свою аватарку"}
                <input aria-label="Загрузить свою аватарку" type="file" accept="image/png,image/jpeg,image/webp" disabled={avatarBusy} className="sr-only" onChange={event => {const file = event.target.files?.[0]; event.target.value = ""; void chooseAvatar(file);}} />
              </label>
              {isCustomAvatar(p.avatar) && <button disabled={avatarBusy} className="btn-ghost px-3 py-2 text-[12px]" onClick={() => void chooseStyle("cube")}>Убрать фото</button>}
            </div>
            <p className="mt-2 text-[11px] text-[var(--tx3)]">PNG, JPG, WebP до 5 МБ. Обрезка до 512×512. {share?'При выборе нового фото оно сохраняется и онлайн: его увидят другие игроки. Онлайн-фото хранится по публичной ссылке.':'Сейчас фото остаётся только на устройстве. Для онлайн-аватарки сначала войди и сохрани юзернейм.'}</p>
            <p className="mt-5 text-[11px] font-extrabold uppercase tracking-wider text-[var(--tx3)]">Вариант</p>
            <div className="mt-2.5 grid grid-cols-8 gap-2">
              {AVATAR_VARIANTS.map((v) => (
                <button
                  key={v}
                  disabled={avatarBusy}
                  onClick={() => void chooseStyle(v)}
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
                  disabled={avatarBusy} onClick={() => {if(isCustomAvatar(p.avatar)){const e=updateProfile({color:c});if(e)push("warn","Ошибка",e);}else void chooseStyle(p.avatar,c);}}
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
                <MaskReveal>Имя и статус</MaskReveal>
              </h2>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-[var(--tx3)]">Имя на устройстве · {nameDraft.length}/{USERNAME_MAX_LENGTH}</span>
                <div className="flex gap-2">
                  <input aria-label="Имя на устройстве" className="input-tl min-w-0 flex-1 px-4 py-2.5 text-[13.5px]" value={nameDraft} maxLength={USERNAME_MAX_LENGTH} onChange={(e) => setNameDraft(e.target.value)} />
                  <button onClick={saveName} className="btn-primary flex-none px-4 py-2.5 text-[12.5px]" disabled={nameDraft.trim() === user.username}>
                    Сохранить имя
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


        </div>
      </div>

      {/* ===== лист ожидания ===== */}
      <Reveal delay={60}>
        <div className="mt-8 flex items-end justify-between">
          <div>
            <p className="font-mono2 text-[10.5px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">локальные закладки</p>
            <h2 className="font-display mt-1 text-[21px] font-extrabold tracking-tight">
              <MaskReveal>Вишлист</MaskReveal>
            </h2>
          </div>
          <span className="chip font-mono2 px-3 py-1.5 text-[11px] font-bold text-[var(--tx2)]">{entries.length}</span>
        </div>
      </Reveal>
      <Reveal delay={100}>
        {entries.length === 0 ? (
          <div className="panel mt-4 border-dashed p-5 text-center text-[13px] font-semibold text-[var(--tx3)]" style={{ borderStyle: "dashed" }}>
            Пока пусто. Добавьте игру из библиотеки одним нажатием — без почты.
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
                      Добавлено {new Date(e.date).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                  <span className="chip px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[var(--accent-2)]">сохранено</span>
                  <button
                    onClick={() => {
                      if (leave(e.game)) push("info", "Убрано из вишлиста", label); else push("warn", "Не удалось сохранить изменение");
                    }}
                    className="btn-ghost px-3.5 py-2 text-[12px] text-[var(--tx2)]"
                  >
                    Убрать
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Reveal>

      <Reveal delay={100}>
        <div className="panel mt-8 flex flex-wrap items-center justify-between gap-4 border-[color-mix(in_srgb,var(--danger)_30%,var(--line))] p-5">
          <div>
            <p className="text-[14px] font-extrabold text-[var(--danger)]">Удаление локального профиля</p>
            <p className="mt-0.5 text-[12px] text-[var(--tx3)]">Профиль «{user.username}» будет стёрт с этого устройства. Общий вишлист сохранится. Онлайн-аккаунт и друзья не удаляются.</p>
          </div>
          {confirmDel ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const error=deleteAccount();if(error)push("warn","Не удалось удалить профиль",error);
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


    </div>
  );
}
