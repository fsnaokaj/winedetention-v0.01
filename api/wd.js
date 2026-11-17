/* Wine Detention API: one function, many actions.
   GET  /api/wd?a=config | offers | lb[&by=refs] | gw | profile&h= | stock | feed&room= | ticker
   POST /api/wd?a=me | reroll | profile | spin | quest | milestone | redeem | gwme | gwjoin | gwfollow | gwshare
                  | bag | checkout | order | orders | cryptopay | say | react   (Authorization: Bearer <sign-in JWT>)
   POST /api/wd?a=notify   (public waitlist)
   POST /api/wd?a=admin    (body.pass must equal env ADMIN_PASS)
   Whop webhook lives in api/whop.js (needs the raw body). */
import { r, pipe, obj, redisConfig } from "./_lib/redis.js";
import { verify, ENV_ID, walletsOf } from "./_lib/auth.js";
import * as O from "./_lib/orders.js";
import * as S from "./_lib/social.js";
import { createCheckout, whopReady } from "./_lib/whop.js";
import { cryptoCfg, verifyUsdcPayment } from "./_lib/cryptopay.js";
import { priceBag } from "../js/wd-catalog.js";
import * as R from "./_lib/rules.js";
import * as EC from "./_lib/econ.js";
import * as JB from "./_lib/jukebox.js";
import { WELCOME_PRIZES, GIFTS, CONNECT, CLUB, PEARL_PACKS, POINTS, SURGE_SCHEDULE, SURGE_TAGLINE } from "../js/wd-rewards.js";
import { randomBytes } from "crypto";
import { cardPng, injectMeta } from "./_lib/card.js";
import * as GW from "./_lib/giveaway.js";
import { GIVEAWAY as GWC } from "./_lib/giveaway.config.js";
const AV_MAX = 70000, COVERS = 12, BANNERS = 8;

