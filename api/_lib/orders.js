/* Orders, real stock, cart holds, fulfillment and the activity ticker. All state in Upstash KV.
   Keys: wd:order:<id> (JSON) · wd:orders (zset) · wd:uorders:<sub> (zset) · wd:sold (hash sku->paid units)
         wd:stockcfg (hash sku->JSON override) · wd:hold:<sku> (hash orderId->"qty:expiresMs") · wd:ticker (list) */
import { randomBytes } from "crypto";
import { r, pipe, obj } from "./redis.js";
import * as R from "./rules.js";
import { SKUS, sku, priceBag, DROP_DEFAULTS, HOLD_MIN, GIFT_BONUS_PCT, MAX_ORDER } from "../../js/wd-catalog.js";
import { CLUB, POINTS } from "../../js/wd-rewards.js";
import { earn, addPearls, joinClub } from "./econ.js";

const E = (m, s = 400) => Object.assign(new Error(m), { status: s });
const U = (sub) => `wd:u:${sub}`;
const OK = (id) => `wd:order:${id}`;
const round2 = (n) => Math.round(n * 100) / 100;

/* ---------- stock ---------- */
export async function stockCfg() {
  const o = obj(await r("HGETALL", "wd:stockcfg")); const out = {};
  for (const k of Object.keys(SKUS)) { let ov = {}; try { ov = o[k] ? JSON.parse(o[k]) : {}; } catch {} out[k] = { ...DROP_DEFAULTS[k], ...ov }; }
  return out;
}
const endOf = (c) => (c.endsAt ? Date.parse(c.endsAt) : null);
async function activeHolds(k, now, except) {
  const h = obj(await r("HGETALL", "wd:hold:" + k)); let n = 0; const dead = [];
  for (const [oid, v] of Object.entries(h)) { const [q, exp] = String(v).split(":").map(Number); if (exp < now) dead.push(oid); else if (oid !== except) n += q; }
  if (dead.length) await r("HDEL", "wd:hold:" + k, ...dead).catch(() => {});
  return n;
}
/** Public, real numbers: stock, claimed (paid), held (in someone's checkout), left, endsAt, status. */
export async function stockAll(now = Date.now()) {
  const cfg = await stockCfg(); const sold = obj(await r("HGETALL", "wd:sold")); const out = {};
  for (const k of Object.keys(SKUS)) {
    const c = cfg[k] || {}; const claimed = +sold[k] || 0; const stock = c.stock == null || c.stock === "" ? null : +c.stock;
    const held = stock == null ? 0 : await activeHolds(k, now);
    const endsAt = endOf(c); const left = stock == null ? null : Math.max(0, stock - claimed - held);
    const startsAt = c.startsAt ? Date.parse(c.startsAt) : null; // early access: Champagne Club can buy CLUB.earlyHours before
    const status = c.paused ? "paused" : endsAt && endsAt <= now ? "ended" : stock != null && stock - claimed <= 0 ? "soldout" : startsAt && startsAt > now ? "soon" : left === 0 ? "held" : "live";
    out[k] = { stock, claimed, held, left, endsAt, startsAt, status };
  }
  return out;
}

/* ---------- orders ---------- */
const newId = () => "WD" + Date.now().toString(36).toUpperCase().slice(-5) + randomBytes(3).toString("hex").toUpperCase();
export const getOrder = async (id) => { const raw = /^WD[A-Z0-9]{6,16}$/.test(String(id)) ? await r("GET", OK(id)) : null; return raw ? JSON.parse(raw) : null; };
const saveOrder = (o) => r("SET", OK(o.id), JSON.stringify(o));

