# CI navigation fix — ПК1.9.4

Причина обоих CI-падений: actual8 vs expected6 в старом smoke. Тест ожидал старые шесть пунктов, хотя UI уже содержал Магазин и Dev.

- Native smoke ожидает все8названий в точном порядке и проверяет aria-label, compact/wide layouts.
- Дополнительно открывает Магазин/Dev:6неактивных покупок, отсутствие музыки без выбранного трека, локальный режим не вызывает шлюз и не открывает форму приглашения.
-9CI regression tests pass: точное совпадение списка Sidebar, mandatory Linux/Windows smoke, восстановление protected copy при LF/CRLF/mixed, запрет повреждённого manifest.
-180unit tests pass; TypeScript/Vite production build pass;110post-restore tests pass.
-Настоящий Linux Electron44.7.0 подXvfb:18фаз smoke pass, включая буферобмена, friends/DM/literaltext/nonce, профили, библиотеку и Soon, preload isolation, IPC, persistence.
-Защищённые копии smoke/ci-regression и SHA256manifest обновлены. Код UI, рабочий сервер и публичное автообновление не изменены.

Windowsrunner/физическое устройство и новая GitHub-публикация не выполнялись. ОбаCIиспользуют исправленный общий скрипт, но результат Windowsjob подтвердится только после нового запуска.
БольшойWindowsинсталлятор лаунчера не создавался/не скачивался. Native/networkfixtures не отправляли реальных OTP и не использовали личные токены.
