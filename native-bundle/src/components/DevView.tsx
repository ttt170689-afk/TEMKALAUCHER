import {useEffect,useRef,useState} from 'react';
import {useOnlineAccount} from '../lib/onlineAccount';
import {devStatus,redeemDev} from '../lib/dev';
import type {DevAccess} from '../lib/dev';
import DevWorkspace from './DevWorkspace';
export default function DevView({onProfile}:{onProfile:()=>void}){
 const {client,mode}=useOnlineAccount();const uid=client.session?.user.id;
 const [access,setAccess]=useState<DevAccess|null>(null),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[opened,setOpened]=useState(false);
 const epoch=useRef(0),lock=useRef(false),alive=useRef(true),currentUid=useRef(uid);currentUid.current=uid;
 async function run(job:(valid:()=>boolean)=>Promise<void>){
  if(lock.current)return;const ticket=++epoch.current,identity=client.session?.user.id;lock.current=true;setBusy(true);setError('');
  const valid=()=>alive.current&&epoch.current===ticket&&currentUid.current===identity;
  try{await job(valid);}catch(e){if(valid()){setAccess(null);setError(e instanceof Error?e.message:'Dev-сервер не ответил.');}}finally{if(valid()){lock.current=false;setBusy(false);}}
 }
 async function check(valid:()=>boolean){if(valid())setAccess(null);const next=await devStatus(client);if(valid())setAccess(next);}
 useEffect(()=>{
  alive.current=true;epoch.current++;lock.current=false;setBusy(false);setAccess(null);setCode('');setError('');
  if(!opened&&mode==='verified'&&uid)void run(check);
  const refresh=()=>{if(!opened&&mode==='verified'&&uid&&!document.hidden&&!lock.current)void run(check);};
  const timer=window.setInterval(refresh,30000);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);
  return()=>{epoch.current++;alive.current=false;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);};
  // Requests are scoped to identity/verification changes, not friend refreshes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[client,uid,mode,opened]);
 useEffect(()=>{setOpened(false);},[client,uid,mode]);
 const button='min-h-11 rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-bold disabled:opacity-50';
 return <section aria-label="Dev — тестовые версии" className="mx-auto max-w-5xl space-y-5 px-5 py-6 sm:px-8">
  <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg2)] p-6"><p className="text-xs font-bold uppercase tracking-widest text-[var(--accent)]">Закрытая среда · только ПК</p><h1 className="mt-3 text-3xl font-extrabold">Вход в Temka Dev</h1><p className="mt-3 text-sm leading-relaxed text-[var(--tx2)]">Отдельный интерфейс для раннего тестирования функций лаунчера — не игровых сборок. Вход через твой основной аккаунт Temka, без второй регистрации. Из Dev можно вернуться в обычный режим.</p></div>
  {mode!=='verified'?<div className="rounded-2xl border border-[var(--line)] p-5"><p>{mode==='checking'?'Проверяем основной аккаунт…':'Нужен подтверждённый основной онлайн-аккаунт. Локальный режим не открывает Dev.'}</p><button className={button+' mt-4'} onClick={onProfile}>Основной аккаунт</button></div>:<>
   <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg2)] p-5" role="status"><strong>{busy?'Связываемся с Dev-сервером…':access?.allowed?(access.owner?'Dev-доступ: владелец':'Dev-доступ: тестер'):access?'Нужно приглашение владельца':'Dev-доступ пока не подтверждён'}</strong><button className={button+' mt-4 block'} disabled={busy} onClick={()=>void run(check)}>Проверить Dev-доступ</button></div>
   {access&&!access.allowed&&<form className="rounded-2xl border border-[var(--line)] p-5" onSubmit={e=>{e.preventDefault();void run(async valid=>{const next=await redeemDev(client,code);if(!valid())return;setAccess(next);setCode('');if(next.allowed)setOpened(true);});}}><label htmlFor="dev-invite" className="block font-bold">Dev-приглашение</label><input id="dev-invite" value={code} onChange={e=>setCode(e.target.value)} maxLength={100} autoComplete="off" spellCheck={false} placeholder="TEMKADEV-…" disabled={busy} className="mt-3 w-full min-w-0 rounded-xl border border-[var(--line)] bg-[var(--bg1)] p-3"/><button className={button+' mt-4'} disabled={busy||!code.trim()}>Войти в Dev по приглашению</button><p className="mt-3 text-xs text-[var(--tx3)]">Одноразовый код привязывает Dev-доступ к основному аккаунту. При следующих входах достаточно кнопки «Войти в Dev». Это не игровой бета-код.</p></form>}
   {access?.allowed&&<div className="rounded-2xl border border-[var(--accent)] bg-[var(--bg2)] p-6"><h2 className="text-xl font-bold">Доступ есть — можно войти</h2><p className="mt-3 text-sm text-[var(--tx2)]">Сейчас ты ещё в обычном лаунчере. Кнопка откроет отдельную закрытую среду после новой проверки сервера.</p><button className={button+' mt-5 bg-[var(--accent)] text-[var(--bg0)]'} disabled={busy} onClick={()=>setOpened(true)}>Войти в Dev</button><p className="mt-3 text-xs text-[var(--tx3)]">Ранние функции ещё не подготовлены. Переключение режима не устанавливает другую версию лаунчера.</p></div>}
   {access?.owner&&<p className="text-sm text-[var(--tx2)]">Приглашения и отзыв Dev-доступа — только в TemkaPublisher → Beta Test → Dev · ПК. В лаунчере управления доступом нет.</p>}
  </>}
  {error&&<p role="alert" className="rounded-xl border border-red-400/40 p-4 text-sm">{error}</p>}
  {opened&&mode==='verified'&&uid&&<DevWorkspace key={uid} onExit={()=>setOpened(false)}/>}
 </section>;
}
