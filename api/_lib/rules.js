/* Hall points: free, for fun, no cash value. Never redeemable, never sold. Served to the client as-is (published odds). */
export const WELCOME = [ // weights sum to 1000
  { v: 500, w: 400 }, { v: 1000, w: 300 }, { v: 2500, w: 170 }, { v: 5000, w: 90 }, { v: 10000, w: 30 }, { v: 35000, w: 10 }];
export const QUESTS = [
  { id: "checkin", title: "Daily check-in", sub: "Stop by the hall", reward: 250, cta: "Check in" },
  { id: "share", title: "Share your profile link", sub: "Send your /handle to a friend", reward: 500, cta: "Share" },
  { id: "drops", title: "Peek at today's drops", sub: "See what's left before it's gone", reward: 250, cta: "Browse", href: "#/shop" },
  { id: "live", title: "Say hi in the Live room", sub: "Drop a message in the hall chat", reward: 250, cta: "Go live", href: "#/live" },
  { id: "profile", title: "Polish your profile", sub: "Add a name, city or bio", reward: 500, cta: "Edit", href: "#/account" },
  { id: "gifts", title: "Check out gift cards", sub: "Pre-launch credit for later", reward: 250, cta: "Look", href: "#/gifts" }];
/* One-time milestone quests, verified on the server from real account data (never from purchases). */
export const MILESTONES = [
  { id: "m_spin", title: "Take your Welcome Spin", reward: 250, href: "#/spin", ok: (h) => h.welcome != null && +h.welcome > 0 },
  { id: "m_pfp", title: "Upload a profile photo", reward: 500, href: "#/account", ok: (h) => +h.hasAv > 0 },
  { id: "m_bio", title: "Write a bio", reward: 300, href: "#/account", ok: (h) => !!(h.bio && h.bio.length >= 3) },
  { id: "m_gw", title: "Enter the free giveaway", reward: 500, href: "#/giveaway", ok: (h, x) => !!x.gwJoined },
  { id: "m_chat", title: "Send your first Live chat", reward: 250, href: "#/live", ok: (h) => +h.chats > 0 },
  { id: "m_ref1", title: "Recruit 1 friend with your link", reward: 1000, href: "#/account", ok: (h) => +h.refs >= 1 },
  { id: "m_ref3", title: "Recruit 3 friends", reward: 2500, href: "#/account", ok: (h) => +h.refs >= 3 },
  { id: "m_ref10", title: "Recruit 10 friends (Hall Legend)", reward: 7500, href: "#/account", ok: (h) => +h.refs >= 10 },
];
export const pick = (t) => { let n = Math.floor(Math.random() * t.reduce((s, x) => s + x.w, 0)); for (let i = 0; i < t.length; i++) { n -= t[i].w; if (n < 0) return i; } return 0; };
const A = ["merlot", "cork", "pinot", "rose", "cabby", "bubbly", "tannin", "magnum", "decant", "vino", "swirl", "sip", "cellar", "brut", "zin", "syrah", "malbec", "riesling", "tardy", "recess", "hall", "detention", "chalk", "late", "prefect"];
const B = ["kid", "pass", "bell", "club", "crew", "fan", "nerd", "boss", "pal", "ace", "star", "ninja"];
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
export function randomHandle() { const h = rnd(A) + (Math.random() < .5 ? rnd(B) : "") + Math.floor(Math.random() * 900 + 10); return h.slice(0, 20); }
export const RESERVED = new Set(["admin", "jukebox", "club", "pearls", "spin", "champagneclub", "dynamic", "api", "u", "gifts", "login", "signup", "account", "privacy", "terms", "partners", "collections", "cart", "checkout", "help", "support", "winedetention", "official", "staff", "giveaway", "giveaways", "vip", "quests", "leaderboard", "spin", "party", "live", "shop", "bag", "orders", "drops", "hallpass", "hallpasses", "passes", "confirmation", "robots", "sitemap", "favicon", "mod", "moderator", "dynamic", "whop"]);
/* OG Founding VIP passes. Credit = price + FIXED bonus (no chance element on a paid purchase). Credit is not cash. */
export const VIP_BONUS_PCT = 35;
export const VIP = {
  vip350: { name: "Founding Members: OG VIP Mystery Drop", price: 350 },
  vip888: { name: "Let's Pop: Champagne After Hours Special", price: 888 },
  vip1750: { name: "The Private Reserve: Bougie Luxury Stash", price: 1750 },
  vip1313: { name: "The Private Reserve: Principal's Pour", price: 1313 },
  vip2500: { name: "The Private Reserve: Penthouse Pour", price: 2500 },
  vip3500: { name: "The Rich Reserve: Permanent Record", price: 3500 },
  vip5000: { name: "The Royal Reserve: Drunk Tank Deluxe", price: 5000 },
  vipBundle: { name: "OG Flash Deal: All Three", price: 2738, list: 2988, credit: 4033.8, bundle: true },
};
export const VIP_RANK = ["vip350", "vip888", "vip1313", "vip1750", "vipBundle", "vip2500", "vip3500", "vip5000"];
export const BUNDLE_RANGE = 100; // bundle buyers get VIP #1-#100; everyone else starts at #101
export const REFERRAL = { inviter: 1000, invitee: 500 };