const E = (m, s = 400) => Object.assign(new Error(m), { status: s });
const U = (sub) => `wd:u:${sub}`;
const clean = (v, n) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
const day = () => new Date(Date.now() - 7 * 3600e3).toISOString().slice(0, 10); // Phoenix day
const safeEq = (a, b) => { a = String(a || ""); b = String(b || ""); if (!a || !b || a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; };
const need = () => { if (!redisConfig()) throw E("store_not_configured", 503); };
function pub(h) { return { member: +h.member || 0, handle: h.handle, displayName: h.displayName || "", bio: h.bio || "", city: h.city || "", avSeed: h.avSeed || h.handle, points: +h.points || 0, credit: +h.credit || 0, createdAt: +h.createdAt || 0, welcome: h.welcome ? +h.welcome : null, vip: h.vip || "", vipNo: +h.vipNo || 0, hasAv: h.hasAv ? +h.hasAv : 0, cover: h.cover || "0", refs: +h.refs || 0, bnSeed: h.bnSeed || h.avSeed || h.handle, banner: h.banner != null ? +h.banner : -1, passes: +h.passes || 0, passSet: Object.fromEntries(Object.entries(h).filter(([k]) => k.startsWith("pass:")).map(([k, v]) => [k.slice(5), +v])), tickerOff: h.tickerOff === "1" ? 1 : 0,
  pearls: +h.pearls || 0, club: h.club || "", clubAt: +h.clubAt || 0, clubMonth: h.clubMonth || "", earned: +h.earned || +h.points || 0, tipsIn: +h.tipsIn || 0, connects: EC.connectsOf(h),
  welcomePrize: h.welcomePrize || "", claimed: h.claimed ? 1 : 0, age21: h.age21 ? 1 : 0, dobOk: h.dobOk ? 1 : 0, promo: +h.promoPct > 0 && !h.promoUsed ? { pct: +h.promoPct, max: +h.promoMax || 25 } : null, gwPending: +h.gwPending || 0 }; }
const PRIVATE = ["credit", "welcome", "tickerOff", "pearls", "promo", "age21", "dobOk", "clubMonth", "gwPending", "welcomePrize"];
const padNo = (n) => "#" + String(+n || 0).padStart(4, "0");
async function body(req) { if (req.body && typeof req.body === "object") return req.body; try { return JSON.parse(req.body || "{}"); } catch { return {}; } }
async function freeHandle() { for (let i = 0; i < 30; i++) { const h = R.randomHandle(); if (!R.RESERVED.has(h) && !(await r("EXISTS", "wd:h:" + h))) return h; } return "hall" + Date.now().toString(36); }
async function me(sub, email, ref) {
  let h = obj(await r("HGETALL", U(sub)));
  if (h.handle) return h;
  const handle = await freeHandle();
  if (!(await r("SET", "wd:h:" + handle, sub, "NX"))) throw E("retry", 409);
  const member = await r("INCR", "wd:members");
  const rb = randomBytes(4);
  h = { handle, member, avSeed: handle + ":" + rb.toString("hex"), bnSeed: "bn:" + randomBytes(4).toString("hex"), banner: rb[0] % BANNERS, cover: String(rb[1] % COVERS), points: 0, credit: 0, createdAt: Date.now(), email: clean(email, 120), ref: clean(ref, 20).toLowerCase() };
  await pipe([["HSET", U(sub), ...Object.entries(h).flat()], ["ZADD", "wd:lb", 0, sub], ["ZADD", "wd:signups", Date.now(), sub]]);
  if (h.ref && R.HANDLE_RE.test(h.ref)) { const inv = await r("GET", "wd:h:" + h.ref); if (inv && inv !== sub) { await EC.earn(inv, R.REFERRAL.inviter); await r("HINCRBY", U(inv), "refs", 1); await r("ZINCRBY", "wd:lb:refs", 1, inv); h.points = (await EC.earn(sub, R.REFERRAL.invitee)).points; try { await GW.gwReferral(inv); } catch {} } }
  return h;
}
const lbList = async (n = 50, key = "wd:lb") => {
  const z = await r("ZREVRANGE", key, 0, n - 1, "WITHSCORES"); const out = [];
  const hs = z.length ? await pipe(z.filter((_, i) => i % 2 === 0).map((sb) => ["HMGET", U(sb), "handle", "displayName", "avSeed", "hasAv", "vip", "vipNo", "member", "points", "refs", "club"])) : [];
  for (let i = 0; i < z.length; i += 2) { const h = hs[i / 2] || []; if (h[0]) out.push({ handle: h[0], displayName: h[1] || "", avSeed: h[2], hasAv: +h[3] || 0, vip: h[4] || "", vipNo: +h[5] || 0, member: +h[6], points: +h[7] || 0, refs: +h[8] || 0, club: h[9] || "", score: +z[i + 1] }); }
  return out;
};
async function bannedList() { const subs = (await r("SMEMBERS", "wd:banned")) || []; const hs = subs.length ? await pipe(subs.map((x) => ["HGET", U(x), "handle"])) : []; return hs.filter(Boolean); }
async function offers() { const o = await r("GET", "wd:offers").catch(() => null); try { return o ? JSON.parse(o) : null; } catch { return null; } }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const a = (req.query && req.query.a) || "";
  try {
    if (a === "config") { const cc = cryptoCfg(); return res.status(200).json({ ok: true, vip: R.VIP, vipBonusPct: R.VIP_BONUS_PCT, dynamicEnvId: ENV_ID() || null, store: !!redisConfig(), welcome: WELCOME_PRIZES, quests: R.QUESTS, milestones: R.MILESTONES.map(({ ok, ...m }) => m), payments: whopReady(), crypto: cc ? { treasury: cc.treasury, chainId: cc.chainId, token: cc.token, decimals: cc.decimals } : null, reactions: S.REACTIONS, surge: redisConfig() ? await EC.surgeNow() : null, checkoutDob: process.env.WD_CHECKOUT_DOB !== "0" }); }
    if (a === "surge") { need(); res.setHeader("Cache-Control", "public, max-age=10, s-maxage=10"); return res.status(200).json({ ok: true, surge: await EC.surgeNow(), schedule: SURGE_SCHEDULE, tagline: SURGE_TAGLINE, now: Date.now() }); }
    if (a === "jb") { need(); return res.status(200).json({ ok: true, ...(await JB.state()) }); }
    if (a === "handle") { need(); const hd = String(req.query.h || "").toLowerCase().replace(/^@/, ""); const valid = R.HANDLE_RE.test(hd) && !R.RESERVED.has(hd); return res.status(200).json({ ok: true, handle: hd, valid, available: valid && !(await r("EXISTS", "wd:h:" + hd)) }); }
    if (a === "stock") { need(); res.setHeader("Cache-Control", "public, max-age=5, s-maxage=5"); return res.status(200).json({ ok: true, stock: await O.stockAll(), now: Date.now() }); }
    if (a === "ticker") { need(); return res.status(200).json({ ok: true, ticker: await O.ticker(20) }); }
    if (a === "feed") { need(); const room = String(req.query.room || "live"); return res.status(200).json({ ok: true, room, msgs: await S.feed(room, 40) }); }
    if (a === "offers") return res.status(200).json({ ok: true, overrides: redisConfig() ? await offers() : null });
    if (a === "wall") { need(); const z = await r("ZRANGE", "wd:wall", 0, 199); const out = []; for (const sb of z) { const h = obj(await r("HGETALL", U(sb))); if (h.handle) out.push({ handle: h.handle, displayName: h.displayName || "", avSeed: h.avSeed, hasAv: +h.hasAv || 0, vipNo: +h.vipNo }); } return res.status(200).json({ ok: true, wall: out }); }
    if (a === "av" || a === "card" || a === "page") {
      const hd = String(req.query.h || "").toLowerCase().replace(/^@/, ""); const ok = R.HANDLE_RE.test(hd) && !R.RESERVED.has(hd);
      const sub = ok && redisConfig() ? await r("GET", "wd:h:" + hd).catch(() => null) : null;
      const host = String(req.headers["x-forwarded-host"] || req.headers.host || "winedetention.com"), origin = "https://" + host;
      if (a === "av") { const d = sub ? await r("GET", "wd:av:" + sub) : null; if (!d) { res.setHeader("Location", "/favicon.svg"); return res.status(302).end(); } const m = d.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/); res.setHeader("Content-Type", m[1]); res.setHeader("Cache-Control", "public, max-age=300"); return res.status(200).send(Buffer.from(m[2], "base64")); }
      const h = sub ? obj(await r("HGETALL", U(sub))) : null;
      if (a === "card") { if (!h) { res.setHeader("Location", "/og-image.png"); return res.status(302).end(); } const avatar = h.hasAv ? await r("GET", "wd:av:" + sub) : ""; const vipName = h.vip && R.VIP[h.vip] ? R.VIP[h.vip].name : "";
        const png = await cardPng({ handle: h.handle, member: h.member, avSeed: h.avSeed, avatar, vipName, vipNo: h.vipNo, host: host.replace(/^www\./, "") }); res.setHeader("Content-Type", "image/png"); res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600"); return res.status(200).send(png); }
      let html = await (await fetch(origin + "/", { headers: { "x-shell": "1" } })).text();
      if (h) html = injectMeta(html, { title: `@${h.handle} on Wine Detention`, description: `Member ${padNo(h.member)}${h.vip && R.VIP[h.vip] ? " · OG Founding VIP #" + h.vipNo : ""}. Join with my link for a free Welcome Spin. 21+.`, url: `${origin}/${h.handle}`, image: `${origin}/api/wd?a=card&h=${h.handle}&v=${h.avSeed}` });
      res.setHeader("Content-Type", "text/html; charset=utf-8"); res.setHeader("Cache-Control", "public, max-age=60"); return res.status(200).send(html);
    }
    if (a === "lb") { need(); const by = ["refs", "tips"].includes(req.query.by) ? req.query.by : "points"; return res.status(200).json({ ok: true, by, board: await lbList(50, by === "refs" ? "wd:lb:refs" : by === "tips" ? "wd:lb:tips" : "wd:lb"), members: +(await r("GET", "wd:members")) || 0 }); }
    if (a === "gw") { need(); return res.status(200).json({ ok: true, ...(await GW.gwPublic()) }); }
    if (a === "profile" && req.method !== "POST") { need(); const hd = String(req.query.h || "").toLowerCase().replace(/^@/, ""); if (!R.HANDLE_RE.test(hd)) throw E("not_found", 404); const sub = await r("GET", "wd:h:" + hd); if (!sub) throw E("not_found", 404); const p = pub(obj(await r("HGETALL", U(sub)))); for (const k of PRIVATE) delete p[k]; return res.status(200).json({ ok: true, profile: p }); }
    if (req.method !== "POST") throw E("method", 405);
    const b = await body(req);
    if (a === "notify") {
      need(); const email = clean(b.email, 120).toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw E("bad_email");
      const item = clean(b.item, 60) || "general";
      await pipe([["ZADD", "wd:waitlist", Date.now(), JSON.stringify({ email, item, at: Date.now() })], ["SADD", "wd:wl:" + item, email]]);
      return res.status(200).json({ ok: true });
    }
    if (a === "admin") {
      const pass = process.env.ADMIN_PASS; if (!pass) throw E("admin_not_configured", 503); if (!safeEq(b.pass, pass)) throw E("bad_pass", 401); need();
      const op = b.op;
      if (op === "stats" || !op) {
        const [members, wl, sig] = await pipe([["GET", "wd:members"], ["ZREVRANGE", "wd:waitlist", 0, 499], ["ZREVRANGE", "wd:signups", 0, 199]]);
        const users = []; for (const s of sig || []) { const h = obj(await r("HGETALL", U(s))); users.push({ member: +h.member, vip: h.vip ? (R.VIP[h.vip] || {}).name + " #" + h.vipNo : "", handle: h.handle, email: h.email || "", points: +h.points || 0, credit: +h.credit || 0, createdAt: +h.createdAt, ref: h.ref || "" }); }
        const codes = obj(await r("HGETALL", "wd:codes")); const cl = Object.entries(codes).map(([k, v]) => ({ code: k, ...JSON.parse(v) })).sort((x, y) => y.at - x.at);
        return res.status(200).json({ ok: true, members: +members || 0, signups: users, waitlist: (wl || []).map((x) => JSON.parse(x)), codes: cl, offers: await offers() });
      }
      if (op === "issue") {
        const tier = b.tier && R.VIP[b.tier] ? b.tier : "";
        const base = tier ? R.VIP[tier].price : Math.round(Number(b.amount) * 100) / 100; if (!(base > 0 && base <= 5000)) throw E("bad_amount");
        const bonus = tier ? (R.VIP[tier].credit ? Math.round((R.VIP[tier].credit - base) * 100) / 100 : Math.round(base * R.VIP_BONUS_PCT) / 100) : 0, amount = Math.round((base + bonus) * 100) / 100;
        const code = "WD-" + randomBytes(6).toString("hex").toUpperCase().replace(/(.{4})(.{4})(.{4})/, "$1-$2-$3");
        await r("HSET", "wd:codes", code, JSON.stringify({ amount, base, bonus, tier, note: clean(b.note, 120), at: Date.now(), redeemedBy: null }));
        return res.status(200).json({ ok: true, code, amount, base, bonus, tier });
      }
      if (op === "offers") { const j = JSON.stringify(b.offers || {}); if (j.length > 60000) throw E("too_big"); await r("SET", "wd:offers", j); return res.status(200).json({ ok: true }); }
      if (op === "orders") { const ids = (await r("ZREVRANGE", "wd:orders", 0, 199)) || []; const raws = ids.length ? await pipe(ids.map((i) => ["GET", "wd:order:" + i])) : []; return res.status(200).json({ ok: true, orders: raws.filter(Boolean).map((x) => JSON.parse(x)) }); }
      if (op === "stock") { return res.status(200).json({ ok: true, stock: await O.stockAll(), cfg: await O.stockCfg() }); }
      if (op === "setstock") { // { sku, stock (number|null), endsAt (ISO|null), paused }
        const k = String(b.sku || ""); if (!(await O.stockCfg())[k]) throw E("bad_sku");
        const v = {}; if ("stock" in b) { if (b.stock === null || b.stock === "") v.stock = null; else { const n = Math.floor(Number(b.stock)); if (!(n >= 0 && n <= 100000)) throw E("bad_stock"); v.stock = n; } }
        if ("endsAt" in b) { if (!b.endsAt) v.endsAt = null; else { if (isNaN(Date.parse(b.endsAt))) throw E("bad_date"); v.endsAt = String(b.endsAt); } }
        if ("startsAt" in b) { if (!b.startsAt) v.startsAt = null; else { if (isNaN(Date.parse(b.startsAt))) throw E("bad_date"); v.startsAt = String(b.startsAt); } }
        if ("paused" in b) v.paused = !!b.paused;
        const prev = await r("HGET", "wd:stockcfg", k); const merged = { ...(prev ? JSON.parse(prev) : {}), ...v };
        await r("HSET", "wd:stockcfg", k, JSON.stringify(merged)); return res.status(200).json({ ok: true, stock: await O.stockAll() });
      }
      if (op === "msgs") { return res.status(200).json({ ok: true, msgs: await S.recent(150), banned: await bannedList() }); }
      if (op === "delmsg") { await S.delMsg(b.room, String(b.id || "")); return res.status(200).json({ ok: true }); }
      if (op === "ban" || op === "unban") {
        const hd = String(b.handle || "").toLowerCase().replace(/^@/, ""); const sb = await r("GET", "wd:h:" + hd); if (!sb) throw E("not_found", 404);
        await r(op === "ban" ? "SADD" : "SREM", "wd:banned", sb);
        if (op === "ban" && b.purge) { for (const m of await S.recent(500)) if (m.sub === sb) await S.delMsg(m.room, m.id); }
        return res.status(200).json({ ok: true, banned: await bannedList() });
      }
      if (op === "surge") { const v = await EC.setSurge(b.mult, b.minutes, b.label); return res.status(200).json({ ok: true, admin: v, surge: await EC.surgeNow() }); }
      if (op === "jbskip") { await JB.adminSkip(); return res.status(200).json({ ok: true, ...(await JB.state()) }); }
      if (op === "jbremove") { await JB.adminRemove(String(b.id || "")); return res.status(200).json({ ok: true, ...(await JB.state()) }); }
      if (op === "club") { const z = await r("ZREVRANGE", "wd:club", 0, 199); const hs = z.length ? await pipe(z.map((x) => ["HMGET", U(x), "handle", "member", "clubAt", "email"])) : []; return res.status(200).json({ ok: true, members: hs.map((h) => ({ handle: h[0], member: +h[1], at: +h[2], email: h[3] || "" })) }); }
      throw E("bad_op");
    }
    const tok = await verify(req); need(); const sub = tok.sub;
    const h = await me(sub, tok.email || (tok.verified_credentials || []).find?.((c) => c.email)?.email, b.ref);
    if (a === "me") return res.status(200).json({ ok: true, me: pub(h), surge: await EC.surgeNow(), done: obj(await r("HGETALL", `wd:q:${sub}:${day()}`)), milestones: obj(await r("HGETALL", "wd:qm:" + sub)) });
    if (a === "reroll") {
      if (b.what === "banner") { const s2 = "bn:" + randomBytes(4).toString("hex"), bn = randomBytes(1)[0] % BANNERS; await r("HSET", U(sub), "bnSeed", s2, "banner", bn); h.bnSeed = s2; h.banner = bn; }
      else if (b.what === "avatar") { const s = h.handle + ":" + randomBytes(3).toString("hex"); await pipe([["HSET", U(sub), "avSeed", s, "hasAv", 0], ["DEL", "wd:av:" + sub]]); h.avSeed = s; h.hasAv = 0; }
      else if (b.what === "handle" || b.handle) {
        let nh = b.handle ? String(b.handle).toLowerCase().replace(/^@/, "") : await freeHandle();
        if (!R.HANDLE_RE.test(nh) || R.RESERVED.has(nh)) throw E("bad_handle");
        if (nh !== h.handle) { if (!(await r("SET", "wd:h:" + nh, sub, "NX"))) throw E("handle_taken", 409); await pipe([["DEL", "wd:h:" + h.handle], ["HSET", U(sub), "handle", nh]]); h.handle = nh; }
      }
      return res.status(200).json({ ok: true, me: pub(h) });
    }
    if (a === "avatar") {
      if (b.clear) { await pipe([["DEL", "wd:av:" + sub], ["HSET", U(sub), "hasAv", 0]]); h.hasAv = 0; return res.status(200).json({ ok: true, me: pub(h) }); }
      const d = String(b.dataUrl || ""); if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(d) || d.length > AV_MAX) throw E("bad_image");
      const v = Date.now(); await pipe([["SET", "wd:av:" + sub, d], ["HSET", U(sub), "hasAv", v]]); h.hasAv = v; return res.status(200).json({ ok: true, me: pub(h) });
    }
    if (a === "profile") { const f = { displayName: clean(b.displayName, 32), bio: clean(b.bio, 160), city: clean(b.city, 40) }; if (b.cover != null) { const c = String(b.cover); if (!/^\d{1,2}$/.test(c) || +c >= COVERS) throw E("bad_cover"); f.cover = c; } if (b.tickerOff != null) f.tickerOff = b.tickerOff ? "1" : "0"; await r("HSET", U(sub), ...Object.entries(f).flat()); Object.assign(h, f); return res.status(200).json({ ok: true, me: pub(h) }); }
    if (a === "spin" || a === "play") { const out = await EC.playWelcome(sub, b.game); return res.status(200).json({ ok: true, ...out, me: pub(obj(await r("HGETALL", U(sub)))) }); }
    if (a === "age") { if (b.ok !== true) throw E("bad_request"); await r("HSETNX", U(sub), "age21", Date.now()); return res.status(200).json({ ok: true }); }
    if (a === "claim") { // "Claim your @" after first sign-in
      if (b.handle) { const nh = String(b.handle).toLowerCase().replace(/^@/, ""); if (!R.HANDLE_RE.test(nh) || R.RESERVED.has(nh)) throw E("bad_handle");
        if (nh !== h.handle) { if (!(await r("SET", "wd:h:" + nh, sub, "NX"))) throw E("handle_taken", 409); await pipe([["DEL", "wd:h:" + h.handle], ["HSET", U(sub), "handle", nh]]); h.handle = nh; } }
      await r("HSET", U(sub), "claimed", Date.now()); h.claimed = 1; if (b.age === true) await r("HSETNX", U(sub), "age21", Date.now());
      return res.status(200).json({ ok: true, me: pub(obj(await r("HGETALL", U(sub)))) });
    }
    if (a === "connect") { const out = await EC.connect(sub, String(b.id || ""), b.handle, tok); return res.status(200).json({ ok: true, ...out, me: pub(obj(await r("HGETALL", U(sub)))) }); }
    if (a === "disconnect") { await EC.disconnect(sub, String(b.id || "")); return res.status(200).json({ ok: true, me: pub(obj(await r("HGETALL", U(sub)))) }); }
    if (a === "pearls") return res.status(200).json({ ok: true, pearls: +h.pearls || 0, log: await EC.pearlLog(sub) });
    if (a === "tip") { const out = await EC.tip(sub, h, b.to, String(b.gift || "")); const msg = await S.sayGift(sub, h, String(b.room || "live"), out.gift, out.to); return res.status(200).json({ ok: true, pearls: out.pearls, msg }); }
    if (a === "clubclaim") { const pearls = await EC.clubMonthly(sub); return res.status(200).json({ ok: true, pearls, me: pub(obj(await r("HGETALL", U(sub)))) }); }
    if (a === "jbreq") return res.status(200).json({ ok: true, ...(await JB.request(sub, h, String(b.track || ""))) });
    if (a === "jbvote") return res.status(200).json({ ok: true, ...(await JB.vote(sub, String(b.id || ""))) });
    if (a === "jbbump") { const out = await JB.bump(sub, String(b.id || ""), b.with === "pearls" ? "pearls" : "points"); return res.status(200).json({ ok: true, ...out, me: pub(obj(await r("HGETALL", U(sub)))) }); }
    if (a === "quest") {
      const q = R.QUESTS.find((x) => x.id === b.id); if (!q) throw E("bad_quest");
      const k = `wd:q:${sub}:${day()}`; if (!(await r("HSETNX", k, q.id, 1))) throw E("already_done", 409); await r("EXPIRE", k, 172800);
      const e = await EC.earn(sub, q.reward); try { await GW.gwQuest(sub); } catch {} return res.status(200).json({ ok: true, reward: e.gained, base: q.reward, mult: e.mult, points: e.points });
    }
    if (a === "redeem") { const code = clean(b.code, 40).toUpperCase(); return res.status(200).json(await O.applyCode(sub, code)); }
    if (a === "gwme" || a === "gwjoin") {
      let joined = false;
      if (a === "gwjoin") {
        const ip = String(req.headers["x-vercel-ip-country"] || req.headers["cf-ipcountry"] || "");
        await GW.gwLocate(sub, b.country, b.region, ip);
        joined = await GW.gwJoin(sub);
        if (joined) { await O.tick(sub, "entered the free giveaway 🎁").catch(() => {}); const pend = +h.gwPending || 0; if (pend > 0) { await GW.gwAdd(sub, pend, "welcome"); await r("HDEL", U(sub), "gwPending"); } }
        h = obj(await r("HGETALL", U(sub)));
      }
      return res.status(200).json({ ok: true, gw: await GW.gwMe(sub), me: pub(h), justJoined: joined, participant: GWC.participant });
    }
    if (a === "gwfollow") {
      if (!GW.gwOpen()) throw E("giveaway_closed", 409);
      const added = await GW.gwFollow(sub, String(b.platform || "").toLowerCase());
      return res.status(200).json({ ok: true, added, gw: await GW.gwMe(sub) });
    }
    if (a === "gwshare") {
      if (!GW.gwOpen()) throw E("giveaway_closed", 409);
      const added = await GW.gwShare(sub);
      return res.status(200).json({ ok: true, added, gw: await GW.gwMe(sub) });
    }
    if (a === "milestone") {
      const m = R.MILESTONES.find((x) => x.id === b.id); if (!m) throw E("bad_quest");
      const fresh = obj(await r("HGETALL", U(sub))); const gwJoined = await GW.gwJoined(sub).catch(() => false);
      if (!m.ok(fresh, { gwJoined })) throw E("not_yet", 409);
      if (!(await r("HSETNX", "wd:qm:" + sub, m.id, Date.now()))) throw E("already_done", 409);
      const e = await EC.earn(sub, m.reward); return res.status(200).json({ ok: true, reward: e.gained, base: m.reward, mult: e.mult, points: e.points });
    }
    if (a === "bag") { // sync the bag to the account: body.items = [{k,q}] to save; omit to just load
      if (Array.isArray(b.items)) { const pb = priceBag(b.items); await r("SET", "wd:bag:" + sub, JSON.stringify(pb.items.map((i) => ({ k: i.k, q: i.q }))), "EX", 2592000); }
      const raw = await r("GET", "wd:bag:" + sub); return res.status(200).json({ ok: true, items: raw ? JSON.parse(raw) : [] });
    }
    if (a === "checkout") {
      if (!whopReady() && !(b.method === "crypto" && cryptoCfg())) throw E("payments_not_configured", 503);
      if (process.env.WD_CHECKOUT_DOB !== "0" && !h.dobOk) { // one-time date-of-birth check at first checkout (remembered on the account; DOB itself isn't stored)
        const m = String(b.dob || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) throw E("dob_required", 428);
        const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])), n = new Date(Date.now() - 7 * 3600e3); let age = n.getUTCFullYear() - d.getUTCFullYear(); if (n.getUTCMonth() < d.getUTCMonth() || (n.getUTCMonth() === d.getUTCMonth() && n.getUTCDate() < d.getUTCDate())) age--;
        if (!(age >= 21 && age <= 120)) throw E("under_21", 403); await r("HSET", U(sub), "dobOk", Date.now(), "age21", h.age21 || Date.now()); h.dobOk = 1;
      }
      const o = await O.createOrder(sub, h.handle, b.items, Date.now(), h);
      if (b.method === "crypto") return res.status(200).json({ ok: true, order: O.publicOrder(o), crypto: cryptoCfg() && { treasury: cryptoCfg().treasury, chainId: cryptoCfg().chainId, token: cryptoCfg().token, decimals: cryptoCfg().decimals } });
      const host = String(req.headers["x-forwarded-host"] || req.headers.host || ""); const origin = process.env.WD_SITE_URL ? process.env.WD_SITE_URL.replace(/\/$/, "") : "https://" + host;
      try { await O.attachCheckout(o, await createCheckout(o, `${origin}/?order=${o.id}#/confirmation`)); }
      catch (e) { await O.releaseHolds(o); throw e; }
      return res.status(200).json({ ok: true, order: O.publicOrder(o), url: o.checkout.purchaseUrl });
    }
    if (a === "order") { const o = await O.getOrder(String(b.id || "")); if (!o || o.sub !== sub) throw E("not_found", 404); return res.status(200).json({ ok: true, order: O.publicOrder(o), me: pub(obj(await r("HGETALL", U(sub)))) }); }
    if (a === "orders") { const ids = (await r("ZREVRANGE", "wd:uorders:" + sub, 0, 49)) || []; const raws = ids.length ? await pipe(ids.map((i) => ["GET", "wd:order:" + i])) : []; return res.status(200).json({ ok: true, orders: raws.filter(Boolean).map((x) => O.publicOrder(JSON.parse(x))).filter((o) => o.status !== "pending" || o.purchaseUrl) }); }
    if (a === "cryptopay") {
      const o = await O.getOrder(String(b.id || "")); if (!o || o.sub !== sub) throw E("not_found", 404);
      if (o.status === "paid") return res.status(200).json({ ok: true, order: O.publicOrder(o) });
      const pay = await verifyUsdcPayment(String(b.tx || ""), o, walletsOf(tok));
      const out = await O.fulfill(o.id, { ...pay, via: "crypto", at: Date.now() });
      return res.status(200).json({ ok: true, order: O.publicOrder(out.order) });
    }
    if (a === "say") { const m = await S.say(sub, h, String(b.room || "live"), b.text); await r("HINCRBY", U(sub), "chats", 1);
      const ck = `wd:chatpts:${sub}:${day()}`; const n = await r("INCR", ck); if (n === 1) await r("EXPIRE", ck, 172800);
      const e = n <= POINTS.chatDailyCap ? await EC.earn(sub, POINTS.chatMsg, { club: h.club }) : null; return res.status(200).json({ ok: true, msg: m, earned: e ? e.gained : 0 }); }
    if (a === "react") { return res.status(200).json({ ok: true, rx: await S.react(sub, String(b.id || ""), String(b.emoji || "")) }); }
    throw E("bad_action", 404);
  } catch (e) { if (!e.status || e.status >= 500) console.error("wd api", a, e); return res.status(e.status || 500).json({ ok: false, error: e.message || "error", ...(e.sku ? { sku: e.sku, left: e.left } : {}) }); }
}
