import type { Friendship } from './online';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function readFriendships(value: unknown, me: string): Friendship[] {
  if(!uuid.test(me)||!Array.isArray(value))throw Error('Сервер не подтвердил список друзей.');
  const seen=new Set<string>();
  return value.map(item=>{
    const r=item as Friendship;
    if(!r||!uuid.test(r.request_id)||!uuid.test(r.requester_id)||!uuid.test(r.receiver_id)||r.requester_id===r.receiver_id||![r.requester_id,r.receiver_id].includes(me)||r.other_id!==(r.requester_id===me?r.receiver_id:r.requester_id)||!['pending','accepted'].includes(r.status)||typeof r.username!=='string'||!r.username.match(/^[a-zа-яё0-9_]{3,25}$/i)||typeof r.has_avatar!=='boolean'||typeof r.is_creator!=='boolean'||!Number.isSafeInteger(r.avatar_version)||r.avatar_version<0||seen.has(r.request_id))throw Error('Сервер вернул некорректную заявку. Обнови список.');
    seen.add(r.request_id);return r;
  });
}
export function incomingRequests(rows: Friendship[], me: string): Friendship[] {
  return rows.filter(row=>row.status==='pending'&&row.receiver_id===me);
}
export function readOnlineProfiles(value:unknown): import('./online').OnlineProfile[] {
  if(!Array.isArray(value)||value.length>1)throw Error('Сервер не подтвердил профиль.');
  return value.map(r=>{
    if(!r||!uuid.test(r.id)||typeof r.username!=='string'||!/^[a-zа-яё0-9_]{3,25}$/i.test(r.username)||typeof r.has_avatar!=='boolean'||typeof r.is_creator!=='boolean'||!Number.isSafeInteger(r.avatar_version)||r.avatar_version<0)throw Error('Сервер вернул некорректный профиль.');
    return r;
  });
}
export type FriendTab='friends'|'incoming'|'outgoing';
export function groupFriends(rows:Friendship[],me:string):Record<FriendTab,Friendship[]> {
  return {friends:rows.filter(r=>r.status==='accepted').sort((a,b)=>a.username.localeCompare(b.username,'ru')),incoming:incomingRequests(rows,me),outgoing:rows.filter(r=>r.status==='pending'&&r.requester_id===me)};
}
export function onlineError(error:unknown):string {
  const text=error instanceof Error?error.message:String(error);
  if(/failed to fetch|networkerror|load failed|network request failed/i.test(text))return 'Нет связи с сервером. Проверь интернет и повтори попытку.';
  if(/token.*expired|otp.*expired|invalid.*otp/i.test(text))return 'Код неверный или устарел. Запроси новый и введи последний код из письма.';
  return text.slice(0,300)||'Не удалось связаться с сервером.';
}
