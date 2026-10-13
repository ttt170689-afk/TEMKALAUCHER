// Online identity settings only. Friend lists/search live in FriendsView, without duplication.
import {useEffect,useRef,useState} from 'react';
import type {Account} from '../lib/auth';
import {useOnlineAccount} from '../lib/onlineAccount';
import {onlineProject} from '../lib/online';
import {onlineError} from '../lib/friendContract';
import {readOtp,secondsLeft} from '../lib/otpState';
import type {OtpState} from '../lib/otpState';
import {isCustomAvatar} from '../lib/avatar';
import './social.css';
export default function FriendsPanel({localUser,onFriends}:{localUser:Account;onFriends:()=>void}){
 const account=useOnlineAccount(),{client,mode,profile,refresh}=account;
 const key=`temka-otp-v2:${onlineProject}:${localUser.id}`;
 const [otp,setOtp]=useState<OtpState|null>(()=>{try{return readOtp(localStorage.getItem(key));}catch{return null;}});
 const [email,setEmail]=useState(otp?.email||client.session?.user.email||localUser.email),[code,setCode]=useState(''),[username,setUsername]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[clock,setClock]=useState(Date.now());
 const alive=useRef(true),lock=useRef(false),draftTouched=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(!draftTouched.current)setUsername(profile?.username||'');},[profile?.username]);
 useEffect(()=>{if(!otp)return;const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[otp]);
 const wait=otp?secondsLeft(otp.retryAt,clock):0;
 function pending(next:OtpState|null){setOtp(next);try{if(next)localStorage.setItem(key,JSON.stringify(next));else localStorage.removeItem(key);}catch{/* An in-memory pending email remains usable. */}}
 async function run(job:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');try{await job();}catch(e){if(alive.current)setError(onlineError(e));}finally{lock.current=false;if(alive.current)setBusy(false);}}
 const disabled=busy||account.busy;
 return <section className="social-panel account-panel" aria-labelledby="online-account-title">
  <div className="social-heading"><div><p className="social-eyebrow">АККАУНТ</p><h2 id="online-account-title">Твой онлайн-профиль</h2></div>{mode==='verified'&&<span className="social-chip">✓ Почта подтверждена</span>}</div>
  {mode==='checking'&&<p role="status" className="social-muted">Проверяем аккаунт…</p>}
  {mode==='disabled'&&<p className="social-muted">Онлайн-сервер не задан в этой сборке. Локальный профиль доступен без него.</p>}
  {mode==='error'&&<div className="social-alert" role="alert"><p>{account.error}</p><button disabled={account.loading} onClick={()=>void refresh()}>Повторить подключение</button></div>}
  {(mode==='signedOut'||mode==='unverified')&&<>
   <p className="social-muted">Подтверди почту, чтобы выбрать @юзернейм и добавлять друзей. Твоя почта другим игрокам не видна.</p>
   <form className="social-form" onSubmit={e=>{e.preventDefault();if(wait)return;void run(async()=>{const address=email.trim().toLowerCase();await client.sendCode(address);if(!alive.current)return;const now=Date.now();pending({email:address,sentAt:now,retryAt:now+60000});setClock(now);setCode('');setNotice('Запрос принят. Проверь входящие и спам.');});}}>
    <label>Почта для онлайн-профиля<input type="email" value={email} maxLength={254} required autoComplete="email" disabled={disabled} onChange={e=>{setEmail(e.target.value);setCode('');}}/></label>
    <button className="social-primary" disabled={disabled||wait>0}>{wait?`Повторить через ${wait} с`:'Получить код на почту'}</button>
   </form>
   {otp&&<form className="social-form" onSubmit={e=>{e.preventDefault();void run(async()=>{await client.verifyCode(otp.email,code);if(!alive.current)return;pending(null);setCode('');await refresh();});}}>
    <label>Код из письма<input aria-label="Код из письма" value={code} inputMode="numeric" autoComplete="one-time-code" placeholder="Код из последнего письма" maxLength={10} disabled={disabled} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/><small>Письмо для {otp.email}</small></label>
    <button className="social-primary" disabled={disabled||!/^\d{6,10}$/.test(code)}>Подтвердить почту</button>
   </form>}
   <details className="social-help"><summary>Не получается получить код?</summary><p>Проверь адрес и папку «Спам». После повторного запроса вводи код из самого нового письма. Если вместо кода пришла только ссылка — сообщи автору лаунчера.</p></details>
  </>}
  {mode==='verified'&&<>
   <div className="social-own"><div><strong>{localUser.username}</strong><p className="social-handle">{profile?`@${profile.username}`:'Юзернейм ещё не выбран'}</p>{profile?.is_creator&&<small>Создатель · Администратор</small>}</div>
    <div className="social-actions">{profile&&<button onClick={()=>void run(async()=>{try{await navigator.clipboard.writeText('@'+profile.username);setNotice('Юзернейм скопирован.');}catch{throw Error(`Не удалось скопировать. Твой юзернейм: @${profile.username}`);}})}>Скопировать @юзернейм</button>}<button className="social-primary" onClick={onFriends}>Мои друзья →</button></div>
   </div>
   <form className="social-form" onSubmit={e=>{e.preventDefault();void run(async()=>{await client.saveUsername(username);draftTouched.current=false;await refresh();if(alive.current)setNotice('Онлайн-юзернейм сохранён. Имя на этом устройстве не изменилось.');});}}>
    <label>Онлайн-юзернейм<input aria-label="Онлайн-юзернейм" value={username} placeholder="Например, temka_friend" maxLength={25} disabled={disabled} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={e=>{draftTouched.current=true;setUsername(e.target.value);}}/><small>3–25 букв, цифр или «_». По нему тебя найдут друзья.</small></label><button disabled={disabled||!username.trim()||username.trim()===profile?.username}>Сохранить онлайн-ник</button>
   </form>
   {profile&&<details className="social-help"><summary>Аватарка для друзей</summary><p>Публикация добровольная: изображение станет публичным. Локальное фото само не отправляется.</p><div className="social-actions"><button disabled={disabled||!isCustomAvatar(localUser.profile.avatar)} onClick={()=>void run(async()=>{await client.publishAvatar(localUser.profile.avatar);await refresh();setNotice('Аватарка опубликована.');})}>Опубликовать аватарку для друзей</button>{profile.has_avatar&&<button disabled={disabled} onClick={()=>void run(async()=>{await client.removePublishedAvatar();await refresh();})}>Удалить опубликованную аватарку</button>}</div></details>}
  </>}
  {client.session&&<button className="social-signout" disabled={disabled} onClick={()=>void run(async()=>{pending(null);await client.logout();})}>Выйти из онлайн-профиля</button>}
  {busy&&<p className="social-muted" role="status">Связываемся с сервером…</p>}{error&&<p className="social-alert" role="alert">{error}</p>}{notice&&<p className="social-success" role="status">{notice}</p>}
 </section>;
}
