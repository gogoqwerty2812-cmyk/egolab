# Оплата картой через 1pay.cx — Cloudflare Worker

`onepay-worker.js` — маленький сервер между сайтом и 1pay:

- **POST /create** — сайт просит создать платёж. Worker сам пересчитывает сумму по `data/content.json`
  (цены, промокод, доставка), поэтому покупатель не может подменить цену. Возвращает ссылку на оплату.
- **GET /status?id=…** — страница заказа узнаёт реальный статус платежа.
- **POST /hook** — 1pay сообщает «оплачено». Worker проверяет подпись, перечитывает платёж
  и шлёт в Telegram «✅ PAID BY CARD».

Деньги приходят в USDT (BEP-20) на кошелёк из кабинета 1pay (Payout wallets & settlement).

## Деплой (один раз, через сайт Cloudflare)

1. dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker** (Start with Hello World).
   Имя: `egolab-pay` → **Deploy**.
2. **Edit code** → удалить всё → вставить содержимое `onepay-worker.js` → **Deploy**.
3. Worker → **Settings → Variables and Secrets** → **Add**:

   | Имя | Тип | Значение |
   |---|---|---|
   | `ONEPAY_API_KEY` | Secret | `pk_test_…` (потом `pk_…`) |
   | `ONEPAY_WEBHOOK_SECRET` | Secret | `whsec_test_…` (потом `whsec_…`) — 1pay → API & webhooks → Reveal |
   | `TG_BOT_TOKEN` | Secret | токен бота (@BotFather → /mybots → API Token) |
   | `TG_CHAT_ID` | Text | `6929789772` |
   | `SITE_URL` | Text | `https://egolab.shop` |

4. Скопировать адрес Worker'а (вида `https://egolab-pay.<имя>.workers.dev`) и вставить его в
   `assets/js/config.js` → `SITE.cardPayment.workerUrl`. Пока поле пустое, карта на сайте — «Скоро».

## Переход на боевой режим

В 1pay включить **Live**, создать боевой ключ `pk_…` (Read + Create payments) и в Worker заменить
`ONEPAY_API_KEY` на `pk_…`, а `ONEPAY_WEBHOOK_SECRET` — на **Live secret** `whsec_…`.
Сайт трогать не нужно.

## Если меняешь промокоды или доставку

Они продублированы в начале `onepay-worker.js` (`PROMO_CODES`, `SHIPPING`) — поменяй там так же,
как в `assets/js/config.js`, и заново вставь код в Cloudflare. Иначе оплата картой ответит «Цены изменились».
