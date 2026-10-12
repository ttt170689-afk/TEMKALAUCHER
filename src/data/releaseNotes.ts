import { APP_VERSION } from '../lib/version';
export type ChangeKind = 'added' | 'fixed' | 'removed';
export interface ReleaseNote {version: string; date: string; title: string; summary: string; current?: boolean; changes: {kind: ChangeKind; text: string}[];}
export const CHANGE_LABELS: Record<ChangeKind,string> = {added:'Добавлено',fixed:'Исправлено',removed:'Убрано'};

// The first entry describes this build, not a claim that it is already published.
// Publisher may assign a newer version; APP_VERSION keeps the entry accurate.
// Update these notes intentionally when preparing the next release.
export const RELEASE_NOTES: ReleaseNote[] = [
 {version:APP_VERSION,date:'2026-10-12',current:true,title:'Проверка обновлений без ложного успеха',summary:'Сверяем GitHub, манифест и пакет. Показываем версии, источник и ошибки.',changes:[
 {kind:'fixed',text:'Проверка публичного GitHub API и манифеста конкретного релиза без локального кеширования. Версия и файл должны совпасть.'},
 {kind:'fixed',text:'Ошибки сети и неполный релиз больше не скрываются за сообщением о свежей версии. Панель видна даже при первой неудачной проверке.'},
 {kind:'removed',text:'Убран таймер уведомления «Проверка запущена» и безусловное «У тебя самая свежая версия».'},
 {kind:'added',text:'Показ установленной и опубликованной версий, времени успешной проверки и кнопка открытия официальных релизов.'}
 ]},
  {
    version:'1.5.5',date:'2026-10-11',title:'Альфа без XP. Вишлист без почты.',
    summary:'Упрощённый профиль, мгновенные закладки и системный выбор папки.',
    changes:[
      {kind:'removed',text:'Начисление XP, ежедневные награды, уровни и связанные с ними блокировки интерфейса отключены. Старые данные не стираются.'},
      {kind:'fixed',text:'Вишлист добавляется одним нажатием без email, фиктивной очереди и обещаний отправить письмо. Старые записи перенесены без адресов почты.'},
      {kind:'added',text:'Настоящий системный диалог выбора папки в desktop-версии. Отмена не меняет путь; повторный клик не открывает дубликаты.'},
      {kind:'added',text:'Обозначение «Альфа». Игры ещё в разработке; выбор папки не начинает установку.'}
    ]
  },
  {
    version: '1.5.4', date: '2026-10-11',
    title: 'Роль автора и понятные новости',
    summary: 'Подпись разработчика больше не зависит от XP. Вместо пустой ленты — история конкретных изменений.',
    changes: [
      {kind:'added',text:'Для локального профиля temka_play_official добавлена подпись «Разработчик» в карточке и боковом меню. Она не выдаёт серверных прав.'},
      {kind:'added',text:'История изменений с версиями, разделами «Добавлено / Исправлено / Убрано», поиском и фильтрами.'},
      {kind:'added',text:'В блоке друзей появилась инструкция для владельца: общая база, SQL, почтовые коды и настройки сборки.'},
      {kind:'fixed',text:'В шапке профиля автора «Новичок» заменён на подпись разработчика. Игровые уровни, XP, достижения и выбранный игровой титул сохранены отдельно.'},
      {kind:'fixed',text:'Постоянная надпись ONLINE в шапке заменена на «Локальный профиль»: она больше не выдаёт локальную сессию за подключение к серверу.'},
      {kind:'removed',text:'Убраны пустая лента «0 публикаций», фиктивная подписка на первую новость и карточки-заглушки.'}
    ]
  },
  {
    version:'1.5.3',date:'2026-10-11',title:'Своя аватарка и подготовка друзей',
    summary:'Персонализация профиля и клиент онлайн-друзей. Общая база и отправка писем требуют отдельного подключения.',
    changes:[
      {kind:'added',text:'Загрузка собственной PNG/JPG/WebP-аватарки до 5 МБ, квадратная обрезка, уменьшение и сохранение после перезапуска.'},
      {kind:'added',text:'Подготовлены вход по коду на почту, поиск по точному онлайн-юзернейму и заявки в друзья. Без подключённого сервера эти функции не включаются.'},
      {kind:'fixed',text:'В описании Fantazia RP 3D указан Godot Engine.'}
    ]
  },
  {
    version:'1.5.2',date:'2026-10-11',title:'Ники до 25 символов и обновления',
    summary:'Работа с профилем и выпуском новых версий Windows-лаунчера.',
    changes:[
      {kind:'added',text:'Ники до 25 символов при регистрации и изменении имени.'},
      {kind:'fixed',text:'Проверка и загрузка обновлений Windows-лаунчера через GitHub Releases, с отображением ошибок вместо ложного успеха.'}
    ]
  }
];
export function filterReleaseNotes(notes: ReleaseNote[], kind: ChangeKind | 'all', query: string): ReleaseNote[] {
  const term = query.trim().toLowerCase();
  return notes.flatMap(note => {
    const headingMatch = `${note.version} ${note.title} ${note.summary}`.toLowerCase().includes(term);
    const changes = note.changes.filter(change =>
      (kind === 'all' || change.kind === kind) &&
      (!term || headingMatch || `${CHANGE_LABELS[change.kind]} ${change.text}`.toLowerCase().includes(term))
    );
    return changes.length ? [{...note, changes}] : [];
  });
}
