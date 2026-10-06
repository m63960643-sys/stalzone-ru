# STALZONE RU — official API + Telegram

Этот вариант использует официальный STALZONE API для региона RU и Telegram Bot API.

## Render environment variables

- TELEGRAM_BOT_TOKEN
- TELEGRAM_CHAT_ID
- STALZONE_CLIENT_ID
- STALZONE_CLIENT_SECRET
- STALZONE_REGION=RU
- STALZONE_API_BASE_URL=https://eapi.stalzone.com
- POLL_INTERVAL_MS=60000

Для production API приложение STALZONE должно быть зарегистрировано и одобрено.
Никогда не помещайте токены/секреты в HTML или GitHub.

## Timer logic

The main timer counts from `previousEnd` (the end of the last completed emission). `currentStart` is used only to detect an active emission and trigger the Telegram notification. This avoids counting the emission duration twice in the elapsed-time counter.
