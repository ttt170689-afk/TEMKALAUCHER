import { useEffect, useRef, useState } from "react";
import { SHOP_PACKS, SHOP_MUSIC } from "../data/shop";

export default function ShopView() {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [musicError, setMusicError] = useState("");
  const src = SHOP_MUSIC.src;
  useEffect(() => { if (audio.current) audio.current.volume = volume; }, [volume]);
  useEffect(() => {
    const element = audio.current;
    return () => { if (element) { element.pause(); element.removeAttribute("src"); element.load(); } };
  }, [src]);
  async function toggleMusic() {
    const element = audio.current;
    if (!element || !src) return;
    if (!element.paused) { element.pause(); return; }
    setMusicError("");
    try { await element.play(); } catch { setPlaying(false); setMusicError("Не удалось включить музыку. Попробуй ещё раз."); }
  }
  return <section className="mx-auto max-w-6xl space-y-6 px-5 py-6 sm:px-8" aria-label="Магазин Fantazia RP">
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg2)] p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--accent)]">Fantazia RP · магазин</p>
      <h1 className="mt-3 text-3xl font-extrabold">Кристаллы для твоей игры</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--tx2)]">Выбери подходящий набор. Это витрина: приём оплаты и начисление кристаллов ещё не подключены.</p>
      <p className="mt-3 text-xs text-[var(--tx3)]">Цены из репозитория fantazia-shop. До открытия продаж наборы могут измениться.</p>
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {SHOP_PACKS.map(pack => <article key={pack.id} className="min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--bg2)] p-5">
        <svg aria-hidden="true" width="40" height="40" viewBox="0 0 40 40" fill="none"><path d="M10 7h20l7 11-17 17L3 18 10 7Z" fill="var(--accent)" opacity=".2"/><path d="M10 7h20l7 11-17 17L3 18 10 7Zm-7 11h34M10 7l10 28L30 7M10 7l10 11L30 7" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round"/></svg>
        <h2 className="mt-4 text-2xl font-extrabold">{pack.gems.toLocaleString("ru-RU")} <span className="text-sm font-medium text-[var(--tx2)]">кристаллов</span></h2>
        <p className="mt-2 text-xl font-bold text-[var(--accent)]">{pack.priceRub.toLocaleString("ru-RU")} ₽</p>
        <button type="button" disabled className="mt-5 min-h-11 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-bold text-[var(--tx3)] opacity-70" aria-label={`Купить ${pack.gems} кристаллов — скоро`}>Купить · скоро</button>
      </article>)}
    </div>
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg2)] p-5">
      <h2 className="text-base font-bold">Оплата через DonationAlerts</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--tx2)]">Подключение готовится. После открытия продаж сервер будет подтверждать платёж и начислять кристаллы на твой игровой аккаунт. Сейчас деньги отправлять не нужно.</p>
    </div>
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg2)] p-5">
      <h2 className="text-base font-bold">Музыка магазина</h2>
      <p className="mt-2 text-sm text-[var(--tx2)]">{src ? SHOP_MUSIC.title : "Трек ещё не выбран — добавим позже."}</p>
      {src && <audio ref={audio} src={src} loop preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { setPlaying(false); setMusicError("Не удалось загрузить трек."); }} />}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button type="button" disabled={!src} onClick={() => void toggleMusic()} aria-pressed={playing} className="min-h-11 rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-bold disabled:opacity-50">{playing ? "Пауза" : "Включить музыку"}</button>
        <label className="flex items-center gap-3 text-xs text-[var(--tx2)]">Громкость<input aria-label="Громкость музыки магазина" type="range" min="0" max="1" step="0.05" value={volume} disabled={!src} onChange={event => setVolume(Number(event.target.value))} /></label>
      </div>
      {musicError && <p role="alert" className="mt-3 text-sm text-[var(--tx2)]">{musicError}</p>}
      <p className="mt-3 text-xs text-[var(--tx3)]">Музыка включается кнопкой и останавливается при выходе из магазина.</p>
    </div>
  </section>;
}
