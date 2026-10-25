/* Giveaway entries ledger (Upstash). Only free actions call gwAdd; paid flows never import this for entries. */
import { r, pipe, obj } from "./redis.js";
import { GIVEAWAY as GW, gwWindow, totalArv, eligibility } from "./giveaway.config.js";

const K = (k) => `gw:${GW.id}:${k}`;
const U = (sub) => `wd:u:${sub}`;
const day = () => new Date(Date.now() - 7 * 3600e3).toISOString().slice(0, 10); // Phoenix day
export const gwOpen = () => { const { start, end } = gwWindow(); const t = Date.now(); return t >= start && t < end; };

export async function gwAdd(sub, n, why) {
  if (n <= 0 || !gwOpen()) return 0;
  await pipe([["ZINCRBY", K("e"), n, sub], ["INCRBY", K("total"), n], ["HINCRBY", K("u:" + sub), "src:" + why, n]]);
  return n;
}

export async function gwLocate(sub, country, region, ipCountry) {
  const raw = obj(await r("HGETALL", K("u:" + sub)));
  const c = String(country || raw.country || "").toUpperCase();
  const reg = String(region || raw.region || "").toUpperCase();
  const bad = eligibility(c, reg, ipCountry);
  if (bad) throw Object.assign(new Error(bad === "excluded" ? "location_excluded" : bad), { status: 403 });
  if (c !== (raw.country || "") || reg !== (raw.region || "")) await r("HSET", K("u:" + sub), "country", c, "region", reg);
  return c;
}

export const gwJoined = async (sub) => Boolean(await r("HGET", K("u:" + sub), "joined"));

/** Idempotent: account entry + participant badge + hall points, once. */
export async function gwJoin(sub) {
  if (!gwOpen()) return false;
  if (!(await r("HSETNX", K("u:" + sub), "joined", Date.now()))) return false;
  await gwAdd(sub, GW.entries.account, "account");
  const pts = GW.participant.points || 0;
  await pipe([
    ["HSET", U(sub), "badge:" + GW.id, GW.participant.badge],
    ["HINCRBY", U(sub), "points", pts],
    ["ZINCRBY", "wd:lb", pts, sub],
  ]);
  return true;
}

export async function gwMe(sub) {
  const u = obj(await r("HGETALL", K("u:" + sub)));
  const [score, rank, qd] = await pipe([["ZSCORE", K("e"), sub], ["ZREVRANK", K("e"), sub], ["GET", K(`qd:${sub}:${day()}`)]]);
  const sources = {};
  for (const k of Object.keys(u)) if (k.startsWith("src:")) sources[k.slice(4)] = Number(u[k]);
  return {
    joined: Boolean(u.joined),
    country: u.country || "",
    region: u.region || "",
    skillQuestion: (GW.eligibility.skillQuestionCountries || []).includes(u.country),
    entries: Number(score) || 0,
    rank: rank == null ? null : Number(rank) + 1,
    sources,
    followedX: Boolean(u.fx),
    followedTikTok: Boolean(u.ftt),
    sharedToday: u.shareDay === day(),
    questToday: Number(qd) || 0,
    badge: u.joined ? GW.participant.badge : null,
  };
}

export async function gwFollow(sub, platform) {
  const P = {
    x: ["fx", GW.entries.followX, "followX"],
    tiktok: ["ftt", GW.entries.followTikTok, "followTikTok"],
  };
  const m = P[platform];
  if (!m) throw Object.assign(new Error("bad_platform"), { status: 400 });
  await gwJoin(sub);
  const first = await r("HSETNX", K("u:" + sub), m[0], Date.now());
  return first ? gwAdd(sub, m[1], m[2]) : 0;
}

export async function gwShare(sub) {
  await gwJoin(sub);
  const d = day();
  if ((await r("HGET", K("u:" + sub), "shareDay")) === d) return 0;
  await r("HSET", K("u:" + sub), "shareDay", d);
  return gwAdd(sub, GW.entries.share, "share");
}

/** Called after a server-verified quest claim. */
export async function gwQuest(sub) {
  if (!(await gwJoined(sub))) return 0;
  const k = K(`qd:${sub}:${day()}`);
  const [c] = await pipe([["INCR", k], ["EXPIRE", k, 172800]]);
  return Number(c) <= GW.entries.questDailyCap ? gwAdd(sub, GW.entries.quest, "quest") : 0;
}

/** Called after a verified referral signup, when inviter has joined the giveaway. */
export async function gwReferral(inviterSub) {
  if (!inviterSub || !(await gwJoined(inviterSub))) return 0;
  const c = Number(await r("HINCRBY", K("u:" + inviterSub), "refs", 1));
  return c <= GW.entries.referralCap ? gwAdd(inviterSub, GW.entries.referral, "referral") : 0;
}

export async function gwPublic() {
  const { start, end } = gwWindow();
  const [total, entrants, z] = await pipe([["GET", K("total")], ["ZCARD", K("e")], ["ZREVRANGE", K("e"), 0, 19, "WITHSCORES"]]);
  const subs = [], sc = [];
  for (let i = 0; z && i < z.length; i += 2) { subs.push(z[i]); sc.push(Number(z[i + 1])); }
  const hs = subs.length ? await pipe(subs.map((s) => ["HMGET", U(s), "handle", "displayName", "avSeed", "hasAv"])) : [];
  return {
    config: GW,
    start,
    end,
    open: gwOpen(),
    totalArv: totalArv(),
    total: Number(total) || 0,
    entrants: Number(entrants) || 0,
    board: hs.map((h, i) => ({
      rank: i + 1,
      handle: h && h[0],
      displayName: (h && h[1]) || "",
      avSeed: (h && h[2]) || "",
      hasAv: Number(h && h[3]) || 0,
      entries: sc[i],
    })).filter((x) => x.handle),
  };
}
