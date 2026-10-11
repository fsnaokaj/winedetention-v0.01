/* Minimal Upstash Redis REST client. Env vars are injected by Vercel Marketplace "Upstash for Redis"
   (KV_REST_API_URL / KV_REST_API_TOKEN) or set manually (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN). */
export function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}
const err = (m, s) => Object.assign(new Error(m), { status: s });
export async function r(...cmd) {
  const c = redisConfig(); if (!c) throw err("store_not_configured", 503);
  const res = await fetch(c.url, { method: "POST", headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" }, body: JSON.stringify(cmd.map(String)) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.error) throw err("store_error: " + (d.error || res.status), 502);
  return d.result;
}
export async function pipe(cmds) {
  const c = redisConfig(); if (!c) throw err("store_not_configured", 503);
  const res = await fetch(c.url + "/pipeline", { method: "POST", headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" }, body: JSON.stringify(cmds.map((x) => x.map(String))) });
  const d = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(d)) throw err("store_error: " + res.status, 502);
  return d.map((x) => (x && !x.error ? x.result : null));
}
export const obj = (a) => { const o = {}; if (Array.isArray(a)) for (let i = 0; i < a.length; i += 2) o[a[i]] = a[i + 1]; else if (a && typeof a === "object") Object.assign(o, a); return o; };
