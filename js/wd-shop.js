/* Wine Detention shop: bag (Uber Eats style +/-), drawer, checkout (Whop), confirmation, real stock +
   countdowns, Hall Passes, drop pages with comments, Live room chat + real activity ticker. */
import { HALL_PASSES, HALL_PASS_PERKS, VIP_DROPS, GIFT_CARDS, GIFT_BONUS_PCT, VIP_BONUS_PCT, PEARL_SKUS, SKUS, sku, priceBag, MAX_QTY, flashEnd, DROP_DEFAULTS } from "./wd-catalog.js";
import { CLUB } from "./wd-rewards.js";
let X = null; // context from wd-live.js
export const HALL = HALL_PASSES;
export { sku };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\.00$/, "");
const $ = (s) => document.querySelector(s);
const route = () => (location.hash.replace(/^#/, "").split("?")[0] || "/");
const padNo = (n) => "#" + String(+n || 0).padStart(4, "0");
const ago = (t) => { const s = Math.max(1, (Date.now() - t) / 1000 | 0); return s < 60 ? s + "s" : s < 3600 ? (s / 60 | 0) + "m" : s < 86400 ? (s / 3600 | 0) + "h" : (s / 86400 | 0) + "d"; };
const ERR = { sold_out: "Sold out, sorry!", not_enough_left: "Not that many left.", drop_ended: "That drop has ended.", drop_paused: "That drop is paused right now.", empty_bag: "Your bag is empty.", payments_not_configured: "Checkout is opening soon. Your bag is saved.", checkout_failed: "Checkout hiccup. Try again in a sec.", order_too_big: "That's a lot of trouble for one order. Split it up (max $25,000).", slow_down: "Easy, tiger. One message every few seconds.", no_links: "No links in chat, please.", spammy: "That looks like spam.", duplicate: "You just said that.", muted: "You're muted in chat.", empty_message: "Say something first.", tx_pending: "Waiting for the network…", wallet_mismatch: "Pay from the same account you signed in with.", underpaid: "That payment was short.", tx_used: "That payment was already used.", needs_more_auth: "Finish signing in to continue.", drop_not_open: "That drop isn't open yet (Champagne Club gets in 24h early).", club_owned: "You're already in the Champagne Club 🥂", dob_required: "Pop in your date of birth once to check out.", under_21: "Sorry, you must be 21 or older.", not_enough_pearls: "Not enough Pearls." };
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
const canEarly = (st) => { const me = X && X.me(); return !!(me && me.club && st.startsAt && st.startsAt - CLUB.earlyHours * 3600e3 <= Date.now()); };
function setQty(k, q, why) {
  const s = sku(k); if (!s) return; q = Math.max(0, Math.floor(q) || 0);
  const had = qty(k), st = STOCK[k];
  if (q > had) { // adding: respect drop status + real stock (removing is always allowed)
    if (st && (st.status === "ended" || st.status === "paused" || st.status === "soldout" || (st.status === "soon" && !canEarly(st)))) { X.toast(st.status === "ended" ? "That drop has ended." : st.status === "soon" ? ERR.drop_not_open : st.status === "paused" ? ERR.drop_paused : "Sold out, sorry!"); return; }
    if (s.kind === "club" && X.me() && X.me().club) { X.toast(ERR.club_owned); return; }
    const cap = Math.min(s.maxQty || MAX_QTY, left(k)); if (q > cap) { X.toast(cap <= 0 ? "Sold out, sorry!" : s.maxQty === 1 ? "One per member" : `Only ${cap} left for you`); q = Math.max(had, cap); if (q === had) { paintBag(); return; } }
  }
  const i = BAG.findIndex((l) => l.k === k); if (q > 0) { if (i >= 0) BAG[i] = { k, q }; else BAG.push({ k, q }); } else if (i >= 0) BAG.splice(i, 1);
  saveBag(); if (q > had && why !== "silent") { X.toast(`${s.emoji} Added ${s.name}`); bump(); }
}
const add = (k, n = 1) => setQty(k, qty(k) + n);
function bump() { const b = document.querySelectorAll(".wds-badge, .cart-count"); b.forEach((e) => { e.classList.remove("wds-bump"); void e.offsetWidth; e.classList.add("wds-bump"); }); }

/* ---------------- stock / countdown ---------------- */
async function loadStock() { try { const d = await X.api("stock"); STOCK = d.stock || {}; STOCK_AT = Date.now(); paintStock(); } catch {} }
const endsOf = (k) => (STOCK[k] && STOCK[k].endsAt) || (DROP_DEFAULTS[k] && DROP_DEFAULTS[k].endsAt ? Date.parse(DROP_DEFAULTS[k].endsAt) : null);
function cdText(ms) { ms = Math.max(0, ms); const d = ms / 864e5 | 0, h = (ms % 864e5) / 36e5 | 0, m = (ms % 36e5) / 6e4 | 0, s = (ms % 6e4) / 1e3 | 0; return d ? `${d}d ${h}h ${String(m).padStart(2, "0")}m` : `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`; }
/** Real stock line: "Only 7 left", progress = claimed / stock, "ends in". */
export function stockLine(k) {
  const s = STOCK[k]; const end = endsOf(k);
  const endHtml = end ? `<span class="wds-ends" data-ends="${end}">⏳ ends in ${cdText(end - Date.now())}</span>` : "";
  if (!s) return `<div class="wds-stock" data-stock="${esc(k)}">${endHtml}</div>`;
  if (s.status === "ended") return `<div class="wds-stock" data-stock="${esc(k)}"><span class="wds-out">Drop ended</span></div>`;
  if (s.status === "soon") return `<div class="wds-stock" data-stock="${esc(k)}"><span class="wds-left">Opens <span data-ends="${s.startsAt}" data-pre="in ">soon</span>${canEarly(s) ? " · 🥂 Club early access is ON" : " · 🥂 Club gets in 24h early"}</span></div>`;
  if (s.status === "soldout") return `<div class="wds-stock" data-stock="${esc(k)}"><span class="wds-out">Sold out · ${s.claimed}/${s.stock} claimed</span></div>`;
  if (s.stock == null) return `<div class="wds-stock" data-stock="${esc(k)}">${s.claimed ? `<span class="wds-claimed">${s.claimed.toLocaleString()} sold</span>` : ""}${endHtml}</div>`;
  const pct = Math.min(100, Math.round((s.claimed / s.stock) * 100)); const hot = s.left <= Math.max(3, s.stock * 0.15);
  return `<div class="wds-stock" data-stock="${esc(k)}"><div class="wds-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${s.stock}" aria-valuenow="${s.claimed}"><i style="width:${Math.max(pct, s.claimed ? 4 : 0)}%"></i></div>
   <span class="${hot ? "wds-hot" : "wds-left"}">${s.left === 0 ? "All held in checkouts · check back" : `${hot ? "🔥 " : ""}Only ${s.left} left`}</span><span class="wds-claimed">${s.claimed} of ${s.stock} claimed</span>${endHtml}</div>`;
}
function paintStock() { document.querySelectorAll("[data-stock]").forEach((e) => { e.outerHTML = stockLine(e.dataset.stock); }); document.querySelectorAll("[data-bagctl]").forEach((e) => (e.innerHTML = ctlInner(e.dataset.bagctl, e.dataset.label))); }
setInterval(() => { document.querySelectorAll("[data-ends]").forEach((e) => { const ms = +e.dataset.ends - Date.now(); e.textContent = ms > 0 ? (e.dataset.pre != null ? e.dataset.pre : "⏳ ends in ") + cdText(ms) : e.dataset.pre != null ? "now" : "Ended"; if (ms <= 0 && ms > -1500) loadStock(); }); }, 1000);

/* ---------------- add-to-bag control ---------------- */
function ctlInner(k, label) {
  const s = STOCK[k], q = qty(k);
  const S = sku(k), me = X && X.me();
  if (S && S.kind === "club" && me && me.club) return `<a class="wdl-btn ghost" href="#/club">🥂 You're in the Club</a>`;
  if (!q && s && (s.status === "ended" || s.status === "soldout" || s.status === "paused" || (s.status === "soon" && !canEarly(s)))) return `<button class="wdl-btn ghost" disabled>${s.status === "ended" ? "Ended" : s.status === "paused" ? "Paused" : s.status === "soon" ? "Opens soon" : "Sold out"}</button>`;
  if (!q) return `<button class="wdl-btn wds-add" data-add="${esc(k)}">${esc(label || "Add to bag")} <span aria-hidden="true">＋</span></button>`;
  const cap = Math.min((S && S.maxQty) || MAX_QTY, left(k)), full = q >= cap;
  return `<div class="wds-step" role="group" aria-label="Quantity in bag"><button data-dec="${esc(k)}" aria-label="${q === 1 ? "Remove from bag" : "Remove one"}">${q === 1 ? "🗑" : "−"}</button><b aria-live="polite">${q}<small>in bag</small></b><button data-inc="${esc(k)}" aria-label="Add one" ${full ? 'aria-disabled="true" class="wds-max"' : ""}>＋</button></div>`;
}
export const ctl = (k, label) => `<div class="wds-ctl" data-bagctl="${esc(k)}" data-label="${esc(label || "")}">${ctlInner(k, label)}</div>`;

/* ---------------- drawer + floating bag bar ---------------- */
function lineHtml(i) { const st = STOCK[i.k], low = st && st.left != null && st.left <= 5 ? `<small class="wds-hot">🔥 Only ${st.left} left</small>` : ""; return `<div class="wds-line"><span class="wds-em">${i.emoji}</span><div class="wds-lt"><a href="#/drop/${esc(i.k)}" data-closebag><b>${esc(i.name)}</b></a><small>${money(i.price)} each</small>${low}<button class="wds-rm" data-rm="${esc(i.k)}">Remove</button></div><div class="wds-step sm"><button data-dec="${esc(i.k)}" aria-label="${i.q === 1 ? "Remove from bag" : "Remove one"}">${i.q === 1 ? "🗑" : "−"}</button><b>${i.q}</b><button data-inc="${esc(i.k)}" aria-label="Add one">＋</button></div><span class="wds-lp">${money(i.line)}</span></div>`; }
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
  const bar = $("#wds-bar"), r = route(); const hideBar = !b.count || /^\/(checkout|cart|confirmation|drop\/.*)$/.test(r);
  document.querySelectorAll(".wds-stickybag .wds-badge").forEach((e) => (e.textContent = b.count || ""));
  if (!/^\/drop\//.test(r)) document.body.classList.remove("wds-onpdp");
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
  const me = X.me(), mine = me && me.handle === m.handle;
  const flair = `${m.club ? ` <span class="wdf-club">🥂 Ruby OG</span>` : ""}${m.vip ? " · ⭐ VIP" : ""}`;
  if (m.type === "gift") return `<div class="wds-msg wds-giftmsg" data-mid="${esc(m.id)}"><span class="wds-gift-em">${esc((m.text.match(/\S+$/) || ["🎁"])[0])}</span><p><a href="#/u/${esc(m.handle)}"><b>@${esc(m.handle)}</b></a>${flair} sent <a href="#/u/${esc(m.to)}"><b>@${esc(m.to)}</b></a> ${esc(m.text.replace(/^sent @\S+ /, ""))} <small>${ago(m.at)}</small></p></div>`;
  const rx = (X.srv().reactions || ["🔥", "😂", "😍", "🎉"]).map((e) => `<button class="wds-rx" data-rx="${esc(m.id)}" data-emoji="${e}">${e}${m.rx && m.rx[e] ? `<small>${m.rx[e]}</small>` : ""}</button>`).join("");
  return `<div class="wds-msg" data-mid="${esc(m.id)}"><a href="#/u/${esc(m.handle)}">${X.av(m, 32)}</a><div><p class="wds-mh"><a href="#/u/${esc(m.handle)}"><b>@${esc(m.handle)}</b></a>${flair} <small>${padNo(m.member)} · ${ago(m.at)}</small></p><p class="wds-mt">${esc(m.text)}</p><div class="wds-rxs">${rx}${mine ? "" : `<button class="wds-rx wds-tipbtn" data-tip="${esc(m.handle)}" data-tiproom="${esc(m.room)}" title="Send a gift">🎁</button>`}</div></div></div>`;
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
  try { const d = await X.api("feed", undefined, "&room=" + encodeURIComponent(FEED.room)); FEED.msgs = d.msgs || []; document.dispatchEvent(new CustomEvent("wd:feed", { detail: FEED.msgs })); const f = $("#wds-feed"); if (f) f.innerHTML = FEED.msgs.length ? FEED.msgs.map(msgHtml).join("") : `<p class="wdl-fine">No messages yet. Start the trouble.</p>`; } catch (e) { const f = $("#wds-feed"); if (f && !FEED.msgs.length) f.innerHTML = `<p class="wdl-fine">${esc(err(e))}</p>`; }
}
function startFeed(room) { stopFeed(); FEED.room = room; pullFeed(); FEED.t = setInterval(() => { if (!document.hidden) pullFeed(); }, 4000); }
function stopFeed() { if (FEED.t) clearInterval(FEED.t); FEED.t = null; FEED.room = null; }

/* ---------------- pages ---------------- */
const shell = (t, inner, sub) => `<section class="wdl wds"><header class="wdl-head"><h1>${t}</h1>${sub ? `<p>${sub}</p>` : ""}</header>${inner}</section>`;
/* Naughty List pre-Black Friday OG deals banner */
export const naughtyBanner = () => `<a class="wds-naughty" href="#/shop"><span class="wds-nl-tag">🎄 Naughty List · pre-Black Friday</span><b>OG supporter deals for the naughty ones on the whitelist</b><span>Thanksgiving, Black Friday &amp; holiday deals are live early. Everything runs through <b>Sun Feb 14, 11:59 PM AZ</b>. Flash bundle ends <b>Cyber Monday (Mon Nov 30, 11:59 PM AZ)</b>.</span></a>`;
export function pShop() {
  const vip = VIP_DROPS.map((v) => `<div class="wds-vrow"><span class="wds-em">${v.emoji}</span><div class="wds-lt"><a href="#/drop/${v.key}"><b>${esc(v.name)}</b></a><small>${v.list ? `<s>${money(v.list)}</s> ` : ""}${money(v.price)} · ${v.bundle ? "flash deal · ends Cyber Monday" : "sealed mystery drop"}</small>${stockLine(v.key)}</div>${ctl(v.key, "Add")}</div>`).join("");
  const pearls = PEARL_SKUS.map((p) => `<div class="wds-vrow"><span class="wds-em">🦪</span><div class="wds-lt"><a href="#/pearls"><b>${esc(p.name)}</b></a><small>${money(p.price)} · virtual gifts, no cash value</small></div>${ctl(p.key, "Add")}</div>`).join("");
  return shell("The Drop Shop", `${naughtyBanner()}${tickerSlot()}<a class="wds-clubcta" href="#/club"><span>🥂</span><div><b>Champagne Club · Founding OG</b><small>${money(CLUB.price)} one-time · Ruby badge, 2x points, monthly Pearls, early drops</small></div><em>See perks →</em></a>
  ${passesSection()}<h2 class="wdl-h2">🎁 OG Founding VIP drops</h2><div class="wdl-card">${vip}</div>
  <h2 class="wdl-h2">💌 Gift cards</h2><div class="wdl-grid">${GIFT_CARDS.map(giftCard).join("")}</div>
  <h2 class="wdl-h2">🦪 Pearls</h2><div class="wdl-card">${pearls}</div>
  <p class="wdl-fine">Not alcohol. Hall Passes, VIP drops, gift cards, Pearls and the Champagne Club are digital Wine Detention credit, collectibles and perks. Quantities and "claimed" counts are real paid orders. Paid items never add giveaway entries. Purchases earn hall points (1 per $1, surges apply); points have no cash value.</p>`, "Hall Passes from $35, sealed VIP drops, gift cards, Pearls and the Club. Tap ＋ to add, check out in one go.");
}
export function pDrop(k) {
  const s = sku(k); if (!s) return shell("Not found", `<div class="wdl-card"><p>That drop doesn't exist (anymore).</p><a class="wdl-btn" href="#/shop">Back to the shop</a></div>`);
  if (s.kind === "club") { setTimeout(() => location.replace("#/club"), 0); return shell("Champagne Club", "<p>Opening…</p>"); }
  const C = window.WD_CONFIG || {}, tier = [...(C.VIP_TIERS || []), ...(C.MORE_DROPS || []), C.VIP_BUNDLE].filter(Boolean).find((t) => t.key === k) || {};
  const p = HALL_PASSES.find((x) => x.key === k);
  const credit = s.kind === "vip" ? (tier.credit || Math.round(s.price * (1 + VIP_BONUS_PCT / 100) * 100) / 100) : s.kind === "gift" ? s.price * (1 + GIFT_BONUS_PCT / 100) : s.kind === "pass" ? s.price : 0;
  const hook = p ? p.blurb : s.kind === "gift" ? "Store credit for drops, passes and future partner offers. Perfect for the friend who's always late." : s.kind === "pearls" ? "Virtual Pearls for tipping and animated gifts in the Live room, chat and jukebox." : (X.hook && X.hook(k)) || tier.tagline || "Sealed for the troublemakers who showed up first.";
  const kindTag = { pass: "🎟️ Hall Pass", vip: s.bundle ? "⚡ OG Flash Deal · Cyber Monday" : "🎁 OG Founding VIP · sealed mystery drop", gift: "💌 Gift card", pearls: "🦪 Pearls pack" }[s.kind] || "";
  const hero = p ? `<div class="wds-pass wds-pass-lg" style="--p1:${p.color[0]};--p2:${p.color[1]}"><div class="wds-pass-top"><span class="wds-pass-em">${p.emoji}</span><span class="wds-pass-k">HALL PASS</span><h3>${esc(p.name)}</h3><span class="wds-pass-price">${money(p.price)}</span></div></div>`
    : s.kind === "vip" && X.boxSvg ? `<div class="wds-dart" style="--a:${(X.dropColor(k))[0]};--b:${(X.dropColor(k))[1]};--bg:${(X.dropColor(k))[2]}">${X.boxSvg(k)}<span class="wds-seal">🔒 Sealed · revealed after checkout</span></div>`
    : s.kind === "gift" ? `<div class="wds-dart wds-dart-gift"><div class="wdl-gc">WINE DETENTION<b>${money(s.price)}</b></div></div>` : `<div class="wds-dart"><span class="wds-bigem">${s.emoji}</span></div>`;
  const perks = s.kind === "pass" ? HALL_PASS_PERKS : s.kind === "gift" ? [`${money(s.price)} gift credit + ${GIFT_BONUS_PCT}% bonus (${money(credit)} total)`, "Code appears right after checkout, keep it or gift it", "Paid value never expires"] : s.kind === "pearls" ? [`${s.pearls.toLocaleString()} Pearls added to your account instantly`, "Tip members and send animated gifts", "Bump your jukebox requests"] : [...(tier.perks || []), `${money(credit)} Wine Detention gift credit`, "OG Founding VIP # badge on your profile"];
  const expect = s.kind === "vip" ? ["Add it to your bag and check out securely (card, Apple Pay, Google Pay, Cash App Pay, crypto).", "Your drop unseals the moment payment clears: reveal screen, gift credit and VIP # land in your account.", "Same contents for every buyer. Nothing random, nothing alcoholic.", "Extra units become gift codes you can hand to friends."] : s.kind === "pass" ? ["Add passes to your bag (stack as many as you like, up to the real stock).", "Pay securely; passes appear on your profile instantly.", "100% of the price becomes Wine Detention gift credit."] : s.kind === "pearls" ? ["Pay securely.", "Pearls land in your balance instantly.", "Tip, gift and bump. Pearls have no cash value."] : ["Pay securely.", "Your code shows on the confirmation page and in My orders.", "Redeem it yourself or gift it."];
  const faq = [["Is this alcohol?", "No. Nothing sold on Wine Detention is alcohol. Drops, passes, gift cards, Pearls and the Club are digital store credit, collectibles and perks."],
    ...(s.kind === "vip" ? [["What's inside?", "It's sealed until checkout, but it's not a lottery: every buyer gets the exact same fixed contents (gift credit + perks listed above + the reveal). See Terms for the full contents list."], ["How many are there?", "The run is limited. The \"claimed\" bar counts real paid orders only, never fake numbers."]] : []),
    ["When do I get it?", "Instantly. Everything is digital and lands in your account the moment payment clears. Nothing ships."],
    ["Can I buy more than one?", s.kind === "pearls" || s.kind === "gift" || s.kind === "pass" ? "Yes, up to the real stock left (max 10 per order)." : "Yes. Your first unlocks on your account; extras become gift codes for friends."],
    ["Refunds?", "Digital items are final once delivered, except where the law says otherwise. Payment issue? Email hello@winedetention.com with your order number."]];
  const related = (s.kind === "pass" ? HALL_PASSES.map((x) => x.key) : s.kind === "vip" ? VIP_DROPS.map((x) => x.key) : s.kind === "gift" ? GIFT_CARDS.map((x) => x.key) : PEARL_SKUS.map((x) => x.key)).filter((x) => x !== k).slice(0, 3);
  const gallery = s.kind === "vip" ? `<div class="wds-gal">${["Sealed box", "The reveal", "Your VIP badge"].map((t, i) => `<div class="wds-galtile" style="--h:${i * 40}"><span>${["🎁", "✨", "⭐"][i]}</span><small>${t}</small><em>🔒 after checkout</em></div>`).join("")}</div>` : "";
  setTimeout(() => document.body.classList.add("wds-onpdp"), 0);
  return `<section class="wdl wds wds-pdp"><nav class="wds-crumbs"><a href="#/shop">Shop</a> › <span>${esc(kindTag.replace(/^\S+ /, ""))}</span></nav>
   <div class="wds-dgrid"><div>${hero}${gallery}</div><div class="wdl-card wds-buybox"><span class="wdl-tag">${kindTag}</span><h1 class="wds-ptitle">${esc(s.name)}</h1><p class="wds-hook">${esc(hook)}</p>
    <div class="wds-pprice">${s.list ? `<s>${money(s.list)}</s> ` : ""}<b>${money(s.price)}</b>${s.list ? `<span class="wds-save">Save ${money(s.list - s.price)}</span>` : ""}</div>
    ${stockLine(k)}${ctl(k)}<p class="wds-trust">🔒 Secure checkout · 💳 Apple Pay · G Pay · Cash App · crypto · ⚡ instant delivery</p>
    ${s.kind === "vip" ? `<p class="wdl-fine">What's in it? Revealed after checkout. Same drop for everyone. Not alcohol.</p>` : ""}</div></div>
   <div class="wds-pgrid"><div class="wdl-card"><h3>What you get</h3><ul class="wds-perks">${perks.map((x) => `<li>✓ ${esc(x)}</li>`).join("")}</ul></div>
    <div class="wdl-card"><h3>What to expect</h3><ol class="wds-steps">${expect.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div></div>
   <div class="wdl-card"><h3>Delivery &amp; fulfillment</h3><p>Digital only: nothing ships to your door. Credit, passes, Pearls, VIP numbers and codes appear on your confirmation page, in <a href="#/orders">My orders</a> and on your profile as soon as payment clears (usually seconds). Wine itself is only ever sold by licensed partners, never on this site.</p></div>
   <div class="wdl-card wds-faq"><h3>FAQ</h3>${faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}<p class="wdl-fine"><a href="#/policy/terms">Terms &amp; full drop details</a></p></div>
   ${related.length ? `<h2 class="wdl-h2">You might also like</h2><div class="wds-related">${related.map((r) => { const x = sku(r); return `<a class="wdl-card wds-rel" href="#/drop/${r}"><span class="wds-em">${x.emoji}</span><b>${esc(x.name)}</b><small>${money(x.price)}</small></a>`; }).join("")}</div>` : ""}
   ${chatBox(k, "💬 Comments")}<p><a href="#/shop">← All drops</a></p>
   <div class="wds-sticky" id="wds-sticky"><div><b>${money(s.price)}</b><small>${esc(s.name)}</small></div>${ctl(k)}<button class="wds-stickybag" data-openbag aria-label="Open bag">🛍️<span class="wds-badge">${count() || ""}</span></button></div></section>`;
}
function checkoutInner() {
  const b = bag(), me = X.me(), srv = X.srv();
  if (!b.items.length) return `<div id="wds-co"><div class="wdl-card wds-empty"><div class="wds-bigem">🎒</div><h3>Your bag is empty</h3><p>Detention's more fun with snacks. Hall Passes start at $35.</p><a class="wdl-btn" href="#/shop">Browse drops</a> <a class="wdl-btn ghost" href="#/hall-passes">Hall Passes</a></div></div>`;
  const promo = me && me.promo ? Math.round(Math.min(b.total * me.promo.pct / 100, me.promo.max) * 100) / 100 : 0, total = Math.round((b.total - promo) * 100) / 100;
  const dob = me && srv.checkoutDob && !me.dobOk ? `<label class="wds-dob" id="wds-dobwrap"><span>One-time 21+ check · date of birth</span><input type="date" id="wds-dob" max="${new Date().toISOString().slice(0, 10)}" required><small>We only save that you passed, not your birthday.</small></label>` : "";
  const pay = !me ? X.needLogin("check out (your bag is saved)") : srv.payments ? `${dob}<button class="wdl-btn wds-pay" id="wds-pay">Pay ${money(total)} securely →</button>${srv.crypto ? `<button class="wdl-btn ghost wds-pay" id="wds-crypto">Pay with USDC</button>` : ""}
     <p class="wds-methods"><span>💳 Card</span><span> Apple Pay</span><span>G Pay</span><span>💵 Cash App Pay</span><span>🪙 Crypto</span><span>+ more</span></p><p class="wdl-fine">You'll finish on our secure checkout partner (Whop). Your stuff lands in your account the moment payment clears. We hold your items for 20 minutes.</p>`
    : `<p class="wdl-fine"><b>Checkout opens very soon.</b> Your bag is saved to your account.</p>${srv.crypto ? `${dob}<button class="wdl-btn ghost wds-pay" id="wds-crypto">Pay with USDC</button>` : ""}`;
  const low = b.items.filter((i) => STOCK[i.k] && STOCK[i.k].left != null && STOCK[i.k].left <= 5);
  return `<div id="wds-co" class="wds-cogrid"><div><div class="wdl-card"><h3>Order summary · ${b.count} item${b.count === 1 ? "" : "s"}</h3><div class="wds-lines">${b.items.map(lineHtml).join("")}</div>${low.length ? `<p class="wds-hot">🔥 Going fast: ${low.map((i) => esc(i.name)).join(", ")}</p>` : ""}</div><div class="wds-ups">${upsells(b)}</div></div>
   <div class="wdl-card wds-cosum"><div class="wds-sub"><span>Subtotal</span><b>${money(b.total)}</b></div>${promo ? `<div class="wds-sub wds-disc"><span>🏷️ Welcome ${me.promo.pct}% off</span><b>−${money(promo)}</b></div>` : ""}<div class="wds-sub"><span>Delivery</span><b>Free · instant, digital</b></div><div class="wds-sub wds-tot"><span>Total</span><b>${money(total)}</b></div>${pay}<p id="wds-comsg" class="wdl-msg" role="status"></p></div></div>`;
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
   <div class="wdl-card"><h3>What you got</h3><ul class="wds-perks">${o.items.map((i) => `<li>${i.emoji} ${i.q}× ${esc(i.name)}</li>`).join("")}${applied}${o.passCredit ? `<li>🎟️ ${money(o.passCredit)} Hall Pass credit added + passes on your profile</li>` : ""}${o.pearls ? `<li>🦪 ${o.pearls.toLocaleString()} Pearls added. <a href="#/live">Go tip someone</a></li>` : ""}${o.club ? `<li>🥂 Welcome to the Champagne Club! Ruby OG badge + ${CLUB.joinPearls.toLocaleString()} Pearls are yours. <a href="#/club">Club perks</a></li>` : ""}${o.points ? `<li>⭐ +${o.points.toLocaleString()} hall points</li>` : ""}${o.discount ? `<li>🏷️ Welcome discount: −${money(o.discount)}</li>` : ""}</ul>
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
  const dobEl = $("#wds-dob"); if (dobEl && !dobEl.value) { msg(ERR.dob_required); dobEl.focus(); return; }
  btn.disabled = true; msg("Holding your stuff for 20 minutes…");
  try { const d = await X.api("checkout", { items: BAG, dob: dobEl ? dobEl.value : undefined }); if (dobEl) { const m = X.me(); if (m) m.dobOk = 1; } localStorage.setItem("wd-last-order", d.order.id); msg("Opening secure checkout…"); location.href = d.url; }
  catch (e) { btn.disabled = false; msg(err(e)); if (e.message === "under_21") { const w = $("#wds-dobwrap"); if (w) w.classList.add("bad"); } if (e.data && e.data.sku) loadStock(); }
}
async function cryptoCheckout(btn) {
  const msg = (t) => { const m = $("#wds-comsg"); if (m) m.textContent = t; };
  const eth = window.ethereum; if (!eth) { msg("Open this page in a browser with your crypto account extension, or use the main checkout (it takes crypto too)."); return; }
  btn.disabled = true;
  try {
    const dobEl = $("#wds-dob"); if (dobEl && !dobEl.value) { msg(ERR.dob_required); btn.disabled = false; return; }
    const d = await X.api("checkout", { items: BAG, method: "crypto", dob: dobEl ? dobEl.value : undefined }); const o = d.order, c = d.crypto; localStorage.setItem("wd-last-order", o.id);
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
    const t = e.target.closest("[data-add],[data-inc],[data-dec],[data-rm],[data-openbag],[data-closebag],[data-swapbundle],[data-copy],[data-rx],#wds-pay,#wds-crypto,.cart-link");
    if (!t) return;
    if (t.matches(".cart-link")) { e.preventDefault(); openBag(); return; }
    if (t.dataset.add) { e.preventDefault(); add(t.dataset.add); }
    else if (t.dataset.inc) { e.preventDefault(); add(t.dataset.inc); }
    else if (t.dataset.dec) { e.preventDefault(); setQty(t.dataset.dec, qty(t.dataset.dec) - 1); }
    else if (t.dataset.rm) { e.preventDefault(); const s = sku(t.dataset.rm); setQty(t.dataset.rm, 0); if (s) X.toast(`Removed ${s.name}`); }
    else if (t.dataset.openbag !== undefined) openBag();
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
  document.addEventListener("wd:msg", (e) => { const m = e.detail; if (!m || m.room !== FEED.room) return; FEED.msgs.unshift(m); const f = $("#wds-feed"); if (f) f.innerHTML = FEED.msgs.map(msgHtml).join(""); });
  window.addEventListener("hashchange", () => { closeBag(); if (!/^\/(live|drop\/)/.test(route())) stopFeed(); paintBag(); });
  window.addEventListener("storage", (e) => { if (e.key === BAG_KEY) { try { BAG = JSON.parse(e.newValue || "[]"); } catch {} paintBag(); } });
}
export function bind() { ensureChrome(); paintBag(); }
export function init(ctx) {
  X = ctx; bindOnce(); ensureChrome(); paintBag(); loadStock(); loadTicker();
  setInterval(() => { if (!document.hidden) loadStock(); }, 15000);
  setInterval(() => { if (!document.hidden) loadTicker(); }, 20000);
}
