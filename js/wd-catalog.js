/* Wine Detention shop catalog — ONE source of truth for prices.
   Imported by the browser (js/wd-shop.js) AND the server (api/_lib/orders.js),
   so the checkout total is always computed server-side from these numbers.
   Nothing here is alcohol. Paid items never add giveaway entries or hall points. */
import { PEARL_PACKS, CLUB } from "./wd-rewards.js";
export const HALL_PASSES = [
  { key: "hp35", price: 35, emoji: "⏰", name: "Tardy Slip", blurb: "Late again? Own it. The starter pass for fashionably late troublemakers.", color: ["#0E3386", "#60A5FA"] },
  { key: "hp53", price: 53, emoji: "🕵️", name: "Hall Monitor Bribe", blurb: "Slip it to the monitor, stroll right past. No questions asked.", color: ["#CC3433", "#FDBA74"] },
  { key: "hp63", price: 63, emoji: "🎯", name: "Spitball Special", blurb: "Aim, fire, deny everything. A pass with good aim.", color: ["#0E7490", "#5EEAD4"] },
  { key: "hp69", price: 69, emoji: "😏", name: "The Nice Pass", blurb: "Nice. Just… nice. The one everybody screenshots.", color: ["#DB2777", "#F9A8D4"], hot: true },
  { key: "hp88", price: 88, emoji: "🎱", name: "Double Detention", blurb: "Twice the trouble, lucky-eights energy. Stack it, flex it.", color: ["#7C3AED", "#C4B5FD"] },
  { key: "hp117", price: 117, emoji: "🏃", name: "Skip-the-Line Slip", blurb: "Cut the lunch line like you run the place.", color: ["#059669", "#86EFAC"] },
  { key: "hp222", price: 222, emoji: "🍕", name: "Cafeteria Takeover", blurb: "Angel-number chaos. You run the cafeteria now.", color: ["#EA580C", "#FDE68A"] },
  { key: "hp333", price: 333, emoji: "🔥", name: "Triple Dog Dare", blurb: "You were triple-dog-dared. You had to.", color: ["#DC2626", "#FCA5A5"] },
  { key: "hp350", price: 350, emoji: "🛋️", name: "Principal's Couch", blurb: "Called to the office and you kicked your feet up.", color: ["#1D4ED8", "#F5C451"] },
  { key: "hp420", price: 420, emoji: "🚌", name: "Senior Skip Day", blurb: "The whole day off the books. Legendary-status pass.", color: ["#0E3386", "#CC3433"] },
];
/* Hall Pass = full price back as Wine Detention gift credit + a collectible pass on your profile. */
export const HALL_PASS_PERKS = ["100% of the price as Wine Detention gift credit", "Collectible pass on your profile", "Counts toward your Hall Pass collection"];

export const VIP_DROPS = [
  { key: "vip350", price: 350, emoji: "🎁", name: "Founding Members: OG VIP Mystery Drop" },
  { key: "vip888", price: 888, emoji: "🍾", name: "Let's Pop: Champagne After Hours Special" },
  { key: "vip1750", price: 1750, emoji: "🗝️", name: "The Private Reserve: Bougie Luxury Stash" },
  { key: "vipBundle", price: 2738, list: 2988, emoji: "⚡", name: "OG Flash Deal: All Three", bundle: true },
  { key: "vip1313", price: 1313, emoji: "🔔", name: "The Private Reserve: Principal's Pour" },
  { key: "vip2500", price: 2500, emoji: "🏙️", name: "The Private Reserve: Penthouse Pour" },
  { key: "vip3500", price: 3500, emoji: "📜", name: "The Rich Reserve: Permanent Record" },
  { key: "vip5000", price: 5000, emoji: "👑", name: "The Royal Reserve: Drunk Tank Deluxe" },
];

