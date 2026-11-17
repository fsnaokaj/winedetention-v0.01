/* Detention Radio jukebox: shared "now playing", song request queue (in-house catalog only), upvotes, bumps.
   Keys: wd:jb:now (JSON) · wd:jb:q (hash reqId -> JSON) · wd:jb:v:<reqId> (set of voter subs) · wd:jb:boost (hash reqId -> boost)
         wd:jb:rot (rotation counter when the queue is empty) · wd:jb:lock (advance lock) */
import { randomBytes } from "crypto";
import { r, pipe, obj } from "./redis.js";
import { JUKEBOX as J, JUKEBOX_TRACKS, track } from "../../js/wd-rewards.js";
import { spendPearls, spendPoints } from "./econ.js";
const E = (m, s = 400) => Object.assign(new Error(m), { status: s });

export async function queue() {
  const all = obj(await r("HGETALL", "wd:jb:q")); const items = Object.values(all).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter((x) => x && track(x.track));
  if (!items.length) return [];
  const [boost, ...cards] = await pipe([["HGETALL", "wd:jb:boost"], ...items.map((i) => ["SCARD", "wd:jb:v:" + i.id])]);
  const b = obj(boost);
  return items.map((i, n) => { const votes = +cards[n] || 0, bo = +b[i.id] || 0; return { id: i.id, track: i.track, handle: i.handle, member: i.member, club: i.club ? 1 : 0, at: i.at, votes, boost: bo, score: votes + bo + (i.club ? J.clubBoost : 0), sub: i.sub }; })
    .sort((x, y) => y.score - x.score || x.at - y.at);
}
const pubQ = (q) => q.map(({ sub, ...x }) => x);
const endOf = (cur) => cur.startedAt + (track(cur.track) || { dur: 0 }).dur * 1000;
export async function advance(now = Date.now()) {
  let cur = null; try { cur = JSON.parse((await r("GET", "wd:jb:now")) || "null"); } catch {}
  if (cur && track(cur.track) && endOf(cur) > now) return cur;
  if (!(await r("SET", "wd:jb:lock", 1, "NX", "PX", 4000))) return cur;
  try {
    const startedAt = cur && endOf(cur) > now - 8000 ? endOf(cur) : now;
    const q = await queue(); let next;
    if (q.length) { const top = q[0]; next = { track: top.track, by: top.handle, member: top.member, club: top.club, reqId: top.id, votes: top.votes, startedAt }; await pipe([["HDEL", "wd:jb:q", top.id], ["HDEL", "wd:jb:boost", top.id], ["DEL", "wd:jb:v:" + top.id]]); }
    else { const n = await r("INCR", "wd:jb:rot"); next = { track: JUKEBOX_TRACKS[n % JUKEBOX_TRACKS.length].id, by: null, startedAt }; }
    await r("SET", "wd:jb:now", JSON.stringify(next)); return next;
  } finally { await r("DEL", "wd:jb:lock").catch(() => {}); }
}
export async function state(now = Date.now()) { const cur = await advance(now); return { now: cur, queue: pubQ(await queue()), serverNow: Date.now() }; }

export async function request(sub, h, trackId) {
  const t = track(trackId); if (!t) throw E("bad_track");
  if (await r("SISMEMBER", "wd:banned", sub)) throw E("muted", 403);
  const q = await queue(); if (q.length >= J.queueMax) throw E("queue_full", 409);
  const dup = q.find((x) => x.track === t.id); if (dup) { await r("SADD", "wd:jb:v:" + dup.id, sub); return { id: dup.id, merged: true, queue: pubQ(await queue()) }; }
  const mine = q.filter((x) => x.sub === sub).length; if (mine >= (h.club ? J.requestClub : J.requestFree)) throw E("one_request_at_a_time", 409);
  const hk = `wd:jb:rl:${sub}:${Math.floor(Date.now() / 3600e3)}`; const n = await r("INCR", hk); if (n === 1) await r("EXPIRE", hk, 3700); if (n > J.perHour) throw E("slow_down", 429);
  const it = { id: Date.now().toString(36) + randomBytes(3).toString("hex"), track: t.id, sub, handle: h.handle, member: +h.member || 0, club: h.club ? 1 : 0, at: Date.now() };
  await pipe([["HSET", "wd:jb:q", it.id, JSON.stringify(it)], ["SADD", "wd:jb:v:" + it.id, sub]]);
  return { id: it.id, queue: pubQ(await queue()) };
}
export async function vote(sub, id) {
  if (!(await r("HEXISTS", "wd:jb:q", String(id)))) throw E("not_found", 404);
  const added = await r("SADD", "wd:jb:v:" + id, sub); return { added: !!added, queue: pubQ(await queue()) };
}
export async function bump(sub, id, withWhat) {
  if (!(await r("HEXISTS", "wd:jb:q", String(id)))) throw E("not_found", 404);
  const left = withWhat === "pearls" ? { pearls: await spendPearls(sub, J.bumpPearls, "jukebox:bump") } : { points: await spendPoints(sub, J.bumpPoints) };
  await r("HINCRBY", "wd:jb:boost", id, J.bumpBoost); return { ...left, queue: pubQ(await queue()) };
}
export async function adminSkip() { const cur = JSON.parse((await r("GET", "wd:jb:now")) || "null"); if (cur) { cur.startedAt = 0; await r("SET", "wd:jb:now", JSON.stringify(cur)); } return advance(); }
export async function adminRemove(id) { await pipe([["HDEL", "wd:jb:q", id], ["HDEL", "wd:jb:boost", id], ["DEL", "wd:jb:v:" + id]]); }
