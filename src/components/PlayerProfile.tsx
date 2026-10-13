import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useOnlineAccount} from '../lib/onlineAccount';
import {onlineAvatar} from '../lib/online';
import {openPlayerProfile,playerError,formatPlaytime} from '../lib/playerCard';
import type {PlayerCard,GameStats} from '../lib/playerCard';
import {GAMES} from '../data/games';
import {AvatarSvg} from './AvatarSvg';
import {FriendActions} from './FriendsView';
import './player-profile.css';
export function PlayerAvatar({card,size=88}:{card:PlayerCard;size?:number}){
 const [broken,setBroken]=useState(false);useEffect(()=>setBroken(false),[card.id,card.avatar_version]);
 return card.has_avatar&&!broken?<img className="player-photo" width={size} height={size} src={onlineAvatar(card.id,card.avatar_version)} alt={`Аватар @${card.username}`} onError={()=>setBroken(true)}/>:<AvatarSvg variant={card.avatar_style} color={card.avatar_color} size={size}/>;
}
export function GameStatsView({stats}:{stats?:GameStats}){
 return <><div className="player-stats"><div><span>Уровень в игре</span><strong>{stats?.level??'Нет данных'}</strong></div><div><span>Время в игре</span><strong>{formatPlaytime(stats?.play_seconds)}</strong></div><div><span>Последний запуск</span><strong>{stats?.last_played_at?new Date(stats.last_played_at).toLocaleDateString('ru-RU'):'Нет данных'}</strong></div></div>
 <div className="player-achievements"><h4>Достижения {stats?.achievements_total!=null&&<small>{stats.achievements.length} / {stats.achievements_total}</small>}</h4>{stats?.achievements_total!=null?<><progress aria-label="Прогресс достижений" value={stats.achievements.length} max={Math.max(1,stats.achievements_total)}/>{stats.achievements.length?<ul>{stats.achievements.map(a=><li key={a.id}><span aria-hidden="true">✦</span><div><strong>{a.title}</strong><small>{new Date(a.earned_at).toLocaleDateString('ru-RU')}</small></div></li>)}</ul>:<p>Игра пока не передала полученных достижений.</p>}</>:<p>Достижения ещё не подключены к игре.</p>}</div></>;
}
export default function PlayerProfileHost(){
 const account=useOnlineAccount(),me=account.client.session?.user.id;
 const [id,setId]=useState<string|null>(null);
 useEffect(()=>{const open=(e:Event)=>{const id=(e as CustomEvent).detail?.id;if(typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id))setId(id);};window.addEventListener('temka-open-player',open);return()=>window.removeEventListener('temka-open-player',open);},[]);
 useEffect(()=>setId(null),[me,account.mode]);
 return id&&account.mode==='verified'?<PlayerProfileDialog key={`${me}:${id}`} id={id} close={()=>setId(null)}/>:null;
}
function PlayerProfileDialog({id,close}:{id:string;close:()=>void}){
 const account=useOnlineAccount(),me=account.client.session?.user.id;
 const [card,setCard]=useState<PlayerCard|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 const panel=useRef<HTMLDivElement>(null),closeRef=useRef(close);closeRef.current=close;
 useEffect(()=>{let active=true;setLoading(true);setError('');setCard(null);account.client.playerCard(id).then(p=>{if(active)setCard(p);}).catch(e=>{if(active)setError(playerError(e));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[account.client,id,me,retry]);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;panel.current?.querySelector<HTMLButtonElement>('[aria-label="Закрыть профиль игрока"]')?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();closeRef.current();}if(e.key==='Tab'){const items=[...panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,[tabindex="0"]')||[]].filter(el=>el.getClientRects().length);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus();else document.querySelector<HTMLButtonElement>('nav button[aria-label="Друзья"]')?.focus();};},[]);
 const relation=account.friends.find(r=>r.other_id===id);
 return createPortal(<div className="player-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)close();}}><section ref={panel} className="player-dialog" role="dialog" aria-modal="true" aria-labelledby="player-title">
 <header className="player-dialog-top"><span>TEMKA / ИГРОК</span><button aria-label="Закрыть профиль игрока" onClick={close}>×</button></header>
 <h2 id="player-title" className="sr-only">Профиль игрока</h2>
 {loading&&<p className="player-loading" role="status">Открываем профиль…</p>}
 {error&&<div className="player-loading" role="alert"><p>{error}</p><button onClick={()=>setRetry(n=>n+1)}>Повторить загрузку профиля</button></div>}
 {card&&<><div className="player-cover"><PlayerAvatar card={card}/><div><span className="player-label">{card.is_creator?'СОЗДАТЕЛЬ · АДМИНИСТРАТОР':'ИГРОК TEMKA'}</span><h2>{card.display_name||card.username}</h2><p>@{card.username}</p></div>{me===id?<span className="player-tag">Это твой профиль</span>:<div className="player-connect">{relation?<><small>{relation.status==='accepted'?'Уже в друзьях':relation.receiver_id===me?'Входящая заявка':'Заявка отправлена'}</small><FriendActions row={relation}/></>:<button className="social-primary" disabled={account.busy||account.loading||!!account.friendsError||!account.profile} onClick={()=>void account.action(()=>account.client.invite(id),'Заявка отправлена.')}>Добавить в друзья</button>}</div>}</div>
 <div className="player-content"><section className="player-about"><span className="player-label">ОБ ИГРОКЕ</span><p>{card.bio||'Игрок ещё не рассказал о себе.'}</p><small>Профиль виден вошедшим игрокам. Почта и локальные данные скрыты.</small></section>
 {account.friendsError&&<p role="alert">Не удалось проверить дружбу: {account.friendsError}</p>}{account.actionError&&<p role="alert">{account.actionError}</p>}{account.notice&&<p role="status">{account.notice}</p>}
 <div className="player-games-heading"><h3>Игровой профиль</h3><span>ДАННЫЕ ИЗ ИГР</span></div>{[...GAMES].sort((a,b)=>Number(card.games.some(g=>g.game_id===b.id))-Number(card.games.some(g=>g.game_id===a.id))).map(game=><section className="player-game" key={game.id}><header><span style={{background:game.accent}}/><h3>{game.title}</h3><small>{card.games.some(g=>g.game_id===game.id)?'Передано игровым сервером':'Статистика ещё не подключена'}</small></header><GameStatsView stats={card.games.find(g=>g.game_id===game.id)}/></section>)}
 <p className="player-fine">Уровни, часы и награды появляются после подключения игры. Время открытого лаунчера не считается игровым.</p></div></>}
 </section></div>,document.body);
}
export function OnlineProfileEditor({fallbackName}:{fallbackName:string}){
 const {client,profile}=useOnlineAccount();const me=client.session?.user.id;
 const [name,setName]=useState(''),[bio,setBio]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(true),[loaded,setLoaded]=useState(false),[retry,setRetry]=useState(0);
 const alive=useRef(true),generation=useRef(0);useEffect(()=>{alive.current=true;const ticket=++generation.current;setBusy(true);setError('');setLoaded(false);if(!me)return;client.playerCard(me).then(card=>{if(alive.current&&ticket===generation.current){setName(card.display_name||fallbackName);setBio(card.bio);setLoaded(true);}}).catch(e=>{if(alive.current&&ticket===generation.current)setError(playerError(e));}).finally(()=>{if(alive.current&&ticket===generation.current)setBusy(false);});return()=>{alive.current=false;generation.current++;};},[client,me,retry]);
 if(!profile||!me)return null;
 return <details className="social-help player-editor"><summary>Как меня видят другие игроки</summary><p>Имя и описание будут видны всем вошедшим игрокам. Почта не публикуется.</p><button onClick={()=>openPlayerProfile(me)}>Открыть мой публичный профиль</button><form onSubmit={e=>{e.preventDefault();const ticket=generation.current;setBusy(true);setError('');setNotice('');void client.savePlayerCard(name,bio).then(()=>{if(alive.current&&ticket===generation.current)setNotice('Онлайн-профиль сохранён.');}).catch(e=>{if(alive.current&&ticket===generation.current)setError(playerError(e));}).finally(()=>{if(alive.current&&ticket===generation.current)setBusy(false);});}}><label>Имя для других игроков<input aria-label="Имя для других игроков" value={name} maxLength={25} disabled={busy||!loaded} onChange={e=>setName(e.target.value)}/></label><label>О себе<textarea aria-label="О себе" value={bio} maxLength={160} disabled={busy||!loaded} onChange={e=>setBio(e.target.value)}/><small>{bio.length}/160</small></label><button disabled={busy||!loaded||!name.trim()}>Сохранить публичный профиль</button></form>{busy&&<p role="status">Проверяем профиль…</p>}{error&&<div role="alert"><p>{error}</p><button disabled={busy} onClick={()=>setRetry(n=>n+1)}>Повторить подключение профиля</button></div>}{notice&&<p role="status">{notice}</p>}</details>;
}
