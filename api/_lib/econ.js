/* Points (with Happy Hour surge + Champagne Club multipliers), Pearls (virtual goods), welcome game,
   connected accounts and tips. Server-authoritative; all state in Upstash KV.
   Keys: wd:u:<sub> fields points/earned/pearls/club/... · wd:lb (zset lifetime earned points) · wd:surge (admin surge JSON)
         wd:pl:<sub> (Pearl ledger list) · wd:cpts:<sub> (hash provider -> first-connect ts) */
import { randomInt } from "crypto";
import { r, pipe, obj } from "./redis.js";
import { surgeAt, CLUB_POINTS_MULT, WELCOME_PRIZES, CONNECT, GIFTS, POINTS, CLUB } from "../../js/wd-rewards.js";
import * as GW from "./giveaway.js";
const E = (m, s = 400) => Object.assign(new Error(m), { status: s });
const U = (sub) => `wd:u:${sub}`;

export async function adminSurge() { try { const raw = await r("GET", "wd:surge"); return raw ? JSON.parse(raw) : null; } catch { return null; } }
export async function surgeNow(now = Date.now()) { return surgeAt(now, await adminSurge()); }
export async function setSurge(mult, minutes, label) {
  if (!mult) { await r("DEL", "wd:surge"); return null; }
  const m = Number(mult), min = Math.floor(Number(minutes));
  if (![1.5, 2, 3.5].includes(m)) throw E("bad_mult"); if (!(min >= 5 && min <= 1440)) throw E("bad_minutes");
  const v = { mult: m, label: String(label || "Surprise Surge").replace(/[<>]/g, "").slice(0, 40), endsAt: Date.now() + min * 60e3 };
  await r("SET", "wd:surge", JSON.stringify(v), "EX", min * 60 + 60); return v;
}
/** Award points: base x surge x (Champagne Club ? 2 : 1). Returns { points, gained, mult, surge }. */
export async function earn(sub, base, opt = {}) {
  base = Math.floor(Number(base) || 0); if (base <= 0) return { points: +(await r("HGET", U(sub), "points")) || 0, gained: 0, mult: 1 };
  const club = opt.club != null ? opt.club : await r("HGET", U(sub), "club");
  const s = opt.noSurge ? { mult: 1, active: false } : await surgeNow();
  const mult = (opt.noSurge ? 1 : s.mult) * (club ? CLUB_POINTS_MULT : 1);
  const gained = Math.round(base * mult);
  const [p] = await pipe([["HINCRBY", U(sub), "points", gained], ["ZINCRBY", "wd:lb", gained, sub], ["HINCRBY", U(sub), "earned", gained]]);
  return { points: +p, gained, base, mult, surge: s.active ? { label: s.label, mult: s.mult } : null };
}
async function ledger(sub, d, why) { await pipe([["LPUSH", "wd:pl:" + sub, JSON.stringify({ d, why, at: Date.now() })], ["LTRIM", "wd:pl:" + sub, 0, 99]]); }
export async function addPearls(sub, n, why) { n = Math.floor(n); if (!(n > 0)) throw E("bad_amount"); const v = await r("HINCRBY", U(sub), "pearls", n); await ledger(sub, n, why); return +v; }
export async function spendPearls(sub, n, why) {
  n = Math.floor(n); if (!(n > 0)) throw E("bad_amount");
  const v = +(await r("HINCRBY", U(sub), "pearls", -n)); if (v < 0) { await r("HINCRBY", U(sub), "pearls", n); throw E("not_enough_pearls", 409); }
  await ledger(sub, -n, why); return v;
}
/** Spend points (leaderboard keeps lifetime earned). */
export async function spendPoints(sub, n) { n = Math.floor(n); const v = +(await r("HINCRBY", U(sub), "points", -n)); if (v < 0) { await r("HINCRBY", U(sub), "points", n); throw E("not_enough_points", 409); } return v; }
export const pearlLog = async (sub) => ((await r("LRANGE", "wd:pl:" + sub, 0, 29)) || []).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);

