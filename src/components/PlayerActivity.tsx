import {useEffect,useState} from 'react';
import {useOnlineAccount} from '../lib/onlineAccount';
import {playerError} from '../lib/playerCard';
import type {PlayerActivity as Activity} from '../lib/messaging';
import {GAMES} from '../data/games';
const title=(id:string)=>GAMES.find(g=>g.id===id)?.title||id;
export default function PlayerActivity({id,detailed=false}:{id:string;detailed?:boolean}){
 const {client,mode}=useOnlineAccount();const [data,setData]=useState<Activity|null>(null),[error,setError]=useState('');
 useEffect(()=>{let alive=true,flight=false;setData(null);setError('');const load=async()=>{if(mode!=='verified'||document.hidden||flight)return;flight=true;try{const next=await client.playerActivity(id);if(alive){setData(next);setError('');}}catch(e){if(alive){setError(playerError(e));setData(null);}}finally{flight=false;}};void load();const timer=setInterval(()=>void load(),30000);window.addEventListener('focus',load);document.addEventListener('visibilitychange',load);return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',load);document.removeEventListener('visibilitychange',load);};},[id,client,mode]);
 const status=<span className={`activity-badge ${data?.playing?'playing':''}`} title={error||undefined}>{error?'Статус игры недоступен':!data?'Проверяем игровую активность…':data.playing?`● Играет сейчас: ${title(data.playing.game_id)}`:'Не в игре'}</span>;
 if(!detailed)return status;
 return <section className="player-activity"><h3>Активность в лаунчере</h3>{status}{error&&<p className="activity-badge">{error}</p>}<h3>Последние запуски</h3>{data&&!data.history.length&&<p className="activity-badge">Запусков пока нет. Игры «Скоро» не создают активность.</p>}<ol>{data?.history.map(s=><li key={s.id}><strong>{title(s.game_id)}</strong><span>{new Date(s.started_at).toLocaleString('ru-RU')} · {s.platform} · {s.ended_at?'Завершено':'Активная сессия'}</span></li>)}</ol><small>Последние 20 сессий отслеживаемых игр. Это не подтверждённые игрой часы или уровни. Статус обновляется каждые 30 секунд; после потери связи снимается автоматически.</small></section>;
}
