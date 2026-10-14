# ПК 1.9.6 — Windows checkout / CRLF

## Реальный запуск 1.9.5

GitHub run 38576529615 (#21), commit bf737b072697c7c1f03a1bde1374b16849949f6b:
- Linux job: success.
- Windows build: failure на npm run build / post-restore tests.
- Publish: skipped.

Linux-исправление сетевой изоляции 1.9.5 прошло удалённый CI. Новое Windows-зависимое падение воспроизведено локально: multiline assertion в tests/ci-smoke.test.cjs искал `await probe();\n ...` в protected smoke, который при CRLF checkout содержит `\r\n`. Это ошибка добавленного теста, не ошибка Vite или рабочего входа.

## Исправление

Protected source читается с канонизацией CRLF → LF. Multiline-проверка сохранена, никаких continue-on-error, удаления теста или отключения платформы.

Предыдущая checkout regression запускала лишь три теста восстановления, поэтому не замечала новый сетевой тест. Теперь для LF, CRLF и mixed запускаются все девять нерекурсивных CI-smoke проверок, включая сетевую. Исключён лишь сам subprocess-spawning тест: отдельный child marker предотвращает рекурсию, а в обычной suite он выполняется. Подлинность protected bundle, checksum, восстановление, sidebar/UI/workflow contracts сохраняются.

Рабочий runtime, Electron session fixture, Auth/backend/Dev/updater не изменены. Номер 1.9.6 нужен, поскольку теги 1.9.4 и 1.9.5 уже созданы.

## Выполненная локальная проверка

- Ошибка старой проверки на CRLF воспроизведена до исправления: ERR_ASSERTION на multiline includes.
- CI-smoke suite: 10/10; дочерние LF/CRLF/mixed проверки запускают по 9 нерекурсивных тестов.
- Полная suite: 187/187, без пропусков.
- TypeScript + production Vite build: PASS.
- Реальные ProjectFiles.ExtractProject + ApplySupport из Publisher 1.1.1, с его встроенным support.zip, выполнены через C# harness.
- После импорта 176 текстовых файлов checkout преобразованы в CRLF. Это воспроизводит переносы Windows Git checkout, а не только отдельный искусственный snippet.
- На этом CRLF checkout: prebuild suite 36/36; Vite restore + TypeScript + обязательная post-restore suite 117/117; production build PASS.
- Собранный CRLF-проект запущен в настоящем Linux Electron 44.7.0 под Xvfb: все 19 фаз smoke PASS, включая онлайн-профиль, системное копирование, чужой renderer, repeated reload, аватарки/DM/IPC.

## Границы проверки

CRLF checkout проверялся на Linux с Node 22, это НЕ нативный Windows запуск. Новый GitHub CI 1.9.6 здесь не запускался; Windows и Linux jobs должны снова пройти через Publisher. Зелёный удалённый Linux относится к 1.9.5.

Большой Windows-инсталлятор лаунчера не создавался/не скачивался. Реальные OTP и личные токены не использовались; Auth/SQL/GitHub записи не выполнялись. Публикация по-прежнему требует успешных обеих платформ. При read-only проверке тег v1.9.6 отсутствовал; существующие теги не перезаписываются.
