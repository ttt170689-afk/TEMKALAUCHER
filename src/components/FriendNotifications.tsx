import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {getCloudClient,ONLINE_CHANGED,onlineEnabled,onlineAvatar} from '../lib/online';
import type {Friendship} from '../lib/online';
import {incomingRequests} from '../lib/friendContract';
import {IconBell} from './ui';
import './friend-notifications.css';

type Mode='checking'|'signedOut'|'unverified'|'verified'|'offline'|'error';
export default function FriendNotifications({localId,onProfile}:{localId:string;onProfile:()=>void}) {
  const client=useMemo(()=>getCloudClient(localId),[localId]);
  const [open,setOpen]=useState(false),[rows,setRows]=useState<Friendship[]>([]);
  const [mode,setMode]=useState<Mode>('checking'),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
  const alive=useRef(true),generation=useRef(0),actionLock=useRef(false);
  const refresh=useCallback(async()=>{
    const ticket=++generation.current,me=client.session?.user.id;
    if(!onlineEnabled||!me){setRows([]);setMode(onlineEnabled?'signedOut':'offline');setLoading(false);setError('');setNotice('');return;}
    setLoading(true);setError('');
    try{
      const verified=await client.emailVerified();
      if(!alive.current||ticket!==generation.current||client.session?.user.id!==me)return;
      if(!verified){setRows([]);setMode('unverified');return;}
      const list=await client.friends();
      if(!alive.current||ticket!==generation.current||client.session?.user.id!==me)return;
      setRows(incomingRequests(list,me));setMode('verified');
    }catch(e){if(alive.current&&ticket===generation.current){setRows([]);setMode('error');setError(e instanceof Error?e.message:'Не удалось получить уведомления.');}}
    finally{if(alive.current&&ticket===generation.current)setLoading(false);}
  },[client]);
  useEffect(()=>{
    alive.current=true;void refresh();
    const changed=(event:Event)=>{if((event as CustomEvent).detail?.localId!==localId)return;generation.current++;setRows([]);setNotice('');setMode('checking');void refresh();};
    const visible=()=>{if(!document.hidden)void refresh();};
    const timer=window.setInterval(()=>{if(!document.hidden&&!actionLock.current)void refresh();},30000);
    window.addEventListener(ONLINE_CHANGED,changed);window.addEventListener('focus',visible);window.addEventListener('online',visible);document.addEventListener('visibilitychange',visible);
    return()=>{alive.current=false;generation.current++;clearInterval(timer);window.removeEventListener(ONLINE_CHANGED,changed);window.removeEventListener('focus',visible);window.removeEventListener('online',visible);document.removeEventListener('visibilitychange',visible);};
  },[localId,refresh]);
  useEffect(()=>{
    if(!open)return;
    const previous=document.activeElement as HTMLElement|null;
    panel.current?.querySelector<HTMLButtonElement>('[aria-label="Закрыть уведомления"]')?.focus();
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){e.preventDefault();setOpen(false);}
      if(e.key==='Tab'){
        const items=[...panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]')||[]].filter(el=>el.getClientRects().length>0);
        const first=items[0],last=items[items.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    };
    window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus();};
  },[open]);
  async function decide(row:Friendship,accept:boolean){
    if(actionLock.current||mode!=='verified'||row.receiver_id!==client.session?.user.id)return;
    actionLock.current=true;setBusy(true);setError('');setNotice('');const me=client.session.user.id;
    try{
      if(accept)await client.accept(row.request_id);else await client.remove(row.request_id,true);
      if(!alive.current||client.session?.user.id!==me)return;
      setNotice(accept?`@${row.username} добавлен в друзья.`:`Заявка от @${row.username} отклонена.`);
      await refresh();
    }catch(e){if(alive.current&&client.session?.user.id===me){await refresh();if(alive.current&&client.session?.user.id===me)setError(e instanceof Error?e.message:'Действие не подтверждено сервером.');}}
    finally{actionLock.current=false;if(alive.current)setBusy(false);}
  }
  const count=mode==='verified'?rows.length:0;
  const profile=()=>{setOpen(false);onProfile();};
  return <>
    <button ref={trigger} className="friend-bell" aria-label={`Уведомления${count?`, входящих заявок: ${count}`:''}`} aria-haspopup="dialog" aria-expanded={open} title="Уведомления" onClick={()=>{setOpen(true);setNotice('');void refresh();}}>
      <IconBell/><span className="friend-bell-label">Уведомления</span>{count>0&&<span className="friend-badge" aria-hidden="true">{count>99?'99+':count}</span>}
    </button>
    {open&&createPortal(<div className="friend-notification-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)setOpen(false);}}>
      <section ref={panel} role="dialog" aria-modal="true" aria-labelledby="friend-notifications-title" className="friend-notification-panel">
        <header><div><p className="friend-eyebrow">TEMKA / ДРУЗЬЯ</p><h2 id="friend-notifications-title">Уведомления</h2></div><button className="friend-close" aria-label="Закрыть уведомления" onClick={()=>setOpen(false)}>×</button></header>
        <div className="friend-notification-body">
          <div className="friend-notification-heading"><h3>Заявки в друзья{mode==='verified'?` · ${count}`:''}</h3><button disabled={loading||busy} onClick={()=>void refresh()}>Обновить</button></div>
          {loading&&<p className="friend-muted" role="status">Проверяем сервер…</p>}
          {mode==='offline'&&<div className="friend-empty"><strong>Сервер не подключён</strong><p>Нет настройки онлайн-сервера в этой сборке.</p></div>}
          {(mode==='signedOut'||mode==='unverified')&&<div className="friend-empty"><strong>Сначала подтверди почту</strong><p>Открой профиль, получи код на свою почту и подтверди его. После этого можно добавлять друзей и принимать заявки.</p><button className="friend-primary" onClick={profile}>Подтвердить почту в профиле</button></div>}
          {mode==='verified'&&!loading&&rows.length===0&&<div className="friend-empty"><strong>Новых заявок нет</strong><p>Когда кто-то добавит тебя по онлайн-нику, заявка появится здесь.</p></div>}
          {mode==='verified'&&rows.map(row=><article key={row.request_id} className="friend-request" data-request-id={row.request_id}>
            <div className="friend-sender">{row.has_avatar?<img src={onlineAvatar(row.other_id,row.avatar_version)} alt="Аватар отправителя" onError={e=>{e.currentTarget.style.visibility='hidden';}}/>:<span aria-hidden="true">{row.username[0]?.toUpperCase()}</span>}<div><strong>@{row.username}</strong>{row.is_creator&&<small>Создатель · Администратор</small>}<p>Хочет добавить тебя в друзья</p></div></div>
            <div className="friend-request-actions"><button className="friend-primary" disabled={busy||loading} onClick={()=>void decide(row,true)}>Принять</button><button disabled={busy||loading} onClick={()=>void decide(row,false)}>Отклонить</button></div>
          </article>)}
          {busy&&<p className="friend-muted" role="status">Сохраняем решение на сервере…</p>}
          {error&&<p className="friend-error" role="alert">{error}</p>}{notice&&<p className="friend-notice" role="status">{notice}</p>}
        </div>
        <footer>Проверяем новые заявки каждые 30 секунд, пока лаунчер открыт и виден. Это не системные push-уведомления.</footer>
      </section>
    </div>,document.body)}
  </>;
}
