import { useId } from "react";
import type { Game } from "../data/games";

/* ================= TemkaWorld: заброшенный парк аттракционов ================= */
export function ParkScene({ className = "" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const cabins: [number, number][] = [
    [92, 0], [65, 65], [0, 92], [-65, 65], [-92, 0], [-65, -65], [0, -92], [65, -65],
  ];
  const cabinFill = ["#5c2440", "#2a1230", "#5c2440", "#ff5d5d", "#2a1230", "#5c2440", "#3ddcc2", "#2a1230"];
  return (
    <svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#150b26" />
          <stop offset="52%" stopColor="#3a1430" />
          <stop offset="84%" stopColor="#8c2f2b" />
          <stop offset="100%" stopColor="#c2492f" />
        </linearGradient>
        <linearGradient id={`${uid}-ground`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e0d26" />
          <stop offset="100%" stopColor="#0d0614" />
        </linearGradient>
        <radialGradient id={`${uid}-siren`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ff5d5d" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#ff5d5d" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="800" height="450" fill={`url(#${uid}-sky)`} />

      {/* звёзды */}
      {[
        [60, 40], [150, 84], [230, 34], [320, 66], [410, 40], [500, 88], [560, 30], [690, 60], [740, 100], [90, 130], [280, 118], [460, 128], [760, 150],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.7 : 1} fill="#ffe9d0" opacity={0.4 + (i % 4) * 0.13} />
      ))}

      {/* луна */}
      <circle cx="128" cy="86" r="46" fill="#ffdfb0" opacity="0.14" />
      <circle cx="128" cy="86" r="34" fill="#ffe4bd" />
      <circle cx="118" cy="78" r="7" fill="#e8bf92" opacity="0.7" />
      <circle cx="138" cy="94" r="4.5" fill="#e8bf92" opacity="0.7" />
      <circle cx="126" cy="100" r="3" fill="#e8bf92" opacity="0.6" />

      {/* тучи */}
      <g fill="#22102e" opacity="0.75">
        <ellipse cx="330" cy="70" rx="90" ry="16" />
        <ellipse cx="390" cy="58" rx="60" ry="12" />
        <ellipse cx="620" cy="110" rx="110" ry="14" opacity="0.8" />
      </g>

      {/* американские горки */}
      <g stroke="#170a20" fill="none">
        <path d="M-20 322 C 60 300, 84 176, 156 168 C 228 160, 236 252, 298 258 C 344 262, 356 208, 404 202 C 452 196, 470 260, 520 300" strokeWidth="6" />
        <path d="M-20 322 C 60 300, 84 176, 156 168 C 228 160, 236 252, 298 258 C 344 262, 356 208, 404 202 C 452 196, 470 260, 520 300" strokeWidth="2" stroke="#54223d" transform="translate(0,-7)" />
        <circle cx="204" cy="206" r="30" strokeWidth="5" />
      </g>
      <g stroke="#170a20" strokeWidth="5">
        {[
          [20, 306], [70, 240], [120, 180], [170, 172], [230, 236], [280, 256], [340, 240], [390, 208], [440, 226], [490, 276],
        ].map(([x, y]) => (
          <line key={x} x1={x} y1={y} x2={x} y2={340} />
        ))}
      </g>

      {/* колесо обозрения */}
      <g transform="translate(600,208)">
        <path d="M-58 158 L0 10 L58 158" stroke="#170a20" strokeWidth="9" fill="none" />
        <rect x="-70" y="152" width="140" height="10" rx="4" fill="#170a20" />
        <g>
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="70s" repeatCount="indefinite" />
          <circle r="94" fill="none" stroke="#170a20" strokeWidth="8" />
          <circle r="94" fill="none" stroke="#54223d" strokeWidth="2.5" />
          <line x1="-94" y1="0" x2="94" y2="0" stroke="#2a1230" strokeWidth="4" />
          <line x1="0" y1="-94" x2="0" y2="94" stroke="#2a1230" strokeWidth="4" />
          <line x1="-66" y1="-66" x2="66" y2="66" stroke="#2a1230" strokeWidth="4" />
          <line x1="-66" y1="66" x2="66" y2="-66" stroke="#2a1230" strokeWidth="4" />
          {cabins.map(([x, y], i) => (
            <g key={i} transform={`translate(${x},${y})`}>
              <rect x="-9" y="-2" width="18" height="15" rx="4" fill="#1c0d24" stroke="#54223d" strokeWidth="1.5" />
              <rect x="-5" y="2" width="10" height="6" rx="2" fill={cabinFill[i]} opacity={cabinFill[i] === "#2a1230" ? 1 : 0.9}>
                {cabinFill[i] !== "#2a1230" && (
                  <animate attributeName="opacity" values="0.9;0.45;0.9" dur={`${1.6 + (i % 3) * 0.7}s`} repeatCount="indefinite" />
                )}
              </rect>
            </g>
          ))}
        </g>
        <circle r="13" fill="#1c0d24" stroke="#54223d" strokeWidth="3" />
      </g>

      {/* карусель-шатёр */}
      <g>
        <polygon points="120,310 250,310 185,252" fill="#5c2440" />
        <polygon points="140,310 165,310 152,262" fill="#3a1430" />
        <polygon points="190,310 215,310 202,258" fill="#3a1430" />
        <polygon points="235,310 250,310 242,282" fill="#3a1430" />
        <rect x="132" y="310" width="106" height="34" fill="#241028" />
        <rect x="126" y="306" width="118" height="7" rx="3" fill="#170a20" />
        {[136, 185, 234].map((x, i) => (
          <circle key={x} cx={x} cy={309} r="3" fill="#ffd9a0">
            <animate attributeName="opacity" values="1;0.15;1" dur={`${1.2 + i * 0.5}s`} repeatCount="indefinite" />
          </circle>
        ))}
        <circle cx="185" cy="249" r="4" fill="#ff5d5d">
          <animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* прожектор */}
      <g>
        <rect x="464" y="238" width="12" height="104" fill="#170a20" />
        <rect x="452" y="230" width="36" height="12" rx="4" fill="#1c0d24" stroke="#54223d" strokeWidth="1.5" />
        <g opacity="0.16">
          <animateTransform attributeName="transform" type="rotate" values="-18 470 236; 14 470 236; -18 470 236" dur="9s" repeatCount="indefinite" />
          <polygon points="470,236 380,420 560,420" fill="#ffd9a0" />
        </g>
      </g>

      {/* тревожное зарево у ворот */}
      <ellipse cx="210" cy="348" rx="170" ry="30" fill={`url(#${uid}-siren)`} opacity="0.5">
        <animate attributeName="opacity" values="0.25;0.65;0.25" dur="1.8s" repeatCount="indefinite" />
      </ellipse>

      {/* арка ворот */}
      <g>
        <path d="M84 262 Q210 186 336 262" fill="none" stroke="#170a20" strokeWidth="15" />
        <rect x="84" y="256" width="26" height="164" fill="#170a20" />
        <rect x="310" y="256" width="26" height="164" fill="#170a20" />
        <rect x="104" y="256" width="6" height="164" fill="#241028" />
        <rect x="310" y="256" width="6" height="164" fill="#241028" />
        {/* вывеска */}
        <g transform="rotate(-3 210 228)">
          <rect x="132" y="210" width="156" height="36" rx="6" fill="#1c0d24" stroke="#5c2440" strokeWidth="2" />
          <text
            x="210"
            y="234"
            textAnchor="middle"
            fontFamily="'Unbounded', sans-serif"
            fontWeight="800"
            fontSize="15"
            letterSpacing="2"
            fill="#ffd9a0"
          >
            TEMKAWORLD
            <animate attributeName="opacity" values="1;1;0.35;1;0.7;1" dur="3.4s" repeatCount="indefinite" />
          </text>
        </g>
        {/* сирена на столбе */}
        <rect x="316" y="238" width="14" height="18" rx="3" fill="#1c0d24" stroke="#54223d" strokeWidth="1.5" />
        <circle cx="323" cy="236" r="26" fill={`url(#${uid}-siren)`}>
          <animate attributeName="opacity" values="0.25;0.9;0.25" dur="1.3s" repeatCount="indefinite" />
        </circle>
        <circle cx="323" cy="236" r="5.5" fill="#ff5d5d">
          <animate attributeName="fill" values="#ff5d5d;#8c1f1f;#ff5d5d" dur="1.3s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* демон на арке */}
      <g>
        <path
          d="M204 150 q6 -16 6 -24 l-6 4 q2 -12 8 -18 l2 10 q8 2 10 12 l6 -6 q2 10 -4 18 q10 4 12 16 l-8 -2 q4 14 -6 22 l-4 -12 q-8 6 -14 2 l2 12 q-10 -6 -8 -20 l-6 4 q0 -10 10 -18 Z"
          fill="#0d0614"
          transform="translate(-6,-8) scale(1.15)"
        />
        <circle cx="206" cy="128" r="2.8" fill="#ff3b3b">
          <animate attributeName="opacity" values="1;0.4;1" dur="2.1s" repeatCount="indefinite" />
        </circle>
        <circle cx="217" cy="128" r="2.8" fill="#ff3b3b">
          <animate attributeName="opacity" values="1;0.4;1" dur="2.1s" begin="0.3s" repeatCount="indefinite" />
        </circle>
        <ellipse cx="212" cy="178" rx="34" ry="10" fill="#0d0614" opacity="0.55">
          <animate attributeName="opacity" values="0.55;0.3;0.55" dur="3s" repeatCount="indefinite" />
        </ellipse>
      </g>

      {/* земля и дорожка */}
      <rect y="340" width="800" height="110" fill={`url(#${uid}-ground)`} />
      <polygon points="176,450 244,450 218,340 202,340" fill="#241028" />
      <polygon points="176,450 244,450 218,340 202,340" fill="none" stroke="#3a1430" strokeWidth="2" />
      {[
        [70, 372, 26], [300, 390, 34], [370, 368, 20], [560, 396, 30], [660, 372, 24], [730, 404, 28], [130, 410, 22],
      ].map(([x, y, w], i) => (
        <rect key={i} x={x} y={y} width={w} height="6" rx="2" fill="#241028" transform={`rotate(${i % 2 ? -8 : 6} ${x} ${y})`} />
      ))}

      {/* угли */}
      {[[250, 330], [330, 300], [430, 336], [500, 310], [590, 336], [280, 356], [680, 320]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.2} fill={i % 2 ? "#ff8a5d" : "#ffd9a0"}>
          <animate attributeName="cy" values={`${y};${y - 46};${y}`} dur={`${3.4 + (i % 3)}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0.9;0" dur={`${3.4 + (i % 3)}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}

/* ================= Fantazia RP: тёмное королевство (фолбэк живой ленты) ================= */
export function FantaziaScene({ className = "" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#060d16" />
          <stop offset="55%" stopColor="#0b2530" />
          <stop offset="100%" stopColor="#123a40" />
        </linearGradient>
        <radialGradient id={`${uid}-portal`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#b8fff2" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#3ddcc2" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#3ddcc2" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="450" fill={`url(#${uid}-sky)`} />

      {[
        [50, 50], [120, 110], [200, 40], [280, 90], [360, 60], [450, 40], [520, 100], [600, 50], [680, 90], [750, 45], [160, 160], [420, 140], [720, 150],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 4 === 0 ? 1.8 : 1} fill="#cfeef2" opacity={0.4 + (i % 5) * 0.1} />
      ))}

      {/* две луны */}
      <circle cx="640" cy="92" r="38" fill="#9adfe8" opacity="0.9" />
      <circle cx="654" cy="84" r="32" fill="#0b2530" opacity="0.55" />
      <circle cx="120" cy="70" r="12" fill="#e8f7f4" opacity="0.8" />

      {/* силуэт города */}
      <g fill="#07141c">
        <rect x="0" y="270" width="800" height="180" />
        <rect x="30" y="210" width="54" height="80" />
        <polygon points="30,210 57,178 84,210" />
        <rect x="110" y="240" width="70" height="50" />
        <rect x="200" y="196" width="40" height="94" />
        <polygon points="200,196 220,160 240,196" />
        <rect x="260" y="230" width="60" height="60" />
        <rect x="500" y="222" width="46" height="68" />
        <polygon points="500,222 523,188 546,222" />
        <rect x="570" y="244" width="80" height="46" />
        <rect x="672" y="204" width="44" height="86" />
        <polygon points="672,204 694,170 716,204" />
        <rect x="736" y="238" width="64" height="52" />
      </g>

      {/* окна */}
      {[
        [44, 228], [58, 246], [126, 254], [146, 262], [212, 214], [212, 240], [276, 246], [298, 258], [514, 238], [524, 258], [592, 256], [620, 264], [686, 222], [686, 248], [756, 252],
      ].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="5" height="7" fill={i % 3 === 0 ? "#ffca7a" : "#5fe8d4"} opacity="0.9">
          {i % 4 === 0 && <animate attributeName="opacity" values="0.9;0.35;0.9" dur={`${2.5 + (i % 3)}s`} repeatCount="indefinite" />}
        </rect>
      ))}

      {/* портал в центре */}
      <ellipse cx="400" cy="300" rx="150" ry="90" fill={`url(#${uid}-portal)`} />
      <ellipse cx="400" cy="300" rx="58" ry="76" fill="none" stroke="#7df2dd" strokeWidth="3" opacity="0.9">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="400" cy="300" rx="86" ry="104" fill="none" stroke="#3ddcc2" strokeWidth="1.6" strokeDasharray="6 12" opacity="0.6">
        <animateTransform attributeName="transform" type="rotate" from="0 400 300" to="360 400 300" dur="24s" repeatCount="indefinite" />
      </ellipse>

      {/* парящие частицы магии */}
      {[[330, 240], [460, 220], [380, 190], [430, 260], [350, 320], [470, 330], [300, 290]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.6} fill="#8df3e0">
          <animate attributeName="opacity" values="0.15;0.95;0.15" dur={`${1.8 + (i % 4) * 0.6}s`} repeatCount="indefinite" />
          <animate attributeName="cy" values={`${y};${y - 26};${y}`} dur={`${4 + (i % 3)}s`} repeatCount="indefinite" />
        </circle>
      ))}

      {/* дорога к порталу */}
      <polygon points="352,450 448,450 414,340 386,340" fill="#0e2b33" />
      <polygon points="352,450 448,450 414,340 386,340" fill="none" stroke="#1d4a52" strokeWidth="2" />
    </svg>
  );
}