/* ---------- welcome game: one FREE play per account, server-side randomness ---------- */
export async function playWelcome(sub, game) {
  if (!(await r("HSETNX", U(sub), "welcome", -1))) throw E("already_spun", 409);
  const tot = WELCOME_PRIZES.reduce((s, x) => s + x.w, 0); let n = randomInt(tot), i = 0;
  for (; i < WELCOME_PRIZES.length; i++) { n -= WELCOME_PRIZES[i].w; if (n < 0) break; }
  let p = WELCOME_PRIZES[Math.min(i, WELCOME_PRIZES.length - 1)], note = "";
  if (p.kind === "entries" && !GW.gwOpen()) { p = WELCOME_PRIZES.find((x) => x.id === "p1000"); note = "giveaway_closed_swapped"; }
  if (p.kind === "points") await earn(sub, p.v, { noSurge: true, club: false });
  else if (p.kind === "pearls") await addPearls(sub, p.v, "welcome");
  else if (p.kind === "entries") { if (await GW.gwJoined(sub)) await GW.gwAdd(sub, p.v, "welcome"); else await r("HINCRBY", U(sub), "gwPending", p.v); } // pending entries land when they enter (eligibility checked there)
  else if (p.kind === "credit") await r("HINCRBYFLOAT", U(sub), "credit", p.v);
  else if (p.kind === "off") await r("HSET", U(sub), "promoPct", p.v, "promoMax", p.max);
  await r("HSET", U(sub), "welcome", 1, "welcomePrize", p.id, "welcomeGame", game === "claw" ? "claw" : "wheel");
  return { prize: { id: p.id, kind: p.kind, v: p.v, label: p.label, emoji: p.emoji }, index: WELCOME_PRIZES.indexOf(p), note };
}

/* ---------- connected accounts ---------- */
const oauthOf = (tok, provider) => ((tok && tok.verified_credentials) || []).find((c) => c && c.format === "oauth" && String(c.oauth_provider || "").toLowerCase() === provider);
export function connectsOf(h) { const out = {}; for (const c of CONNECT) { const raw = h["c:" + c.id]; if (raw) try { out[c.id] = JSON.parse(raw); } catch {} } return out; }
export async function connect(sub, id, handle, tok) {
  const c = CONNECT.find((x) => x.id === id); if (!c) throw E("bad_provider");
  let v = null, hd = String(handle || "").trim().replace(/^@/, "").slice(0, 40);
  if (c.verify) { const cr = oauthOf(tok, c.verify); if (cr) { v = 1; hd = String(cr.oauth_username || cr.oauth_display_name || hd || "").replace(/^@/, "").slice(0, 40); } }
  if (!v && !c.re.test(hd)) throw E("bad_social_handle");
  await r("HSET", U(sub), "c:" + id, JSON.stringify({ h: hd, v: v ? 1 : 0, at: Date.now() }));
  let reward = null;
  if (await r("HSETNX", "wd:cpts:" + sub, id + (v ? ":v" : ""), Date.now())) reward = await earn(sub, v ? POINTS.connectVerified : POINTS.connect);
  return { id, h: hd, v: v ? 1 : 0, reward };
}
export async function disconnect(sub, id) { if (!CONNECT.find((x) => x.id === id)) throw E("bad_provider"); await r("HDEL", U(sub), "c:" + id); }

/* ---------- tips / gifts (virtual, no cash value) ---------- */
export async function tip(sub, h, toHandle, giftId) {
  const g = GIFTS.find((x) => x.id === giftId); if (!g) throw E("bad_gift");
  const to = String(toHandle || "").toLowerCase().replace(/^@/, ""); const toSub = /^[a-z0-9_]{3,20}$/.test(to) ? await r("GET", "wd:h:" + to) : null;
  if (!toSub) throw E("not_found", 404); if (toSub === sub) throw E("no_self_tip");
  if (await r("SISMEMBER", "wd:banned", sub)) throw E("muted", 403);
  if (!(await r("SET", "wd:trl:" + sub, 1, "NX", "PX", 1500))) throw E("slow_down", 429);
  const left = await spendPearls(sub, g.cost, `tip:${g.id}:@${to}`);
  await pipe([["HINCRBY", U(toSub), "tipsIn", g.cost], ["HINCRBY", U(sub), "tipsOut", g.cost], ["ZINCRBY", "wd:lb:tips", g.cost, toSub]]);
  const rec = await earn(toSub, g.cost * POINTS.tipReceivedPerPearl);
  return { gift: g, to, pearls: left, toGained: rec.gained };
}

/* ---------- Champagne Club ---------- */
const month = () => new Date(Date.now() - 7 * 3600e3).toISOString().slice(0, 7); // Arizona month
export async function joinClub(sub, orderId) {
  const first = await r("HSETNX", U(sub), "club", "ruby");
  if (first) { await r("HSET", U(sub), "clubAt", Date.now(), "clubOrder", orderId, "clubMonth", month()); await r("ZADD", "wd:club", Date.now(), sub); await addPearls(sub, CLUB.joinPearls, "club:join"); }
  return !!first;
}
export async function clubMonthly(sub) {
  const h = obj(await r("HGETALL", U(sub))); if (!h.club) throw E("not_club", 403);
  const m = month(); if (h.clubMonth === m) throw E("already_claimed", 409);
  if (!(await r("SET", `wd:clubm:${sub}:${m}`, 1, "NX", "EX", 40 * 86400))) throw E("already_claimed", 409);
  await r("HSET", U(sub), "clubMonth", m); return addPearls(sub, CLUB.monthlyPearls, "club:" + m);
}
