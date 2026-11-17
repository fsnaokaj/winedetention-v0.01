/* Wine Detention rewards config: ONE source of truth shared by the browser and the server
   (api/_lib/econ.js, api/_lib/jukebox.js). Hall points + Pearls are virtual, for fun, with NO cash value. */

/* ---------- Happy Hour surge (points multipliers), Arizona time (UTC-7, no DST) ----------
   Scheduled windows below + admin-triggered surges (/admin → Surge). The highest active one wins.
   Applied on the server to quests, milestones, referrals, chat activity, tips received and purchases. */
export const SURGE_SCHEDULE = [
  { id: "lunch", label: "Lunch Detention", mult: 1.5, days: [0, 1, 2, 3, 4, 5, 6], from: 12, to: 13 },
  { id: "happy", label: "Happy Hour", mult: 2, days: [0, 1, 2, 3, 4, 5, 6], from: 17, to: 19 },
  { id: "late", label: "Late Night Surge", mult: 3.5, days: [5, 6], from: 21, to: 23 },
];
export const SURGE_MULTS = [1.5, 2, 3.5];
export const SURGE_TAGLINE = "It might not be much but it's honest work.";
const AZ = 7 * 3600e3;
/** Scheduled surge at `now` (ms) → { mult, label, endsAt, id } or null. */
export function scheduledSurge(now = Date.now()) {
  const az = new Date(now - AZ), dow = az.getUTCDay(), hr = az.getUTCHours() + az.getUTCMinutes() / 60;
  let best = null;
  for (const s of SURGE_SCHEDULE) if (s.days.includes(dow) && hr >= s.from && hr < s.to && (!best || s.mult > best.mult)) {
    const end = Date.UTC(az.getUTCFullYear(), az.getUTCMonth(), az.getUTCDate(), s.to, 0, 0) + AZ;
    best = { id: s.id, label: s.label, mult: s.mult, endsAt: end, source: "schedule" };
  }
  return best;
}
/** Next scheduled surge start after `now` → { label, mult, startsAt }. */
export function nextSurge(now = Date.now()) {
  let best = null; const az0 = new Date(now - AZ);
  for (let d = 0; d < 8; d++) {
    const day = new Date(Date.UTC(az0.getUTCFullYear(), az0.getUTCMonth(), az0.getUTCDate() + d)); const dow = day.getUTCDay();
    for (const s of SURGE_SCHEDULE) { if (!s.days.includes(dow)) continue;
      const st = day.getTime() + s.from * 3600e3 + AZ; if (st > now && (!best || st < best.startsAt)) best = { id: s.id, label: s.label, mult: s.mult, startsAt: st }; }
    if (best) return best;
  }
  return best;
}
/** Combine the schedule with an admin override ({mult,label,endsAt}). */
export function surgeAt(now = Date.now(), admin = null) {
  const s = scheduledSurge(now); const a = admin && +admin.endsAt > now && SURGE_MULTS.includes(+admin.mult) ? { id: "admin", label: admin.label || "Surprise Surge", mult: +admin.mult, endsAt: +admin.endsAt, source: "admin" } : null;
  const best = [s, a].filter(Boolean).sort((x, y) => y.mult - x.mult)[0] || null;
  return best ? { ...best, active: true } : { active: false, mult: 1, next: nextSurge(now) };
}

/* ---------- base points (multiplied by surge x Champagne Club 2x) ---------- */
export const POINTS = { chatMsg: 10, chatDailyCap: 10, perDollar: 1, connect: 250, connectVerified: 500, tipReceivedPerPearl: 1 };
export const CLUB_POINTS_MULT = 2;

/* ---------- Pearls: virtual goods for tips + gifts. No cash value, not withdrawable, no cash-out. ---------- */
export const PEARL_PACKS = [
  { key: "pearls5", price: 5, pearls: 500, name: "Handful of Pearls" },
  { key: "pearls10", price: 10, pearls: 1100, name: "Pocket of Pearls", bonus: "+10%" },
  { key: "pearls25", price: 25, pearls: 3000, name: "Pearl Pouch", bonus: "+20%", hot: true },
  { key: "pearls50", price: 50, pearls: 6500, name: "Pearl Vault", bonus: "+30%" },
  { key: "pearls100", price: 100, pearls: 14000, name: "Oyster Bar", bonus: "+40%" },
];
export const GIFTS = [
  { id: "rose", emoji: "🌹", name: "Rose", cost: 10, fx: "float" },
  { id: "star", emoji: "⭐", name: "Gold star", cost: 25, fx: "burst" },
  { id: "pearl", emoji: "🦪", name: "Pearl drop", cost: 50, fx: "rain" },
  { id: "beads", emoji: "📿", name: "Prayer beads", cost: 100, fx: "swing" },
  { id: "champ", emoji: "🍾", name: "Champagne pop", cost: 500, fx: "pop" },
];
export const gift = (id) => GIFTS.find((g) => g.id === id) || null;

