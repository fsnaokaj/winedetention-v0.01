# Wine Detention (winedetention.com)

Pre-launch site: gift cards + pre-launch offers (Whop, non-alcohol), partner wine lockers (licensed partners sell and ship), Dynamic.xyz sign-in, Upstash KV accounts.

- `js/wd-config.js` — Whop links, partners, locker → partner mapping, gift bonus. Empty link = "Notify me".
- `api/wd.js` — accounts, spin, quests, leaderboard, waitlist, gift codes, admin.
- `/admin` — needs env `ADMIN_PASS`.

- `js/wd-catalog.js` — Hall Passes, VIP drops, gift cards: prices, real stock + sale windows (shared by browser and server).
- `js/wd-shop.js` — bag (+/-), drawer, checkout, confirmation, drop pages + comments, Live chat, activity ticker.
- `api/whop.js` — Whop webhook (`payment.succeeded`) → fulfills orders. `api/_lib/orders.js` stock/holds/fulfillment, `api/_lib/social.js` chat.

Env vars (Vercel → Project → Settings → Environment Variables):

| Var | Required | Where to get it |
| --- | --- | --- |
| `DYNAMIC_ENV_ID` | **yes (Production)** | Sign-in dashboard (app.dynamic.xyz) → Developers → SDK & API keys → Environment ID. Production no longer falls back to a hardcoded id. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | yes | Upstash for Redis (Vercel Marketplace) — already connected. |
| `ADMIN_PASS` | yes | Any long passphrase, for `/admin`. |
| `WHOP_API_KEY` | yes for checkout | Whop dashboard → Developer → Company API key (needs checkout-configuration create + payment read). |
| `WHOP_COMPANY_ID` | yes for checkout | Whop business id `biz_…` (dashboard URL / Settings). |
| `WHOP_WEBHOOK_SECRET` | yes for fulfillment | Whop → Developer → Webhooks → create `https://<domain>/api/whop`, event `payment.succeeded` (+ `payment.failed`), API version v1 → copy the `ws_…` secret. |
| `WHOP_PRODUCT_ID` | optional | `prod_…` to group order plans under one Whop product. |
| `WD_SITE_URL` | optional | e.g. `https://winedetention-v0-01.vercel.app` — where Whop sends buyers back. Defaults to the request host. |
| `WD_CRYPTO_TREASURY` | optional | Your own `0x…` receiving address for direct "Pay with USDC" on Base. Off when unset (Whop checkout already accepts crypto). |
| `WD_TEST_AUTH` | local only | `1` enables `test:<id>` tokens; ignored on Vercel. |

## Ops notes (internal)

- **Domain hold:** `winedetention.com` may be on registrar client hold. Keep shipping on the Vercel alias `https://winedetention-v0-01.vercel.app`. Public promo copy continues to use winedetention.com; do not put the hold warning on the public homepage.
- **Giveaway:** Founding Detention Giveaway '26 — free entry, 21+, **no alcohol prizes** (gift cards, whitening strips, swag). Config in `api/_lib/giveaway.config.js`; UI in `js/wd-giveaway.js` + sticky `js/promo-bar.js`.
- **Still waiting on Mimi:** Whop API key + company id + webhook secret (env vars above); clear domain hold / restore DNS to Vercel.
- **Stock:** defaults in `js/wd-catalog.js` (`DROP_DEFAULTS`); override per SKU in `/admin → Stock`. "Claimed" = paid units only.

