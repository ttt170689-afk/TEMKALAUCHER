export interface GameStats {game_id:string;level:number|null;play_seconds:number|null;last_played_at:string|null;updated_at:string;achievements:{id:string;title:string;earned_at:string}[];achievements_total:number|null;}
export interface PlayerCard {id:string;username:string;display_name:string;bio:string;has_avatar:boolean;avatar_version:number;avatar_style:string;avatar_color:string;is_creator:boolean;games:GameStats[];}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const integer=(v:unknown,max:number)=>v===null||typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max;
export function readPlayerCard(value:unknown,expectedId:string):PlayerCard{
 if(value===null)throw Error('Профиль не найден или больше недоступен.');
 const p=value as PlayerCard;
 if(!p||typeof p!=='object'||!uuid.test(p.id)||p.id!==expectedId||typeof p.username!=='string'||!/^[a-zа-яё0-9_]{3,25}$/i.test(p.username)||typeof p.display_name!=='string'||p.display_name.length>25||typeof p.bio!=='string'||p.bio.length>160||typeof p.has_avatar!=='boolean'||typeof p.is_creator!=='boolean'||!Number.isSafeInteger(p.avatar_version)||p.avatar_version<0||!/^#[0-9a-f]{6}$/i.test(p.avatar_color)||!['cube','knight','mage','demon','bot','ghost','cat','crown'].includes(p.avatar_style)||!Array.isArray(p.games)||p.games.length>2)throw Error('Сервер вернул некорректный профиль.');
 const ids=new Set();
 for(const g of p.games){
  if(!g||!['fantazia','temkaworld'].includes(g.game_id)||ids.has(g.game_id)||!integer(g.level,1000000)||!integer(g.play_seconds,3155760000)||!integer(g.achievements_total,100000)||!date(g.updated_at)||(g.last_played_at!==null&&!date(g.last_played_at))||!Array.isArray(g.achievements)||g.achievements.length>200)throw Error('Некорректная игровая статистика.');
  ids.add(g.game_id);const achievements=new Set();
  for(const a of g.achievements){if(!a||typeof a.id!=='string'||!a.id||a.id.length>100||achievements.has(a.id)||typeof a.title!=='string'||!a.title||a.title.length>80||!date(a.earned_at))throw Error('Некорректные достижения.');achievements.add(a.id);}
  if(g.achievements_total!==null&&g.achievements.length>g.achievements_total)throw Error('Некорректное число достижений.');
 }
 return p;
}
export function formatPlaytime(seconds:number|null|undefined){if(seconds==null)return 'Нет данных';if(seconds<60)return seconds===0?'0 мин':'Меньше минуты';if(seconds<3600)return `${Math.floor(seconds/60)} мин`;return `${Math.floor(seconds/3600)} ч ${Math.floor(seconds%3600/60)} мин`;}
export function openPlayerProfile(id:string){if(uuid.test(id))window.dispatchEvent(new CustomEvent('temka-open-player',{detail:{id}}));}
export function playerError(error:unknown){const text=error instanceof Error?error.message:String(error);return /PGRST202|schema cache|Could not find the function|does not exist/i.test(text)?'Обновление профилей ещё не подключено на сервере. Сообщи temka_play_official.':text;}
