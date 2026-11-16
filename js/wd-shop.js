/* Wine Detention shop: bag (Uber Eats style +/-), drawer, checkout (Whop), confirmation, real stock +
   countdowns, Hall Passes, drop pages with comments, Live room chat + real activity ticker. */
import { HALL_PASSES, HALL_PASS_PERKS, VIP_DROPS, GIFT_CARDS, GIFT_BONUS_PCT, SKUS, sku, priceBag, MAX_QTY, flashEnd } from "./wd-catalog.js";
let X = null; // context from wd-live.js
export const HALL = HALL_PASSES;
export { sku };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\.00$/, "");
const $ = (s) => document.querySelector(s);
const route = () => (location.hash.replace(/^#/, "").split("?")[0] || "/");
const padNo = (n) => "#" + String(+n || 0).padStart(4, "0");
const ago = (t) => { const s = Math.max(1, (Date.now() - t) / 1000 | 0); return s < 60 ? s + "s" : s < 3600 ? (s / 60 | 0) + "m" : s < 86400 ? (s / 3600 | 0) + "h" : (s / 86400 | 0) + "d"; };
const ERR = { sold_out: "Sold out, sorry!", not_enough_left: "Not that many left.", drop_ended: "That drop has ended.", drop_paused: "That drop is paused right now.", empty_bag: "Your bag is empty.", payments_not_configured: "Checkout is opening soon. Your bag is saved.", checkout_failed: "Checkout hiccup. Try again in a sec.", order_too_big: "That's a lot of trouble for one order. Split it up (max $25,000).", slow_down: "Easy, tiger. One message every few seconds.", no_links: "No links in chat, please.", spammy: "That looks like spam.", duplicate: "You just said that.", muted: "You're muted in chat.", empty_message: "Say something first.", tx_pending: "Waiting for the network…", wallet_mismatch: "Pay from the same account you signed in with.", underpaid: "That payment was short.", tx_used: "That payment was already used.", needs_more_auth: "Finish signing in to continue." };
const err = (e) => ERR[e && e.message] || (X && X.errText(e)) || "Something went wrong";

/* ---------------- bag ---------------- */
const BAG_KEY = "wd-bag";
let BAG = (() => { try { return priceBag(JSON.parse(localStorage.getItem(BAG_KEY) || "[]")).items.map((i) => ({ k: i.k, q: i.q })); } catch { return []; } })();
let STOCK = {}, STOCK_AT = 0, TICK = [], syncT = null;
const qty = (k) => (BAG.find((l) => l.k === k) || { q: 0 }).q;
export const bag = () => priceBag(BAG);
export const count = () => bag().count;
function saveBag(sync = true) {
  BAG = priceBag(BAG).items.map((i) => ({ k: i.k, q: i.q }));
  try { localStorage.setItem(BAG_KEY, JSON.stringify(BAG)); } catch {}
  paintBag();
  if (sync && X && X.me()) { clearTimeout(syncT); syncT = setTimeout(() => X.api("bag", { items: BAG }).catch(() => {}), 600); }
}
/** On sign-in: merge the account bag with this device's bag. */
export async function syncOnLogin() {
  try { const d = await X.api("bag", {}); const m = new Map(BAG.map((l) => [l.k, l.q])); for (const l of d.items || []) m.set(l.k, Math.max(m.get(l.k) || 0, l.q)); BAG = [...m].map(([k, q]) => ({ k, q })); saveBag(true); } catch {}
}
const left = (k) => { const s = STOCK[k]; return s && s.left != null ? s.left : Infinity; };
function setQty(k, q, why) {
  const s = sku(k); if (!s) return;
  const st = STOCK[k]; if (st && (st.status === "ended" || st.status === "paused" || st.status === "soldout")) { X.toast(st.status === "ended" ? "That drop has ended." : "Sold out, sorry!"); return; }
  const cap = Math.min(MAX_QTY, left(k)); if (q > cap) { X.toast(cap <= 0 ? "Sold out, sorry!" : `Only ${cap} left for you`); q = cap; }
  const had = qty(k); BAG = BAG.filter((l) => l.k !== k); if (q > 0) BAG.push({ k, q });
  saveBag(); if (q > had && why !== "silent") { X.toast(`${s.emoji} Added ${s.name}`); bump(); }
}
const add = (k, n = 1) => setQty(k, qty(k) + n);
function bump() { const b = document.querySelectorAll(".wds-badge, .cart-count"); b.forEach((e) => { e.classList.remove("wds-bump"); void e.offsetWidth; e.classList.add("wds-bump"); }); }

/* ---------------- stock / countdown ---------------- */
async function loadStock() { try { const d = await X.api("stock"); STOCK = d.stock || {}; STOCK_AT = Date.now(); paintStock(); } catch {} }
const endsOf = (k) => (STOCK[k] && STOCK[k].endsAt) || (k === "vipBundle" ? flashEnd() : null);
function cdText(ms) { ms = Math.max(0, ms); const d = ms / 864e5 | 0, h = (ms % 864e5) / 36e5 | 0, m = (ms % 36e5) / 6e4 | 0, s = (ms % 6e4) / 1e3 | 0; return d ? `${d}d ${h}h ${String(m).padStart(2, "0")}m` : `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`; }
/** Real stock line: "Only 7 left", progress = claimed / stock, "ends in". */
export function stockLine(k) {
  const s = STOCK[k]; const end = endsOf(k);
  const endHtml = end ? `<span class="wds-ends" data-ends="${end}">⏳ ends in ${cdText(end - Date.now())}</span>` : "";
  if (!s) return `<div class="wds-stock" data-stock="${esc(k)}">${endHtml}</div>`;
  if (s.status === "ended") return `<div class="wds-stock" data-stock="${esc(k)}"><span class="wds-out">Drop ended</span></div>`;
  if (s.status === "soldout") return `<div class="wds-stock" data-stock="${esc(k)}"><span class="wds-out">Sold out · ${s.claimed}/${s.stock} claimed</span></div>`;
  if (s.stock == null) return `<div class="wds-stock" data-stock="${esc(k)}">${s.claimed ? `<span class="wds-claimed">${s.claimed.toLocaleString()} sold</span>` : ""}${endHtml}</div>`;
  const pct = Math.min(100, Math.round((s.claimed / s.stock) * 100)); const hot = s.left <= Math.max(3, s.stock * 0.15);
  return `<div class="wds-stock" data-stock="${esc(k)}"><div class="wds-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${s.stock}" aria-valuenow="${s.claimed}"><i style="width:${Math.max(pct, s.claimed ? 4 : 0)}%"></i></div>
   <span class="${hot ? "wds-hot" : "wds-left"}">${s.left === 0 ? "All held in checkouts · check back" : `${hot ? "🔥 " : ""}Only ${s.left} left`}</span><span class="wds-claimed">${s.claimed} of ${s.stock} claimed</span>${endHtml}</div>`;
}
function paintStock() { document.querySelectorAll("[data-stock]").forEach((e) => { e.outerHTML = stockLine(e.dataset.stock); }); document.querySelectorAll("[data-bagctl]").forEach((e) => (e.innerHTML = ctlInner(e.dataset.bagctl, e.dataset.label))); }
setInterval(() => { document.querySelectorAll("[data-ends]").forEach((e) => { const ms = +e.dataset.ends - Date.now(); e.textContent = ms > 0 ? "⏳ ends in " + cdText(ms) : "Ended"; }); }, 1000);

/* ---------------- add-to-bag control ---------------- */
function ctlInner(k, label) {
  const s = STOCK[k], q = qty(k);
  if (s && (s.status === "ended" || s.status === "soldout" || s.status === "paused")) return `<button class="wdl-btn ghost" disabled>${s.status === "ended" ? "Ended" : s.status === "paused" ? "Paused" : "Sold out"}</button>`;
  if (!q) return `<button class="wdl-btn wds-add" data-add="${esc(k)}">${esc(label || "Add to bag")} <span aria-hidden="true">＋</span></button>`;
  return `<div class="wds-step" role="group" aria-label="Quantity"><button data-dec="${esc(k)}" aria-label="Remove one">${q === 1 ? "🗑" : "−"}</button><b>${q}</b><button data-inc="${esc(k)}" aria-label="Add one">＋</button></div>`;
}
export const ctl = (k, label) => `<div class="wds-ctl" data-bagctl="${esc(k)}" data-label="${esc(label || "")}">${ctlInner(k, label)}</div>`;

/* ---------------- drawer + floating bag bar ---------------- */
function lineHtml(i) { return `<div class="wds-line"><span class="wds-em">${i.emoji}</span><div class="wds-lt"><b>${esc(i.name)}</b><small>${money(i.price)} each</small></div><div class="wds-step sm"><button data-dec="${esc(i.k)}" aria-label="Remove one">${i.q === 1 ? "🗑" : "−"}</button><b>${i.q}</b><button data-inc="${esc(i.k)}" aria-label="Add one">＋</button></div><span class="wds-lp">${money(i.line)}</span></div>`; }
function upsells(b) {
  const out = [], has = new Set(b.items.map((i) => i.k));
  if (has.has("vip350") && has.has("vip888") && has.has("vip1750") && !has.has("vipBundle")) out.push(`<div class="wds-up wds-up-big"><b>⚡ Swap to the OG Flash Deal</b><span>Same three drops for ${money(SKUS.vipBundle.price)}. You save ${money(350 + 888 + 1750 - SKUS.vipBundle.price)}.</span><button class="wdl-btn" data-swapbundle>Swap &amp; save</button></div>`);
  const cheap = HALL_PASSES.filter((p) => !has.has(p.key) && left(p.key) > 0 && (!STOCK[p.key] || STOCK[p.key].status === "live")).slice(0, 3);
  if (cheap.length) out.push(`<div class="wds-up"><b>🎟️ Throw in a Hall Pass?</b><div class="wds-chips">${cheap.map((p) => `<button class="wds-chip" data-add="${p.key}">${p.emoji} ${esc(p.name)} · ${money(p.price)}</button>`).join("")}</div></div>`);
  if (!b.items.some((i) => i.kind === "gift")) out.push(`<div class="wds-up"><b>💌 Bring a friend to detention</b><span>Add a $175 gift card (+${GIFT_BONUS_PCT}% bonus credit).</span><button class="wds-chip" data-add="gift175">＋ $175 gift card</button></div>`);
  return out.join("");
}
function drawerHtml() {
  const b = bag();
  return `<div class="wds-dhead"><h2>Your bag 🛍️</h2><button class="wds-x" data-closebag aria-label="Close">×</button></div>
  ${b.items.length ? `<div class="wds-lines">${b.items.map(lineHtml).join("")}</div><div class="wds-ups">${upsells(b)}</div>
  <div class="wds-dfoot"><div class="wds-sub"><span>Subtotal · ${b.count} item${b.count === 1 ? "" : "s"}</span><b>${money(b.total)}</b></div><a class="wdl-btn wds-go" href="#/checkout" data-closebag>Checkout · ${money(b.total)} →</a><p class="wdl-fine">Card · Apple Pay · Google Pay · Cash App Pay · crypto &amp; more at secure checkout.</p></div>`
  : `<div class="wds-empty"><div class="wds-bigem">🎒</div><p>Your bag is empty. Detention's more fun with snacks.</p><a class="wdl-btn" href="#/shop" data-closebag>Browse drops</a></div>`}`;
}
function ensureChrome() {
  if (!$("#wds-drawer")) {
    const d = document.createElement("div"); d.id = "wds-drawer"; d.className = "wds-drawer"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "Your bag"); d.hidden = true;
    const bd = document.createElement("div"); bd.id = "wds-backdrop"; bd.className = "wds-backdrop"; bd.hidden = true; bd.dataset.closebag = "1";
    const bar = document.createElement("button"); bar.id = "wds-bar"; bar.className = "wds-fbar"; bar.dataset.openbag = "1"; bar.hidden = true;
    document.body.append(bd, d, bar);
  }
}
export function openBag() { ensureChrome(); const d = $("#wds-drawer"); d.innerHTML = drawerHtml(); d.hidden = false; $("#wds-backdrop").hidden = false; document.body.classList.add("wds-locked"); requestAnimationFrame(() => d.classList.add("on")); }
function closeBag() { const d = $("#wds-drawer"); if (!d) return; d.classList.remove("on"); document.body.classList.remove("wds-locked"); setTimeout(() => { d.hidden = true; $("#wds-backdrop").hidden = true; }, 200); }
function paintBag() {
  ensureChrome(); const b = bag();
  const el = document.getElementById("cart-count"); if (el) { el.textContent = b.count ? String(b.count) : ""; el.setAttribute("data-empty", b.count ? "0" : "1"); }
  const bar = $("#wds-bar"), r = route(); const hideBar = !b.count || /^\/(checkout|cart|confirmation)$/.test(r);
  bar.hidden = hideBar; if (!hideBar) bar.innerHTML = `<span class="wds-badge">${b.count}</span><span>View bag</span><b>${money(b.total)}</b>`;
  document.body.classList.toggle("wds-hasbar", !hideBar);
  const d = $("#wds-drawer"); if (d && !d.hidden) d.innerHTML = drawerHtml();
  document.querySelectorAll("[data-bagctl]").forEach((e) => (e.innerHTML = ctlInner(e.dataset.bagctl, e.dataset.label)));
  if (/^\/(checkout|cart)$/.test(r)) { const m = $("#wds-co"); if (m) m.outerHTML = checkoutInner(); }
}

/* ---------------- cards ---------------- */
export function passCard(p) {
  return `<div class="wds-pass" style="--p1:${p.color[0]};--p2:${p.color[1]}">${p.hot ? `<span class="wds-flag">★ fan fave</span>` : ""}
   <a class="wds-pass-top" href="#/drop/${p.key}"><span class="wds-pass-em">${p.emoji}</span><span class="wds-pass-k">HALL PASS</span><h3>${esc(p.name)}</h3><span class="wds-pass-price">${money(p.price)}</span></a>
   <div class="wds-pass-body"><p>${esc(p.blurb)}</p>${stockLine(p.key)}${ctl(p.key)}<a class="wds-more" href="#/drop/${p.key}">Details &amp; comments →</a></div></div>`;
}
export function giftCard(g) { return `<div class="wdl-card wdl-gift"><div class="wdl-gc">WINE DETENTION<b>${money(g.price)}</b></div><p class="wdl-tag">+ ${money(g.price * GIFT_BONUS_PCT / 100)} bonus credit</p>${ctl(g.key)}</div>`; }
export const passesSection = () => `<div class="wds-passes-hero"><span class="wdl-tag">New · cheap thrills</span><h2>🎟️ Hall Passes</h2><p>Grab a pass, flex it on your profile, spend it later. 100% of the price comes back as Wine Detention gift credit. Limited runs, real counts.</p></div><div class="wds-passgrid">${HALL_PASSES.map(passCard).join("")}</div>`;

/* ---------------- ticker (real orders + giveaway entries, opt-out respected server-side) ---------------- */
async function loadTicker() { try { TICK = (await X.api("ticker")).ticker || []; paintTicker(); } catch {} }
export const tickerSlot = () => `<div class="wds-ticker" id="wds-ticker" ${TICK.length ? "" : "hidden"}>${tickerInner()}</div>`;
function tickerInner() { const t = TICK.slice(0, 12); if (!t.length) return ""; const row = t.map((x) => `<a href="#/u/${esc(x.handle)}">${X.av(x, 20)}<b>@${esc(x.handle)}</b> ${esc(x.text)} <small>${ago(x.at)} ago</small></a>`).join(""); return `<div class="wds-tk-track">${row}${t.length > 2 ? row : ""}</div>`; }
function paintTicker() { const e = $("#wds-ticker"); if (!e) return; e.hidden = !TICK.length; e.innerHTML = tickerInner(); }

/* ---------------- chat / comments ---------------- */
let FEED = { room: null, msgs: [], t: null };
function msgHtml(m) {
  const rx = (X.srv().reactions || ["🔥", "😂", "😍", "🎉"]).map((e) => `<button class="wds-rx" data-rx="${esc(m.id)}" data-emoji="${e}">${e}${m.rx && m.rx[e] ? `<small>${m.rx[e]}</small>` : ""}</button>`).join("");
  return `<div class="wds-msg" data-mid="${esc(m.id)}"><a href="#/u/${esc(m.handle)}">${X.av(m, 32)}</a><div><p class="wds-mh"><a href="#/u/${esc(m.handle)}"><b>@${esc(m.handle)}</b></a> <small>${padNo(m.member)}${m.vip ? " · ⭐ VIP" : ""} · ${ago(m.at)}</small></p><p class="wds-mt">${esc(m.text)}</p><div class="wds-rxs">${rx}</div></div></div>`;
}
export function chatBox(room, title) {
  setTimeout(() => startFeed(room), 0);
  const me = X.me();
  return `<div class="wdl-card wds-chat" data-room="${esc(room)}"><h3>${esc(title)}</h3>
   ${me ? `<form class="wds-say" id="wds-say"><input id="wds-say-in" maxlength="240" autocomplete="off" placeholder="${room === "live" ? "Say hi to the hall…" : "Ask or hype this drop…"}" aria-label="Message"><button class="wdl-btn">Send</button></form>` : `<p class="wdl-fine"><a href="#/login">Sign in</a> to chat. Be nice: no links, no spam, 21+.</p>`}
   <div class="wds-feed" id="wds-feed"><p class="wdl-fine">Loading…</p></div></div>`;
}
async function pullFeed() {
  if (!FEED.room || !$("#wds-feed")) { stopFeed(); return; }
  try { const d = await X.api("feed", undefined, "&room=" + encodeURIComponent(FEED.room)); FEED.msgs = d.msgs || []; const f = $("#wds-feed"); if (f) f.innerHTML = FEED.msgs.length ? FEED.msgs.map(msgHtml).join("") : `<p class="wdl-fine">No messages yet. Start the trouble.</p>`; } catch (e) { const f = $("#wds-feed"); if (f && !FEED.msgs.length) f.innerHTML = `<p class="wdl-fine">${esc(err(e))}</p>`; }
}
function startFeed(room) { stopFeed(); FEED.room = room; pullFeed(); FEED.t = setInterval(() => { if (!document.hidden) pullFeed(); }, 4000); }
function stopFeed() { if (FEED.t) clearInterval(FEED.t); FEED.t = null; FEED.room = null; }

/* ---------------- pages ---------------- */
const shell = (t, inner, sub) => `<section class="wdl wds"><header class="wdl-head"><h1>${t}</h1>${sub ? `<p>${sub}</p>` : ""}</header>${inner}</section>`;
export function pShop() {
  const vip = VIP_DROPS.map((v) => `<div class="wds-vrow"><span class="wds-em">${v.emoji}</span><div class="wds-lt"><a href="#/drop/${v.key}"><b>${esc(v.name)}</b></a><small>${v.list ? `<s>${money(v.list)}</s> ` : ""}${money(v.price)} · sealed mystery drop</small>${stockLine(v.key)}</div>${ctl(v.key, "Add")}</div>`).join("");
  return shell("The Drop Shop", `${tickerSlot()}${passesSection()}<h2 class="wdl-h2">🎁 OG Founding VIP drops</h2><div class="wdl-card">${vip}</div>
  <h2 class="wdl-h2">💌 Gift cards</h2><div class="wdl-grid">${GIFT_CARDS.map(giftCard).join("")}</div>
  <p class="wdl-fine">Not alcohol. Hall Passes, VIP drops and gift cards are Wine Detention store credit + profile perks. Quantities and "claimed" counts are real paid orders. Paid items never add giveaway entries or hall points.</p>`, "Hall Passes from $35, sealed VIP drops and gift cards. Tap ＋ to add, check out in one go.");
}
export function pDrop(k) {
  const s = sku(k); if (!s) return shell("Not found", `<a class="wdl-btn" href="#/shop">Back to the shop</a>`);
  const p = HALL_PASSES.find((x) => x.key === k), perks = s.kind === "pass" ? HALL_PASS_PERKS : s.kind === "gift" ? [`${money(s.price)} gift credit + ${GIFT_BONUS_PCT}% bonus credit`, "Emailed code, redeem or gift it", "Paid value never expires"] : ["Sealed mystery drop, revealed after checkout", "Same contents for every buyer, nothing random", "Gift credit + OG Founding VIP # badge", "Not alcohol"];
  const hero = p ? `<div class="wds-pass wds-pass-lg" style="--p1:${p.color[0]};--p2:${p.color[1]}"><div class="wds-pass-top"><span class="wds-pass-em">${p.emoji}</span><span class="wds-pass-k">HALL PASS</span><h3>${esc(p.name)}</h3><span class="wds-pass-price">${money(p.price)}</span></div></div>` : `<div class="wds-dhero"><span class="wds-bigem">${s.emoji}</span><b>${s.list ? `<s>${money(s.list)}</s> ` : ""}${money(s.price)}</b></div>`;
  return shell(esc(s.name), `<div class="wds-dgrid"><div>${hero}</div><div class="wdl-card"><p>${esc(p ? p.blurb : s.kind === "gift" ? "Store credit for drops, passes and partner offers. Perfect for the friend who's always late." : "Sealed for the troublemakers who showed up first.")}</p>
   <ul class="wds-perks">${perks.map((x) => `<li>✓ ${esc(x)}</li>`).join("")}</ul>${stockLine(k)}${ctl(k)}<p class="wdl-fine">Not alcohol. <a href="#/policy/terms">Terms &amp; drop details</a></p></div></div>
   ${chatBox(k, "💬 Comments")}<p><a href="#/shop">← All drops</a></p>`);
}
function checkoutInner() {
  const b = bag(), me = X.me(), srv = X.srv();
  if (!b.items.length) return `<div id="wds-co"><div class="wdl-card wds-empty"><div class="wds-bigem">🎒</div><p>Your bag is empty.</p><a class="wdl-btn" href="#/shop">Browse drops</a></div></div>`;
  const pay = !me ? X.needLogin("check out (your bag is saved)") : srv.payments ? `<button class="wdl-btn wds-pay" id="wds-pay">Pay ${money(b.total)} securely →</button>${srv.crypto ? `<button class="wdl-btn ghost wds-pay" id="wds-crypto">Pay with USDC</button>` : ""}
     <p class="wds-methods"><span>💳 Card</span><span> Apple Pay</span><span>G Pay</span><span>💵 Cash App Pay</span><span>🪙 Crypto</span><span>+ more</span></p><p class="wdl-fine">You'll finish on our secure checkout partner (Whop). Your stuff lands in your account the moment payment clears.</p>`
    : `<p class="wdl-fine"><b>Checkout opens very soon.</b> Your bag is saved to your account.</p>${srv.crypto ? `<button class="wdl-btn ghost wds-pay" id="wds-crypto">Pay with USDC</button>` : ""}`;
  return `<div id="wds-co" class="wds-cogrid"><div><div class="wdl-card"><h3>Order summary</h3><div class="wds-lines">${b.items.map(lineHtml).join("")}</div></div><div class="wds-ups">${upsells(b)}</div></div>
   <div class="wdl-card wds-cosum"><div class="wds-sub"><span>Subtotal</span><b>${money(b.total)}</b></div><div class="wds-sub"><span>Shipping</span><b>Free · digital</b></div><div class="wds-sub wds-tot"><span>Total</span><b>${money(b.total)}</b></div>${pay}<p id="wds-comsg" class="wdl-msg" role="status"></p></div></div>`;
}
export const pCheckout = () => shell("Checkout", checkoutInner(), "Almost out of detention. Tweak your bag, then pay your way.");
export const pCart = () => shell("Your bag", checkoutInner());
export function pConfirm() {
  const id = new URLSearchParams(location.search).get("order") || new URLSearchParams(location.hash.split("?")[1] || "").get("o") || localStorage.getItem("wd-last-order") || "";
  setTimeout(() => pollOrder(id, 0), 0);
  return shell("Order status", `<div id="wds-conf"><div class="wdl-card wds-center"><div class="wds-bigem wds-spin">⏳</div><p>Confirming your payment…</p></div></div>`);
}
async function pollOrder(id, n) {
  const box = $("#wds-conf"); if (!box) return;
  if (!id) { box.innerHTML = `<div class="wdl-card"><p>No recent order found.</p><a class="wdl-btn" href="#/orders">My orders</a></div>`; return; }
  if (!X.me()) { if (n < 10) return setTimeout(() => pollOrder(id, n + 1), 1000); box.innerHTML = X.needLogin("see your order"); return; }
  try {
    const d = await X.api("order", { id }); const o = d.order;
    if (o.status === "paid") { BAG = []; saveBag(true); localStorage.removeItem("wd-last-order"); X.setMe(d.me); box.innerHTML = paidHtml(o); X.confetti(); setTimeout(X.confetti, 600); return; }
    if (o.status === "underpaid") { box.innerHTML = `<div class="wdl-card"><h3>Payment didn't cover the order</h3><p>Order ${esc(o.id)}. Email hello@winedetention.com and we'll sort it out.</p></div>`; return; }
    if (n < 60) { box.innerHTML = `<div class="wdl-card wds-center"><div class="wds-bigem wds-spin">⏳</div><p>Waiting for payment to clear… (order ${esc(o.id)})</p>${o.purchaseUrl ? `<a class="wdl-btn ghost" href="${esc(o.purchaseUrl)}">Back to payment</a>` : ""}</div>`; return setTimeout(() => pollOrder(id, n + 1), 3000); }
    box.innerHTML = `<div class="wdl-card"><p>Still waiting on payment for order ${esc(o.id)}. If you paid, it'll show up in <a href="#/orders">My orders</a> shortly.</p></div>`;
  } catch (e) { box.innerHTML = `<div class="wdl-card"><p>${esc(err(e))}</p></div>`; }
}
function paidHtml(o) {
  const codes = (o.codes || []).map((c) => `<div class="wds-code"><b>${esc(c.code)}</b><small>${esc(c.name || "")} · ${money(c.amount)} credit</small><button class="wds-chip" data-copy="${esc(c.code)}">Copy</button></div>`).join("");
  const applied = (o.applied || []).map((c) => `<li>🎁 ${esc(c.name)} unlocked: ${money(c.amount)} gift credit added</li>`).join("");
  return `<div class="wdl-card wds-center"><div class="wds-bigem">🎉</div><h2>You're officially in trouble.</h2><p>Order <b>${esc(o.id)}</b> · ${money(o.total)} paid</p></div>
   <div class="wdl-card"><h3>What you got</h3><ul class="wds-perks">${o.items.map((i) => `<li>${i.emoji} ${i.q}× ${esc(i.name)}</li>`).join("")}${applied}${o.passCredit ? `<li>🎟️ ${money(o.passCredit)} Hall Pass credit added + passes on your profile</li>` : ""}</ul>
   ${codes ? `<h3>Gift codes</h3><p class="wdl-fine">Keep one, gift the rest. Redeem under Gift cards → Redeem.</p>${codes}` : ""}<a class="wdl-btn" href="#/account">My profile</a> <a class="wdl-btn ghost" href="#/shop">Keep shopping</a></div>`;
}
export function pOrders() {
  if (!X.me()) return shell("My orders", X.needLogin("see your orders"));
  setTimeout(async () => { const box = $("#wds-orders"); if (!box) return; try { const os = (await X.api("orders", {})).orders; box.innerHTML = os.length ? os.map((o) => `<div class="wdl-card"><p><b>${esc(o.id)}</b> · ${new Date(o.createdAt).toLocaleDateString()} · ${money(o.total)} · <span class="wds-st wds-st-${esc(o.status)}">${esc(o.status)}</span></p><p class="wdl-fine">${o.items.map((i) => `${i.q}× ${esc(i.name)}`).join(", ")}</p>${(o.codes || []).map((c) => `<div class="wds-code"><b>${esc(c.code)}</b><small>${money(c.amount)}</small><button class="wds-chip" data-copy="${esc(c.code)}">Copy</button></div>`).join("")}${o.purchaseUrl ? `<a class="wdl-btn ghost" href="${esc(o.purchaseUrl)}">Finish payment</a>` : ""}</div>`).join("") : `<div class="wdl-card"><p>No orders yet.</p><a class="wdl-btn" href="#/shop">Shop drops</a></div>`; } catch (e) { box.innerHTML = `<p>${esc(err(e))}</p>`; } }, 0);
  return shell("My orders", `<div id="wds-orders"><p>Loading…</p></div>`);
}
export function pLive() {
  const hot = [...HALL_PASSES.map((p) => p.key), ...VIP_DROPS.map((v) => v.key)].filter((k) => STOCK[k] && STOCK[k].status === "live" && STOCK[k].left != null).sort((a, b) => STOCK[a].left / STOCK[a].stock - STOCK[b].left / STOCK[b].stock).slice(0, 4);
  return shell("🔴 Live in the hall", `${tickerSlot()}<div class="wds-livegrid"><div>${chatBox("live", "Hall chat")}</div><div><div class="wdl-card"><h3>🔥 Going fast</h3>${(hot.length ? hot : ["hp69", "hp35", "vip350"]).map((k) => { const s = sku(k); return `<div class="wds-vrow"><span class="wds-em">${s.emoji}</span><div class="wds-lt"><a href="#/drop/${k}"><b>${esc(s.name)}</b></a><small>${money(s.price)}</small>${stockLine(k)}</div>${ctl(k, "Add")}</div>`; }).join("")}<a class="wds-more" href="#/shop">See every drop →</a></div></div></div>
  <p class="wdl-fine">Members only, 21+. No links, spam or hate. Mods can remove messages and mute accounts. Activity shows real orders and giveaway entries; turn yours off in your profile.</p>`, "Real members, real drops, real-time-ish chat.");
}

/* ---------------- events (delegated once) ---------------- */
async function startCheckout(btn) {
  const msg = (t) => { const m = $("#wds-comsg"); if (m) m.textContent = t; };
  btn.disabled = true; msg("Holding your stuff for 20 minutes…");
  try { const d = await X.api("checkout", { items: BAG }); localStorage.setItem("wd-last-order", d.order.id); msg("Opening secure checkout…"); location.href = d.url; }
  catch (e) { btn.disabled = false; msg(err(e)); if (e.data && e.data.sku) loadStock(); }
}
async function cryptoCheckout(btn) {
  const msg = (t) => { const m = $("#wds-comsg"); if (m) m.textContent = t; };
  const eth = window.ethereum; if (!eth) { msg("Open this page in a browser with your crypto account extension, or use the main checkout (it takes crypto too)."); return; }
  btn.disabled = true;
  try {
    const d = await X.api("checkout", { items: BAG, method: "crypto" }); const o = d.order, c = d.crypto; localStorage.setItem("wd-last-order", o.id);
    const [from] = await eth.request({ method: "eth_requestAccounts" });
    try { await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x" + c.chainId.toString(16) }] }); } catch {}
    const units = BigInt(Math.round(o.total * 100)) * 10n ** BigInt(c.decimals - 2);
    const data = "0xa9059cbb" + c.treasury.slice(2).padStart(64, "0") + units.toString(16).padStart(64, "0");
    msg("Confirm the payment in your extension…");
    const tx = await eth.request({ method: "eth_sendTransaction", params: [{ from, to: c.token, data }] });
    msg("Payment sent. Confirming on the network…");
    for (let i = 0; i < 40; i++) { try { await X.api("cryptopay", { id: o.id, tx }); location.hash = "#/confirmation?o=" + o.id; return; } catch (e) { if (e.message !== "tx_pending" && e.message !== "rpc_error") throw e; await new Promise((r) => setTimeout(r, 3000)); } }
    msg("Still confirming. Check My orders in a minute.");
  } catch (e) { msg(err(e)); btn.disabled = false; }
}
let bound = false;
function bindOnce() {
  if (bound) return; bound = true;
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-add],[data-inc],[data-dec],[data-openbag],[data-closebag],[data-swapbundle],[data-copy],[data-rx],#wds-pay,#wds-crypto,.cart-link");
    if (!t) return;
    if (t.matches(".cart-link")) { e.preventDefault(); openBag(); return; }
    if (t.dataset.add) { e.preventDefault(); add(t.dataset.add); }
    else if (t.dataset.inc) { e.preventDefault(); add(t.dataset.inc); }
    else if (t.dataset.dec) { e.preventDefault(); setQty(t.dataset.dec, qty(t.dataset.dec) - 1); }
    else if (t.dataset.openbag) openBag();
    else if (t.dataset.swapbundle !== undefined) { ["vip350", "vip888", "vip1750"].forEach((k) => setQty(k, qty(k) - 1, "silent")); add("vipBundle"); }
    else if (t.dataset.copy) navigator.clipboard && navigator.clipboard.writeText(t.dataset.copy).then(() => X.toast("Copied " + t.dataset.copy));
    else if (t.dataset.rx) { if (!X.me()) { X.toast("Sign in to react"); return; } try { const d = await X.api("react", { id: t.dataset.rx, emoji: t.dataset.emoji }); const m = FEED.msgs.find((x) => x.id === t.dataset.rx); if (m) { m.rx = d.rx; const el = document.querySelector(`[data-mid="${t.dataset.rx}"]`); if (el) el.outerHTML = msgHtml(m); } } catch (er) { X.toast(err(er)); } }
    else if (t.id === "wds-pay") startCheckout(t);
    else if (t.id === "wds-crypto") cryptoCheckout(t);
    if (t.dataset.closebag !== undefined) closeBag();
  });
  document.addEventListener("submit", async (e) => {
    if (e.target.id !== "wds-say") return; e.preventDefault();
    const i = $("#wds-say-in"); const room = e.target.closest("[data-room]").dataset.room; const text = i.value.trim(); if (!text) return;
    const b = e.target.querySelector("button"); b.disabled = true;
    try { const d = await X.api("say", { room, text }); i.value = ""; FEED.msgs.unshift(d.msg); const f = $("#wds-feed"); if (f) f.innerHTML = FEED.msgs.map(msgHtml).join(""); } catch (er) { X.toast(err(er)); }
    b.disabled = false; i.focus();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeBag(); });
  window.addEventListener("hashchange", () => { closeBag(); if (!/^\/(live|drop\/)/.test(route())) stopFeed(); paintBag(); });
  window.addEventListener("storage", (e) => { if (e.key === BAG_KEY) { try { BAG = JSON.parse(e.newValue || "[]"); } catch {} paintBag(); } });
}
export function bind() { ensureChrome(); paintBag(); }
export function init(ctx) {
  X = ctx; bindOnce(); ensureChrome(); paintBag(); loadStock(); loadTicker();
  setInterval(() => { if (!document.hidden) loadStock(); }, 15000);
  setInterval(() => { if (!document.hidden) loadTicker(); }, 20000);
}
