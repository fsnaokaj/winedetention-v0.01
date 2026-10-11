/* Hall points: free, for fun, no cash value. Never redeemable, never sold. Served to the client as-is (published odds). */
export const WELCOME = [ // weights sum to 1000
  { v: 500, w: 400 }, { v: 1000, w: 300 }, { v: 2500, w: 170 }, { v: 5000, w: 90 }, { v: 10000, w: 30 }, { v: 35000, w: 10 }];
export const QUESTS = [
  { id: "checkin", title: "Daily check-in", sub: "Stop by the hall", reward: 250, cta: "Check in" },
  { id: "share", title: "Share your profile link", sub: "Send your /handle to a friend", reward: 500, cta: "Share" },
  { id: "partners", title: "Browse partner offers", sub: "See today's partner lockers", reward: 250, cta: "Browse", href: "#/collections" },
  { id: "profile", title: "Polish your profile", sub: "Add a name, city or bio", reward: 500, cta: "Edit", href: "#/account" },
  { id: "gifts", title: "Check out gift cards", sub: "Pre-launch credit for later", reward: 250, cta: "Look", href: "#/gifts" }];
export const pick = (t) => { let n = Math.floor(Math.random() * t.reduce((s, x) => s + x.w, 0)); for (let i = 0; i < t.length; i++) { n -= t[i].w; if (n < 0) return i; } return 0; };
const A = ["merlot", "cork", "pinot", "rose", "cabby", "bubbly", "tannin", "magnum", "decant", "vino", "swirl", "sip", "cellar", "brut", "zin", "syrah", "malbec", "riesling", "tardy", "recess", "hall", "detention", "chalk", "late", "prefect"];
const B = ["kid", "pass", "bell", "club", "crew", "fan", "nerd", "boss", "pal", "ace", "star", "ninja"];
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
export function randomHandle() { const h = rnd(A) + (Math.random() < .5 ? rnd(B) : "") + Math.floor(Math.random() * 900 + 10); return h.slice(0, 20); }
export const RESERVED = new Set(["admin", "api", "u", "gifts", "login", "signup", "account", "privacy", "terms", "partners", "collections", "cart", "checkout", "help", "support", "winedetention", "official", "staff"]);
/* OG Founding VIP passes. Credit = price + FIXED bonus (no chance element on a paid purchase). Credit is not cash. */
export const VIP_BONUS_PCT = 35;
export const VIP = {
  vipMonthly: { name: "Founding Members Monthly", price: 36, monthly: true },
  vip350: { name: "Founding Members: OG VIP Mystery Drop", price: 350 },
  vip888: { name: "Let's Pop: Champagne After Hours Special", price: 888 },
  vip1750: { name: "The Private Reserve: Penthouse Pour", price: 1750 },
  vip1313: { name: "The Private Reserve: Principal's Pour", price: 1313 },
  vip2500: { name: "The Rich Reserve: Permanent Record", price: 2500 },
  vip5000: { name: "The Royal Reserve: Drunk Tank Deluxe", price: 5000 },
  vipBundle: { name: "OG Flash Deal: All Three", price: 2738, list: 2988, credit: 4033.8, bundle: true },
};
export const VIP_RANK = ["vipMonthly", "vip350", "vip888", "vip1313", "vip1750", "vipBundle", "vip2500", "vip5000"];
export const BUNDLE_RANGE = 100; // bundle buyers get VIP #1-#100; everyone else starts at #101
