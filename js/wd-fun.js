/* Wine Detention fun layer: Happy Hour surge banner, free welcome game (wheel or claw), Pearls + tips + gift FX,
   connected accounts, Champagne Club, Detention Radio jukebox (requests, votes, bumps, karaoke / sing-along).
   Everything that matters (points, Pearls, prizes, queue) is decided on the server. */
import { SURGE_TAGLINE, WELCOME_PRIZES, PEARL_PACKS, GIFTS, gift, CONNECT, CLUB, JUKEBOX as J, JUKEBOX_TRACKS, track, POINTS, SURGE_SCHEDULE } from "./wd-rewards.js";
import * as Shop from "./wd-shop.js";
let X = null, SURGE = null, SURGE_AT = 0;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const $ = (s) => document.querySelector(s);
const route = () => (location.hash.replace(/^#/, "").split("?")[0] || "/");
const num = (n) => Number(n || 0).toLocaleString("en-US");
const money = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\.00$/, "");
const shell = (t, inner, sub, cls = "") => `<section class="wdl wdf ${cls}"><header class="wdl-head"><h1>${t}</h1>${sub ? `<p>${sub}</p>` : ""}</header>${inner}</section>`;
const hms = (ms) => { ms = Math.max(0, ms); const h = ms / 36e5 | 0, m = (ms % 36e5) / 6e4 | 0, s = (ms % 6e4) / 1e3 | 0; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0"); };
const ERR = { not_enough_pearls: "Not enough Pearls. Grab a pack first.", not_enough_points: "Not enough hall points.", no_self_tip: "You can't tip yourself, silly.", one_request_at_a_time: "One request at a time (Champagne Club gets two).", queue_full: "The queue is packed. Try again soon.", bad_social_handle: "That handle doesn't look right.", already_claimed: "Already claimed this month.", not_club: "That's a Champagne Club perk.", already_spun: "You already played your free welcome game." };
const err = (e) => ERR[e && e.message] || X.errText(e);

/* ---------------- Happy Hour surge ---------------- */
export function setSurge(s) { if (s) { SURGE = s; SURGE_AT = Date.now(); paintSurge(); } }
async function pullSurge() { try { const d = await X.api("surge"); setSurge(d.surge); } catch {} }
export function surgeMult() { return SURGE && SURGE.active ? SURGE.mult : 1; }
function surgeHtml(full) {
  const s = SURGE; if (!s) return "";
  if (s.active) return `<div class="wdf-surge on" role="status"><span class="wdf-surge-x">${s.mult}x</span><div><b>⚡ ${esc(s.label)} surge</b><small>${s.mult}x hall points on quests, chat, referrals, tips &amp; purchases · ends in <span data-surge-end="${s.endsAt}">${hms(s.endsAt - Date.now())}</span></small>${full ? `<small class="wdf-honest">${esc(SURGE_TAGLINE)}</small>` : ""}</div></div>`;
  if (!full || !s.next) return "";
  return `<div class="wdf-surge"><span class="wdf-surge-x soft">${s.next.mult}x</span><div><b>Next surge: ${esc(s.next.label)}</b><small>starts in <span data-surge-start="${s.next.startsAt}">${hms(s.next.startsAt - Date.now())}</span> · ${esc(SURGE_TAGLINE)}</small></div></div>`;
}
export const surgeSlot = (full) => `<div class="wdf-surge-slot" data-full="${full ? 1 : 0}">${surgeHtml(full)}</div>`;
function paintSurge() {
  document.querySelectorAll(".wdf-surge-slot").forEach((e) => (e.innerHTML = surgeHtml(e.dataset.full === "1")));
  let pill = $("#wdf-surgepill"); const on = SURGE && SURGE.active;
  if (!pill) { pill = document.createElement("a"); pill.id = "wdf-surgepill"; pill.className = "wdf-surgepill"; pill.href = "#/quests"; document.body.appendChild(pill); }
  pill.hidden = !on || !!document.querySelector(".wdf-surge-slot .wdf-surge.on") || !!document.querySelector("#wdm.on"); if (on) pill.innerHTML = `⚡ <b>${SURGE.mult}x</b> ${esc(SURGE.label)} · <span data-surge-end="${SURGE.endsAt}">${hms(SURGE.endsAt - Date.now())}</span>`;
}
setInterval(() => {
  document.querySelectorAll("[data-surge-end]").forEach((e) => { const ms = +e.dataset.surgeEnd - Date.now(); e.textContent = hms(ms); if (ms <= 0) pullSurge(); });
  document.querySelectorAll("[data-surge-start]").forEach((e) => { const ms = +e.dataset.surgeStart - Date.now(); e.textContent = hms(ms); if (ms <= 0) pullSurge(); });
}, 1000);
export const multNote = (d) => d && d.mult > 1 ? ` (${d.mult}x${SURGE && SURGE.active ? " " + SURGE.label : ""})` : "";

/* ---------------- free welcome game: wheel or claw (one play per account) ---------------- */
const SEG = ["#FFE4E6", "#DBEAFE", "#FEF3C7", "#DCFCE7", "#FCE7F3", "#E0E7FF", "#FFEDD5", "#CCFBF1"];
function wheelSvg() {
  const n = WELCOME_PRIZES.length, a = 360 / n, R = 140, c = 150;
  const pt = (deg, r) => [c + r * Math.sin(deg * Math.PI / 180), c - r * Math.cos(deg * Math.PI / 180)];
  return `<svg viewBox="0 0 300 300" class="wdf-wheel-svg" aria-hidden="true">${WELCOME_PRIZES.map((p, i) => { const [x1, y1] = pt(i * a, R), [x2, y2] = pt((i + 1) * a, R), [tx, ty] = pt(i * a + a / 2, 92);
    return `<path d="M${c} ${c}L${x1} ${y1}A${R} ${R} 0 0 1 ${x2} ${y2}z" fill="${SEG[i % SEG.length]}" stroke="#fff" stroke-width="3"/><text x="${tx}" y="${ty}" font-size="26" text-anchor="middle" dominant-baseline="central" transform="rotate(${i * a + a / 2} ${tx} ${ty})">${p.emoji}</text>`; }).join("")}
    <circle cx="150" cy="150" r="140" fill="none" stroke="#0E3386" stroke-width="6"/><circle cx="150" cy="150" r="26" fill="#0E3386"/><text x="150" y="151" fill="#fff" font-size="13" font-weight="800" text-anchor="middle" dominant-baseline="central">FREE</text></svg>`;
}
function clawHtml() {
  const caps = WELCOME_PRIZES.map((p, i) => `<span class="wdf-cap" data-cap="${i}" style="left:${8 + (i % 4) * 22}%;bottom:${8 + (i >> 2) * 26}%;background:${SEG[i % SEG.length]}">${p.emoji}</span>`).join("");
  return `<div class="wdf-claw-box" id="wdf-claw-box"><div class="wdf-claw" id="wdf-claw"><i class="wdf-claw-rope"></i><b class="wdf-claw-head">🪝</b></div>${caps}<div class="wdf-claw-glass"></div></div>`;
}
export function pSpin() {
  const me = X.me(), tot = WELCOME_PRIZES.reduce((s, x) => s + x.w, 0);
  const odds = `<table class="wdl-table"><tr><th>Prize</th><th>Odds</th></tr>${WELCOME_PRIZES.map((x) => `<tr><td>${x.emoji} ${esc(x.label)}</td><td>${(x.w / tot * 100).toFixed(1)}%</td></tr>`).join("")}</table>
   <p class="wdl-fine">One FREE play per account, wheel or claw (same prizes, same odds). There's no way to buy a play. Results are picked on our server with a secure random number. Points and Pearls are virtual and have no cash value; gift credit is not cash. Bonus giveaway entries land when you enter the free giveaway (eligibility rules apply).</p>`;
  let top;
  if (!me) top = X.needLogin("play your free welcome game");
  else if (me.welcome != null && +me.welcome !== -1) { const p = WELCOME_PRIZES.find((x) => x.id === me.welcomePrize); top = `<div class="wdl-card wdl-center wdf-won"><div class="wdf-bigem">${p ? p.emoji : "🎁"}</div><h3>${p ? "You won " + esc(p.label) : "Welcome game played"}</h3><p>Daily quests and Happy Hour surges keep the rewards coming.</p><a class="wdl-btn" href="#/quests">Daily quests</a> <a class="wdl-btn ghost" href="#/jukebox">Jukebox</a></div>`; }
  else top = `<div class="wdl-card wdf-game"><div class="wdl-row wdl-tabs wdf-gtabs"><button class="on" data-game="wheel">🎡 Wheel spin</button><button data-game="claw">🕹️ Claw machine</button></div>
    <div class="wdf-stage" id="wdf-stage"><div class="wdf-wheel" id="wdf-wheel"><div class="wdf-pointer">▼</div><div class="wdf-wheel-rot" id="wdf-wheel-rot">${wheelSvg()}</div></div></div>
    <button class="wdl-btn wdf-play" id="wdf-play">Spin it (free) 🎁</button><p class="wdl-fine wdf-center">One free play. Pick wheel or claw, it's the same prize table.</p></div>`;
  return shell("🎁 Free welcome game", top + `<div class="wdl-card"><h3>Prizes &amp; published odds</h3>${odds}</div>`, "New here? One free play on the house. No purchase, ever.");
}
function bindSpin() {
  let game = "wheel"; const stage = $("#wdf-stage"), play = $("#wdf-play"); if (!stage || !play) return;
  document.querySelectorAll("[data-game]").forEach((b) => (b.onclick = () => { game = b.dataset.game; document.querySelectorAll("[data-game]").forEach((x) => x.classList.toggle("on", x === b));
    stage.innerHTML = game === "claw" ? clawHtml() : `<div class="wdf-wheel" id="wdf-wheel"><div class="wdf-pointer">▼</div><div class="wdf-wheel-rot" id="wdf-wheel-rot">${wheelSvg()}</div></div>`; play.textContent = game === "claw" ? "Drop the claw (free) 🕹️" : "Spin it (free) 🎁"; }));
  play.onclick = async () => {
    play.disabled = true; document.querySelectorAll("[data-game]").forEach((x) => (x.disabled = true));
    let d; try { d = await X.api("play", { game }); } catch (e) { X.toast(err(e)); play.disabled = false; return; }
    const finish = () => { X.setMe(d.me); X.confetti(); setTimeout(X.confetti, 500); const p = d.prize; stage.insertAdjacentHTML("beforeend", `<div class="wdf-prize"><div class="wdf-bigem">${p.emoji}</div><b>You won ${esc(p.label)}!</b><small>${p.kind === "off" ? "Applied automatically at your first checkout." : p.kind === "entries" ? "Added when you enter the free giveaway." : p.kind === "pearls" ? "Tip friends in the Live room and jukebox." : "Already in your account."}</small></div>`); play.outerHTML = `<a class="wdl-btn" href="#/account">See my profile</a>`; };
    if (game === "wheel") { const n = WELCOME_PRIZES.length, a = 360 / n, rot = $("#wdf-wheel-rot"); const deg = 360 * 6 + (360 - (d.index * a + a / 2)) + (Math.random() * a * .6 - a * .3);
      rot.style.transition = "transform 4.2s cubic-bezier(.12,.67,.12,1)"; rot.style.transform = `rotate(${deg}deg)`; setTimeout(finish, 4400); }
    else { const claw = $("#wdf-claw"), cap = document.querySelector(`[data-cap="${d.index}"]`), box = $("#wdf-claw-box"); const br = box.getBoundingClientRect(), cr = cap.getBoundingClientRect();
      claw.style.left = (cr.left - br.left + cr.width / 2) + "px"; setTimeout(() => { claw.classList.add("down"); claw.style.setProperty("--drop", (cr.top - br.top) + "px"); }, 900);
      setTimeout(() => { cap.classList.add("grabbed"); claw.appendChild(cap); claw.classList.remove("down"); }, 2200); setTimeout(finish, 3400); }
  };
}

/* ---------------- Pearls + tips + gift FX ---------------- */
export function fx(giftId) {
  const g = gift(giftId); if (!g) return; const layer = document.createElement("div"); layer.className = "wdf-fx wdf-fx-" + g.fx;
  const n = g.fx === "rain" ? 18 : g.fx === "pop" ? 24 : g.fx === "burst" ? 12 : 8;
  layer.innerHTML = (g.fx === "pop" ? `<b class="wdf-fx-big">🍾</b>` : "") + Array.from({ length: n }, (_, i) => `<i style="--x:${Math.random() * 100}%;--d:${(Math.random() * .6).toFixed(2)}s;--r:${Math.round(Math.random() * 60 - 30)}deg">${g.fx === "pop" ? ["🫧", "✨", "🥂"][i % 3] : g.emoji}</i>`).join("");
  document.body.appendChild(layer); setTimeout(() => layer.remove(), 2600);
}
let TIP = null;
export function openTip(to, room) {
  const me = X.me(); if (!me) { X.openAuth(); return; } if (to === me.handle) { X.toast(ERR.no_self_tip); return; }
  TIP = { to, room: room || "live" }; let el = $("#wdf-tip"); if (!el) { el = document.createElement("div"); el.id = "wdf-tip"; el.className = "wdf-sheetwrap"; document.body.appendChild(el); }
  el.hidden = false; el.innerHTML = `<div class="wdf-sheetback" data-tipclose></div><div class="wdf-sheet" role="dialog" aria-label="Send a gift"><button class="wdm-x" data-tipclose aria-label="Close">×</button><h3>Send @${esc(to)} a gift</h3><p class="wdl-fine">You have <b id="wdf-tipbal">${num(me.pearls)}</b> 🦪 Pearls · they earn hall points when you tip.</p>
    <div class="wdf-gifts">${GIFTS.map((g) => `<button class="wdf-gift" data-sendgift="${g.id}" ${me.pearls < g.cost ? "disabled" : ""}><span>${g.emoji}</span><b>${esc(g.name)}</b><small>${g.cost} 🦪</small></button>`).join("")}</div>
    <a class="wdl-btn ghost" href="#/pearls" data-tipclose>Get Pearls</a><p class="wdl-fine">Pearls are virtual gifts: no cash value, can't be withdrawn or cashed out.</p></div>`;
  requestAnimationFrame(() => el.classList.add("on"));
}
const closeTip = () => { const el = $("#wdf-tip"); if (el) { el.classList.remove("on"); setTimeout(() => (el.hidden = true), 200); } };
async function sendGift(id) {
  const me = X.me(); if (!TIP || !me) return;
  try { const d = await X.api("tip", { to: TIP.to, gift: id, room: TIP.room }); me.pearls = d.pearls; X.setMe(me); fx(id); SEEN.add(d.msg.id); closeTip(); X.toast(`${gift(id).emoji} Sent to @${TIP.to}`); document.dispatchEvent(new CustomEvent("wd:msg", { detail: d.msg })); }
  catch (e) { X.toast(err(e)); }
}
const SEEN = new Set(); let FX_READY = false;
/** Called by the chat feed with fresh messages: animate gifts we haven't seen yet (not on first load). */
export function onFeed(msgs) { const fresh = msgs.filter((m) => m.type === "gift" && !SEEN.has(m.id)); msgs.forEach((m) => SEEN.add(m.id)); if (FX_READY) fresh.slice(0, 2).forEach((m) => fx(m.gift)); FX_READY = true; }
export function pPearls() {
  const me = X.me();
  const packs = PEARL_PACKS.map((p) => `<div class="wdl-card wdf-pack ${p.hot ? "hot" : ""}">${p.hot ? `<span class="wdl-popular">★ Best value</span>` : ""}<div class="wdf-bigem">🦪</div><h3>${num(p.pearls)} Pearls</h3><p class="wdl-tag">${esc(p.name)}${p.bonus ? " · " + p.bonus + " bonus" : ""}</p><p class="wdf-price">${money(p.price)}</p>${Shop.ctl(p.key, "Add " + money(p.price))}</div>`).join("");
  return shell("🦪 Pearls", `${me ? `<div class="wdl-card wdf-bal"><div class="wdf-bigem">🦪</div><div><b>${num(me.pearls)}</b> Pearls<small>Tip in the Live room, chat and jukebox, or bump a song.</small></div><a class="wdl-btn ghost" href="#/live">Go tip someone</a></div>` : X.needLogin("get and send Pearls")}
   <div class="wdf-packs">${packs}</div>
   <h2 class="wdl-h2">Gifts you can send</h2><div class="wdf-gifts wdf-gifts-show">${GIFTS.map((g) => `<button class="wdf-gift" data-demofx="${g.id}"><span>${g.emoji}</span><b>${esc(g.name)}</b><small>${g.cost} 🦪</small></button>`).join("")}</div><p class="wdl-fine">Tap a gift to preview its animation.</p>
   <div class="wdl-card wdl-prose"><h3>The fine print, in plain English</h3><p>Pearls are a virtual item for tipping and sending animated gifts on Wine Detention. They have <b>no cash value</b>, can't be withdrawn, cashed out, sold, transferred off-site or exchanged for money, gift credit, giveaway entries or prizes. Members you tip earn hall points (also no cash value). Packs are sold through our secure checkout (Whop). Purchases are final except where the law says otherwise.</p></div>`, "Virtual gifts for tipping: roses, pearls, prayer beads and a champagne pop. For fun, never cash.");
}

/* ---------------- connected accounts ---------------- */
const providerOn = (p) => { const c = X.client && X.client(); return !!(c && c.projectSettings && (c.projectSettings.providers || []).some((x) => x && x.provider === p && x.enabledAt)); };
export function connectsHtml(p, mine) {
  const cs = (p && p.connects) || {};
  if (!mine) { const ks = CONNECT.filter((c) => cs[c.id]); if (!ks.length) return ""; return `<div class="wdf-links">${ks.map((c) => `<a class="wdf-link" href="${esc(c.url + encodeURIComponent(cs[c.id].h))}" target="_blank" rel="nofollow noopener ugc me">${c.emoji} ${esc(c.name)}${cs[c.id].v ? ` <span class="wdf-ver" title="Verified">✓</span>` : ""}</a>`).join("")}</div>`; }
  return `<div class="wdl-card" id="wdf-connects"><h3>🔗 Connected accounts</h3><p class="wdl-fine">Show off your socials on your profile. +${POINTS.connect} pts each, +${POINTS.connectVerified} when verified (surges apply). Only the handle is shown.</p>
   <div class="wdf-conn">${CONNECT.map((c) => { const v = cs[c.id]; const canVerify = c.verify && providerOn(c.verify);
     return `<div class="wdf-crow"><span class="wdf-cic">${c.emoji}</span><b>${esc(c.name)}</b>${v ? `<span class="wdf-ch">@${esc(v.h)}${v.v ? ` <span class="wdf-ver">✓ verified</span>` : ` <small>unverified</small>`}</span><button class="wds-chip" data-disc="${c.id}">Remove</button>${canVerify && !v.v ? `<button class="wds-chip" data-link="${c.id}">Verify</button>` : ""}`
       : `${canVerify ? `<button class="wdl-btn" data-link="${c.id}">Connect</button>` : ""}<form class="wdf-cform" data-conn="${c.id}"><input placeholder="@handle" aria-label="${esc(c.name)} handle" autocapitalize="none" spellcheck="false"><button class="wds-chip">Add</button></form>`}</div>`; }).join("")}</div></div>`;
}
export async function finishLink(id) { try { const d = await X.api("connect", { id }); X.setMe(d.me); X.toast(d.v ? `✓ ${id} verified` + (d.reward ? ` · +${d.reward.gained} pts` : "") : "Couldn't verify that account yet."); X.rerender(); } catch (e) { X.toast(err(e)); } }

/* ---------------- Champagne Club ---------------- */
export const clubBadge = (p) => p && p.club ? `<span class="wdf-club" title="Champagne Club · Founding OG">🥂 Ruby OG</span>` : "";
export function pClub() {
  const me = X.me(), member = me && me.club; const month = new Date(Date.now() - 7 * 3600e3).toISOString().slice(0, 7);
  return shell("🥂 Champagne Club", `<div class="wdf-clubhero"><div class="wdf-gem">💎</div><span class="wdl-tag">Founding OG · Ruby tier</span><h2>${money(CLUB.price)} <small>one-time, founding members only</small></h2><p>The VIP lounge of detention. Lifetime-ish founding perks for the OGs who back us early. Not alcohol.</p>
    ${member ? `<p class="wdf-in">✓ You're in, @${esc(me.handle)} ${clubBadge(me)}</p>${me.clubMonth === month ? `<p class="wdl-fine">This month's ${CLUB.monthlyPearls} Pearls: claimed ✓</p>` : `<button class="wdl-btn" id="wdf-clubclaim">Claim ${CLUB.monthlyPearls} monthly Pearls 🦪</button>`}` : `${Shop.stockLine("club")}${Shop.ctl("club", "Join the Club · " + money(CLUB.price))}`}</div>
   <div class="wdl-card"><h3>Perks</h3><ul class="wds-perks">${CLUB.perks.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
   <div class="wdl-grid3"><div class="wdl-card"><h3>💎 Ruby · Founding OG</h3><p>${money(CLUB.price)} once. Founding run is limited (real count above).</p></div><div class="wdl-card wdf-dim"><h3>🔷 Sapphire</h3><p>Coming later.</p></div><div class="wdl-card wdf-dim"><h3>🤍 Platinum</h3><p>Coming later.</p></div></div>
   <div class="wdl-card wdl-prose"><h3>Good to know</h3><p>One-time founding price through secure checkout (card, Apple Pay, Google Pay, Cash App Pay, crypto). Crypto checkout is one-time only, which is why the founding tier is a one-time price rather than a subscription. Perks are for your Wine Detention account, have no cash value and can change with notice; monthly Pearls are claimed once per calendar month (Arizona time). Down the road we may extend Club perks to supporters on Twitch, YouTube, Kick, Telegram and Spotify.</p></div>`, "Badge flair, 2x points, monthly Pearls, early drops and jukebox priority.", "wdf-clubpage");
}

/* ---------------- Detention Radio jukebox ---------------- */
let JB = { now: null, queue: [], skew: 0, t: null, listening: false, karaoke: false, voted: new Set(JSON.parse(localStorage.getItem("wd-jbv") || "[]")) };
let AUDIO = null, ACTX = null, ANA = null, RAF = 0;
const jbNowMs = () => Date.now() + JB.skew;
async function pullJb() { try { const d = await X.api("jb"); JB.skew = d.serverNow - Date.now(); const changed = !JB.now || !d.now || JB.now.track !== d.now.track || JB.now.startedAt !== d.now.startedAt; JB.now = d.now; JB.queue = d.queue || []; paintJb(); if (changed && JB.listening) syncAudio(); } catch (e) {} }
function syncAudio() {
  if (!JB.now) return; const t = track(JB.now.track); if (!t) return;
  if (!AUDIO) { AUDIO = new Audio(); AUDIO.preload = "auto"; AUDIO.crossOrigin = "anonymous"; AUDIO.onended = () => setTimeout(pullJb, 400); }
  const pa = document.getElementById("party-audio"); if (pa && !pa.paused) pa.pause();
  const off = Math.max(0, (jbNowMs() - JB.now.startedAt) / 1000);
  if (!AUDIO.src.endsWith(t.src)) AUDIO.src = t.src;
  const go = () => { try { AUDIO.currentTime = Math.min(off, t.dur - 1); } catch {} AUDIO.play().catch(() => { JB.listening = false; paintJb(); }); };
  if (AUDIO.readyState >= 1) go(); else AUDIO.onloadedmetadata = go;
  try { if (!ACTX) { ACTX = new (window.AudioContext || window.webkitAudioContext)(); const src = ACTX.createMediaElementSource(AUDIO); ANA = ACTX.createAnalyser(); ANA.fftSize = 64; src.connect(ANA); ANA.connect(ACTX.destination); } ACTX.resume && ACTX.resume(); } catch {}
  viz();
}
function viz() {
  cancelAnimationFrame(RAF); const bars = document.querySelectorAll(".wdf-viz i"); if (!bars.length) return;
  const data = ANA ? new Uint8Array(ANA.frequencyBinCount) : null;
  const loop = () => { if (data && JB.listening) { ANA.getByteFrequencyData(data); bars.forEach((b, i) => (b.style.height = (12 + data[(i * 2) % data.length] / 255 * 88) + "%")); } RAF = requestAnimationFrame(loop); };
  if (data) loop();
}
function nowHtml() {
  const n = JB.now, t = n && track(n.track); if (!t) return `<div class="wdl-card"><p>Tuning in…</p></div>`;
  const el = Math.max(0, (jbNowMs() - n.startedAt) / 1000), pct = Math.min(100, el / t.dur * 100);
  const lyr = t.lyrics && t.lyrics.length ? t.lyrics : null;
  const kara = JB.karaoke ? (lyr ? `<div class="wdf-lyrics" id="wdf-lyrics">${lyr.map(([s, l]) => `<p data-at="${s}">${esc(l)}</p>`).join("")}</div>` : `<div class="wdf-sing"><b>🎤 Sing-along mode</b><span class="wdf-sing-t" id="wdf-sing-t">${hms((t.dur - el) * 1000)}</span><small>No lyrics on file for this one, so freestyle it. Make it up, hum it, own it.</small></div>`) : "";
  return `<div class="wdl-card wdf-now ${JB.karaoke ? "kara" : ""}"><div class="wdf-now-top"><div class="wdf-disc ${JB.listening ? "spin" : ""}">💿</div><div><span class="wdl-tag">Now playing for everyone</span><h3>${esc(t.title)}</h3><p>${esc(t.artist)}${n.by ? ` · requested by <a href="#/u/${esc(n.by)}">@${esc(n.by)}</a>${n.club ? " 🥂" : ""}` : " · Detention Radio rotation"}</p></div></div>
    <div class="wdf-viz ${JB.listening ? "on" : ""}">${Array.from({ length: 24 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div>
    <div class="wdf-prog"><i id="wdf-prog" style="width:${pct}%"></i></div><div class="wdf-times"><span id="wdf-el">${hms(el * 1000)}</span><span>${hms(t.dur * 1000)}</span></div>${kara}
    <div class="wdl-row"><button class="wdl-btn" id="wdf-listen">${JB.listening ? "⏸ Stop listening" : "🎧 Listen along"}</button><button class="wdl-btn ghost" id="wdf-kara">${JB.karaoke ? "Exit karaoke" : "🎤 Karaoke mode"}</button>${n.by ? `<button class="wdl-btn ghost" data-tip="${esc(n.by)}" data-tiproom="jukebox">🎁 Tip the DJ</button>` : ""}</div></div>`;
}
function queueHtml() {
  const me = X.me();
  if (!JB.queue.length) return `<p class="wdl-fine">Queue's empty. Request a song below and it plays next.</p>`;
  return `<ol class="wdf-q">${JB.queue.map((q, i) => { const t = track(q.track); return `<li><span class="wdf-qn">${i + 1}</span><div><b>${esc(t ? t.title : q.track)}</b><small>@${esc(q.handle)}${q.club ? " 🥂 priority" : ""} · ${q.votes} vote${q.votes === 1 ? "" : "s"}${q.boost ? ` · ⚡+${q.boost}` : ""}</small></div>
    <div class="wdf-qa"><button class="wds-chip" data-jbvote="${q.id}" ${JB.voted.has(q.id) ? "disabled" : ""}>👍 ${q.score}</button>${me ? `<button class="wds-chip" data-jbbump="${q.id}" title="Bump: ${J.bumpPoints} pts or ${J.bumpPearls} Pearls">⚡ Bump</button>` : ""}${me && me.handle !== q.handle ? `<button class="wds-chip" data-tip="${esc(q.handle)}" data-tiproom="jukebox">🎁</button>` : ""}</div></li>`; }).join("")}</ol>`;
}
function paintJb() { const a = $("#wdf-now"); if (a) { a.innerHTML = nowHtml(); bindNow(); } const b = $("#wdf-queue"); if (b) b.innerHTML = queueHtml(); }
function bindNow() {
  const l = $("#wdf-listen"); if (l) l.onclick = () => { JB.listening = !JB.listening; if (JB.listening) syncAudio(); else if (AUDIO) AUDIO.pause(); paintJb(); };
  const k = $("#wdf-kara"); if (k) k.onclick = () => { JB.karaoke = !JB.karaoke; paintJb(); };
  if (JB.listening) viz();
}
setInterval(() => {
  if (!$("#wdf-now") || !JB.now) return; const t = track(JB.now.track); if (!t) return; const el = Math.max(0, (jbNowMs() - JB.now.startedAt) / 1000);
  const p = $("#wdf-prog"); if (p) p.style.width = Math.min(100, el / t.dur * 100) + "%"; const e = $("#wdf-el"); if (e) e.textContent = hms(el * 1000);
  const s = $("#wdf-sing-t"); if (s) s.textContent = hms((t.dur - el) * 1000);
  document.querySelectorAll("#wdf-lyrics p").forEach((x, i, all) => x.classList.toggle("on", +x.dataset.at <= el && (!all[i + 1] || +all[i + 1].dataset.at > el)));
  if (el > t.dur + 1) pullJb();
}, 500);
export function pJukebox() {
  setTimeout(() => { pullJb(); clearInterval(JB.t); JB.t = setInterval(() => { if (!$("#wdf-now")) { clearInterval(JB.t); return; } if (!document.hidden) pullJb(); }, 5000); }, 0);
  const me = X.me();
  const cat = JUKEBOX_TRACKS.map((t) => `<div class="wdf-trk"><span>🎵</span><div><b>${esc(t.title)}</b><small>${esc(t.artist)} · ${hms(t.dur * 1000)}${t.lyrics ? " · 🎤 lyrics" : ""}</small></div><button class="wds-chip" data-jbreq="${t.id}">${me ? "Request" : "Sign in to request"}</button></div>`).join("");
  return shell("🎶 Detention Radio Jukebox", `${surgeSlot(false)}<div class="wdf-jbgrid"><div><div id="wdf-now">${nowHtml()}</div>
    <div class="wdl-card"><h3>Up next</h3><div id="wdf-queue">${queueHtml()}</div><p class="wdl-fine">Most votes play first. Bump a request with ${J.bumpPoints} hall points or ${J.bumpPearls} Pearls (+${J.bumpBoost}). Champagne Club requests get priority. One request at a time (Club: two), ${J.perHour} per hour.</p></div>
    <div class="wdl-card"><h3>Request a song</h3><div class="wdf-cat">${cat}</div><p class="wdl-fine">In-house Detention Radio catalog only. No licensed music.</p></div></div>
    <div>${Shop.chatBox("jukebox", "💬 Jukebox chat")}</div></div>`, "Request songs, vote them up, sing along. Everyone hears the same track at the same time.");
}

/* ---------------- events ---------------- */
let bound = false;
function bindOnce() {
  if (bound) return; bound = true;
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-tip],[data-sendgift],[data-tipclose],[data-demofx],[data-jbreq],[data-jbvote],[data-jbbump],[data-disc],[data-link],#wdf-clubclaim");
    if (!t) return;
    if (t.dataset.tip) { e.preventDefault(); openTip(t.dataset.tip, t.dataset.tiproom); }
    else if (t.dataset.sendgift) sendGift(t.dataset.sendgift);
    else if (t.dataset.tipclose !== undefined) closeTip();
    else if (t.dataset.demofx) fx(t.dataset.demofx);
    else if (t.dataset.jbreq) { if (!X.me()) { X.openAuth(); return; } try { const d = await X.api("jbreq", { track: t.dataset.jbreq }); JB.queue = d.queue; JB.voted.add(d.id); localStorage.setItem("wd-jbv", JSON.stringify([...JB.voted].slice(-50))); paintJb(); X.toast(d.merged ? "Already queued: added your vote 👍" : "Requested! 🎶"); } catch (er) { X.toast(err(er)); } }
    else if (t.dataset.jbvote) { if (!X.me()) { X.openAuth(); return; } try { const d = await X.api("jbvote", { id: t.dataset.jbvote }); JB.voted.add(t.dataset.jbvote); localStorage.setItem("wd-jbv", JSON.stringify([...JB.voted].slice(-50))); JB.queue = d.queue; paintJb(); } catch (er) { X.toast(err(er)); } }
    else if (t.dataset.jbbump) { const me = X.me(); const usePearls = me.pearls >= J.bumpPearls && (me.points < J.bumpPoints || confirm(`Bump with ${J.bumpPearls} Pearls? (Cancel = use ${J.bumpPoints} hall points)`));
      try { const d = await X.api("jbbump", { id: t.dataset.jbbump, with: usePearls ? "pearls" : "points" }); X.setMe(d.me); JB.queue = d.queue; paintJb(); X.toast("⚡ Bumped!"); } catch (er) { X.toast(err(er)); } }
    else if (t.dataset.disc) { try { const d = await X.api("disconnect", { id: t.dataset.disc }); X.setMe(d.me); X.rerender(); } catch (er) { X.toast(err(er)); } }
    else if (t.dataset.link) { const c = CONNECT.find((x) => x.id === t.dataset.link); const D = X.D(); if (!c || !D) return; sessionStorage.setItem("wd-linking", c.id); sessionStorage.setItem("wd-after-login", "#/account");
      try { await D.signInWithSocialRedirect({ provider: c.verify, redirectUrl: location.origin + "/" }); } catch (er) { sessionStorage.removeItem("wd-linking"); X.toast("Couldn't open " + c.name + ". Add your handle instead."); } }
    else if (t.id === "wdf-clubclaim") { try { const d = await X.api("clubclaim", {}); X.setMe(d.me); fx("pearl"); X.toast(`+${CLUB.monthlyPearls} Pearls 🦪`); X.rerender(); } catch (er) { X.toast(err(er)); } }
  });
  document.addEventListener("submit", async (e) => {
    const f = e.target.closest("[data-conn]"); if (!f) return; e.preventDefault();
    const v = f.querySelector("input").value.trim(); if (!v) return;
    try { const d = await X.api("connect", { id: f.dataset.conn, handle: v }); X.setMe(d.me); X.toast(`Linked ${f.dataset.conn}` + (d.reward ? ` · +${d.reward.gained} pts${multNote(d.reward)}` : "")); X.rerender(); } catch (er) { X.toast(err(er)); }
  });
  document.addEventListener("wd:feed", (e) => onFeed(e.detail || []));
}
export function bind(r) { if (r === "/spin") bindSpin(); if (r === "/jukebox") bindNow(); paintSurge(); }
export function init(ctx) { X = ctx; bindOnce(); setInterval(() => { if (!document.hidden) pullSurge(); }, 60000); }
