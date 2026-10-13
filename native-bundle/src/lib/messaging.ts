export interface DirectMessage{id:string;sender_id:string;receiver_id:string;body:string;created_at:string;}
export interface MessageThread{peer_id:string;username:string;has_avatar:boolean;avatar_version:number;is_creator:boolean;can_send:boolean;last_message:string|null;last_at:string|null;unread:number;}
export interface ActivitySession{id:string;game_id:string;platform:string;started_at:string;last_seen_at:string;ended_at?:string|null;}
export interface PlayerActivity{playing:ActivitySession|null;history:ActivitySession[];}
export const isUUID=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const date=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v));
export function readMessages(data:unknown,me:string,peer:string):DirectMessage[]{
 if(!Array.isArray(data)||data.length>50)throw Error('Некорректная история сообщений.');const ids=new Set();
 return data.map(m=>{if(!m||!isUUID(m.id)||ids.has(m.id)||!isUUID(m.sender_id)||!isUUID(m.receiver_id)||m.sender_id===m.receiver_id||!((m.sender_id===me&&m.receiver_id===peer)||(m.sender_id===peer&&m.receiver_id===me))||typeof m.body!=='string'||!m.body.trim()||m.body.length>4000||!date(m.created_at))throw Error('Сообщение не принадлежит этому диалогу.');ids.add(m.id);return m;});
}
export function readThreads(data:unknown,me:string):MessageThread[]{
 if(!Array.isArray(data)||data.length>100)throw Error('Некорректный список диалогов.');const ids=new Set();
 return data.map(t=>{if(!t||!isUUID(t.peer_id)||t.peer_id===me||ids.has(t.peer_id)||typeof t.username!=='string'||!/^[a-zа-яё0-9_]{3,25}$/i.test(t.username)||typeof t.has_avatar!=='boolean'||!Number.isSafeInteger(t.avatar_version)||t.avatar_version<0||typeof t.is_creator!=='boolean'||typeof t.can_send!=='boolean'||!Number.isSafeInteger(t.unread)||t.unread<0||(t.last_at!==null&&!date(t.last_at))||(t.last_message!==null&&(typeof t.last_message!=='string'||t.last_message.length>360)))throw Error('Сервер вернул некорректный диалог.');ids.add(t.peer_id);return t;});
}
export function readActivitySession(v:unknown):ActivitySession{
 const s=v as ActivitySession;if(!s||!isUUID(s.id)||!['fantazia','temkaworld'].includes(s.game_id)||!['windows','linux','android','ios'].includes(s.platform)||!date(s.started_at)||!date(s.last_seen_at)||(s.ended_at!==undefined&&s.ended_at!==null&&!date(s.ended_at)))throw Error('Некорректная игровая активность.');return s;
}
export function readActivity(data:unknown):PlayerActivity{const a=data as PlayerActivity;if(!a||!Array.isArray(a.history)||a.history.length>20)throw Error('Активность не подтверждена сервером.');const history=a.history.map(readActivitySession);if(new Set(history.map(s=>s.id)).size!==history.length)throw Error('Повторяющиеся игровые сессии.');const playing=a.playing===null?null:readActivitySession(a.playing);if(playing?.ended_at)throw Error('Завершённая игра не может быть активной.');return {playing,history};}
export function mergeMessages(old:DirectMessage[],next:DirectMessage[]){const map=new Map(old.map(m=>[m.id,m]));for(const m of next)map.set(m.id,m);return [...map.values()].sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||a.id.localeCompare(b.id));}
export function newMessageNonce(){if(crypto.randomUUID)return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const s=[...b].map(n=>n.toString(16).padStart(2,'0')).join('');return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;}
export function openMessages(peerId?:string){window.dispatchEvent(new CustomEvent('temka-open-messages',{detail:{peerId:isUUID(peerId)?peerId:null}}));}
