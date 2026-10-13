import {useEffect,useRef,useState} from 'react';
import {useAuth} from '../lib/auth';
import {useOnlineAccount} from '../lib/onlineAccount';
import {groupFriends,onlineError} from '../lib/friendContract';
import type {FriendTab} from '../lib/friendContract';
import {onlineAvatar} from '../lib/online';
import type {Friendship,OnlineProfile} from '../lib/online';
import './social.css';
export function OnlinePerson({person}:{person:OnlineProfile}){
 return <div className="social-person"><span className="social-avatar">{person.username[0]?.toUpperCase()}{person.has_avatar&&<img src={onlineAvatar(person.id,person.avatar_version)} alt="Аватар игрока" onError={e=>{e.currentTarget.hidden=true;}}/>}</span><div><strong>@{person.username}</strong>{person.is_creator&&<small>Создатель · Администратор</small>}</div></div>;
}
export function FriendActions({row}:{row:Friendship}){
 const {client,action,busy,loading}=useOnlineAccount();const [confirm,setConfirm]=useState(false),disabled=busy||loading;
 if(row.status==='accepted')return <div className="social-actions">{confirm?<><span>Удалить @{row.username} из друзей?</span><button className="social-danger" disabled={disabled} onClick={()=>void action(()=>client.remove(row.request_id),`@${row.username} удалён из друзей.`)}>Да, удалить</button><button onClick={()=>setConfirm(false)}>Отмена</button></>:<button disabled={disabled} onClick={()=>setConfirm(true)}>Удалить из друзей</button>}</div>;
 const incoming=row.receiver_id===client.session?.user.id;
 return <div className="social-actions">{incoming&&<button className="social-primary" disabled={disabled} onClick={()=>void action(()=>client.accept(row.request_id),`@${row.username} добавлен в друзья.`)}>Принять</button>}<button disabled={disabled} onClick={()=>void action(()=>client.remove(row.request_id,true),incoming?`Заявка от @${row.username} отклонена.`:'Заявка отменена.')}>{incoming?'Отклонить':'Отменить заявку'}</button></div>;
}
export function AccountGate({onProfile}:{onProfile:()=>void}){
 const {mode,profile,error,loading,refresh}=useOnlineAccount();
 if(mode==='verified'&&profile)return null;
 return <div className="social-panel social-empty" role="status"><h3>{mode==='checking'?'Проверяем аккаунт…':mode==='error'?'Не удалось подключиться':mode==='verified'?'Выбери свой @юзернейм':mode==='disabled'?'Онлайн-сервер не подключён':'Сначала подтверди почту'}</h3>
  <p>{mode==='error'?error:mode==='verified'?'Сохрани онлайн-юзернейм в профиле. После этого тебя смогут найти друзья.':mode==='checking'?'Это займёт немного времени.':'Локальный профиль остаётся на устройстве. Для друзей нужен подтверждённый онлайн-профиль.'}</p>
  <div className="social-actions">{mode==='error'&&<button disabled={loading} onClick={()=>void refresh()}>Повторить подключение</button>}{mode!=='checking'&&<button className="social-primary" onClick={onProfile}>{mode==='verified'?'Выбрать юзернейм':'Подтвердить почту в профиле'}</button>}</div>
 </div>;
}
export default function FriendsView({onProfile}:{onProfile:()=>void}){
 const {user}=useAuth();const account=useOnlineAccount(),{client,profile,friends,mode,refresh,loading,busy}=account;
 const [tab,setTab]=useState<FriendTab>('friends'),[filter,setFilter]=useState(''),[searchOpen,setSearchOpen]=useState(false),[query,setQuery]=useState('');
 const [results,setResults]=useState<OnlineProfile[]>([]),[searched,setSearched]=useState(false),[searching,setSearching]=useState(false),[searchError,setSearchError]=useState(''),[copyNotice,setCopyNotice]=useState('');
 const input=useRef<HTMLInputElement>(null),sequence=useRef(0),alive=useRef(true),searchLock=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sequence.current++;};},[]);
 useEffect(()=>{if(searchOpen)input.current?.focus();},[searchOpen]);
 useEffect(()=>{sequence.current++;setResults([]);setSearched(false);setSearching(false);searchLock.current=false;},[client.session?.user.id]);
 const groups=groupFriends(friends,client.session?.user.id||'');
 const displayed=groups[tab].filter(r=>r.username.toLocaleLowerCase('ru').includes(filter.trim().replace(/^@/,'').toLocaleLowerCase('ru')));
 async function search(){
  if(searchLock.current)return;const ticket=++sequence.current,me=client.session?.user.id;searchLock.current=true;setSearching(true);setSearched(false);setResults([]);setSearchError('');
  try{const rows=await client.search(query);if(alive.current&&ticket===sequence.current&&client.session?.user.id===me){setResults(rows);setSearched(true);}}
  catch(e){if(alive.current&&ticket===sequence.current)setSearchError(onlineError(e));}
  finally{if(alive.current&&ticket===sequence.current){setSearching(false);searchLock.current=false;}}
 }
 const ready=mode==='verified'&&!!profile;
 return <div className="social-page" data-friends-page>
  <header className="social-page-heading"><div><p className="social-eyebrow">TEMKA / ВМЕСТЕ</p><h1>Друзья</h1><p className="social-muted">Найди своих. Пригласи в следующий мир.</p></div><button className="social-primary" disabled={!ready} onClick={()=>{setSearchOpen(true);input.current?.focus();}}>＋ Добавить друга</button></header>
  <AccountGate onProfile={onProfile}/>
  {ready&&<>
   <section className="social-panel social-own"><div><p className="social-eyebrow">ТЕБЯ МОЖНО НАЙТИ</p><strong>{user?.username}</strong><p className="social-handle">@{profile.username}</p></div><div className="social-actions"><button onClick={onProfile}>Мой профиль</button><button aria-label="Скопировать свой юзернейм" onClick={async()=>{try{await navigator.clipboard.writeText('@'+profile.username);setCopyNotice('Юзернейм скопирован.');}catch{setCopyNotice(`Скопируй вручную: @${profile.username}`);}}}>Скопировать @юзернейм</button></div></section>
   {searchOpen&&<section className="social-panel" aria-labelledby="friend-search-title"><div className="social-heading"><h2 id="friend-search-title">Добавить друга</h2><button aria-label="Закрыть поиск друзей" onClick={()=>{setSearchOpen(false);sequence.current++;searchLock.current=false;setSearching(false);}}>×</button></div>
    <form className="social-form" onSubmit={e=>{e.preventDefault();void search();}}><label>Юзернейм друга<input aria-label="Юзернейм друга" ref={input} placeholder="@юзернейм" value={query} maxLength={26} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={e=>{sequence.current++;searchLock.current=false;setSearching(false);setQuery(e.target.value);setResults([]);setSearched(false);setSearchError('');}}/><small>Введи полный онлайн-юзернейм. Регистр букв не важен.</small></label><button className="social-primary" disabled={searching||!query.trim()||busy}>Найти друга</button></form>
    {searching&&<p role="status" className="social-muted">Ищем игрока…</p>}{searched&&!results.length&&<p role="status" className="social-muted">Игрок не найден. Проверь полный онлайн-юзернейм.</p>}
    {results.map(person=>{const relation=friends.find(r=>r.other_id===person.id);return <article className="social-row" key={person.id} data-search-result><OnlinePerson person={person}/>{person.id===client.session?.user.id?<span className="social-chip">Это ты</span>:relation?<div><p className="social-muted">{relation.status==='accepted'?'Уже в друзьях':relation.receiver_id===client.session?.user.id?'Этот игрок уже прислал заявку':'Заявка уже отправлена'}</p><>{relation.status==='accepted'?<button onClick={()=>{setSearchOpen(false);setTab('friends');setFilter(person.username);}}>Показать в списке</button>:<FriendActions row={relation}/>}</></div>:<button className="social-primary" disabled={busy||loading||!!account.friendsError} onClick={()=>void account.action(()=>client.invite(person.id),'Заявка отправлена. Друг сможет принять её в уведомлениях.')}>Отправить заявку</button>}</article>;})}
   </section>}
   <section className="social-panel">
    <div className="social-tabs" role="tablist" aria-label="Друзья и заявки">{(['friends','incoming','outgoing'] as const).map((id,index)=><button key={id} id={`friends-tab-${id}`} role="tab" aria-controls="friends-list" aria-selected={tab===id} tabIndex={tab===id?0:-1} onClick={()=>{setTab(id);setFilter('');}} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(index+(e.key==='ArrowRight'?1:2))%3;const key=(['friends','incoming','outgoing'] as const)[next];setTab(key);setFilter('');document.getElementById('friends-tab-'+key)?.focus();}}>{id==='friends'?'Все друзья':id==='incoming'?'Входящие':'Исходящие'} <span>{groups[id].length}</span></button>)}</div>
    <div className="social-list-tools"><label><span className="sr-only">Фильтр текущего списка</span><input placeholder="Фильтр по юзернейму…" value={filter} maxLength={25} onChange={e=>setFilter(e.target.value)}/></label><button aria-label="Обновить список" title="Обновить список" disabled={loading||busy} onClick={()=>{account.clearMessage();void refresh();}}>Обновить список</button></div>
    <div id="friends-list" role="tabpanel" aria-labelledby={`friends-tab-${tab}`} aria-busy={loading}>
     {account.friendsError?<p className="social-alert" role="alert">{account.friendsError}</p>:<>{!displayed.length&&<div className="social-empty"><h3>{filter?'Совпадений нет':tab==='friends'?'Здесь будут твои друзья':tab==='incoming'?'Входящих заявок нет':'Исходящих заявок нет'}</h3><p>{filter?'Попробуй другой юзернейм.':tab==='friends'?'Нажми «Добавить друга» и найди игрока по @юзернейму.':tab==='incoming'?'Поделись своим @юзернеймом с братом или друзьями.':'Здесь появятся отправленные тобой приглашения.'}</p>{filter&&<button onClick={()=>setFilter('')}>Сбросить фильтр</button>}</div>}{displayed.map(row=><article className="social-row" key={row.request_id} data-friend-row={row.request_id}><OnlinePerson person={{...row,id:row.other_id}}/><FriendActions row={row}/></article>)}</>}
    </div><p className="social-sync" role="status">{loading?'Обновляем список…':account.friendsError?'Список не подтверждён сервером':account.updated?`Проверено в ${new Date(account.updated).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})} · Автообновление каждые 30 с`:'Ожидаем данные сервера'}</p>
   </section>
  </>}
  {copyNotice&&<p className="social-success" role="status">{copyNotice}</p>}{searchError&&<p className="social-alert" role="status">{searchError}</p>}{account.actionError&&<p className="social-alert" role="alert">{account.actionError}</p>}{account.notice&&<p className="social-success" role="status">{account.notice}</p>}
 </div>;
}
