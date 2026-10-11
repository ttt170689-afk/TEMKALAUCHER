import { useMemo, useState } from 'react';
import { Reveal, MaskReveal } from './ui';
import { APP_VERSION } from '../lib/version';
import { CHANGE_LABELS, RELEASE_NOTES, filterReleaseNotes } from '../data/releaseNotes';
import type { ChangeKind } from '../data/releaseNotes';

const KIND_STYLE: Record<ChangeKind, {color:string;symbol:string}> = {
  added: {color:'#80dec1',symbol:'+'}, fixed: {color:'#92bdff',symbol:'✓'}, removed: {color:'#f2b18a',symbol:'−'}
};
const KINDS: ChangeKind[] = ['added','fixed','removed'];
export default function NewsView() {
  const [kind,setKind] = useState<ChangeKind|'all'>('all');
  const [query,setQuery] = useState('');
  const notes = useMemo(()=>filterReleaseNotes(RELEASE_NOTES,kind,query),[kind,query]);
  const count = notes.reduce((sum,note)=>sum+note.changes.length,0);
  return <div className="mx-auto max-w-[1080px] px-5 pb-14 pt-6 lg:px-8">
    <Reveal><div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="font-mono2 text-[10px] font-bold uppercase tracking-[.24em] text-[var(--accent)]">TEMKA / ИСТОРИЯ ИЗМЕНЕНИЙ</p><h2 className="font-display mt-2 text-[28px] font-extrabold tracking-tight"><MaskReveal>Что нового?</MaskReveal></h2><p className="mt-3 max-w-[65ch] text-[13px] leading-relaxed text-[var(--tx2)]">Что появилось, что исправлено и от чего отказались. Без пустых обещаний — изменения по версиям.</p></div>
      <span className="chip font-mono2 px-3 py-2 text-[11px] font-bold text-[var(--accent)]">ТВОЯ ВЕРСИЯ · {APP_VERSION}</span>
    </div></Reveal>
    <div className="panel mt-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр изменений">
          {(['all',...KINDS] as const).map(value=><button key={value} type="button" aria-pressed={kind===value} onClick={()=>setKind(value)} className={`rounded-lg border px-3 py-2 text-[12px] font-bold transition-colors ${kind===value?'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]':'border-[var(--line)] text-[var(--tx2)] hover:border-[var(--line-2)]'}`}>{value==='all'?'Все':CHANGE_LABELS[value]}</button>)}
        </div>
        <label className="min-w-0 flex-1 sm:max-w-[300px]"><span className="sr-only">Поиск по изменениям</span><input type="search" value={query} maxLength={100} onChange={event=>setQuery(event.target.value)} placeholder="Версия, аватарка, исправление…" className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg0)] px-3 py-2 text-[12px] text-[var(--tx)]"/></label>
      </div>
      <p role="status" className="mt-3 text-[11px] text-[var(--tx3)]">Записей: {notes.length} · Изменений: {count}</p>
    </div>
    <div className="mt-5 space-y-5">
      {notes.map(note=><article key={note.version} data-release={note.version} className="panel overflow-hidden">
        <header className="border-b border-[var(--line)] p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3"><span className="font-mono2 text-[13px] font-extrabold text-[var(--accent)]">v{note.version}</span>{note.current&&<span className="rounded-full border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--accent)]">Эта сборка</span>}<time dateTime={note.date} className="ml-auto text-[10px] text-[var(--tx3)]">Запись от {note.date.split('-').reverse().join('.')}</time></div>
          <h3 className="font-display mt-3 text-[19px] font-extrabold tracking-tight">{note.title}</h3><p className="mt-2 text-[12px] leading-relaxed text-[var(--tx2)]">{note.summary}</p>
        </header>
        <div className="space-y-5 p-5 sm:p-6">{KINDS.map(category=>{
          const entries=note.changes.filter(change=>change.kind===category);if(!entries.length)return null;
          return <section key={category} data-change-kind={category} aria-label={CHANGE_LABELS[category]}><h4 className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.12em]" style={{color:KIND_STYLE[category].color}}><span className="grid h-5 w-5 place-items-center rounded-md border border-current text-[14px]" aria-hidden="true">{KIND_STYLE[category].symbol}</span>{CHANGE_LABELS[category]}</h4><ul className="mt-3 space-y-2 pl-7">{entries.map(entry=><li key={entry.text} className="relative text-[12.5px] leading-relaxed text-[var(--tx2)]"><span className="absolute -left-4 top-2 h-1 w-1 rounded-full bg-[var(--tx3)]" aria-hidden="true"/>{entry.text}</li>)}</ul></section>;
        })}</div>
      </article>)}
      {!notes.length&&<div className="panel px-5 py-10 text-center"><h3 className="font-display text-[18px] font-bold">Ничего не найдено</h3><p className="mt-2 text-[12px] text-[var(--tx3)]">Попробуй другое слово или сбрось фильтры.</p><button className="btn-ghost mt-4 px-4 py-2 text-[12px]" onClick={()=>{setQuery('');setKind('all');}}>Сбросить фильтры</button></div>}
    </div>
    <aside className="mt-5 rounded-xl border border-[var(--line)] p-4 text-[12px] leading-relaxed text-[var(--tx3)]"><strong className="text-[var(--tx2)]">Ещё нужно подключение:</strong> общая база друзей и отправка кодов на почту. Вход в игры через лаунчер — следующий этап, не готовая функция этой версии.</aside>
    <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-5"><p className="max-w-[58ch] text-[11px] leading-relaxed text-[var(--tx3)]">История хранится внутри лаунчера и работает без интернета. Новые записи приходят вместе с обновлениями. Это не автоматическая подписка на уведомления.</p><a href="https://t.me/temka_play_official1" target="_blank" rel="noopener noreferrer" className="btn-ghost px-4 py-2 text-[12px]">Канал автора ↗</a></footer>
  </div>;
}
