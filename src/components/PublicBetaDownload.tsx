import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {PUBLIC_BETA,betaAsset,betaSize} from '../lib/publicBeta';
import {betaPlatform,betaAction,onBetaProgress,useBetaBack} from '../lib/publicBetaRuntime';
import {gameBetaToken} from '../lib/gameBetaGate';
import {useOnlineAccount} from '../lib/onlineAccount';
import {copyText} from '../lib/clipboard';
import './public-beta.css';
export default function PublicBetaDownload({gameId,onActivate}:{gameId:string;onActivate?:()=>void}){
 const {client,mode}=useOnlineAccount(),[open,setOpen]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);const platform=betaPlatform(),asset=betaAsset(platform);const lock=useRef(false);
 if(gameId!==PUBLIC_BETA.gameId)return null;
 async function begin(){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{if(mode!=='verified')throw Error('Нужен подтверждённый онлайн-аккаунт.');await gameBetaToken(client);setOpen(true);}catch(e){setError((e as Error).message);onActivate?.();}finally{lock.current=false;setBusy(false);}}
 return <div className="public-beta-action"><button className="library-play public-beta-trigger" disabled={!asset||busy} onClick={()=>void begin()}>{busy?'Проверяем доступ…':asset?'Бета · установить / играть':'Сборки для этой платформы пока нет'}</button><small>{asset?`${asset.label} · по ключу автора`:'APK не работает на iPhone; Linux-сборки игры пока нет.'}</small>{error&&<p role="alert" className="public-beta-error">{error}</p>}{open&&<BetaConsent close={()=>setOpen(false)}/>}</div>;
}
function BetaConsent({close}:{close:()=>void}){
 const {client}=useOnlineAccount(),modal=useRef<HTMLDialogElement>(null),alive=useRef(true),lock=useRef(false),closeRef=useRef(close);closeRef.current=close;const platform=betaPlatform(),asset=betaAsset(platform),android=platform==='android';
 const openingUID=useRef(client.session?.user.id);
 useEffect(()=>{if(client.session?.user.id!==openingUID.current)closeRef.current();},[client.session?.user.id]);
 const [accepted,setAccepted]=useState(false),[busy,setBusy]=useState(false),[phase,setPhase]=useState('checking'),[progress,setProgress]=useState(0),[error,setError]=useState(''),[notice,setNotice]=useState(''),[folder,setFolder]=useState('');
 useBetaBack(()=>closeRef.current());
 async function action(kind:'status'|'install'|'launch'|'settings'){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');
  try{if(kind!=='status'&&accepted!==true)throw Error('Сначала подтверди предупреждение о ранней бете.');const token=await gameBetaToken(client);const result=await betaAction(kind,token,accepted);if(!alive.current)return;
   if(result.phase)setPhase(result.phase);if(result.folder)setFolder(result.folder);
   if(result.phase==='installerOpened')setNotice('Установщик Android запрошен. Подтверди установку или отмени её в Android. После возвращения нажми «Проверить установку», затем «Играть». Завершение установки пока не подтверждено.');
   else if(result.phase==='permissionRequired')setNotice('Нужно вручную разрешить установку из TemkaLauncher. Открой настройки источника отдельной кнопкой, вернись и повтори установку. Общую защиту не отключай.');
   else if(result.phase==='settingsOpened')setNotice('Настройки запрошены. Разрешение меняешь только ты. Вернись и повтори установку.');
   else if(result.phase==='launchRequested')setNotice('Запуск Fantazia TEST запрошен у Android. Это не подтверждение загрузки игрового мира или начала игровой сессии.');
   else if(result.phase==='running')setNotice('Запущен процесс Windows-клиента. При первом подключении адрес сервера: '+ 'https://fantazia-rp-3d1.onrender.com/');
   else if(result.phase==='installed'&&kind==='install')setNotice('Пакет проверен и установлен. Игра сама не запускается — нажми «Играть».');
  }catch(e){if(alive.current){setError(e instanceof Error?e.message:'Не удалось выполнить действие.');if(kind==='status')setPhase('unknown');}}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 useEffect(()=>{alive.current=true;modal.current?.showModal();void action('status');const remove=onBetaProgress(s=>{if(alive.current){setPhase(s.phase);setProgress(s.progress||0);}});const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeRef.current();}};window.addEventListener('keydown',key,true);return()=>{alive.current=false;remove();window.removeEventListener('keydown',key,true);modal.current?.close();};},[]);
 const installed=phase==='installed'||phase==='running'||phase==='launchRequested',canInstall=!['checking','unknown'].includes(phase),settings=['permissionRequired','settingsOpened'].includes(phase);
 return createPortal(<dialog ref={modal} className="public-beta-dialog" aria-labelledby="public-beta-title" onCancel={e=>{e.preventDefault();close();}}><header><div><small>ЗАКРЫТЫЙ БЕТА-ТЕСТ · ПО КЛЮЧУ</small><h2 id="public-beta-title">Fantazia RP3D · Beta0.1</h2></div><button aria-label="Закрыть скачивание беты" onClick={close}>×</button></header><div className="public-beta-body"><p>Это ранняя тестовая версия: возможны ошибки, нестабильная работа и изменения сохранений. Доступ выдаёт автор по ключу; перед установкой и запуском лаунчер проверяет разрешение аккаунта на сервере.</p><dl><div><dt>Платформа</dt><dd>{asset?.label}</dd></div><div><dt>{android?'Встроенный APK':'Архив загрузки'}</dt><dd>{asset?.filename}</dd></div><div><dt>Размер</dt><dd>{asset?betaSize(asset.bytes):'—'}</dd></div><div><dt>Состояние</dt><dd>{installed?'Установка найдена':busy?'Проверяем / обрабатываем…':'Установка не подтверждена'}</dd></div></dl>
 <p className="public-beta-note">Нужны интернет и работающий основной сайт <strong>fantazia-rp-3d1.onrender.com</strong>. Холодный запуск Render может занять до2минут. Это онлайн-клиент, не офлайн-игра. Игровой вход отдельный: SSO с лаунчером не добавлялся.</p>
 <p>{android?'Оригинальный клиент1.0.2 TEST встроен в APK лаунчера. Android сам устанавливает приложение и запрашивает разрешения. Временная TEST-подпись может отличаться от других тестовых сборок: автоматически приложения и данные не удаляются.':'Лаунчер скачивает153МБ и проверяет SHA256 обоих ZIP, затем распаковывает весь portable-пакет вместе с DLL/resources/locales. Нужно не менее1ГБ свободного места. В браузер за файлом не переходим. После установки отдельная кнопка запускает Fantazia RP3D.exe, без shell/PowerShell и без установщика.'}</p>
 {!android&&folder&&<p>Папка игры: <code>{folder}</code>. Другую папку можно выбрать в Настройки → Обзор до установки.</p>}<button onClick={()=>void copyText('https://fantazia-rp-3d1.onrender.com/').then(()=>setNotice('Адрес основного сервера скопирован.')).catch(e=>setError(e.message))}>Скопировать адрес игры</button><p>Ключ ограничивает получение и запуск через лаунчер. Пересланная отдельно копия EXE/APK не блокируется; вход в саму игру не менялся. За загрузку, установку или отправленный launch Intent игровые часы/XP не начисляются.</p>
 <label className="public-beta-consent"><input type="checkbox" checked={accepted} disabled={busy} onChange={e=>setAccepted(e.target.checked)}/><span>Я понимаю риски раннего бета-теста и хочу установить или запустить тестовый клиент.</span></label>
 {['downloading','extracting'].includes(phase)&&<p role="status">{phase==='downloading'?`Скачиваем: ${progress}%`:'Проверяем и распаковываем файлы…'}</p>}
 {error&&<p role="alert" className="public-beta-error">{error}</p>}{notice&&<p role="status" className="public-beta-notice">{notice}</p>}
 <button disabled={busy} onClick={()=>void action('status')}>Проверить установку</button>{settings&&<button disabled={busy||!accepted} onClick={()=>void action('settings')}>Настройки установки Android</button>}
 </div><footer><button onClick={close}>Закрыть</button><button className="public-beta-primary" disabled={!accepted||busy||['downloading','extracting'].includes(phase)||(!installed&&!canInstall)} onClick={()=>void action(installed?'launch':'install')}>{busy?'Обрабатываем…':installed?'Играть':android?'Открыть установщик Android':'Скачать и установить'}</button></footer></dialog>,document.body);
}
