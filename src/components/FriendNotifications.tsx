import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useOnlineAccount} from '../lib/onlineAccount';
import {incomingRequests} from '../lib/friendContract';
import {IconBell} from './ui';
import {AccountGate,FriendActions,OnlinePerson} from './FriendsView';
import './friend-notifications.css';
export default function FriendNotifications({onProfile,onFriends}:{localId:string;onProfile:()=>void;onFriends:()=>void}) {
 const account=useOnlineAccount(),{mode,client,friends,refresh,loading,busy}=account;
 const [open,setOpen]=useState(false),panel=useRef<HTMLDivElement>(null);
 const rows=incomingRequests(friends,client.session?.user.id||''),count=mode==='verified'?rows.length:0;
 useEffect(()=>{
  if(!open)return;const previous=document.activeElement as HTMLElement|null;
  panel.current?.querySelector<HTMLButtonElement>('[aria-label="Закрыть уведомления"]')?.focus();
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();setOpen(false);}if(e.key==='Tab'){
   const items=[...panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]')||[]].filter(el=>el.getClientRects().length>0);const first=items[0],last=items[items.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  }};window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus();};
 },[open]);
 return <>
  <button className="friend-bell" aria-label={`Уведомления${count?`, входящих заявок: ${count}`:''}`} aria-haspopup="dialog" aria-expanded={open} title="Уведомления" onClick={()=>{setOpen(true);account.clearMessage();void refresh();}}><IconBell/><span className="friend-bell-label">Уведомления</span>{count>0&&<span className="friend-badge" aria-hidden="true">{count>99?'99+':count}</span>}</button>
  {open&&createPortal(<div className="friend-notification-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)setOpen(false);}}><section ref={panel} role="dialog" aria-modal="true" aria-labelledby="friend-notifications-title" className="friend-notification-panel">
   <header><div><p className="friend-eyebrow">TEMKA / ДРУЗЬЯ</p><h2 id="friend-notifications-title">Уведомления</h2></div><button className="friend-close" aria-label="Закрыть уведомления" onClick={()=>setOpen(false)}>×</button></header>
   <div className="friend-notification-body"><div className="friend-notification-heading"><h3>Заявки в друзья · {count}</h3><button disabled={loading||busy} onClick={()=>void refresh()}>Обновить</button></div>
    <AccountGate onProfile={()=>{setOpen(false);onProfile();}}/>
    {mode==='verified'&&account.profile&&<>{account.friendsError?<p className="friend-error" role="alert">{account.friendsError}</p>:<>{!loading&&rows.length===0&&<div className="friend-empty"><strong>Новых заявок нет</strong><p>Найди друзей по @юзернейму или поделись своим.</p></div>}{rows.map(row=><article key={row.request_id} className="friend-request" data-request-id={row.request_id}><OnlinePerson person={{...row,id:row.other_id}}/><p className="friend-muted">Хочет добавить тебя в друзья</p><FriendActions row={row}/></article>)}</>}
     <button className="friend-all" onClick={()=>{setOpen(false);onFriends();}}>Все друзья и заявки →</button></>}
    {loading&&<p className="friend-muted" role="status">Проверяем сервер…</p>}{account.actionError&&<p className="friend-error" role="alert">{account.actionError}</p>}{account.notice&&<p className="friend-notice" role="status">{account.notice}</p>}
   </div><footer>Новые заявки проверяются каждые 30 секунд, пока лаунчер открыт и виден.</footer>
  </section></div>,document.body)}
 </>;
}
