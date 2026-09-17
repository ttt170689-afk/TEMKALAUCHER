import { useToast } from "../lib/toast";
import { useProgress } from "../lib/progress";
import { Reveal, MaskReveal, IconBell } from "./ui";

export default function NewsView() {
  const { push } = useToast();
  const { grant } = useProgress();

  return (
    <div className="mx-auto max-w-[1180px] px-5 pb-14 pt-6 lg:px-8">
      {/* заголовок ленты */}
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono2 text-[10.5px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">лента объявлений</p>
            <h2 className="font-display mt-1.5 text-[26px] font-extrabold tracking-tight">
              <MaskReveal>Новости</MaskReveal>
            </h2>
          </div>
          <span className="chip font-mono2 px-3 py-1.5 text-[11px] font-bold text-[var(--tx2)]">0 публикаций</span>
        </div>
      </Reveal>

      {/* пустая лента */}
      <Reveal delay={100}>
        <div
          className="relative mt-6 flex flex-col items-center overflow-hidden rounded-[16px] border border-dashed border-[var(--line-2)] bg-[var(--bg1)] px-6 py-16 text-center"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, color-mix(in srgb, var(--accent) 4%, transparent) 0 18px, transparent 18px 36px)",
          }}
        >
          <div
            className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full"
            style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 13%, transparent), transparent 65%)" }}
          />
          <span
            className="relative flex h-16 w-16 items-center justify-center rounded-[16px] text-[var(--accent)]"
            style={{
              background: "color-mix(in srgb, var(--accent) 11%, transparent)",
              border: "1px dashed color-mix(in srgb, var(--accent) 42%, transparent)",
              boxShadow: "0 10px 30px -12px color-mix(in srgb, var(--accent) 35%, transparent)",
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5h13v14H6a2 2 0 0 1-2-2V5Z" />
              <path d="M17 8h3v9a2 2 0 0 1-2 2h-1" />
              <path d="M7 9h7M7 12.5h7M7 16h4" />
            </svg>
          </span>
          <p className="shimmer font-display relative mt-5 text-[16px] font-extrabold uppercase tracking-[0.14em]">
            Здесь пока тихо
          </p>
          <p className="relative mt-2 max-w-[52ch] text-[13.5px] leading-relaxed text-[var(--tx2)]">
            Новостей пока нет — лента пустая. Когда появится первое объявление, оно выйдет сюда.
            Разработчик уже что-то печатает…
          </p>
          <div className="relative mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                push("ok", "Подписка оформлена", "Сообщим, как только выйдет первая новость.");
                grant("news-bell", 15, "Подписка на новости");
              }}
              className="btn-primary flex items-center gap-2 px-5 py-3 text-[13.5px]"
            >
              <IconBell />
              Сообщить о первой новости
            </button>
            <span className="font-mono2 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--tx3)]">
              подписчиков: 1 · вы
            </span>
          </div>
        </div>
      </Reveal>

      {/* слоты ленты */}
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Reveal key={i} delay={140 + i * 90}>
            <div className="panel h-full p-5 opacity-70">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[var(--bg3)]" />
                <div className="h-2.5 w-20 rounded-full bg-[var(--bg3)]" />
              </div>
              <div className="mt-4 h-3 w-4/5 rounded-full bg-[var(--bg3)]" />
              <div className="mt-2 h-3 w-3/5 rounded-full bg-[var(--bg3)]" />
              <div className="mt-4 flex flex-col gap-2">
                <div className="h-2 w-full rounded-full bg-[var(--bg2)]" />
                <div className="h-2 w-11/12 rounded-full bg-[var(--bg2)]" />
                <div className="h-2 w-4/6 rounded-full bg-[var(--bg2)]" />
              </div>
              <p className="font-mono2 mt-4 text-[9.5px] font-bold uppercase tracking-[0.22em] text-[var(--tx3)]">
                слот #{i + 1} · ожидает публикацию
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
