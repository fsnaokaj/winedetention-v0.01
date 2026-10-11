/* Wine Detention API: one function, many actions.
   GET  /api/wd?a=config | offers | lb | profile&h=
   POST /api/wd?a=me | reroll | profile | spin | quest | redeem   (Authorization: Bearer <Dynamic JWT>)
   POST /api/wd?a=notify   (public waitlist)
   POST /api/wd?a=admin    (body.pass must equal env ADMIN_PASS) */
import { r, pipe, obj, redisConfig } from "./_lib/redis.js";
import { verify, ENV_ID } from "./_lib/auth.js";
import * as R from "./_lib/rules.js";
import { randomBytes } from "crypto";

const E = (m, s = 400) => Object.assign(new Error(m), { status: s });
const U = (sub) => `wd:u:${sub}`;
const clean = (v, n) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
const day = () => new Date(Date.now() - 7 * 3600e3).toISOString().slice(0, 10); // Phoenix day
const safeEq = (a, b) => { a = String(a || ""); b = String(b || ""); if (!a || !b || a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; };
const need = () => { if (!redisConfig()) throw E("store_not_configured", 503); };
function pub(h) { return { member: +h.member || 0, handle: h.handle, displayName: h.displayName || "", bio: h.bio || "", city: h.city || "", avSeed: h.avSeed || h.handle, points: +h.points || 0, credit: +h.credit || 0, createdAt: +h.createdAt || 0, welcome: h.welcome ? +h.welcome : null, vip: h.vip || "", vipNo: +h.vipNo || 0 }; }
async function award(sub, pts) { const [p] = await pipe([["HINCRBY", U(sub), "points", pts], ["ZINCRBY", "wd:lb", pts, sub]]); return +p; }
async function body(req) { if (req.body && typeof req.body === "object") return req.body; try { return JSON.parse(req.body || "{}"); } catch { return {}; } }
async function freeHandle() { for (let i = 0; i < 30; i++) { const h = R.randomHandle(); if (!R.RESERVED.has(h) && !(await r("EXISTS", "wd:h:" + h))) return h; } return "hall" + Date.now().toString(36); }
async function me(sub, email, ref) {
  let h = obj(await r("HGETALL", U(sub)));
  if (h.handle) return h;
  const handle = await freeHandle();
  if (!(await r("SET", "wd:h:" + handle, sub, "NX"))) throw E("retry", 409);
  const member = await r("INCR", "wd:members");
  h = { handle, member, avSeed: handle + ":" + member, points: 0, credit: 0, createdAt: Date.now(), email: clean(email, 120), ref: clean(ref, 20).toLowerCase() };
  await pipe([["HSET", U(sub), ...Object.entries(h).flat()], ["ZADD", "wd:lb", 0, sub], ["ZADD", "wd:signups", Date.now(), sub]]);
  return h;
}
const lbList = async (n = 50) => {
  const z = await r("ZREVRANGE", "wd:lb", 0, n - 1, "WITHSCORES"); const out = [];
  for (let i = 0; i < z.length; i += 2) { const h = obj(await r("HGETALL", U(z[i]))); if (h.handle) out.push({ handle: h.handle, displayName: h.displayName || "", avSeed: h.avSeed, member: +h.member, points: +z[i + 1] }); }
  return out;
};
async function offers() { const o = await r("GET", "wd:offers").catch(() => null); try { return o ? JSON.parse(o) : null; } catch { return null; } }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const a = (req.query && req.query.a) || "";
  try {
    if (a === "config") return res.status(200).json({ ok: true, vip: R.VIP, vipBonusPct: R.VIP_BONUS_PCT, dynamicEnvId: ENV_ID() || null, store: !!redisConfig(), welcome: R.WELCOME, quests: R.QUESTS });
    if (a === "offers") return res.status(200).json({ ok: true, overrides: redisConfig() ? await offers() : null });
    if (a === "lb") { need(); return res.status(200).json({ ok: true, board: await lbList(), members: +(await r("GET", "wd:members")) || 0 }); }
    if (a === "profile") { need(); const hd = String(req.query.h || "").toLowerCase().replace(/^@/, ""); if (!R.HANDLE_RE.test(hd)) throw E("not_found", 404); const sub = await r("GET", "wd:h:" + hd); if (!sub) throw E("not_found", 404); const p = pub(obj(await r("HGETALL", U(sub)))); delete p.credit; delete p.welcome; return res.status(200).json({ ok: true, profile: p }); }
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
        const bonus = tier ? Math.round(base * R.VIP_BONUS_PCT) / 100 : 0, amount = Math.round((base + bonus) * 100) / 100;
        const code = "WD-" + randomBytes(6).toString("hex").toUpperCase().replace(/(.{4})(.{4})(.{4})/, "$1-$2-$3");
        await r("HSET", "wd:codes", code, JSON.stringify({ amount, base, bonus, tier, note: clean(b.note, 120), at: Date.now(), redeemedBy: null }));
        return res.status(200).json({ ok: true, code, amount, base, bonus, tier });
      }
      if (op === "offers") { const j = JSON.stringify(b.offers || {}); if (j.length > 60000) throw E("too_big"); await r("SET", "wd:offers", j); return res.status(200).json({ ok: true }); }
      throw E("bad_op");
    }
    const tok = await verify(req); need(); const sub = tok.sub;
    const h = await me(sub, tok.email || (tok.verified_credentials || []).find?.((c) => c.email)?.email, b.ref);
    if (a === "me") return res.status(200).json({ ok: true, me: pub(h), done: obj(await r("HGETALL", `wd:q:${sub}:${day()}`)) });
    if (a === "reroll") {
      if (b.what === "avatar") { const s = h.handle + ":" + randomBytes(3).toString("hex"); await r("HSET", U(sub), "avSeed", s); h.avSeed = s; }
      else if (b.what === "handle" || b.handle) {
        let nh = b.handle ? String(b.handle).toLowerCase().replace(/^@/, "") : await freeHandle();
        if (!R.HANDLE_RE.test(nh) || R.RESERVED.has(nh)) throw E("bad_handle");
        if (nh !== h.handle) { if (!(await r("SET", "wd:h:" + nh, sub, "NX"))) throw E("handle_taken", 409); await pipe([["DEL", "wd:h:" + h.handle], ["HSET", U(sub), "handle", nh]]); h.handle = nh; }
      }
      return res.status(200).json({ ok: true, me: pub(h) });
    }
    if (a === "profile") { const f = { displayName: clean(b.displayName, 32), bio: clean(b.bio, 160), city: clean(b.city, 40) }; await r("HSET", U(sub), ...Object.entries(f).flat()); Object.assign(h, f); return res.status(200).json({ ok: true, me: pub(h) }); }
    if (a === "spin") {
      if (!(await r("HSETNX", U(sub), "welcome", -1))) throw E("already_spun", 409);
      const i = R.pick(R.WELCOME), v = R.WELCOME[i].v; await r("HSET", U(sub), "welcome", v); const pts = await award(sub, v);
      return res.status(200).json({ ok: true, index: i, value: v, points: pts });
    }
    if (a === "quest") {
      const q = R.QUESTS.find((x) => x.id === b.id); if (!q) throw E("bad_quest");
      const k = `wd:q:${sub}:${day()}`; if (!(await r("HSETNX", k, q.id, 1))) throw E("already_done", 409); await r("EXPIRE", k, 172800);
      return res.status(200).json({ ok: true, reward: q.reward, points: await award(sub, q.reward) });
    }
    if (a === "redeem") {
      const code = clean(b.code, 40).toUpperCase(); const raw = await r("HGET", "wd:codes", code); if (!raw) throw E("bad_code", 404);
      const c = JSON.parse(raw); if (c.redeemedBy) throw E("code_used", 409);
      if (!(await r("SET", "wd:redeem:" + code, sub, "NX"))) throw E("code_used", 409);
      c.redeemedBy = h.handle; c.redeemedAt = Date.now(); await r("HSET", "wd:codes", code, JSON.stringify(c));
      const credit = await r("HINCRBYFLOAT", U(sub), "credit", c.amount);
      let vipNo = +h.vipNo || 0;
      if (c.tier && R.VIP[c.tier]) { if (!vipNo) { vipNo = await r("INCR", "wd:vip"); await r("HSET", U(sub), "vipNo", vipNo); } const rank = Object.keys(R.VIP); if (!h.vip || rank.indexOf(c.tier) > rank.indexOf(h.vip)) await r("HSET", U(sub), "vip", c.tier); await r("ZADD", "wd:vips", Date.now(), sub); }
      return res.status(200).json({ ok: true, amount: c.amount, base: c.base || c.amount, bonus: c.bonus || 0, tier: c.tier || "", vipNo, credit: +credit });
    }
    throw E("bad_action", 404);
  } catch (e) { return res.status(e.status || 500).json({ ok: false, error: e.message || "error" }); }
}
