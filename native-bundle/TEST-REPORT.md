# Проверка cloud-first входа · 13.10.2026

ПК 1.9.2, Android/iOS 0.4.2/build10. Publisher 1.1.0 не менялся.

- ПК: 161 unit-тест; postrestore 103 регрессии; TypeScript/Vite. Protected bundle 38 файлов, protocol3: теперь защищает и первый экран/локальный режим/auth/entry helpers и их тесты.
- Mobile: 73 unit-теста, TypeScript/Vite, синхронизация Android/iOS web assets.
- Новый smoke-entry.cjs: **76 проверок** Chromium PC, Chromium mobile, WebKit mobile. Чистое устройство, create_user=false/true, сохранение pending/cooldown, плохой код, серверная занятость, старый непроверенный email без автослияния, существующий профиль через регистрацию без переименования, UID mismatch, неподтверждённая почта, сеть, quota rollback, повтор после RPC-сбоя без повторной проверки использованного кода, отмена/поздний ответ, выход/повторный вход, локальный режим. Все Auth/RPC подставные, реальных писем нет.
- Electron Linux/Xvfb: 17 фаз. Старые сценарии явно выбирают локальный режим; IPC/аватар/clipboard/профили/друзья/бета/ЛС/Soon сохранены.
- Общие browser-регрессии: 46 friends/profile/beta + 18 chat/activity; mobile Chromium/WebKit: 150 проверок шести разделов, размеров/ориентаций, offline UI и сохранения локальных данных.
- Android: SDK35/JDK21 assembleDebug, версия0.4.2/code10, min26/target35, прежний appId. Сохранённый приватный test key не включён в ZIP. iOS sync не равен сборке Xcode.

Репетиция поставки: настоящий ProjectFiles.ExtractProject/ApplySupport из Publisher1.1.0, checkout CRLF, тесты старого шаблона, restore/build и обязательный Electron smoke; точные финальные результаты и SHA-256 записываются в WORKSPACE.md и LOGIN-UPDATE-SHA256.txt рядом с поставкой.

Production Auth/SMTP/SQL/роли/серверные данные не менялись. Windows-установщик лаунчера не создавался/не скачивался. На физическом Android/Windows/iPhone не проверено. Старые бета/SQL/Publisher проверки описаны в предыдущем отчёте и в этом исправлении заново не заявляются.
