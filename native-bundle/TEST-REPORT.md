# ПК 1.9.7 — Dev admin UI removal

- DevView не содержит выдачи/копирования нового приглашения и отзыва tester даже для owner. SDK issueDev/revokeDevTester удалены.
- Dev-клиент оставляет проверку доступа, redeem, каталог и download с прежним Main Auth.
- Полная Node suite **189/189**; TypeScript/Vite production build PASS.
- Настоящий Linux Electron 44.7.0 под Xvfb: **20 фаз smoke PASS**. Новая фаза рендерит Dev с server fixture owner:true/allowed:true и проверяет отсутствие админ-кнопок и поля выдачи. Разрешены лишь status/builds Dev-вызовы из этого сценария. Остальные clipboard/Auth/UI/IPC проверки сохранены.
- LF/CRLF/mixed CI-regression продолжает выполняться, не выключена. DevView/SDK/dev.test защищены native-bundle, 45 файлов, canonical SHA256 manifest.
- Проверен анонимный READ-ONLY POST status к текущему Dev-шлюзу без Bearer: HTTP401 sign_in_required. Это отрицательная проверка, НЕ тест чужого настоящего аккаунта или реальной выдачи.
- Серверный код проверен: primary Auth/user даёт UID/email только после подтверждения, RPC доступен service_role, выдача/отзыв требуют owner. SQL/Gateway/RLS не менялись.
- Новый удалённый CI 1.9.7/нативный Windows здесь не запускались. Publisher должен снова проверить обе платформы. Windows/Linux исправления 1.9.6 сохранены.
- Реальные OTP/личные токены/инвайт со скриншота не использовались, production mutations отсутствуют. Большой Windows-инсталлятор лаунчера не создавался/не скачивался.

Publisher 1.1.2 проверен отдельно: официальные .NET Framework4.8 references, WinForms UI и server fixtures; Main Auth и Dev owner проверяются отдельно перед действием; существующее запоминание входа сохранено. Реальная Windows/DPAPI/живые owner mutations требуют пользовательской проверки.