/** Validates the bag against real stock + windows, then holds the units for HOLD_MIN minutes. */
export async function createOrder(sub, handle, lines, now = Date.now(), h = {}) {
  const bag = priceBag(lines);
  if (!bag.items.length) throw E("empty_bag");
  if (bag.total > MAX_ORDER) throw E("order_too_big");
  if (bag.items.some((i) => i.kind === "club") && h.club) throw Object.assign(E("club_owned", 409), { sku: "club" });
  const st = await stockAll(now);
  for (const i of bag.items) {
    const s = st[i.k];
    if (s.status === "ended") throw Object.assign(E("drop_ended", 409), { sku: i.k });
    if (s.status === "paused") throw Object.assign(E("drop_paused", 409), { sku: i.k });
    if (s.status === "soon" && !(h.club && s.startsAt - CLUB.earlyHours * 3600e3 <= now)) throw Object.assign(E("drop_not_open", 409), { sku: i.k });
    if (s.stock != null && s.left < i.q) throw Object.assign(E(s.left > 0 ? "not_enough_left" : "sold_out", 409), { sku: i.k, left: s.left });
  }
  /* welcome-game discount (10% off first order, capped) */
  let discount = 0; if (+h.promoPct > 0 && !h.promoUsed) discount = round2(Math.min(bag.total * (+h.promoPct) / 100, +h.promoMax || 25));
  const o = { id: newId(), sub, handle, items: bag.items, subtotal: bag.total, discount, total: round2(bag.total - discount), count: bag.count, status: "pending", createdAt: now };
  const exp = now + HOLD_MIN * 60e3;
  await pipe([["SET", OK(o.id), JSON.stringify(o)], ["ZADD", "wd:orders", now, o.id], ["ZADD", "wd:uorders:" + sub, now, o.id],
    ...bag.items.filter((i) => st[i.k].stock != null).map((i) => ["HSET", "wd:hold:" + i.k, o.id, `${i.q}:${exp}`])]);
  return o;
}
export async function attachCheckout(o, ck) { o.checkout = ck; await saveOrder(o); return o; }
export async function releaseHolds(o) { await pipe(o.items.map((i) => ["HDEL", "wd:hold:" + i.k, o.id])); }

/* ---------- gift codes ---------- */
const code = () => "WD-" + randomBytes(6).toString("hex").toUpperCase().replace(/(.{4})(.{4})(.{4})/, "$1-$2-$3");
export async function issueCode({ base, tier = "", note = "", order = "" }) {
  const bonus = tier ? (R.VIP[tier].credit ? round2(R.VIP[tier].credit - base) : round2(base * R.VIP_BONUS_PCT / 100)) : round2(base * GIFT_BONUS_PCT / 100);
  const c = code(), amount = round2(base + bonus);
  await r("HSET", "wd:codes", c, JSON.stringify({ amount, base, bonus, tier, note, order, at: Date.now(), redeemedBy: null }));
  return { code: c, amount, base, bonus, tier };
}
/** Redeem a code into an account (VIP tier + VIP number + credit). Shared by /redeem and checkout. */
export async function applyCode(sub, codeStr) {
  const raw = await r("HGET", "wd:codes", codeStr); if (!raw) throw E("bad_code", 404);
  const c = JSON.parse(raw); if (c.redeemedBy) throw E("code_used", 409);
  if (!(await r("SET", "wd:redeem:" + codeStr, sub, "NX"))) throw E("code_used", 409);
  const h = obj(await r("HGETALL", U(sub)));
  c.redeemedBy = h.handle || sub; c.redeemedAt = Date.now(); await r("HSET", "wd:codes", codeStr, JSON.stringify(c));
  const credit = await r("HINCRBYFLOAT", U(sub), "credit", c.amount);
  let vipNo = +h.vipNo || 0;
  if (c.tier && R.VIP[c.tier]) { const isB = !!R.VIP[c.tier].bundle;
    if (isB && (!vipNo || vipNo > R.BUNDLE_RANGE)) { const n = await r("INCR", "wd:vipb"); if (n <= R.BUNDLE_RANGE) { vipNo = n; await r("HSET", U(sub), "vipNo", vipNo); } }
    if (!vipNo) { vipNo = R.BUNDLE_RANGE + (await r("INCR", "wd:vip")); await r("HSET", U(sub), "vipNo", vipNo); }
    const rank = R.VIP_RANK; if (!h.vip || rank.indexOf(c.tier) > rank.indexOf(h.vip)) await r("HSET", U(sub), "vip", c.tier);
    await r("ZADD", "wd:vips", Date.now(), sub); if (isB) await r("ZADD", "wd:wall", Date.now(), sub); }
  return { ok: true, amount: c.amount, base: c.base || c.amount, bonus: c.bonus || 0, tier: c.tier || "", vipNo, credit: +credit };
}

