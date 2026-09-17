export type DlcStatus = "dev" | "soon" | "planned";

export const FANTAZIA_LIVE_URL = "https://fantazia-rp-3d1.onrender.com";

export interface Dlc {
  id: string;
  title: string;
  desc: string;
  status: DlcStatus;
  price: string;
  size: string;
  icon: "island" | "gear" | "snow" | "crown" | "abyss" | "ship";
}

export interface Milestone {
  label: string;
  state: "done" | "active" | "locked";
}

/** kind: placeholder — арт нарисует разработчик; live — живая лента из веб-сборки; launch — открытие веб-демо */
export interface Shot {
  kind: "placeholder" | "live" | "launch";
  src?: string;
  label: string;
}

export interface Game {
  id: string;
  title: string;
  tagline: string;
  description: string;
  genre: string;
  version: string;
  size: string;
  developer: string;
  engine: string;
  statusLabel: string;
  progress: number;
  accent: string;
  liveUrl?: string;
  screenshots: Shot[];
  features: string[];
  requirements: { label: string; min: string; rec: string }[];
  dlcs: Dlc[];
  roadmap: Milestone[];
}

export const GAMES: Game[] = [
  {
    id: "temkaworld",
    title: "TemkaWorld",
    tagline: "Вернись в парк. Выживи. Открой бункер.",
    description:
      "Всё начинается с воспоминаний о детстве — но идиллию разрывает сирена: на грандиозный парк аттракционов Temkaworld нападает жуткий Демон. Лидер Артём успевает вытолкнуть тебя за гермозатвор с таинственной запиской. Спустя два года ты находишь тайный лаз на заброшке и возвращаешься в заколоченный парк: туториал Никиты, портал в мультиплеер, лавка скинов Серёги и первое задание — Золотой Ключ, рухнувшая стена и бешеная погоня от Гигантского Монстра. А под парком ждёт Секретный Бункер… но защитная система пустит только игрока 10 уровня.",
    genre: "Сюжетный хоррор · Кооп",
    version: "0.6.2-alpha",
    size: "6,6 ГБ",
    developer: "Temka_Игрок · инди-разработка",
    engine: "Собственный движок",
    statusLabel: "В разработке",
    progress: 62,
    accent: "#ff7a2f",
    screenshots: [
      { kind: "placeholder", label: "День, когда сработала сирена" },
      { kind: "placeholder", label: "Погоня Гигантского Монстра" },
    ],
    features: [
      "Пролог: выбор имени со строгим фильтром мата",
      "Атака Демона и жертва лидера Артёма",
      "Мультиплеер через портал за сценой",
      "Лавка Серёги: редкие скины и одежда",
      "Секретный Бункер — доступ с 10 уровня",
    ],
    requirements: [
      { label: "ОС", min: "Windows 10 64-bit", rec: "Windows 11 64-bit" },
      { label: "Процессор", min: "Intel i5-8400", rec: "Intel i5-12400F" },
      { label: "Видеокарта", min: "GTX 1050 Ti", rec: "RTX 3060" },
      { label: "Оперативная память", min: "8 ГБ", rec: "16 ГБ" },
      { label: "Место на диске", min: "6 ГБ (SSD)", rec: "10 ГБ (NVMe)" },
    ],
    // DLC добавит сам разработчик. Пример записи:
    // { id: "tw-my-dlc", title: "Название", desc: "Описание", status: "soon", price: "449 ₽", size: "1,2 ГБ", icon: "island" }
    dlcs: [],
    roadmap: [
      { label: "Пролог: Детство и Катастрофа", state: "done" },
      { label: "Фильтр плохих имён", state: "done" },
      { label: "Возвращение: туториал Никиты", state: "done" },
      { label: "Портал в мультиплеер", state: "active" },
      { label: "Миссия «Золотой Ключ» и погоня", state: "locked" },
      { label: "Секретный Бункер (10 уровень)", state: "locked" },
    ],
  },
  {
    id: "fantazia",
    title: "Fantazia RP",
    tagline: "Фэнтези-ролеплей в живом королевстве",
    description:
      "MMORPG, где история пишется игроками. Выбирайте фракцию, стройте карьеру от бродяги до лорда, участвуйте в судах, торговле и войнах гильдий. Мастера игры проводят живые ивенты, а экономика полностью находится в руках сообщества.",
    genre: "MMORPG · Ролеплей",
    version: "0.3.8-prealpha",
    size: "12 ГБ",
    developer: "Temka Studio × Fantazia Team",
    engine: "Unreal Engine 5",
    statusLabel: "В разработке",
    progress: 41,
    accent: "#3ddcc2",
    liveUrl: FANTAZIA_LIVE_URL,
    screenshots: [
      { kind: "live", src: FANTAZIA_LIVE_URL, label: "Живой кадр из игры — браузерная сборка" },
      { kind: "launch", src: FANTAZIA_LIVE_URL, label: "Веб-демо во весь экран" },
    ],
    features: [
      "Живая экономика, управляемая игроками",
      "Фракции, гильдии и политика королевства",
      "Система законов, судов и репутации",
      "Еженедельные ивенты с мастерами игры",
    ],
    requirements: [
      { label: "ОС", min: "Windows 10 64-bit", rec: "Windows 11 64-bit" },
      { label: "Процессор", min: "Intel i5-10400", rec: "Intel i7-12700" },
      { label: "Видеокарта", min: "GTX 1660 Super", rec: "RTX 3070" },
      { label: "Оперативная память", min: "12 ГБ", rec: "16 ГБ" },
      { label: "Место на диске", min: "25 ГБ (SSD)", rec: "40 ГБ (NVMe)" },
    ],
    // DLC добавит сам разработчик. Пример записи:
    // { id: "fz-my-dlc", title: "Название", desc: "Описание", status: "dev", price: "599 ₽", size: "4,2 ГБ", icon: "crown" }
    dlcs: [],
    roadmap: [
      { label: "Создание персонажа", state: "done" },
      { label: "Боевая система", state: "done" },
      { label: "Экономика и торговля", state: "active" },
      { label: "Фракционные войны", state: "locked" },
      { label: "Подземелья и рейды", state: "locked" },
      { label: "Релиз для всех", state: "locked" },
    ],
  },
];

export const DLC_STATUS: Record<DlcStatus, { label: string; cls: string }> = {
  soon: { label: "Скоро", cls: "text-[#ffd28a] border-[#ffd28a44] bg-[#ffd28a14]" },
  dev: { label: "В разработке", cls: "text-[var(--accent-2)] border-[color-mix(in_srgb,var(--accent-2)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent-2)_10%,transparent)]" },
  planned: { label: "Запланировано", cls: "text-[var(--tx2)] border-[var(--line-2)] bg-transparent" },
};



export const TICKER = [
  "СБОРКА #1247 СКОМПИЛИРОВАНА",
  "TEMKAWORLD: ГОТОВНОСТЬ 62%",
  "FANTAZIA RP: ГОТОВНОСТЬ 41%",
  "СЕРВЕРЫ АВТОРИЗАЦИИ: ОНЛАЙН",
  "FANTAZIA RP: ВЕБ-СБОРКА LIVE",
  "TEMKAWORLD: БУНКЕР — С 10 УРОВНЯ",
  "ЛАВКА СЕРЁГИ: СКИНЫ УЖЕ СКОРО",
  "НОВЫЙ DEVLOG #14 УЖЕ В СЕТИ",
  "ЛИСТ ОЖИДАНИЯ ОТКРЫТ",
];
