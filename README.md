# Wine Detention (winedetention.com)

Pre-launch site: gift cards + pre-launch offers (Whop, non-alcohol), partner wine lockers (licensed partners sell and ship), Dynamic.xyz sign-in, Upstash KV accounts.

- `js/wd-config.js` — Whop links, partners, locker → partner mapping, gift bonus. Empty link = "Notify me".
- `api/wd.js` — accounts, spin, quests, leaderboard, waitlist, gift codes, admin.
- `/admin` — needs env `ADMIN_PASS`.

Env vars (Vercel): `DYNAMIC_ENV_ID`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `ADMIN_PASS`.
