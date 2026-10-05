STALZONE RU — Telegram prototype

В комплекте: сайт, серверный /api/emission и Telegram notifier.
Проверка нового выброса — раз в 60 секунд. При изменении timestamp отправляется одно сообщение.

Для теста:
1. Создайте бота через @BotFather.
2. Напишите ему /start.
3. Задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в секретах хостинга.
4. npm start

Сейчас getEmission() использует DEMO_EMISSION. Следующий шаг — заменить его на официальный STALZONE API.
Не помещайте токены или Client Secret в index.html/app.js.
