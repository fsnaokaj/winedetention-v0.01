# Wine Detention (winedetention.com)

Pre-launch site: gift cards + pre-launch offers (Whop, non-alcohol), partner wine lockers (licensed partners sell and ship), Dynamic.xyz sign-in, Upstash KV accounts.

- `js/wd-config.js` — Whop links, partners, locker → partner mapping, gift bonus. Empty link = "Notify me".
- `api/wd.js` — accounts, spin, quests, leaderboard, waitlist, gift codes, admin.
- `/admin` — needs env `ADMIN_PASS`.

Env vars (Vercel): `DYNAMIC_ENV_ID`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `ADMIN_PASS`.

## Ops notes (internal)

- **Domain hold:** `winedetention.com` may be on registrar client hold. Keep shipping on the Vercel alias `https://winedetention-v0-01.vercel.app`. Public promo copy continues to use winedetention.com; do not put the hold warning on the public homepage.
- **Giveaway:** Founding Detention Giveaway '26 — free entry, 21+, **no alcohol prizes** (gift cards, whitening strips, swag). Config in `api/_lib/giveaway.config.js`; UI in `js/wd-giveaway.js` + sticky `js/promo-bar.js`.
- **Still waiting on Mimi:** Whop checkout links for VIP drops + gift cards; clear domain hold / restore DNS to Vercel.

