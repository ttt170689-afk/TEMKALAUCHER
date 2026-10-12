import { useAutoUpdate } from '../lib/updater';
export default function UpdateBanner(){
 const u=useAutoUpdate();
 if(u.dismissed||u.phase==='idle')return null;
 const title=u.phase==='checking'?'Проверяем GitHub…':u.phase==='error'?'Ошибка проверки или обновления':u.phase==='latest'?(u.info.comparison==='ahead'?'Установленная версия новее опубликованной':'Версии совпадают'):u.phase==='ready'?'Обновление скачано':u.phase==='downloading'?'Загружаем обновление':`Доступна версия ${u.info.latest}`;
 return <section role="status" aria-live="polite" aria-label="Состояние обновления" className="panel relative z-40 mx-4 mb-3 rounded-xl border border-[var(--line-2)] p-4 sm:mx-6">
 <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0 flex-1"><h2 className="font-display text-sm font-bold">{title}</h2>
 <p className="mt-1 text-xs text-[var(--tx2)]">{u.phase==='checking'?'Запрашиваем опубликованный релиз и его манифест. Дождись ответа.':u.phase==='error'?u.error:`Установлена: ${u.info.current} · На GitHub: ${u.info.latest}`}</p>
 {u.info.checkedAt&&u.phase!=='checking'&&<p className="mt-1 text-[10px] text-[var(--tx3)]">Последняя успешная проверка: {new Date(u.info.checkedAt).toLocaleString('ru-RU')} · {u.info.source}</p>}
 {u.phase==='downloading'&&<p className="mt-1 text-xs">{Math.round(u.progress)}% {u.speed>0?`· ${(u.speed/1048576).toFixed(1)} МБ/с`:''}</p>}
 {u.phase==='ready'&&<p className="mt-1 text-xs">Для установки перезапусти лаунчер.</p>}</div>
 <div className="flex flex-wrap gap-2">
 {u.phase==='available'&&<button className="btn-primary px-4 py-2 text-xs" onClick={()=>void u.install()}>Скачать и установить</button>}
 {u.phase==='ready'&&<button className="btn-primary px-4 py-2 text-xs" onClick={()=>void u.relaunch()}>Перезапустить</button>}
 {(u.phase==='error'||u.phase==='latest')&&<button className="btn-ghost px-3 py-2 text-xs" onClick={()=>void u.check()}>Проверить снова</button>}
 <button className="btn-ghost px-3 py-2 text-xs" onClick={u.download}>Релизы GitHub ↗</button>
 <button className="btn-ghost px-3 py-2 text-xs" onClick={u.later} aria-label="Скрыть обновление">×</button></div></div>
 </section>;
}
