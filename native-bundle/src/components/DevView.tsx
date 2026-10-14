import {useEffect,useRef,useState} from 'react';
import {useOnlineAccount} from '../lib/onlineAccount';
import {devStatus,redeemDev,devBuilds,downloadDev} from '../lib/dev';
import type {DevAccess,DevBuild} from '../lib/dev';
export default function DevView({onProfile}:{onProfile:()=>void}){
 const {client,mode}=useOnlineAccount();const uid=client.session?.user.id;
 const [access,setAccess]=useState<DevAccess|null>(null),[builds,setBuilds]=useState<DevBuild[]>([]),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const epoch=useRef(0),lock=useRef(false),alive=useRef(true),currentUid=useRef(uid),urls=useRef<string[]>([]);currentUid.current=uid;
 async function run(job:(valid:()=>boolean)=>Promise<void>){
  if(lock.current)return;const ticket=++epoch.current,identity=client.session?.user.id;lock.current=true;setBusy(true);setError('');setNotice('');
  const valid=()=>alive.current&&epoch.current===ticket&&currentUid.current===identity;
  try{await job(valid);}catch(e){if(valid())setError(e instanceof Error?e.message:'Dev-сервер не ответил.');}finally{if(valid()){lock.current=false;setBusy(false);}}
 }
 async function check(valid:()=>boolean){
  // Fail closed on errors: never keep a stale allowed badge after a failed recheck.
  if(valid()){setAccess(null);setBuilds([]);}
  const next=await devStatus(client);if(!valid())return;setAccess(next);
  if(next.allowed){const list=await devBuilds(client);if(valid())setBuilds(list.filter(b=>b.product!=='launcher-android'));}
 }
 useEffect(()=>{
  alive.current=true;epoch.current++;lock.current=false;setBusy(false);setAccess(null);setBuilds([]);setCode('');setError('');setNotice('');
  if(mode==='verified'&&uid)void run(check);
  const refresh=()=>{if(mode==='verified'&&uid&&!document.hidden&&!lock.current)void run(check);};
  const timer=window.setInterval(refresh,30000);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);
  return()=>{epoch.current++;alive.current=false;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);urls.current.forEach(URL.revokeObjectURL);urls.current=[];};
  // Requests are scoped to real identity/verification changes, not background friend refreshes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[client,uid,mode]);
 const button='min-h-11 rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-bold disabled:opacity-50';
 return <section aria-label="Dev — тестовые версии" className="mx-auto max-w-5xl space-y-5 px-5 py-6 sm:px-8">
  <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg2)] p-6"><p className="text-xs font-bold uppercase tracking-widest text-[var(--accent)]">Закрытый канал · только ПК</p><h1 className="mt-3 text-3xl font-extrabold">Dev — тестовые версии</h1><p className="mt-3 text-sm leading-relaxed text-[var(--tx2)]">Вход через твой основной аккаунт Temka. Вторую регистрацию проходить не нужно. Dev-доступ не даёт права управлять игровыми бета-ключами.</p></div>
  {mode!=='verified'?<div className="rounded-2xl border border-[var(--line)] p-5"><p>{mode==='checking'?'Проверяем основной аккаунт…':'Нужен подтверждённый основной онлайн-аккаунт. Локальный режим не открывает Dev.'}</p><button className={button+' mt-4'} onClick={onProfile}>Основной аккаунт</button></div>:<>
   <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg2)] p-5" role="status"><strong>{busy?'Связываемся с Dev-сервером…':access?.allowed?(access.owner?'Dev-доступ: владелец':'Dev-доступ: тестер'):access?'Нужно приглашение владельца':'Dev-доступ пока не подтверждён'}</strong><button className={button+' mt-4 block'} disabled={busy} onClick={()=>void run(check)}>Проверить Dev-доступ</button></div>
   {access&&!access.allowed&&<form className="rounded-2xl border border-[var(--line)] p-5" onSubmit={e=>{e.preventDefault();void run(async valid=>{const next=await redeemDev(client,code);if(!valid())return;setAccess(next);setCode('');const list=await devBuilds(client);if(valid()){setBuilds(list.filter(b=>b.product!=='launcher-android'));setNotice('Приглашение принято. Доступ привязан к твоему основному аккаунту.');}});}}><label htmlFor="dev-invite" className="block font-bold">Dev-приглашение</label><input id="dev-invite" value={code} onChange={e=>setCode(e.target.value)} maxLength={100} autoComplete="off" spellCheck={false} placeholder="TEMKADEV-…" disabled={busy} className="mt-3 w-full min-w-0 rounded-xl border border-[var(--line)] bg-[var(--bg1)] p-3"/><button className={button+' mt-4'} disabled={busy||!code.trim()}>Войти в Dev по приглашению</button><p className="mt-3 text-xs text-[var(--tx3)]">Код вводится один раз. Это не игровой бета-код.</p></form>}
   {access?.allowed&&<div className="space-y-4"><h2 className="text-xl font-bold">Закрытые сборки</h2>{!builds.length&&<p className="rounded-xl border border-[var(--line)] p-5 text-sm text-[var(--tx2)]">Пока нет доступных сборок. Наличие Dev-доступа само по себе не означает, что игра уже готова.</p>}{builds.map(build=><article key={build.id} className="rounded-2xl border border-[var(--line)] bg-[var(--bg2)] p-5"><h3 className="text-lg font-bold">{build.product==='launcher-pc'?'Лаунчер ПК':build.product==='fantazia'?'Fantazia RP':'TemkaWorld'} · {build.version}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--tx2)]">{build.notes}</p><p className="mt-3 break-all text-xs text-[var(--tx3)]">{build.filename} · {(build.size_bytes/1048576).toFixed(1)} МиБ{!build.published?' · Не опубликовано':''}</p><button disabled={busy} className={button+' mt-4'} onClick={()=>void run(async valid=>{const blob=await downloadDev(client,build);if(!valid())return;const url=URL.createObjectURL(blob);urls.current.push(url);const a=document.createElement('a');a.href=url;a.download=build.filename;document.body.append(a);a.click();a.remove();setNotice('Файл проверен по размеру и SHA256. Передан на сохранение.');})}>Скачать тестовую сборку</button></article>)}<p className="text-xs leading-relaxed text-[var(--tx3)]">Это отдельная загрузка, не переключение публичного автообновления. Файл не запускается автоматически. Для установки рядом с обычным лаунчером нужна специально подготовленная Dev-сборка.</p></div>}
   {access?.owner&&<p className="text-sm text-[var(--tx2)]">Приглашения и отзыв Dev-доступа — только в TemkaPublisher → Beta Test → Dev · ПК. В лаунчере управления доступом нет.</p>}
  </>}
  {error&&<p role="alert" className="rounded-xl border border-red-400/40 p-4 text-sm">{error}</p>}{notice&&<p role="status" className="rounded-xl border border-[var(--accent)] p-4 text-sm">{notice}</p>}
 </section>;
}
