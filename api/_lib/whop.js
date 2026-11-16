/* Whop: server-created checkout for the whole bag + Standard Webhooks signature check.
   Env: WHOP_API_KEY (company API key), WHOP_COMPANY_ID (biz_...), WHOP_WEBHOOK_SECRET (ws_...),
   optional WHOP_PRODUCT_ID (prod_... to group order plans under one product). */
import { createHmac, timingSafeEqual } from "crypto";
const API = (process.env.WHOP_API_BASE || "https://api.whop.com/api/v1").replace(/\/$/, "");
const E = (m, s = 502) => Object.assign(new Error(m), { status: s });
export const whopReady = () => !!(process.env.WHOP_API_KEY && process.env.WHOP_COMPANY_ID);

/** One-time inline variant priced at the server-computed bag total. Cards, Apple Pay / Google Pay,
    Cash App Pay, crypto etc. are whatever the Whop account has enabled (platform defaults). */
export async function createCheckout(order, redirectUrl) {
  if (!whopReady()) throw E("payments_not_configured", 503);
  const summary = order.items.map((i) => `${i.q}× ${i.name}`).join(", ").slice(0, 480);
  const variant = { title: `Wine Detention order ${order.id}`, description: summary, billing_type: "one_time", initial_price: order.total, currency: "usd", force_create_new_plan: true, unlimited_stock: true, metadata: { wd_order: order.id } };
  if (process.env.WHOP_PRODUCT_ID) variant.product_id = process.env.WHOP_PRODUCT_ID;
  const body = { account_id: process.env.WHOP_COMPANY_ID, mode: "payment", redirect_url: redirectUrl, metadata: { wd_order: order.id, wd_sub: order.sub, wd_total: String(order.total) }, variant };
  const res = await fetch(API + "/checkout_configurations", { method: "POST", headers: { Authorization: "Bearer " + process.env.WHOP_API_KEY, "Content-Type": "application/json", "Idempotency-Key": "wd-" + order.id }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.purchase_url) { console.error("whop checkout failed", res.status, JSON.stringify(d).slice(0, 500)); throw E("checkout_failed"); }
  return { id: d.id, purchaseUrl: d.purchase_url };
}

/* Standard Webhooks: base64(HMAC-SHA256(key, `${id}.${ts}.${raw}`)), header "v1,<sig> v1,<sig2>".
   Whop's docs: the key is the ws_... secret as given. We also accept the spec's whsec_/base64 form. */
function keys(secret) {
  const out = [Buffer.from(secret, "utf8")];
  const m = secret.match(/^(?:whsec_|ws_)?([A-Za-z0-9+/=]+)$/);
  if (m) { try { const b = Buffer.from(m[1], "base64"); if (b.length >= 16) out.push(b); } catch {} }
  return out;
}
export function verifyWebhook(raw, headers, secret = process.env.WHOP_WEBHOOK_SECRET, now = Date.now()) {
  if (!secret) throw E("webhook_not_configured", 503);
  const id = headers["webhook-id"], ts = headers["webhook-timestamp"], sig = headers["webhook-signature"];
  if (!id || !ts || !sig) throw E("bad_signature", 401);
  if (!/^\d+$/.test(String(ts)) || Math.abs(now / 1000 - Number(ts)) > 300) throw E("stale_webhook", 401);
  const signed = `${id}.${ts}.${raw}`;
  const given = String(sig).split(" ").map((s) => s.split(",")).filter((p) => p[0] === "v1" && p[1]).map((p) => Buffer.from(p[1], "base64"));
  for (const k of keys(secret)) {
    const want = createHmac("sha256", k).update(signed).digest();
    if (given.some((g) => g.length === want.length && timingSafeEqual(g, want))) return JSON.parse(raw);
  }
  throw E("bad_signature", 401);
}
export function signForTest(raw, secret, id = "msg_test", ts = Math.floor(Date.now() / 1000)) {
  return { "webhook-id": id, "webhook-timestamp": String(ts), "webhook-signature": "v1," + createHmac("sha256", Buffer.from(secret, "utf8")).update(`${id}.${ts}.${raw}`).digest("base64") };
}
