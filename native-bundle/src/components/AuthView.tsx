import {useEffect,useMemo,useRef,useState} from 'react';
import {useAuth,isBadName} from '../lib/auth';
import {CloudClient,onlineEnabled} from '../lib/online';
import {ENTRY_OTP_KEY,readEntryOtp,validEmail,entryError} from '../lib/entryOtp';
import type {EntryIntent,EntryOtp} from '../lib/entryOtp';
import {USERNAME_MAX_LENGTH} from '../lib/username';
import LocalAuthView from './LocalAuthView';

export default function AuthView(){
  const {enterOnline}=useAuth();
  const client=useMemo(()=>new CloudClient('entry',true),[]);
  const [pending,setPending]=useState<EntryOtp|null>(()=>{try{return readEntryOtp(localStorage.getItem(ENTRY_OTP_KEY));}catch{return null;}});
  const [intent,setIntent]=useState<EntryIntent>(pending?.intent||'login');
  const [email,setEmail]=useState(pending?.email||'');
  const [step,setStep]=useState<'email'|'code'|'profile'>(pending?'code':'email');
  const [code,setCode]=useState(''),[name,setName]=useState('');
  const [local,setLocal]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [phase,setPhase]=useState(''),[connection,setConnection]=useState('');
  const [now,setNow]=useState(Date.now());
  const epoch=useRef(0),lock=useRef(false),alive=useRef(true);
  useEffect(()=>{alive.current=true;const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>{alive.current=false;epoch.current++;client.clearTransient();clearInterval(timer);};},[client]);
  const remember=(value:EntryOtp|null)=>{setPending(value);try{if(value)localStorage.setItem(ENTRY_OTP_KEY,JSON.stringify(value));else localStorage.removeItem(ENTRY_OTP_KEY);}catch{/* no secrets here; in-memory cooldown still works */}};
  const reset=(mode:EntryIntent=intent)=>{epoch.current++;lock.current=false;client.clearTransient();setIntent(mode);setStep('email');setCode('');setName('');setBusy(false);setError('');setPhase('');setConnection('');};
  const run=async(task:(current:()=>boolean)=>Promise<void>)=>{
    if(lock.current)return;lock.current=true;setBusy(true);setError('');const ticket=epoch.current;
    const current=()=>alive.current&&ticket===epoch.current;
    try{await task(current);}catch(e){if(current())setError(entryError(e));}
    finally{if(current()){lock.current=false;setBusy(false);}}
  };
  const wait=Math.max(0,Math.ceil(((pending?.retryAt||0)-now)/1000));
  const send=()=>run(async(current)=>{
    const address=email.trim().toLowerCase();
    if(!validEmail(address))throw Error('Введи корректную почту.');
    if(pending && pending.retryAt>Date.now())throw Error('Подожди перед повторной отправкой кода.');
    setPhase('Отправляем письмо…');
    await client.sendCode(address,intent==='register');
    if(!current())return;
    const sentAt=Date.now();remember({email:address,intent,sentAt,retryAt:sentAt+60000});setEmail(address);setCode('');setStep('code');
  });
  const finish=async(current:()=>boolean)=>{
    const opened=await enterOnline(client,text=>{if(current())setPhase(text);});
    if(opened){remember(null);return;}
    if(current())setStep('profile');
  };
  const verify=()=>run(async(current)=>{
    if(!pending)throw Error('Сначала запроси код.');
    setPhase(client.session?'Код уже принят. Продолжаем вход…':'Проверяем код из письма…');
    if(!client.session)await client.verifyCode(pending.email,code.trim());
    if(current())await finish(current);
  });
  const saveName=()=>run(async(current)=>{
    if(isBadName(name))throw Error('Юзернейм заблокирован фильтром.');
    setPhase('Сохраняем юзернейм на сервере…');
    await client.saveUsername(name.trim());
    if(current())await finish(current);
  });
  const diagnose=()=>run(async(current)=>{
    setConnection('');setPhase('Проверяем доступность сервиса входа…');
    const started=Date.now();await client.checkConnection();
    if(current())setConnection(`Сервис входа доступен (${((Date.now()-started)/1000).toFixed(1)} с). Это проверка соединения, не подтверждение кода или исправности базы профилей. Повтори вход; если ошибка останется, сообщи её обозначение в квадратных скобках.`);
  });
  if(local)return <div className="relative z-10 flex min-h-0 flex-1 flex-col">
    <div className="border-b border-[var(--line)] px-5 py-3 text-sm">
      <button className="text-accent font-bold" onClick={()=>{reset();setLocal(false);}}>← Вход по почте</button>
      <p className="mt-2 text-[var(--tx2)]">Локальный режим · только это устройство. Для общего аккаунта на ПК и телефоне используй вход по почте.</p>
    </div><LocalAuthView/>
  </div>;
  return <div className="mobile-auth relative z-10 min-h-0 flex-1 overflow-y-auto tl-scroll p-4 sm:p-8" data-cloud-entry>
    <section className="panel mx-auto my-4 w-full max-w-[520px] rounded-[20px] p-6 sm:p-9">
      <p className="font-mono2 text-xs font-bold tracking-[.2em] text-accent">TEMKA LAUNCHER · ALPHA</p>
      <h1 className="font-display mt-5 text-[27px] font-extrabold leading-tight">{step==='code'?'Проверь почту':step==='profile'?'Заверши свой профиль':'Один аккаунт. ПК и телефон.'}</h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--tx2)]">{step==='email'?'Вход без пароля: укажи почту и введи код из письма. Не нужно создавать отдельный профиль на каждом устройстве.':step==='code'?`Код отправлен на ${pending?.email||email}. Введи цифры из последнего письма. Проверь также папку «Спам».`:'Почта подтверждена. Выбери @юзернейм — по нему тебя смогут найти друзья.'}</p>
      {step==='email'&&<div className="mt-6 grid grid-cols-2 gap-2" role="tablist" aria-label="Способ входа">
        {(['login','register'] as const).map(mode=><button key={mode} role="tab" aria-selected={intent===mode} onClick={()=>reset(mode)} className={`${intent===mode?'btn-primary':'btn-ghost'} px-2 py-3 text-sm`}>{mode==='login'?'Войти в аккаунт':'Создать аккаунт'}</button>)}
      </div>}
      <form className="mt-5 flex flex-col gap-4" onSubmit={e=>{e.preventDefault();if(step==='email')void send();else if(step==='code')void verify();else void saveName();}}>
        {step==='email'?<label className="text-sm font-bold">Твоя почта
          <input className="input-tl mt-2 w-full px-4 py-3 text-base" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={254} placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} required disabled={busy}/>
        </label>:step==='code'?<label className="text-sm font-bold">Код из письма
          <input className="input-tl mt-2 w-full px-4 py-3 text-xl tracking-[.25em]" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} placeholder="123456" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} required disabled={busy}/>
        </label>:<label className="text-sm font-bold">Юзернейм · {name.length}/{USERNAME_MAX_LENGTH}
          <input className="input-tl mt-2 w-full px-4 py-3 text-base" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={USERNAME_MAX_LENGTH} minLength={3} placeholder="Temka_Игрок" value={name} onChange={e=>setName(e.target.value)} required disabled={busy}/>
          <span className="mt-2 block text-xs font-normal text-[var(--tx2)]">3–25 букв, цифр или _. Занятость проверяется сервером при сохранении.</span>
        </label>}
        {step==='email'&&<p className="text-xs leading-relaxed text-[var(--tx2)]">{intent==='login'?'Уже подтверждал эту почту в онлайн-профиле на ПК? Просто войди здесь с той же почтой.':'Если раньше был только локальный профиль с паролем, общий аккаунт ещё нужно создать. Его почта подтверждается кодом.'}</p>}
        {!onlineEnabled&&<p role="alert">Онлайн-сервер не настроен. Пока доступен локальный режим ниже.</p>}
        {busy&&<p role="status" className="text-sm text-accent">{phase} Можно подождать до 45 секунд.</p>}
        {error&&<p role="alert" className="rounded-lg border border-[var(--danger)] p-3 text-sm text-[var(--danger)]">{error}</p>}
        <button className="btn-primary w-full px-4 py-3.5 text-sm disabled:opacity-50" disabled={busy||!onlineEnabled||(step==='email'&&wait>0)}>{busy?'Подожди…':step==='email'?(wait>0?`Новый код через ${wait} с`:'Получить код'):step==='code'?'Подтвердить и войти':'Сохранить и войти'}</button>
      </form>
      {connection&&<p role="status" className="mt-3 text-xs text-[var(--tx2)]">{connection}</p>}
      {(error||connection)&&<button className="mt-4 w-full text-sm text-accent disabled:opacity-50" disabled={busy} onClick={()=>void diagnose()}>Проверить соединение</button>}
      {step==='code'&&<button className="mt-4 w-full text-sm text-accent disabled:opacity-50" onClick={()=>void send()} disabled={busy||wait>0}>{wait>0?`Отправить снова через ${wait} с`:'Отправить код снова'}</button>}
      {step!=='email'&&<button className="mt-4 w-full text-sm text-[var(--tx2)]" onClick={()=>reset()}>← Другая почта / отменить вход</button>}
      <div className="mt-7 border-t border-[var(--line)] pt-5 text-center">
        <button className="text-sm font-bold text-[var(--tx2)]" onClick={()=>{reset();setLocal(true);}}>Локальный режим</button>
        <p className="mt-2 text-xs leading-relaxed text-[var(--tx3)]">Без интернета · профиль только на этом устройстве.<br/>Старые локальные профили и пароли сохранены.</p>
      </div>
    </section>
  </div>;
}
