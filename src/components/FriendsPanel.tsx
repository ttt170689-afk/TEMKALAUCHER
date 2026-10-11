import { useEffect, useMemo, useRef, useState } from 'react';
import type { Account } from '../lib/auth';
import { CloudClient, onlineEnabled, onlineAvatar } from '../lib/online';
import type { OnlineProfile, Friendship } from '../lib/online';
import { isCustomAvatar } from '../lib/avatar';

const inputClass = 'mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--bg0)] px-3 py-2 text-[13px] text-[var(--tx)]';
const buttonClass = 'btn-ghost px-4 py-2 text-[12px] disabled:opacity-50';
function Person({person}: {person: {id:string; username:string; has_avatar:boolean; avatar_version:number; is_creator:boolean}}) {
  return <div className="flex min-w-0 items-center gap-3">
    {person.has_avatar ? <img src={onlineAvatar(person.id,person.avatar_version)} alt="Аватар игрока" className="h-10 w-10 flex-none rounded-full object-cover" onError={event=>{event.currentTarget.style.visibility='hidden';}}/> : <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-[var(--bg3)] font-bold text-[var(--accent)]">{person.username[0]?.toUpperCase()}</span>}
    <div className="min-w-0"><strong className="break-all text-[13px]">@{person.username}</strong>{person.is_creator && <p className="text-[11px] text-[var(--accent)]">Создатель · Администратор</p>}</div>
  </div>;
}
export default function FriendsPanel({localUser}: {localUser:Account}) {
  const client = useMemo(()=>new CloudClient(localUser.id),[localUser.id]);
  const [signedIn,setSignedIn] = useState(!!client.session);
  const [profile,setProfile] = useState<OnlineProfile|null>(null);
  const [friends,setFriends] = useState<Friendship[]>([]);
  const [results,setResults] = useState<OnlineProfile[]>([]);
  const [queried,setQueried] = useState(false);
  const [email,setEmail] = useState(localUser.email);
  const [sentEmail,setSentEmail] = useState('');
  const [code,setCode] = useState('');
  const [username,setUsername] = useState(localUser.username);
  const [query,setQuery] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [cooldown,setCooldown] = useState(0);
  const alive = useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const refresh = async () => {
    const [own,rows] = await Promise.all([client.ownProfile(),client.friends()]);
    if(!alive.current)return;
    setProfile(own);setFriends(rows);setSignedIn(!!client.session);
    if(own)setUsername(own.username);
  };
  async function perform(action:()=>Promise<void>) {
    if(busy)return;setBusy(true);setError('');setNotice('');
    try {await action();} catch(e) {if(alive.current)setError(e instanceof Error ? e.message : 'Не удалось связаться с сервером.');}
    finally {if(alive.current){setBusy(false);setSignedIn(!!client.session);}}
  }
  useEffect(()=>{
    if(onlineEnabled&&client.session) {setBusy(true);refresh().catch(e=>{if(alive.current)setError(String(e.message));}).finally(()=>{if(alive.current)setBusy(false);});}
    // Client lifetime is bound to the local profile, never shared with another profile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[client]);
  useEffect(()=>{if(!cooldown)return;const timer=window.setTimeout(()=>setCooldown(c=>Math.max(0,c-1)),1000);return()=>clearTimeout(timer);},[cooldown]);
  return <section aria-labelledby="friends-title" className="panel mt-7 p-6">
    <p className="font-mono2 text-[10px] font-bold uppercase tracking-[.2em] text-[var(--accent)]">TEMKA / ДРУЗЬЯ</p>
    <h2 id="friends-title" className="font-display mt-2 text-[22px] font-extrabold">Играть интереснее вместе.</h2>
    {!onlineEnabled ? <div className="mt-4 rounded-xl border border-[var(--line)] p-4">
      <p className="text-[13px] font-bold">Сервер друзей ещё не подключён</p>
      <p className="mt-2 text-[12px] leading-relaxed text-[var(--tx3)]">Настоящий поиск по юзернейму появится после подключения общей базы аккаунтов владельцем проекта. В этой сборке нет выдуманных игроков и локального поиска, выдаваемого за онлайн.</p>
      <p className="mt-2 text-[12px] text-[var(--tx3)]">Своя аватарка уже доступна ниже. Общий вход в игры — отдельный будущий этап.</p>
    </div> : <>
      <p className="mt-3 text-[12px] leading-relaxed text-[var(--tx3)]">Это онлайн-профиль для друзей, отдельно от локального профиля лаунчера. Вход — по коду на почту. Электронная почта не видна другим игрокам. Вход в игры ещё не подключён.</p>
      {!signedIn ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-[12px]">Почта для онлайн-профиля<input className={inputClass} type="email" value={email} maxLength={254} disabled={busy} onChange={e=>{setEmail(e.target.value);setSentEmail('');setCode('');}} autoComplete="email"/></label>
        <div className="flex items-end"><button disabled={busy||cooldown>0} className={buttonClass} onClick={()=>void perform(async()=>{const address=email.trim().toLowerCase();await client.sendCode(address);if(alive.current){setSentEmail(address);setCooldown(60);setNotice('Сервис принял запрос. Проверь почту и папку «Спам». Доставка зависит от настроек почтового сервиса.');}})}>{cooldown ? `Повторить через ${cooldown} с` : 'Получить код на почту'}</button></div>
        {sentEmail && <><label className="text-[12px]">Код из письма<input className={inputClass} inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} disabled={busy}/></label><div className="flex items-end"><button className={buttonClass} disabled={busy} onClick={()=>void perform(async()=>{await client.verifyCode(sentEmail,code);if(!alive.current)return;setCode('');setSignedIn(true);await refresh();})}>Подтвердить почту</button></div></>}
      </div> : <>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] p-3">
          {profile ? <Person person={profile}/> : <span className="text-[12px]">Почта подтверждена. Выбери онлайн-юзернейм.</span>}
          <button disabled={busy} className={buttonClass} onClick={()=>void perform(async()=>{try{await client.logout();}finally{if(alive.current){setProfile(null);setFriends([]);setResults([]);setQueried(false);setSignedIn(false);}}})}>Выйти из онлайн-профиля</button>
        </div>
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();void perform(async()=>{await client.saveUsername(username);await refresh();if(alive.current)setNotice('Онлайн-юзернейм сохранён. Локальный ник не менялся.');});}}>
          <label className="min-w-0 flex-1 text-[12px]">Онлайн-юзернейм<input className={inputClass} value={username} maxLength={25} onChange={e=>setUsername(e.target.value)} disabled={busy}/></label><button className={buttonClass} disabled={busy}>Сохранить онлайн-ник</button>
        </form>
        {profile && <>
          <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy||!isCustomAvatar(localUser.profile.avatar)} className={buttonClass} onClick={()=>void perform(async()=>{await client.publishAvatar(localUser.profile.avatar);await refresh();if(alive.current)setNotice('Аватарка опубликована. Теперь изображение доступно другим игрокам.');})}>Опубликовать аватарку для друзей</button>{profile.has_avatar&&<button disabled={busy} className={buttonClass} onClick={()=>void perform(async()=>{await client.removePublishedAvatar();await refresh();})}>Удалить опубликованную аватарку</button>}</div>
          <p className="mt-2 text-[11px] text-[var(--tx3)]">Публикация добровольная: картинка станет публичной. Локальная аватарка сама на сервер не отправляется.</p>
          <form className="mt-5 flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();setQueried(false);setResults([]);void perform(async()=>{const rows=await client.search(query);if(alive.current){setResults(rows);setQueried(true);}});}}>
            <label className="min-w-0 flex-1 text-[12px]">Найти друга по точному юзернейму<input className={inputClass} placeholder="@юзернейм" value={query} maxLength={26} onChange={e=>{setQuery(e.target.value);setQueried(false);setResults([]);}} disabled={busy}/></label><button className={buttonClass} disabled={busy}>Найти друга</button>
          </form>
          {queried&&!results.length&&<p className="mt-3 text-[12px] text-[var(--tx3)]">Пользователь с таким онлайн-юзернеймом не найден.</p>}
          {results.map(person=><div key={person.id} className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] p-3"><Person person={person}/>{person.id===client.session?.user.id?<span className="text-[11px]">Это ты</span>:friends.some(f=>f.other_id===person.id)?<span className="text-[11px]">Уже в списке друзей или заявок</span>:<button className={buttonClass} disabled={busy} onClick={()=>void perform(async()=>{await client.invite(person.id);await refresh();if(alive.current)setNotice('Заявка отправлена. Друг должен её принять.');})}>Добавить в друзья</button>}</div>)}
          <div className="mt-6 flex items-center justify-between gap-3"><h3 className="text-[14px] font-bold">Друзья и заявки</h3><button className={buttonClass} disabled={busy} onClick={()=>void perform(refresh)}>Обновить список</button></div>
          {!friends.length&&<p className="mt-2 text-[12px] text-[var(--tx3)]">Пока нет друзей и заявок. Найди друга по его онлайн-юзернейму.</p>}
          {friends.map(friend=><div key={friend.request_id} className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] p-3"><div><Person person={{...friend,id:friend.other_id}}/><p className="mt-2 text-[11px] text-[var(--tx3)]">{friend.status==='accepted'?'В друзьях':friend.receiver_id===client.session?.user.id?'Входящая заявка':'Заявка отправлена'}</p></div><div className="flex gap-2">{friend.status==='pending'&&friend.receiver_id===client.session?.user.id&&<button disabled={busy} className={buttonClass} onClick={()=>void perform(async()=>{await client.accept(friend.request_id);await refresh();})}>Принять</button>}<button disabled={busy} className={buttonClass} onClick={()=>void perform(async()=>{await client.remove(friend.request_id);await refresh();})}>{friend.status==='accepted'?'Удалить из друзей':friend.receiver_id===client.session?.user.id?'Отклонить':'Отменить заявку'}</button></div></div>)}
        </>}
      </>}
      {busy&&<p className="mt-3 text-[12px] text-[var(--tx3)]" role="status">Связываюсь с сервером…</p>}
      {error&&<p className="mt-3 rounded-lg border border-red-400/30 p-3 text-[12px] text-red-300" role="alert">{error}</p>}
      {notice&&<p className="mt-3 text-[12px] text-[var(--accent)]" role="status">{notice}</p>}
    </>}
  </section>;
}
