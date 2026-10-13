import type {Account, Store} from './auth';
import type {OnlineProfile, Session} from './online';
export const ACCOUNT_KEY='temka-accounts-v1';
type StoragePort=Pick<Storage,'getItem'|'setItem'|'removeItem'>;

// Two-key commit with rollback: never open the launcher on a partially saved login.
export function saveAccountSession(storage:StoragePort,next:Store,key:string,session:Session|null) {
  const oldAccount=storage.getItem(ACCOUNT_KEY),oldSession=storage.getItem(key);
  const restore=(k:string,v:string|null)=>v===null?storage.removeItem(k):storage.setItem(k,v);
  try {
    restore(key,session?JSON.stringify(session):null);
    storage.setItem(ACCOUNT_KEY,JSON.stringify(next));
  } catch {
    let failed=false;
    try {restore(key,oldSession);} catch {failed=true;}
    try {restore(ACCOUNT_KEY,oldAccount);} catch {failed=true;}
    throw Error(failed?'Хранилище недоступно. Не удалось восстановить сохранённую сессию; освободи место и перезапусти лаунчер.':'Не удалось сохранить вход. Освободи место или разреши хранение данных и повтори.');
  }
}

export function commitEntry(storage:StoragePort,sessionKey:(id:string)=>string,identity:{id:string;email:string},profile:OnlineProfile,session:Session):Store {
  if(profile.id!==identity.id || session.user.id!==identity.id)throw Error('Аккаунт изменился. Повтори вход.');
  const raw=storage.getItem(ACCOUNT_KEY);
  const store:Store=raw?JSON.parse(raw):{users:[],session:null};
  if(!Array.isArray(store.users))throw Error('Не удалось прочитать профили устройства. Данные не изменены.');
  // Matching a local nickname/email proves nothing. Only an existing UID binding or
  // the UID of its previously saved cloud session may reuse a legacy device profile.
  const account=store.users.find(u=>u.onlineUserId===identity.id) || store.users.find(u=>{
    if(u.onlineUserId)return false;
    try {return JSON.parse(storage.getItem(sessionKey(u.id))||'null')?.user?.id===identity.id;}catch{return false;}
  });
  const id=account?.id || `online-${identity.id}`;
  if(!account && store.users.some(u=>u.id===id))throw Error('Конфликт профилей устройства. Существующие данные не изменены.');
  const user:Account=account ? {...account,onlineUserId:identity.id,email:identity.email} : {
    id,onlineUserId:identity.id,username:profile.username,email:identity.email,passHash:'',createdAt:new Date().toISOString(),
    profile:{avatar:'cube',color:'#ff7a2f',title:'newbie',status:'Игрок Temka'},
  };
  const next:Store={users:account?store.users.map(u=>u.id===id?user:u):[...store.users,user],session:id};
  saveAccountSession(storage,next,sessionKey(id),session);
  return next;
}
