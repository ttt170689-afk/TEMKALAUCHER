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
