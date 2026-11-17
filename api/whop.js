/* POST /api/whop — Whop webhook (payment.succeeded). Signed with WHOP_WEBHOOK_SECRET (Standard Webhooks).
   Marks the order paid, issues gift codes, applies VIP drops + Hall Pass credit, counts real stock. */
import { verifyWebhook } from "./_lib/whop.js";
import { fulfill, getOrder, releaseHolds } from "./_lib/orders.js";
import { r } from "./_lib/redis.js";
export const config = { api: { bodyParser: false } };
async function rawBody(req) {
  if (typeof req.rawBody === "string") return req.rawBody;
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString("utf8");
  const chunks = []; try { for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)); } catch {}
  if (chunks.length) return Buffer.concat(chunks).toString("utf8");
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  return req.body ? JSON.stringify(req.body) : "";
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  let ev;
  try { ev = verifyWebhook(await rawBody(req), req.headers); }
  catch (e) { return res.status(e.status || 401).json({ ok: false, error: e.message }); }
  try {
    const d = ev.data || {}; const md = d.metadata || {}; const oid = md.wd_order;
    if (!oid) return res.status(200).json({ ok: true, ignored: "no_order" });
    if (ev.type === "payment.succeeded") {
      if (d.currency && String(d.currency).toLowerCase() !== "usd") return res.status(200).json({ ok: true, ignored: "currency" });
      const amt = [d.total, d.subtotal, d.usd_total, d.amount_charged && d.amount_charged.amount].map(Number).find((n) => Number.isFinite(n) && n > 0);
      const out = await fulfill(oid, { id: d.id || "", amount: amt ?? null, method: d.payment_method_type || "whop", via: "whop", at: Date.now() });
      if (out.busy) return res.status(409).json({ ok: false, error: "busy" }); // Whop retries
      await r("SET", "wd:wh:" + (req.headers["webhook-id"] || d.id), oid, "EX", 864000).catch(() => {});
      return res.status(200).json({ ok: true, status: out.order.status });
    }
    if (ev.type === "payment.failed" || ev.type === "payment.canceled") { const o = await getOrder(oid); if (o && o.status === "pending") await releaseHolds(o); return res.status(200).json({ ok: true }); }
    return res.status(200).json({ ok: true, ignored: ev.type });
  } catch (e) { console.error("whop webhook", e); return res.status(e.status && e.status < 500 ? 200 : 500).json({ ok: false, error: e.message }); }
}