/* ---------- Welcome game: ONE free play per account (wheel or claw, same prize table). Never sold. ---------- */
export const WELCOME_PRIZES = [ // weights sum to 1000; odds published on /spin
  { id: "p500", kind: "points", v: 500, label: "500 hall points", emoji: "⭐", w: 250 },
  { id: "p1000", kind: "points", v: 1000, label: "1,000 hall points", emoji: "🌟", w: 200 },
  { id: "p2500", kind: "points", v: 2500, label: "2,500 hall points", emoji: "💫", w: 90 },
  { id: "pl100", kind: "pearls", v: 100, label: "100 Pearls", emoji: "🦪", w: 150 },
  { id: "pl250", kind: "pearls", v: 250, label: "250 Pearls", emoji: "🦪", w: 60 },
  { id: "gw3", kind: "entries", v: 3, label: "+3 bonus giveaway entries", emoji: "🎟️", w: 120 },
  { id: "cr5", kind: "credit", v: 5, label: "$5 gift credit", emoji: "💌", w: 80 },
  { id: "off10", kind: "off", v: 10, max: 25, label: "10% off your first order (up to $25)", emoji: "🏷️", w: 50 },
];

/* ---------- Connected accounts ----------
   verified: linked through the sign-in provider (needs the provider switched on + "Social account linking"
   in the sign-in dashboard). Others are self-reported handles, shown as unverified profile links. */
export const CONNECT = [
  { id: "instagram", name: "Instagram", emoji: "📸", url: "https://instagram.com/", re: /^[a-z0-9._]{1,30}$/i },
  { id: "spotify", name: "Spotify", emoji: "🎧", url: "https://open.spotify.com/user/", re: /^[a-z0-9._-]{1,40}$/i },
  { id: "tiktok", name: "TikTok", emoji: "🎵", url: "https://www.tiktok.com/@", re: /^[a-z0-9._]{2,24}$/i, verify: "tiktok" },
  { id: "x", name: "X", emoji: "𝕏", url: "https://x.com/", re: /^[a-z0-9_]{1,15}$/i, verify: "twitter" },
  { id: "youtube", name: "YouTube", emoji: "▶️", url: "https://www.youtube.com/@", re: /^[a-z0-9._-]{3,30}$/i },
  { id: "twitch", name: "Twitch", emoji: "🟣", url: "https://www.twitch.tv/", re: /^[a-z0-9_]{3,25}$/i, verify: "twitch" },
  { id: "kick", name: "Kick", emoji: "🟢", url: "https://kick.com/", re: /^[a-z0-9_]{3,25}$/i },
  { id: "telegram", name: "Telegram", emoji: "✈️", url: "https://t.me/", re: /^[a-z0-9_]{5,32}$/i },
];

/* ---------- Champagne Club (premium) ---------- */
export const CLUB = {
  key: "club", price: 88.88, name: "Champagne Club · Founding OG", tier: "Ruby", emoji: "🥂",
  perks: ["🥂 Ruby Founding OG badge + chat flair", "2x base hall points, forever (stacks with Happy Hour)", "1,000 Pearls on day one + 500 Pearls every month", "Early access: shop new drops 24h before everyone", "Jukebox priority + 2 song requests at once"],
  joinPearls: 1000, monthlyPearls: 500, earlyHours: 24,
  later: ["Sapphire", "Platinum"], // future tiers, not sold yet
};

/* ---------- Jukebox: in-house catalog only (no licensed music) ---------- */
export const JUKEBOX = { requestFree: 1, requestClub: 2, perHour: 4, bumpPoints: 250, bumpPearls: 10, bumpBoost: 3, clubBoost: 2, queueMax: 40 };

/* durations in seconds (from the files in /audio). Lyrics: add `lyrics: [[sec, "line"], ...]` to a track
   ONLY if we own them; tracks without lyrics get the sing-along mode (timer + visualizer). */
export const JUKEBOX_TRACKS = [
  { id: "superboy", title: "Superboy (First Person)", artist: "Superboy", dur: 156, src: "/audio/superboy-first-person-v1.m4a" },
  { id: "superboy-v2", title: "Superboy (First Person) V2", artist: "Superboy", dur: 156, src: "/audio/superboy-first-person-v2.m4a" },
  { id: "superboy-v2b", title: "Superboy (First Person) V2.1", artist: "Superboy", dur: 156, src: "/audio/superboy-first-person-v2-1.m4a" },
  { id: "superboy-hard-v1", title: "Superboy (Hardstyle Mix)", artist: "Superboy", dur: 172, src: "/audio/superboy-hardstyle-v1.m4a" },
  { id: "superboy-hard-v2", title: "Superboy (Hardstyle Mix) V2", artist: "Superboy", dur: 175, src: "/audio/superboy-hardstyle-v2.m4a" },
  { id: "superboy-male-v1", title: "Superboy (Male Vocals)", artist: "Superboy", dur: 175, src: "/audio/superboy-male-v1.m4a" },
  { id: "superboy-male-remix", title: "Superboy (Male Vocals Remix)", artist: "Superboy", dur: 159, src: "/audio/superboy-male-v1-remix.m4a" },
  { id: "superboy-male-v2", title: "Superboy (Male Vocals) V2", artist: "Superboy", dur: 171, src: "/audio/superboy-male-v2.m4a" },
  { id: "superboy-cut", title: "Superboy", artist: "Superboy", dur: 154, src: "/audio/superboy.m4a" },
  { id: "superboy-1", title: "Superboy 1", artist: "Superboy", dur: 180, src: "/audio/superboy-1.m4a" },
  { id: "superboy-2", title: "Superboy 2", artist: "Superboy", dur: 181, src: "/audio/superboy-2.m4a" },
];
export const track = (id) => JUKEBOX_TRACKS.find((t) => t.id === id) || null;