/* ================= универсальная поверхность арта ================= */
export function ArtSurface({
  game,
  mini = false,
  eager = false,
  className = "",
}: {
  game: Game;
  mini?: boolean;
  eager?: boolean;
  className?: string;
}) {
  // живая лента из браузерной сборки игры
  if (game.liveUrl && !mini) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <FantaziaScene className="absolute inset-0 h-full w-full" />
        <iframe
          src={game.liveUrl}
          title={`${game.title} — живая веб-сборка`}
          loading={eager ? "eager" : "lazy"}
          sandbox="allow-scripts allow-same-origin allow-popups"
          className="pointer-events-none absolute inset-0 h-full w-full border-0"
        />
      </div>
    );
  }
  return game.id === "temkaworld" ? (
    <ParkScene className={className} />
  ) : (
    <FantaziaScene className={className} />
  );
}

/* ================= заглушка скриншота (арт добавит разработчик) ================= */
export function ShotPlaceholder({ label, sub }: { label: string; sub?: string }) {
  return (
    <div
      className="relative flex aspect-[16/9] w-full flex-col items-center justify-center overflow-hidden rounded-[14px] border border-dashed border-[var(--line-2)] bg-[var(--bg1)] p-4 text-center"
      style={{
        backgroundImage:
          "repeating-linear-gradient(45deg, color-mix(in srgb, var(--accent) 5%, transparent) 0 14px, transparent 14px 28px)",
      }}
    >
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 2 8 4.5v9L12 20l-8-4.5v-9L12 2Z" />
        <path d="m4 6.5 8 4.5 8-4.5M12 11v9" />
      </svg>
      <p className="shimmer font-display mt-3 text-[13px] font-bold uppercase tracking-[0.14em]">скриншот скоро</p>
      <p className="mt-1 max-w-[30ch] text-[11.5px] font-semibold text-[var(--tx3)]">{label}</p>
      {sub && <p className="font-mono2 mt-2 text-[9.5px] font-bold uppercase tracking-[0.18em] text-[var(--tx3)]">{sub}</p>}
    </div>
  );
}