export const GIFT_CARDS = [175, 350, 500, 1000].map((a) => ({ key: "gift" + a, price: a, emoji: "💌", name: `$${a.toLocaleString("en-US")} Wine Detention gift card` }));
/* Virtual goods + premium (see js/wd-rewards.js). Pearls have no cash value and can't be withdrawn. */
export const PEARL_SKUS = PEARL_PACKS.map((p) => ({ key: p.key, price: p.price, emoji: "🦪", name: `${p.pearls.toLocaleString("en-US")} Pearls · ${p.name}`, pearls: p.pearls, kind: "pearls" }));
export const CLUB_SKU = { key: CLUB.key, price: CLUB.price, emoji: CLUB.emoji, name: CLUB.name, kind: "club", maxQty: 1 };
export const GIFT_BONUS_PCT = 10;   // fixed promotional bonus on gift cards (not cash)
export const VIP_BONUS_PCT = 35;    // fixed bonus credit on VIP drops (matches api/_lib/rules.js)

/* REAL limited drops: default stock + sale window per SKU. Admin (/admin → Stock) can override in KV.
   "claimed" shown on the site = paid units counted by the Whop webhook. Nothing is faked.
   stock null = unlimited. endsAt null = no end (flash bundle ends Cyber Monday, FLASH_END). */
const AZ = (d) => d + "T23:59:59-07:00"; // 11:59:59 PM Arizona time
/* Naughty List pre-Black Friday OG deals: everything runs through Valentine's, flash bundle through Cyber Monday. */
export const DEALS_END = AZ("2027-02-14");   // Sun Feb 14, 2027 11:59 PM Arizona (same as the giveaway)
export const FLASH_END = AZ("2026-11-30");   // Mon Nov 30, 2026 11:59 PM Arizona (Cyber Monday)
const W = (stock) => ({ stock, endsAt: DEALS_END });
export const DROP_DEFAULTS = {
  hp35: W(200), hp53: W(150), hp63: W(150), hp69: W(69), hp88: W(88), hp117: W(75), hp222: W(50), hp333: W(33), hp350: W(30), hp420: W(42),
  vip350: W(100), vip888: W(50), vip1750: W(25), vipBundle: { stock: 100, endsAt: FLASH_END },
  vip1313: W(13), vip2500: W(10), vip3500: W(5), vip5000: W(3),
  gift175: W(null), gift350: W(null), gift500: W(null), gift1000: W(null),
  pearls5: { stock: null, endsAt: null }, pearls10: { stock: null, endsAt: null }, pearls25: { stock: null, endsAt: null }, pearls50: { stock: null, endsAt: null }, pearls100: { stock: null, endsAt: null },
  club: W(888),
};
/** Flash bundle deadline (fixed: Cyber Monday). Kept as a function so callers don't change. */
export function flashEnd() { return Date.parse(FLASH_END); }
export const HOLD_MIN = 20; // bag reserved for 20 minutes while you're at checkout

export const MAX_QTY = 10;
export const MAX_ORDER = 25000;

const kind = (s) => s.kind || (s.key.startsWith("hp") ? "pass" : s.key.startsWith("vip") ? "vip" : "gift");
export const SKUS = Object.fromEntries([...HALL_PASSES, ...VIP_DROPS, ...GIFT_CARDS, ...PEARL_SKUS, CLUB_SKU].map((s) => [s.key, { ...s, kind: kind(s) }]));
export const sku = (k) => SKUS[k] || null;

/** Normalise a bag: [{k,q}] -> valid lines with prices, merged, clamped. */
export function priceBag(lines) {
  const m = new Map();
  for (const l of Array.isArray(lines) ? lines : []) {
    const s = sku(String((l && l.k) || ""));
    const q = Math.floor(Number(l && l.q));
    if (!s || !(q > 0)) continue;
    m.set(s.key, Math.min(s.maxQty || MAX_QTY, (m.get(s.key) || 0) + q));
  }
  const items = [...m].map(([k, q]) => { const s = SKUS[k]; return { k, q, name: s.name, emoji: s.emoji, kind: s.kind, price: s.price, line: Math.round(s.price * q * 100) / 100 }; });
  const total = Math.round(items.reduce((t, i) => t + i.line, 0) * 100) / 100;
  return { items, total, count: items.reduce((t, i) => t + i.q, 0) };
}
