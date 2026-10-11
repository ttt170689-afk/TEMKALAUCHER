import { useState } from 'react';
import schema from '../../backend/supabase.sql?raw';

export default function OnlineSetupGuide() {
  const [copyResult,setCopyResult] = useState('');
  const [showSql,setShowSql] = useState(false);
  const copySql = async () => {
    try {await navigator.clipboard.writeText(schema);setCopyResult('SQL скопирован. Выполни его один раз в SQL Editor нового проекта.');}
    catch {setShowSql(true);setCopyResult('Автокопирование недоступно. Выдели текст SQL ниже и скопируй вручную.');}
  };
  return <details className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--bg0)] p-4">
    <summary className="cursor-pointer text-[12px] font-bold text-[var(--accent)]">Как включить друзей и письма? · для владельца проекта</summary>
    <div className="mt-4 space-y-4 text-[12px] leading-relaxed text-[var(--tx2)]">
      <p>Лаунчер установлен у разных людей, поэтому ему нужна общая база в интернете. Это настраивает владелец один раз — игрокам ничего подключать не нужно.</p>
      <p><strong>Можно бесплатно?</strong> Для первых тестов подойдёт Supabase Cloud Free. У него есть лимиты и приостановка неактивных проектов; почтовую доставку нужно настроить отдельно. <a href="https://supabase.com/pricing" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline">Проверить тариф ↗</a></p>
      <p><strong>Свой Xeon?</strong> Возможен, но полный стек требует минимум 2 ядра, 4 ГБ RAM и 40 ГБ SSD по документации Supabase. Нужны Linux, HTTPS, защищённый доступ и бэкапы. Эта сборка пока принимает только облачный адрес *.supabase.co — для своего сервера потребуется отдельная доработка клиента. Сервер друзей не заменяет игровой сервер. Подробности: backend/БЕСПЛАТНЫЙ-СЕРВЕР-И-XEON.md.</p>
      <ol className="list-decimal space-y-4 pl-5">
        <li><strong>Создай отдельный проект Supabase.</strong> Войди в свой аккаунт, выбери New project и дождись запуска базы. Пароль базы сохраняй у себя.<br/><a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[var(--accent)] underline underline-offset-4">Открыть Supabase ↗</a></li>
        <li><strong>Установи таблицы и защиту.</strong> В новом проекте открой SQL Editor → New query, вставь подготовленный SQL и нажми Run. Скрипт рассчитан на однократный запуск в новом проекте, не удаляй уже работающие таблицы.<div className="mt-2 flex flex-wrap gap-2"><button type="button" className="btn-ghost px-3 py-2 text-[11px]" onClick={()=>void copySql()}>Скопировать SQL</button><button type="button" className="btn-ghost px-3 py-2 text-[11px]" aria-expanded={showSql} aria-controls="friends-setup-sql" onClick={()=>setShowSql(value=>!value)}>{showSql?'Скрыть SQL':'Показать SQL'}</button></div><p role="status" className="mt-2 text-[11px] text-[var(--accent)]">{copyResult}</p></li>
        <li><strong>Настрой коды на почту.</strong> В Authentication включи Email и регистрации. Подключи SMTP с разрешённым отправителем. В шаблоны Magic Link и Confirm signup добавь <code className="rounded bg-[var(--bg2)] px-1">{'{{ .Token }}'}</code> — это код, который вводится в лаунчере. Сначала проверь реальную доставку; тестовая отправка сервиса может быть ограничена.</li>
        <li><strong>Передай только публичные настройки сборке.</strong> В настройках Supabase возьми Project URL и publishable key (или anon public). В репозитории лаунчера: Settings → Secrets and variables → Actions → Variables. Создай <code className="break-all text-[var(--accent)]">TEMKA_SUPABASE_URL</code> и <code className="break-all text-[var(--accent)]">TEMKA_SUPABASE_ANON_KEY</code>.</li>
        <li><strong>Выпусти следующую версию.</strong> Для передачи этих настроек используй workflow из Publisher 1.0.5. Если 1.0.5 уже установлен, обновлять его ещё раз не нужно. Старый 1.0.3 публикует Windows-интерфейс, но его шаблон не передаёт настройки сервера. После сборки появятся вход по коду и поиск онлайн-юзернеймов.</li>
      </ol>
      <div id="friends-setup-sql" hidden={!showSql}><label className="block text-[11px] font-bold">SQL для нового проекта<textarea aria-label="SQL для нового проекта" readOnly value={schema} spellCheck={false} onFocus={event=>event.currentTarget.select()} className="mt-2 h-64 w-full rounded-lg border border-[var(--line)] bg-[var(--bg1)] p-3 font-mono text-[11px] leading-relaxed text-[var(--tx2)]"/></label></div>
      <p className="rounded-lg border border-amber-400/25 p-3 text-[11px] text-amber-200">Не помещай SMTP-пароль, пароль базы, service_role или sb_secret в лаунчер, GitHub Variables или переписку. В приложение идут только публичный URL и publishable/anon ключ.</p>
      <p><strong>Настоящая роль создателя:</strong> подтверди свою почту в онлайн-профиле. В Supabase Auth → Users найди свой UID и назначь ему creator_admin в таблице creator_roles через SQL Editor. Ник сам по себе не даёт прав. Подробности и точная команда — в backend/ПОДКЛЮЧИТЬ-ДРУЗЕЙ.md внутри исходного архива.</p>
      <p className="text-[11px] text-[var(--tx3)]">Открытие этой инструкции ничего не подключает автоматически. Сначала проверь два реальных аккаунта, получение кода и принятие заявки. Игра пока не использует эту авторизацию.</p>
    </div>
  </details>;
}
