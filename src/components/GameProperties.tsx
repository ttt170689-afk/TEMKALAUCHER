import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Game} from '../data/games';
import {useAuth} from '../lib/auth';
import {CloudClient,onlineEnabled} from '../lib/online';
import {BETA_LABELS} from '../lib/betaContract';
import type {BetaStatus,BetaRequest,BetaCode,IssuedBetaCode} from '../lib/betaContract';
import './game-properties.css';

export function GameMenu({game,onProperties,card=false}:{game:Game;onProperties:()=>void;card?:boolean}){
 const [open,setOpen]=useState(false);const trigger=useRef<HTMLButtonElement>(null);
 return <div className={`game-menu ${card?'game-menu-card':''}`} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);e.stopPropagation();}}}>
  <button ref={trigger} className="game-menu-trigger" aria-label={`Меню игры ${game.title}`} aria-expanded={open} onClick={()=>setOpen(v=>!v)}>⋯</button>
  {open&&<div className="game-menu-popover"><button onClick={()=>{setOpen(false);trigger.current?.focus();onProperties();}}>Свойства</button></div>}
 </div>;
}
export default function GameProperties({game,onClose,onProfile}:{game:Game;onClose:()=>void;onProfile:()=>void}){
 const {user}=useAuth();const client=useMemo(()=>new CloudClient(user?.id||''),[user?.id]);
 const [tab,setTab]=useState<'about'|'beta'|'admin'>('about');const [status,setStatus]=useState<BetaStatus|null>(null);
 const [admin,setAdmin]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [code,setCode]=useState('');const [notice,setNotice]=useState('');
 const [requests,setRequests]=useState<BetaRequest[]>([]);const [codes,setCodes]=useState<BetaCode[]>([]);const [issued,setIssued]=useState<IssuedBetaCode|null>(null);
 const [approval,setApproval]=useState(true);const [limit,setLimit]=useState(1);const [hours,setHours]=useState(72);
 const panel=useRef<HTMLDivElement>(null),alive=useRef(true),lock=useRef(false),closeRef=useRef(onClose);closeRef.current=onClose;
 const connected=onlineEnabled&&!!client.session;
 async function run(job:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');try{await job();}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Не удалось связаться с сервером.');}finally{lock.current=false;if(alive.current)setBusy(false);}}
 async function refresh(){setStatus(null);const [profile,value]=await Promise.all([client.ownProfile(),client.betaStatus(game.id)]);if(alive.current){setAdmin(profile?.is_creator===true);setStatus(value);}}
 async function loadAdmin(){const [r,c]=await Promise.all([client.betaRequests(game.id),client.betaCodes(game.id)]);if(alive.current){setRequests(r);setCodes(c);}}
 useEffect(()=>{
  alive.current=true;const previous=document.activeElement as HTMLElement|null;panel.current?.querySelector<HTMLButtonElement>('[aria-label="Закрыть свойства"]')?.focus();
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();closeRef.current();}if(e.key==='Tab'){
   const elements=[...panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea,a[href]')||[]].filter(el=>el.getClientRects().length>0);
   const first=elements[0],last=elements[elements.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  }};window.addEventListener('keydown',key);
  if(connected)void run(refresh);
  return()=>{alive.current=false;window.removeEventListener('keydown',key);previous?.focus();};
 // Each opening is a new, game/account-scoped component.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 const action=(title:string,state:'approved'|'rejected'|'revoked',id:string)=><button disabled={busy} onClick={()=>{if(!window.confirm(`${title}? Решение будет сохранено на сервере.`))return;void run(async()=>{await client.decideBeta(id,state);await loadAdmin();await refresh();});}}>{title}</button>;
 return createPortal(<div className="gp-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}}>
 <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="gp-title" className="gp-panel">
  <header className="gp-header"><div><p className="gp-eyebrow">СВОЙСТВА ИГРЫ</p><h2 id="gp-title">{game.title}</h2></div><button className="gp-close" onClick={onClose} aria-label="Закрыть свойства">×</button></header>
  <div className="gp-tabs" role="tablist" aria-label="Разделы свойств">
   {([['about','Об игре'],['beta','Бета-тест'],...(admin?[['admin','Управление']]:[])] as const).map(([id,label])=><button key={id} id={`gp-tab-${id}`} role="tab" aria-selected={tab===id} aria-controls="gp-content" onClick={()=>{setTab(id as typeof tab);if(id==='admin')void run(loadAdmin);}}>{label}</button>)}
  </div>
  <div className="gp-content" id="gp-content" role="tabpanel" aria-labelledby={`gp-tab-${tab}`}>
  {tab==='about'&&<><p className="gp-eyebrow">ИНФОРМАЦИЯ</p><dl className="gp-facts"><div><dt>Разработчик</dt><dd>{game.developer}</dd></div><div><dt>Движок</dt><dd>{game.engine}</dd></div><div><dt>Стадия</dt><dd>{game.version} · В разработке</dd></div><div><dt>Цена</dt><dd>{game.id==='fantazia'?'Бесплатно':'Пока не объявлена'}</dd></div></dl><div className="gp-note"><strong>Сборка игры ещё не подключена</strong><p>Одобрение бета-доступа не устанавливает игру. Автор отдельно подготовит файлы для поддерживаемых устройств.</p></div><button className="gp-primary" onClick={()=>setTab('beta')}>Перейти к бета-тесту →</button></>}
  {tab==='beta'&&<><p className="gp-eyebrow">ДОСТУП ПО ПРИГЛАШЕНИЮ</p><h3>Есть код от автора?</h3><p className="gp-muted">Введи его для этой игры. Код проверяет сервер, а не приложение.</p>
   {!onlineEnabled?<div className="gp-note" role="status"><strong>Сервер бета-теста ещё не подключён</strong><p>Панель уже доступна. Активация заработает после настройки сервера владельцем. Введённый код пока никуда не отправляется и не сохраняется.</p></div>:!client.session?<div className="gp-note"><strong>Нужен подтверждённый онлайн-аккаунт</strong><p>Локальное имя не подтверждает личность. Открой профиль и подтверди почту в онлайн-разделе.</p><button onClick={()=>{onClose();onProfile();}}>Открыть профиль</button></div>:<div className={`gp-status gp-state-${status?.state||'unknown'}`} role="status"><strong>{status?BETA_LABELS[status.state]:busy?'Проверяем сервер…':'Статус не подтверждён'}</strong>{status?.state==='pending'&&<p>Заявка отправлена. Дождись решения temka_play_official и нажми «Проверить статус».</p>}{status?.state==='approved'&&<p>Сервер подтвердил доступ аккаунта. Файл бета-сборки ещё не подключён; кнопка запуска не разблокирована.</p>}{status?.updated_at&&<p>Изменено: {new Date(status.updated_at).toLocaleString('ru-RU')}</p>}</div>}
   <form className="gp-code-form" onSubmit={e=>{e.preventDefault();if(!connected)return;void run(async()=>{setStatus(null);const next=await client.redeemBeta(game.id,code);if(alive.current){setStatus(next);setCode('');}});}}>
    <label htmlFor="gp-code">Бета-код</label><input id="gp-code" value={code} onChange={e=>setCode(e.target.value)} placeholder="TEMKA-…" maxLength={100} autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false} disabled={busy||!!status&&status.state!=='none'} />
    <button className="gp-primary" type="submit" disabled={!connected||busy||!code.trim()||!!status&&status.state!=='none'}>{busy?'Подожди…':'Отправить код'}</button>
   </form>
   {connected&&<button disabled={busy} onClick={()=>void run(refresh)}>Проверить статус</button>}
   <p className="gp-fine">Автор выбирает режим кода: доступ сразу или только после его одобрения. Доступ связан с онлайн-аккаунтом и конкретной игрой. Смена локального имени не даёт прав администратора.</p>
  </>}
  {tab==='admin'&&admin&&<><h3>Управление бета-тестом</h3><p className="gp-muted">Права подтверждены сервером. Не передавай другим свой онлайн-аккаунт.</p>
   <form className="gp-admin-form" onSubmit={e=>{e.preventDefault();void run(async()=>{const c=await client.issueBeta(game.id,approval,limit,hours);if(alive.current)setIssued(c);await loadAdmin();});}}>
    <label>Режим кода<select value={approval?'manual':'auto'} onChange={e=>setApproval(e.target.value==='manual')}><option value="manual">Моё одобрение каждой заявки</option><option value="auto">Доступ сразу после проверки</option></select></label>
    <div className="gp-two"><label>Число игроков<input type="number" min={1} max={1000} required value={limit} onChange={e=>setLimit(Number(e.target.value))}/></label><label>Срок кода, часы<input type="number" min={1} max={720} required value={hours} onChange={e=>setHours(Number(e.target.value))}/></label></div>
    <button className="gp-primary" disabled={busy}>Создать код</button>
   </form>
   {issued&&<div className="gp-note"><strong>Скопируй сейчас — повторно код не показывается</strong><input aria-label="Новый бета-код" readOnly value={issued.code} onFocus={e=>e.currentTarget.select()}/><button onClick={async()=>{try{await navigator.clipboard.writeText(issued.code);setNotice('Код скопирован.');}catch{setNotice('Выдели код и скопируй вручную.');}}}>Скопировать код</button><p>Действует до {new Date(issued.expires_at).toLocaleString('ru-RU')}. На сервере хранится только хеш.</p></div>}
   <div className="gp-section-heading"><h3>Заявки и доступ</h3><button disabled={busy} onClick={()=>void run(loadAdmin)}>Обновить</button></div>
   {!requests.length&&<p className="gp-muted">Заявок пока нет.</p>}
   {requests.map(r=><article className="gp-request" key={r.id}><strong>@{r.username}</strong><small>{r.user_id}</small><p>{BETA_LABELS[r.state]}</p><div className="gp-actions">{r.state!=='approved'&&action('Одобрить','approved',r.id)}{r.state==='pending'&&action('Отклонить','rejected',r.id)}{r.state==='approved'&&action('Отозвать доступ','revoked',r.id)}</div></article>)}
   <h3>Выданные коды</h3><p className="gp-fine">Последние 200 записей. Место в лимите расходуется при заявке, даже если её потом отклонили. Отключение кода не отзывает ранее выданный доступ.</p>
   {codes.map(c=><article className="gp-request" key={c.id}><small>ID: {c.id}</small><p>{c.require_approval?'С одобрением':'Автоматический'} · {c.uses}/{c.max_uses} заявок</p><p>До {new Date(c.expires_at).toLocaleString('ru-RU')}{c.revoked?' · Отключён':''}</p>{!c.revoked&&<button disabled={busy} onClick={()=>{if(window.confirm('Отключить этот код для новых заявок?'))void run(async()=>{await client.revokeBetaCode(c.id);await loadAdmin();});}}>Отключить код</button>}</article>)}
  </>}
  {busy&&<p className="gp-fine" role="status">Связываемся с сервером…</p>}{error&&<p className="gp-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </div><footer className="gp-footer">TemkaLauncher · Бета-доступ не означает, что игра уже выпущена</footer>
 </div></div>,document.body);
}
