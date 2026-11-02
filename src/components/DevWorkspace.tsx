import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useOnlineAccount} from '../lib/onlineAccount';
import {devStatus,devBuilds,downloadDev} from '../lib/dev';
import type {DevBuild} from '../lib/dev';
import {DevModeGate,DEV_RECHECK_MS} from '../lib/devMode';
import type {DevGateState} from '../lib/devMode';
import {APP_VERSION} from '../lib/version';
import './DevWorkspace.css';

/** A separate, modal top-layer shell: public navigation is inert while Dev is open.
 * Never selects an update feed, runs remote code, registers another user or stores authority. */
export default function DevWorkspace({onExit}:{onExit:()=>void}){
 const {client,mode,profile}=useOnlineAccount();const uid=client.session?.user.id;
 const dialog=useRef<HTMLDialogElement>(null),gate=useRef<DevModeGate|null>(null),alive=useRef(false),actionLock=useRef(false),urls=useRef<string[]>([]);
 const [status,setStatus]=useState<DevGateState>({phase:'checking',access:null,message:''});
 const [tab,setTab]=useState<'overview'|'features'|'builds'>('overview'),[builds,setBuilds]=useState<DevBuild[]>([]),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const release=()=>{urls.current.forEach(URL.revokeObjectURL);urls.current=[];};
 useEffect(()=>{
  alive.current=true;const modal=dialog.current;modal?.showModal();
  const session=new DevModeGate(()=>devStatus(client),()=>client.session?.user.id,next=>{
   if(!alive.current)return;setStatus(next);
   if(next.phase==='blocked'){setBuilds([]);setLoaded(false);setNotice('');release();}
  });gate.current=session;
  const check=()=>{if(!document.hidden)void session.verify();};
  const hidden=()=>{if(document.hidden)session.invalidate('Dev приостановлен. Доступ будет проверен при возвращении.');else check();};
  const offline=()=>session.invalidate('Нет сети. Dev-доступ закрыт до новой проверки сервера.');
  const timer=window.setInterval(check,DEV_RECHECK_MS),lease=window.setInterval(()=>session.expire(),1000);
  window.addEventListener('focus',check);window.addEventListener('online',check);window.addEventListener('offline',offline);document.addEventListener('visibilitychange',hidden);
  if(mode==='verified'&&uid)void session.verify();else session.invalidate('Нужен подтверждённый основной онлайн-аккаунт.');
  return()=>{alive.current=false;session.dispose();gate.current=null;release();clearInterval(timer);clearInterval(lease);window.removeEventListener('focus',check);window.removeEventListener('online',check);window.removeEventListener('offline',offline);document.removeEventListener('visibilitychange',hidden);modal?.close();};
 },[client,uid,mode]);
 async function action(job:(session:DevModeGate)=>Promise<void>){
  const session=gate.current;if(actionLock.current||!session)return;actionLock.current=true;setBusy(true);setError('');setNotice('');
  try{await job(session);}catch(e){if(alive.current&&session===gate.current)setError(e instanceof Error?e.message:'Dev-сервер не ответил.');}
  finally{actionLock.current=false;if(alive.current)setBusy(false);}
 }
 const load=()=>void action(async session=>{const list=await session.run(()=>devBuilds(client));if(alive.current&&session===gate.current){setBuilds(list.filter(b=>b.product==='launcher-pc'));setLoaded(true);}});
 const save=(build:DevBuild)=>void action(async session=>{
  const blob=await session.run(()=>downloadDev(client,build));if(!alive.current||session!==gate.current)return;
  release();const url=URL.createObjectURL(blob);urls.current.push(url);const a=document.createElement('a');a.href=url;a.download=build.filename;dialog.current?.append(a);a.click();a.remove();setNotice('Размер и SHA256 проверены. Файл передан на сохранение; автоматически не запускается.');
 });
 return createPortal(<dialog ref={dialog} className="dev-workspace" aria-label="Закрытая среда Temka Dev" onCancel={e=>{e.preventDefault();onExit();}}>
  <header className="dev-header"><div className="dev-brand"><span className="dev-mark" aria-hidden="true">D</span><div><strong>TEMKA <span>DEV</span></strong><small>Закрытая среда · ПК</small></div></div><button className="dev-button dev-return" onClick={onExit}>← Вернуться в обычный лаунчер</button></header>
  {status.phase!=='allowed'?<main className="dev-gate" aria-live="polite"><p className="dev-kicker">Серверная проверка</p><h1>{status.phase==='checking'?'Подтверждаем вход в Dev…':'Dev-сеанс закрыт'}</h1><p>{status.phase==='checking'?'Используем твой основной аккаунт. Закрытые разделы появятся только после ответа Dev-сервера.':status.message}</p>{status.phase==='blocked'&&<button className="dev-button" onClick={()=>void gate.current?.verify()}>Повторить проверку Dev</button>}</main>:<div className="dev-layout" data-dev-environment>
   <aside className="dev-sidebar"><p className="dev-kicker">Рабочая среда</p><nav aria-label="Разделы Temka Dev">{([['overview','Обзор Dev'],['features','Ранние функции'],['builds','Сборки лаунчера']] as const).map(([id,label])=><button key={id} aria-current={tab===id?'page':undefined} disabled={busy} onClick={()=>{setTab(id);setError('');setNotice('');if(id==='builds'&&!loaded)load();}}>{label}</button>)}</nav><div className="dev-identity"><span className="dev-dot"/> Доступ подтверждён<strong>{status.access?.owner?'Владелец Dev':'Тестер Dev'}</strong><small>{profile?.username?'@'+profile.username:'Основной аккаунт Temka'}</small><small>Проверка каждые 20 секунд</small></div></aside>
   <main className="dev-content">
    {tab==='overview'&&<><p className="dev-kicker">Только по приглашению</p><h1>Ты в Temka Dev</h1><p className="dev-lead">Отдельная закрытая среда для раннего тестирования новых функций лаунчера. Обычный интерфейс остаётся за её пределами.</p><div className="dev-cards"><article className="dev-card"><span className="dev-card-index">01 / СРЕДА</span><h2>Один аккаунт. Два режима.</h2><p>Используется текущий вход Temka. Возвращение в обычный лаунчер не завершает сеанс аккаунта и не требует нового кода.</p></article><article className="dev-card"><span className="dev-card-index">02 / РАННИЙ ДОСТУП</span><h2>Функции лаунчера, не игр</h2><p>Здесь место для экспериментальных возможностей TemkaLauncher. Ранние игровые сборки и игровые серверы в этот режим не входят.</p></article></div><section className="dev-card dev-release"><span className="dev-pill">Установлена Alpha {APP_VERSION}</span><h2>Отдельный вход — не подмена версии</h2><p>Экспериментальные функции ещё не подготовлены. Включение Dev не скачивает скрытое обновление и не превращает публичную сборку в другую версию.</p><button className="dev-button" onClick={()=>setTab('features')}>Открыть ранние функции →</button></section></>}
    {tab==='features'&&<><p className="dev-kicker">Ранний доступ / TemkaLauncher</p><h1>Ранние функции</h1><section className="dev-card dev-empty"><span className="dev-pill">Пока нет подготовленных функций</span><h2>Среда готова для следующих экспериментов</h2><p>Сейчас здесь нет отдельных экспериментальных модулей. Когда они будут разработаны и включены в сборку, их можно будет тестировать в этом закрытом разделе.</p><p>Обычные друзья, профиль и библиотека не выдаются за новые Dev-функции.</p></section></>}
    {tab==='builds'&&<><p className="dev-kicker">Закрытый каталог / только лаунчер ПК</p><h1>Сборки лаунчера</h1><p className="dev-lead">Дополнение к Dev-среде, а не замена входа в неё. Автообновление остаётся в обычном публичном канале.</p><button className="dev-button" disabled={busy} onClick={load}>{busy?'Проверяем…':'Обновить список сборок'}</button>{!loaded&&!busy&&<p>Каталог ещё не загружен.</p>}{loaded&&!builds.length&&<section className="dev-card dev-empty"><h2>Dev-сборки лаунчера ещё не опубликованы</h2><p>Это не ошибка входа. Подготовленная ранняя сборка появится после отдельной публикации.</p></section>}{builds.map(build=><article className="dev-card" key={build.id}><span className="dev-pill">{build.published?'Опубликована':'Не опубликована'}</span><h2>TemkaLauncher · {build.version}</h2><p className="dev-notes">{build.notes}</p><small className="dev-filename">{build.filename} · {(build.size_bytes/1048576).toFixed(1)} МиБ</small><button className="dev-button" disabled={busy} onClick={()=>save(build)}>Скачать тестовую сборку</button></article>)}<p className="dev-footnote">Файл проверяется по размеру и SHA256 и не запускается автоматически. Для установки рядом с обычным лаунчером нужна специально подготовленная Dev-сборка.</p></>}
    {error&&<p className="dev-error" role="alert">{error}</p>}{notice&&<p className="dev-card" role="status">{notice}</p>}
   </main>
  </div>}
  <footer className="dev-footer"><span>DEV / НЕ ПУБЛИЧНЫЙ РЕЖИМ</span><span>Основной аккаунт · обычный канал обновлений</span></footer>
 </dialog>,document.body);
}