/* ---------- ticker (real paid orders + giveaway entries only; respects opt-out) ---------- */
export async function tick(sub, text) {
  const h = obj(await r("HGETALL", U(sub))); if (!h.handle || h.tickerOff === "1") return;
  await pipe([["LPUSH", "wd:ticker", JSON.stringify({ handle: h.handle, avSeed: h.avSeed, hasAv: +h.hasAv || 0, member: +h.member || 0, text, at: Date.now() })], ["LTRIM", "wd:ticker", 0, 49]]);
}
export const ticker = async (n = 20) => (await r("LRANGE", "wd:ticker", 0, n - 1) || []).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);

/* ---------- fulfillment (idempotent; called by the signed Whop webhook or verified crypto pay) ---------- */
export async function fulfill(orderId, pay) {
  const o = await getOrder(orderId); if (!o) throw E("order_not_found", 404);
  if (o.status === "paid") return { order: o, already: true };
  if (pay.amount != null && pay.amount + 0.01 < o.total) { o.status = "underpaid"; o.payment = pay; await saveOrder(o); await releaseHolds(o); return { order: o, underpaid: true }; }
  if (!(await r("SET", "wd:fulfill:" + o.id, pay.id || "1", "NX", "EX", 300))) return { order: o, busy: true };
  try {
    const sub = o.sub, codes = [], applied = []; let passCredit = 0, pearls = 0, club = false;
    for (const i of o.items) {
      const s = sku(i.k); if (!s) continue;
      if (s.kind === "pass") { passCredit += i.price * i.q; await pipe([["HINCRBY", U(sub), "pass:" + i.k, i.q], ["HINCRBY", U(sub), "passes", i.q]]); }
      else if (s.kind === "pearls") { const n = s.pearls * i.q; pearls += n; await addPearls(sub, n, "order:" + o.id); }
      else if (s.kind === "club") { club = await joinClub(sub, o.id); }
      else if (s.kind === "gift") { for (let n = 0; n < i.q; n++) codes.push({ ...(await issueCode({ base: i.price, note: "Order " + o.id, order: o.id })), name: s.name }); }
      else { for (let n = 0; n < i.q; n++) { const c = await issueCode({ base: i.price, tier: i.k, note: "Order " + o.id, order: o.id });
        if (n === 0) { await applyCode(sub, c.code); applied.push({ ...c, name: s.name }); } else codes.push({ ...c, name: s.name }); } }
    }
    if (passCredit) await r("HINCRBYFLOAT", U(sub), "credit", round2(passCredit));
    await pipe([...o.items.map((i) => ["HINCRBY", "wd:sold", i.k, i.q]), ...o.items.map((i) => ["HDEL", "wd:hold:" + i.k, o.id]), ["HINCRBYFLOAT", U(sub), "spent", o.total], ["HINCRBY", U(sub), "orders", 1]]);
    if (o.discount) await r("HSET", U(sub), "promoUsed", o.id);
    /* purchase points (1/$, x surge x club). Points are virtual and never giveaway entries. */
    const pts = await earn(sub, Math.floor(o.total * POINTS.perDollar)).catch(() => ({ gained: 0 }));
    Object.assign(o, { status: "paid", paidAt: Date.now(), payment: pay, codes, applied, passCredit: round2(passCredit), pearls, club, points: pts.gained || 0 });
    await saveOrder(o);
    const top = [...o.items].filter((i) => i.kind !== "club").sort((a, b) => b.line - a.line)[0];
    if (top) await tick(sub, `just grabbed ${top.q > 1 ? top.q + "× " : ""}${top.kind === "pass" ? "the " + top.name + " Hall Pass" : top.kind === "gift" ? "a gift card" : top.kind === "pearls" ? "a pack of Pearls" : top.name} ${top.emoji || ""}`.trim()).catch(() => {});
    if (club) await tick(sub, "just joined the Champagne Club 🥂").catch(() => {});
    return { order: o };
  } finally { await r("DEL", "wd:fulfill:" + o.id).catch(() => {}); }
}
export const publicOrder = (o) => o && ({ id: o.id, status: o.status, items: o.items, subtotal: o.subtotal || o.total, discount: o.discount || 0, pearls: o.pearls || 0, club: !!o.club, points: o.points || 0, total: o.total, createdAt: o.createdAt, paidAt: o.paidAt || null, codes: o.codes || [], applied: o.applied || [], passCredit: o.passCredit || 0, purchaseUrl: o.status === "pending" && o.checkout ? o.checkout.purchaseUrl : null, method: o.payment && o.payment.method || null });
