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
| `WD_CHECKOUT_DOB` | optional | One-time date-of-birth check at first checkout is **on** by default; set `0` to turn it off. Only "passed" is stored, never the date. |
| `VERCEL_PREVIEW_FEEDBACK_ENABLED` | optional | `0` hides the Vercel comments toolbar on previews (alternative to the project setting below). Not set by us. |

### Vercel toolbar / comments
The site also hides the toolbar with CSS, but the clean switch is in Vercel: **Project → Settings → General → Vercel Toolbar** → set *Pre-Production Deployments* (and *Production*) to **Off**. A team-wide default lives in **Team → Settings → General → Vercel Toolbar**.

### Sign-in dashboard toggles (app.dynamic.xyz)
- **Log in & User Profile → Email**: on (the primary sign-in, 6-digit code).
- **Social → Google / Apple**: optional; their buttons appear in the sign-in popup automatically when enabled.
- **Log in & User Profile → Social account linking**: on, plus **X (Twitter), TikTok, Twitch** under Social, for the ✓ verified badge on Connected accounts. Instagram, Spotify, YouTube, Kick and Telegram are shown as unverified handles (not linkable through the sign-in SDK this site uses).
- Leave wallet / embedded-wallet login off: the popup never mentions it.

### Round 2 features (all server-authoritative, Upstash keys `wd:*`)
- **Happy Hour surge**: scheduled 12–1 PM 1.5x daily, 5–7 PM 2x daily, 9–11 PM 3.5x Fri/Sat (Arizona). Admin can fire 1.5x/2x/3.5x for 5–1440 min. Applies to quests, milestones, referrals, chat (cap 10 msgs/day), tips received and purchases (1 pt per $1).
- **Pearls**: packs $5/$10/$25/$50/$100 through the bag + Whop. Tips/gifts: rose 10, star 25, pearl 50, prayer beads 100, champagne pop 500. No cash value, not withdrawable (Terms §Pearls).
- **Welcome game**: one free wheel or claw play per account, `crypto.randomInt`, published odds.
- **Champagne Club**: $88.88 one-time Founding OG (Ruby), 888 run. 2x points, 1,000 Pearls on join + 500/month claim, 24h early access when a drop has a *Starts* time (admin → Stock), jukebox priority. Whop crypto is one-time only, hence no subscription.
- **Jukebox**: request/vote/bump the 11 in-house Superboy tracks; sing-along mode (no lyrics in repo; add `lyrics: [[sec, "line"], …]` to a track in `js/wd-rewards.js` to enable karaoke lines).
- **Deal windows**: VIP drops, Hall Passes, gift-card promos → Sun Feb 14 2027 11:59 PM AZ; OG Flash bundle → Mon Nov 30 2026 11:59 PM AZ (Cyber Monday).

## Ops notes (internal)

- **Domain hold:** `winedetention.com` may be on registrar client hold. Keep shipping on the Vercel alias `https://winedetention-v0-01.vercel.app`. Public promo copy continues to use winedetention.com; do not put the hold warning on the public homepage.
- **Giveaway:** Founding Detention Giveaway '26 — free entry, 21+, **no alcohol prizes** (gift cards, whitening strips, swag). Config in `api/_lib/giveaway.config.js`; UI in `js/wd-giveaway.js` + sticky `js/promo-bar.js`.
- **Still waiting on Mimi:** Whop API key + company id + webhook secret (env vars above); clear domain hold / restore DNS to Vercel.
- **Stock:** defaults in `js/wd-catalog.js` (`DROP_DEFAULTS`); override per SKU in `/admin → Stock`. "Claimed" = paid units only.

