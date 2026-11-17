import * as GWPage from "./wd-giveaway.js";
import * as Shop from "./wd-shop.js";
import { bannerSvg, qrSvg } from "./wd-art.js";
import * as Fun from "./wd-fun.js";
import { flashEnd } from "./wd-catalog.js";
/* Wine Detention live layer: sign-in (Dynamic headless SDK, never named in the UI), KV accounts, profiles,
   shop (wd-shop.js: bag, Whop checkout, stock, live chat), giveaway, waitlist.
   Loaded as a module after the main app script. Owns the routes listed in OWN. */
const C = window.WD_CONFIG || {}, V = C.DYNAMIC_SDK_VERSION || "1.39.1";
const W = () => window.WD || {};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\.00$/, "");
const $ = (s) => document.querySelector(s);
const OWN = /^\/(login|signup|account|spin|jukebox|club|pearls|quests|leaderboard|collections|product\/.+|cart|checkout|confirmation|gifts(\/.*)?|vip|giveaway|giveaways|policy\/(privacy|terms)|partners|u\/.+|socials|how-it-works|shop|hall-passes|drop\/[a-z0-9]+|orders|live)$/;
let SRV = null, D = null, client = null, ME = null, DONE = {}, MDONE = {}, OV = null, authState = "loading", authMsg = "", LAST_HASH = "";
const curRoute = () => location.hash.replace(/^#/, "").split("?")[0] || "/";
const padNo = (n) => "#" + String(+n || 0).padStart(4, "0");

/* ---------- avatars (deterministic cartoon wine glass) ---------- */
const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
export function avatar(seed, size = 48) {
  const h = hash(seed), hue = h % 360, wine = ["#9B1B30", "#CC3433", "#E7A0B4", "#F2D16B", "#7A1F4A"][h % 5], eyes = ["dots", "happy", "wink", "shades"][(h >> 3) % 4], mouth = ["smile", "o", "grin"][(h >> 6) % 3];
  const E = { dots: '<circle cx="42" cy="40" r="3.5" fill="#161823"/><circle cx="58" cy="40" r="3.5" fill="#161823"/>', happy: '<path d="M38 41q4-5 8 0M54 41q4-5 8 0" stroke="#161823" stroke-width="3" fill="none" stroke-linecap="round"/>', wink: '<circle cx="42" cy="40" r="3.5" fill="#161823"/><path d="M54 40h8" stroke="#161823" stroke-width="3" stroke-linecap="round"/>', shades: '<rect x="35" y="35" width="13" height="8" rx="3" fill="#161823"/><rect x="52" y="35" width="13" height="8" rx="3" fill="#161823"/><path d="M48 38h4" stroke="#161823" stroke-width="2"/>' }[eyes];
  const M = { smile: '<path d="M44 50q6 6 12 0" stroke="#161823" stroke-width="3" fill="none" stroke-linecap="round"/>', o: '<ellipse cx="50" cy="52" rx="3.5" ry="4.5" fill="#161823"/>', grin: '<path d="M43 49h14q-2 8-7 8t-7-8z" fill="#161823"/>' }[mouth];
  return `<svg class="wdl-av" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><rect width="100" height="100" rx="50" fill="hsl(${hue} 85% 92%)"/><path d="M28 24h44q2 30-22 38-24-8-22-38z" fill="#fff" stroke="#0E3386" stroke-width="3"/><path d="M30 34h40q-2 22-20 27-18-5-20-27z" fill="${wine}"/>${E}${M}<path d="M50 62v18M38 82h24" stroke="#0E3386" stroke-width="4" stroke-linecap="round"/></svg>`;
}

const COVERS = ["linear-gradient(135deg,#FFE3E3,#E3ECFF)", "linear-gradient(135deg,#FFF6DA,#F6E3B4)", "linear-gradient(135deg,#E8F7EE,#D8ECFF)", "linear-gradient(135deg,#FCE7F3,#FFE4E6)", "linear-gradient(135deg,#EDE9FE,#FCE7F3)", "linear-gradient(135deg,#E0F2FE,#F0FDFA)", "linear-gradient(135deg,#FEF3C7,#FFE4E6)", "linear-gradient(135deg,#F3F6FF,#FFFFFF)", "repeating-linear-gradient(45deg,#FFF1F2 0 18px,#FFE4E6 18px 36px)", "repeating-linear-gradient(90deg,#EEF2FF 0 22px,#E0E7FF 22px 44px)", "radial-gradient(circle at 20% 30%,#FDE68A,transparent 40%),radial-gradient(circle at 80% 60%,#FBCFE8,transparent 45%),#FFFBEB", "radial-gradient(circle at 30% 70%,#C7D2FE,transparent 45%),radial-gradient(circle at 75% 25%,#FECACA,transparent 40%),#F8FAFC"];
const coverCss = (c) => COVERS[+c || 0] || COVERS[0];
const av = (p, size = 48) => p && +p.hasAv ? `<img class="wdl-av" src="/api/wd?a=av&h=${encodeURIComponent(p.handle)}&v=${p.hasAv}" width="${size}" height="${size}" alt="" style="object-fit:cover">` : avatar((p && p.avSeed) || "x", size);
function resizeImg(file) { return new Promise((ok, no) => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"), S = 256, m = Math.min(img.width, img.height); c.width = c.height = S; c.getContext("2d").drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S); let q = .85, d; do { d = c.toDataURL("image/jpeg", q); q -= .1; } while (d.length > 68000 && q > .3); ok(d); }; img.onerror = no; img.src = URL.createObjectURL(file); }); }
/* ---------- API ---------- */
async function api(a, body, get) {
  const headers = { "Content-Type": "application/json" }; if (client && client.token) headers.Authorization = "Bearer " + client.token;
  const r = await fetch("/api/wd?a=" + a + (get || ""), body === undefined ? { headers } : { method: "POST", headers, body: JSON.stringify(body || {}) });
  let d; try { d = await r.json(); } catch { d = { ok: false, error: "api_unavailable" }; }
  if (!r.ok || !d.ok) throw Object.assign(new Error(d.error || "error"), { status: r.status, data: d }); return d;
}
const ERR = { needs_more_auth: "Almost there: finish the sign-in step, then try again.", invalid_token: "Your sign-in expired. Sign in again.", not_yet: "Not done yet. Finish the task first.", store_not_configured: "Accounts are opening soon. Try again shortly.", auth_not_configured: "Accounts are opening soon.", already_spun: "You already took your Welcome Spin.", already_done: "Already claimed today. Come back tomorrow.", handle_taken: "That handle is taken.", bad_handle: "Handles are 3–20 letters, numbers or _.", bad_code: "That code wasn't found.", code_used: "That code was already redeemed.", bad_email: "Enter a valid email.", api_unavailable: "Service unavailable. Try again soon." };
const errText = (e) => ERR[e && e.message] || (e && e.message) || "Something went wrong";
const toast = (m) => (W().toast ? W().toast(m) : alert(m));
const rerender = () => W().render && W().render();

/* ---------- offers (config + admin overrides) ---------- */
const cfg = () => { const o = OV || {}; return { WHOP: { ...(C.WHOP_LINKS || {}), ...(o.WHOP_LINKS || {}) }, PARTNERS: o.PARTNERS || C.PARTNERS || [], LOCKERS: { ...(C.LOCKERS || {}), ...(o.LOCKERS || {}) }, OFFERS: o.OFFERS || C.OFFERS || [], VIP: o.VIP_TIERS || C.VIP_TIERS || [], MORE: o.MORE_DROPS || C.MORE_DROPS || [], BUNDLE: o.VIP_BUNDLE || C.VIP_BUNDLE, BONUS: o.GIFT_BONUS || C.GIFT_BONUS || { pct: 0 } }; };
const GIFTS = [175, 350, 500, 1000];
const vipFlair = (m) => { if (!m || !m.vip) return Fun.clubBadge(m); const t = ([...cfg().VIP, ...cfg().MORE, { ...(cfg().BUNDLE || {}), theme: "champagne" }].find((x) => x.key === m.vip) || {}); return `<span class="wdl-flair wdl-th-${esc(t.theme || "pass")}">${esc(t.emoji || "⭐")} OG Founding VIP #${m.vipNo} · ${esc(t.name || "")}</span>${Fun.clubBadge(m)}`; };
const BAGKEY = (key) => key.replace(/^gift-(\d+)$/, "gift$1");
function buyBtn(key, label) {
  const k = BAGKEY(key); if (Shop.sku && Shop.sku(k)) return Shop.stockLine(k) + Shop.ctl(k);
  const url = cfg().WHOP[key];
  return url ? `<a class="wdl-btn" href="${esc(url)}" target="_blank" rel="noopener">${esc(label || "Buy now")}</a>` : `<button class="wdl-btn ghost" data-notify="${esc(key)}">Notify me</button>`;
}
function partnerOf(slug) { const L = cfg().LOCKERS[slug] || {}; const p = cfg().PARTNERS.find((x) => x.id === L.partner); return { L, p }; }
function refUrl(u) { if (!u) return ""; try { const x = new URL(u); if (ME) x.searchParams.set("ref", ME.handle); else x.searchParams.set("ref", "winedetention"); return x.toString(); } catch { return ""; } }

/* ---------- auth (Dynamic headless SDK) ---------- */
async function bootAuth() {
  try { SRV = await api("config", undefined); } catch (e) { SRV = { dynamicEnvId: null, store: false, welcome: [], quests: [] }; }
  try { OV = (await api("offers")).overrides; } catch {}
  Fun.setSurge(SRV.surge);
  if (!SRV.dynamicEnvId || !SRV.store) { authState = "soon"; authMsg = ""; rerender(); if (AUTH.open) paintAuthModal(); return; }
  try {
    const [core, evm] = await Promise.all([import(`https://esm.sh/@dynamic-labs-sdk/client@${V}`), import(`https://esm.sh/@dynamic-labs-sdk/evm@${V}`).catch(() => null)]);
    D = core; client = D.createDynamicClient({ autoInitialize: false, environmentId: SRV.dynamicEnvId, metadata: { name: "Wine Detention", universalLink: location.origin } });
    evm && evm.addEvmExtension && evm.addEvmExtension();
    await D.initializeClient(); authState = "ready";
    let redirected = false;
    try { const u = new URL(location.href); if (await D.detectSocialRedirectUrl({ url: u })) { redirected = true; await D.completeSocialRedirect({ url: u }); D.removeDynamicOauthParamsFromUrl && D.removeDynamicOauthParamsFromUrl(); const back = sessionStorage.getItem("wd-after-login"); sessionStorage.removeItem("wd-after-login"); history.replaceState(null, "", location.pathname + (back || "#/account")); } } catch (e) { authMsg = "Sign-in didn't finish. Try again."; }
    if (D.isSignedIn()) await loadMe();
    if (redirected && ME) { const link = sessionStorage.getItem("wd-linking"); sessionStorage.removeItem("wd-linking"); if (link) Fun.finishLink(link); else if (!ME.claimed) openAuth(); }
  } catch (e) { authState = "error"; authMsg = String((e && e.message) || e); console.warn("Dynamic init failed", e); }
  rerender(); if (AUTH.open) paintAuthModal();
}
async function loadMe() {
  try { const d = await api("me", { ref: localStorage.getItem("wd-ref") || "" }); ME = d.me; DONE = d.done || {}; MDONE = d.milestones || {}; localStorage.removeItem("wd-ref"); Shop.syncOnLogin(); Fun.setSurge(d.surge);
    if (ME.age21) passGate(); else if (gateOk()) api("age", { ok: true }).catch(() => {}); }
  catch (e) { ME = null; authMsg = errText(e); }
  W().paintAuth && W().paintAuth();
}
async function logout() { ME = null; try { D && (await D.logout()); } catch {} rerender(); W().paintAuth && W().paintAuth(); }

/* ---------- pages ---------- */
const shell = (title, inner, sub) => `<section class="wdl"><header class="wdl-head"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</header>${inner}</section>`;
const LEGAL = `<p class="wdl-fine">Must be 21+. Nothing sold on this site is alcohol. Hall points are free, for fun and have no cash value.</p>`;
const needLogin = (what) => authState === "soon" ? `<div class="wdl-card"><h3>Accounts opening soon</h3><p>Sign-in launches shortly. Join the list and we'll tell you when ${esc(what)} opens.</p>${notifyForm("accounts")}</div>` : `<div class="wdl-card"><h3>Sign in to ${esc(what)}</h3><p>Free and quick: we email you a 6-digit code. No password to remember.</p><a class="wdl-btn" href="#/login" onclick="sessionStorage.setItem('wd-after-login', location.hash)">Sign in / sign up</a></div>`;
const notifyForm = (item) => `<form class="wdl-notify" data-item="${esc(item)}"><input type="email" required placeholder="you@email.com" aria-label="Email"><button class="wdl-btn">Notify me</button></form>`;

/* ---------- sign in / sign up: one clean popup ("Claim your @") ---------- */
const SOCIAL = { google: "Continue with Google", apple: "Continue with Apple", twitter: "Continue with X", discord: "Continue with Discord", tiktok: "Continue with TikTok", twitch: "Continue with Twitch" };
const SOC_IC = { google: "G", apple: "", twitter: "𝕏", discord: "◎", tiktok: "♪", twitch: "◆" };
const gateOk = () => { try { return localStorage.getItem("wd-gate") === "1"; } catch { return false; } };
const passGate = () => { try { localStorage.setItem("wd-gate", "1"); document.cookie = "wd21=1; max-age=31536000; path=/; samesite=lax"; } catch {} if (W().passGate) W().passGate(); const g = document.getElementById("age-gate"); if (g) g.classList.add("hidden"); };
let AUTH = { open: false, step: "email", email: "", ver: null, next: "" };
const LOGO_MARK = `<svg class="wdm-mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#0E3386"/><path d="M19 13h26c1.3 13-4.4 23.4-13 25.6C23.4 36.4 17.7 26 19 13z" fill="#fff"/><path d="M20.6 22h22.8c-1.2 8.4-5.4 14-11.4 15.4C26 36 21.8 30.4 20.6 22z" fill="#CC3433"/><circle cx="28" cy="27" r="1.8" fill="#fff"/><circle cx="36" cy="27" r="1.8" fill="#fff"/><path d="M28.5 31.5q3.5 3 7 0" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/><rect x="30.6" y="38" width="2.8" height="10" fill="#fff"/><rect x="23" y="47.5" width="18" height="4" rx="2" fill="#fff"/><circle cx="49" cy="15" r="8" fill="#CC3433" stroke="#fff" stroke-width="2.5"/><rect x="47.8" y="10.4" width="2.4" height="6" rx="1.2" fill="#fff"/><circle cx="49" cy="19.3" r="1.4" fill="#fff"/></svg>`;
export function openAuth(next) {
  AUTH.open = true; if (next) AUTH.next = next; else if (!AUTH.next) AUTH.next = location.hash && !/login|signup/.test(location.hash) ? location.hash : "";
  if (ME) AUTH.step = !ME.claimed ? "claim" : "done";
  else if (AUTH.step !== "otp") AUTH.step = "email";
  let el = $("#wdm"); if (!el) { el = document.createElement("div"); el.id = "wdm"; el.className = "wdm-wrap"; document.body.appendChild(el); }
  el.hidden = false; document.body.classList.add("wdm-locked"); paintAuthModal(); requestAnimationFrame(() => el.classList.add("on"));
}
export function closeAuth() {
  AUTH.open = false; const el = $("#wdm"); if (!el) return; el.classList.remove("on"); document.body.classList.remove("wdm-locked");
  setTimeout(() => { if (!AUTH.open) el.hidden = true; }, 220);
  if (AUTH.step === "done" || AUTH.step === "claim") AUTH.step = "email";
}
function modalBody() {
  const fine = `<p class="wdm-fine">By continuing you confirm you're 21+ and agree to the <a href="#/policy/terms" data-wdm-close>Terms</a> &amp; <a href="#/policy/privacy" data-wdm-close>Privacy</a>. Nothing here is alcohol.</p>`;
  if (authState === "loading") return `<div class="wdm-center"><div class="wdm-spin"></div><p>Warming up the hall…</p></div>`;
  if (authState === "soon" || authState === "error") return `<h2 id="wdm-t">Accounts open soon 🎟️</h2><p class="wdm-sub">Drop your email and we'll ping you the second sign-ups open.</p>${notifyForm("accounts")}`;
  const s = AUTH.step;
  if (s === "otp") return `<h2 id="wdm-t">Check your inbox 📬</h2><p class="wdm-sub">We sent a 6-digit code to <b>${esc(AUTH.email)}</b></p>
    <form id="wdm-otp" class="wdm-form"><input id="wdm-code" class="wdm-code" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" maxlength="6" placeholder="••••••" aria-label="6-digit code" required><button class="wdl-btn wdm-go" type="submit">Let me in</button></form>
    <div class="wdm-row"><button class="wdm-link" type="button" id="wdm-resend">Resend code</button><button class="wdm-link" type="button" id="wdm-back">Use a different email</button></div><p id="wdm-msg" class="wdm-msg" role="status">${esc(authMsg)}</p>`;
  if (s === "claim" && ME) return `<div class="wdm-claimtop">${av(ME, 64)}<span class="wdm-badge">Member ${padNo(ME.member)}</span></div><h2 id="wdm-t">Claim your @</h2><p class="wdm-sub">This is your name in the hall, on the leaderboard and in your share link. You can change it later.</p>
    <form id="wdm-claim" class="wdm-form"><label class="wdm-at"><span>@</span><input id="wdm-handle" value="${esc(ME.handle)}" maxlength="20" autocapitalize="none" autocomplete="off" spellcheck="false" aria-label="Username"></label><p id="wdm-avail" class="wdm-avail" aria-live="polite"></p>
    <button class="wdl-btn wdm-go" id="wdm-claim-go" type="submit">Claim @${esc(ME.handle)}</button></form>
    <div class="wdm-row"><button class="wdm-link" type="button" id="wdm-shuffle">🎲 Shuffle a random one</button></div><p id="wdm-msg" class="wdm-msg" role="status"></p>`;
  if (s === "done" && ME) return `<div class="wdm-center"><div class="wdm-pop">🎉</div><h2 id="wdm-t">You're in, @${esc(ME.handle)}</h2><p class="wdm-sub">Member ${padNo(ME.member)} · welcome to detention.</p>
    ${ME.welcome == null ? `<a class="wdl-btn wdm-go" href="#/spin" data-wdm-close>🎁 Play your free welcome game</a>` : `<button class="wdl-btn wdm-go" data-wdm-close>Let's go</button>`}<a class="wdm-link" href="#/account" data-wdm-close>See my profile</a></div>`;
  return `<h2 id="wdm-t">Claim your @</h2><p class="wdm-sub">Free hall pass: member number, your own @, a fresh profile pic and a free welcome game. No password.</p>
    <form id="wdm-email" class="wdm-form"><input id="wdm-em" type="email" required placeholder="you@email.com" autocomplete="email" aria-label="Email" value="${esc(AUTH.email)}">
    ${gateOk() ? "" : `<label class="wdm-21"><input type="checkbox" id="wdm-21" required> <span>I'm 21 or older 🍷</span></label>`}
    <button class="wdl-btn wdm-go" type="submit">Email me a code</button></form>
    <div id="wdm-social" class="wdm-social"></div>
    <details class="wdm-more" id="wdm-more" hidden><summary>More ways to sign in</summary><div id="wdm-ext" class="wdm-social"></div></details>
    <p id="wdm-msg" class="wdm-msg" role="status">${esc(authMsg)}</p>${fine}`;
}
function paintAuthModal() {
  const el = $("#wdm"); if (!el) return;
  el.innerHTML = `<div class="wdm-back" data-wdm-close></div><div class="wdm" role="dialog" aria-modal="true" aria-labelledby="wdm-t"><button class="wdm-x" data-wdm-close aria-label="Close">×</button><div class="wdm-head">${LOGO_MARK}<span>Wine Detention</span></div><div class="wdm-body">${modalBody()}</div></div>`;
  bindAuthModal(); bind(curRoute());
  const f = el.querySelector("#wdm-code, #wdm-handle, #wdm-em"); if (f && !("ontouchstart" in window)) setTimeout(() => f.focus(), 60);
}
const nice = (err) => { const m = String((err && err.message) || err || ""); return /rate|too many/i.test(m) ? "Too many tries. Give it a minute." : /invalid|incorrect|expired/i.test(m) ? "That code didn't work. Check it and try again." : "Something went sideways. Try again."; };
async function finishLogin() {
  const msg = (t) => { const m = $("#wdm-msg"); if (m) m.textContent = t; };
  msg("You're in. Setting up your hall pass…"); await loadMe();
  if (!ME) { msg(authMsg || "Couldn't finish sign-in."); return; }
  if (gateOk() && !ME.age21) api("age", { ok: true }).catch(() => {});
  passGate(); AUTH.step = ME.claimed ? "done" : "claim"; paintAuthModal(); rerender();
}
function bindAuthModal() {
  const msg = (t) => { const m = $("#wdm-msg"); if (m) m.textContent = t; };
  const ef = $("#wdm-email"); if (ef) ef.onsubmit = async (e) => { e.preventDefault(); if (!D) return; const c = $("#wdm-21"); if (c && !c.checked) { msg("Tap “I'm 21 or older” first."); return; } if (c) passGate();
    AUTH.email = $("#wdm-em").value.trim(); msg("Sending your code…"); ef.querySelector("button").disabled = true;
    try { AUTH.ver = await D.sendEmailOTP({ email: AUTH.email }); AUTH.step = "otp"; authMsg = "Check spam if it's not there in a minute."; paintAuthModal(); authMsg = ""; } catch (err) { msg(nice(err)); ef.querySelector("button").disabled = false; } };
  const of = $("#wdm-otp"); if (of) { const code = $("#wdm-code");
    const go = async () => { msg("Checking…"); try { await D.verifyOTP({ otpVerification: AUTH.ver, verificationToken: code.value.trim() }); await finishLogin(); } catch (err) { msg(nice(err)); code.select(); } };
    of.onsubmit = (e) => { e.preventDefault(); go(); }; code.oninput = () => { code.value = code.value.replace(/\D/g, "").slice(0, 6); if (code.value.length === 6) go(); };
    $("#wdm-back").onclick = () => { AUTH.step = "email"; paintAuthModal(); };
    $("#wdm-resend").onclick = async () => { msg("Sending a fresh code…"); try { AUTH.ver = await D.sendEmailOTP({ email: AUTH.email }); msg("New code sent."); } catch (err) { msg(nice(err)); } }; }
  const cf = $("#wdm-claim"); if (cf) { const inp = $("#wdm-handle"), out = $("#wdm-avail"), btn = $("#wdm-claim-go"); let t = null;
    const check = () => { const v = inp.value.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_]/g, ""); if (v !== inp.value) inp.value = v; btn.textContent = "Claim @" + (v || "…");
      clearTimeout(t); if (v === ME.handle) { out.textContent = "✓ That's yours"; out.className = "wdm-avail ok"; btn.disabled = false; return; }
      if (!/^[a-z0-9_]{3,20}$/.test(v)) { out.textContent = "3–20 letters, numbers or _"; out.className = "wdm-avail"; btn.disabled = true; return; }
      out.textContent = "Checking…"; out.className = "wdm-avail"; t = setTimeout(async () => { try { const d = await api("handle", undefined, "&h=" + encodeURIComponent(v)); if (inp.value !== v) return; out.textContent = d.available ? "✓ Available" : d.valid ? "✗ Taken, try another" : "✗ Not allowed"; out.className = "wdm-avail " + (d.available ? "ok" : "no"); btn.disabled = !d.available; } catch { out.textContent = ""; btn.disabled = false; } }, 280); };
    inp.oninput = check; check();
    $("#wdm-shuffle").onclick = async () => { try { ME = (await api("reroll", { what: "handle" })).me; inp.value = ME.handle; check(); W().paintAuth && W().paintAuth(); } catch (e) { msg(errText(e)); } };
    cf.onsubmit = async (e) => { e.preventDefault(); btn.disabled = true; try { ME = (await api("claim", { handle: inp.value, age: true })).me; AUTH.step = "done"; confetti(); paintAuthModal(); rerender(); W().paintAuth && W().paintAuth(); } catch (er) { msg(errText(er)); btn.disabled = false; } }; }
  /* Social buttons: only providers switched on in the sign-in dashboard. */
  const S = $("#wdm-social"); if (S && D && authState === "ready") {
    const ps = ((client && client.projectSettings && client.projectSettings.providers) || []).filter((p) => p && p.enabledAt && SOCIAL[p.provider] && ["google", "apple"].includes(p.provider)).map((p) => p.provider);
    S.innerHTML = [...new Set(ps)].map((p) => `<button class="wdl-btn ghost wdm-soc" type="button" data-soc="${p}"><b>${SOC_IC[p]}</b> ${SOCIAL[p]}</button>`).join("");
    if (ps.length) S.insertAdjacentHTML("afterbegin", `<div class="wdm-or"><span>or</span></div>`);
    S.querySelectorAll("[data-soc]").forEach((b) => (b.onclick = async () => { const c = $("#wdm-21"); if (c && !c.checked) { msg("Tap “I'm 21 or older” first."); return; } if (c) passGate(); msg("Opening " + b.textContent.replace("Continue with ", "").trim() + "…"); try { sessionStorage.setItem("wd-after-login", AUTH.next || "#/account"); await D.signInWithSocialRedirect({ provider: b.dataset.soc, redirectUrl: location.origin + "/" }); } catch (err) { msg(nice(err)); } }));
    /* Low-key extra option: a sign-in browser extension, if one is installed. No brand names. */
    let ws = []; try { ws = D.getAvailableWalletProvidersData() || []; } catch {}
    const seen = new Set(); ws = ws.filter((p) => !seen.has(p.key) && seen.add(p.key));
    if (ws.length) { $("#wdm-more").hidden = false; const L = $("#wdm-ext");
      L.innerHTML = ws.slice(0, 4).map((p, i) => `<button class="wdl-btn ghost" type="button" data-k="${esc(p.key)}">${ws.length > 1 ? "Browser extension " + (i + 1) : "Use my browser extension"}</button>`).join("") + `<p class="wdm-fine">For folks who already use a sign-in extension. Email works great for everyone else.</p>`;
      L.querySelectorAll("[data-k]").forEach((b) => (b.onclick = async () => { const c = $("#wdm-21"); if (c && !c.checked) { msg("Tap “I'm 21 or older” first."); return; } if (c) passGate(); msg("Approve the sign-in in your extension…"); try { await D.connectAndVerifyWithWalletProvider({ walletProviderKey: b.dataset.k }); await finishLogin(); } catch (err) { msg(nice(err)); } })); }
  }
}
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href="#/login"], a[href="#/signup"], [data-auth]'); if (a) { e.preventDefault(); openAuth(a.dataset.next || ""); return; }
  if (e.target.closest("[data-wdm-close]")) { const link = e.target.closest("a[href]"); closeAuth(); if (AUTH.step === "done" && !link && AUTH.next) { location.hash = AUTH.next; } if (!link && AUTH.next === "") {} }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && AUTH.open) closeAuth(); });
function pLogin() { // deep link #/login or #/signup: show the page they came from + the popup
  const back = LAST_HASH || "#/"; setTimeout(() => { history.replaceState(null, "", location.pathname + location.search + back); rerender(); openAuth(); }, 0);
  return `<section class="wdl"><div class="wdl-card"><p>Opening sign-in…</p></div></section>`;
}
const shareUrl = (h) => location.origin + "/" + h;
const bannerHtml = (p) => `<div class="wdl-cover wdl-banner" style="background:${coverCss(p.cover)}">${p.banner >= 0 ? bannerSvg(p.bnSeed || p.handle, p.banner) : ""}</div>`;
function passShelf(p) { const set = p.passSet || {}; const ks = Object.keys(set); if (!ks.length) return ""; return `<div class="wdl-card"><h3>🎟️ Hall Pass collection · ${p.passes || 0}</h3><div class="wds-chips">${ks.map((k) => { const x = (Shop.HALL || []).find((y) => y.key === k); return x ? `<a class="wds-chip" href="#/drop/${k}" style="border-color:${x.color[0]}">${x.emoji} ${esc(x.name)}${set[k] > 1 ? " ×" + set[k] : ""}</a>` : ""; }).join("")}</div></div>`; }
function qrCard(h, mine) { const u = shareUrl(h); return `<div class="wdl-card wdl-qr"><div>${qrSvg(u, 156)}</div><div><h3>${mine ? "Your share link" : "Share this profile"}</h3><p><b>${esc(u.replace(/^https?:\/\//, ""))}</b></p>${mine ? `<p>Friends who join with it get +500 pts. You get +1,000 per signup and climb the recruiters board. Joined so far: <b>${ME.refs || 0}</b>.</p>` : ""}<div class="wdl-row"><button class="wdl-btn" data-sharep="${esc(h)}">Share link</button><button class="wdl-btn ghost" data-copy="${esc(u)}">Copy</button>${mine ? `<a class="wdl-btn ghost" href="/api/wd?a=card&h=${esc(h)}&v=${esc(ME.avSeed)}${ME.hasAv}" target="_blank" rel="noopener">Share card</a>` : ""}</div></div></div>`; }
function pAccount() {
  if (!ME) return shell("My profile", needLogin("your profile"));
  return shell("My profile", `${bannerHtml(ME)}<div class="wdl-card wdl-pro wdl-pro-top">${av(ME, 96)}<div><h3>${esc(ME.displayName || "@" + ME.handle)}</h3><p>@${esc(ME.handle)} · Member ${padNo(ME.member)}</p>${vipFlair(ME)}<div class="wdl-stats"><a href="#/quests"><b>${ME.points.toLocaleString()}</b><small>hall points</small></a><a href="#/pearls"><b>${(ME.pearls || 0).toLocaleString()}</b><small>🦪 Pearls</small></a><a href="#/gifts/redeem"><b>${money(ME.credit)}</b><small>gift credit</small></a>${ME.passes ? `<a href="#/shop"><b>${ME.passes}</b><small>hall passes</small></a>` : ""}${ME.tipsIn ? `<span><b>${ME.tipsIn.toLocaleString()}</b><small>Pearls received</small></span>` : ""}</div>${ME.promo ? `<p class="wdl-tag">🏷️ ${ME.promo.pct}% off your first order is waiting at checkout</p>` : ""}${ME.gwPending ? `<p class="wdl-tag">🎟️ ${ME.gwPending} bonus giveaway entries waiting: <a href="#/giveaway">enter the free giveaway</a></p>` : ""}
    <div class="wdl-row"><button class="wdl-btn ghost" data-reroll="avatar">🎲 New pic</button><button class="wdl-btn ghost" data-reroll="banner">🎲 New banner</button><button class="wdl-btn ghost" data-reroll="handle">🎲 Random @</button><label class="wdl-btn ghost">📷 Upload photo<input type="file" accept="image/*" id="wdl-up" hidden></label><a class="wdl-btn ghost" href="#/u/${esc(ME.handle)}">View public profile</a><a class="wdl-btn ghost" href="#/orders">My orders</a><button class="wdl-btn ghost" data-logout>Log out</button></div></div></div>
   ${Fun.surgeSlot(false)}${ME.club ? "" : `<a class="wds-clubcta" href="#/club"><span>🥂</span><div><b>Join the Champagne Club</b><small>Ruby OG badge, 2x points, monthly Pearls, early drops, jukebox priority</small></div><em>$88.88 →</em></a>`}
   ${qrCard(ME.handle, true)}${Fun.connectsHtml(ME, true)}${passShelf(ME)}
   <form class="wdl-card wdl-form" id="wdl-prof"><h3>Edit profile</h3><p class="wdl-fine">Banner color (behind your generated banner)</p><div class="wdl-covers">${COVERS.map((c, i) => `<label style="background:${c}"><input type="radio" name="cover" value="${i}" ${String(ME.cover || 0) === String(i) ? "checked" : ""}><span></span></label>`).join("")}</div><label>Username<input name="handle" maxlength="20" value="${esc(ME.handle)}" pattern="[a-z0-9_]{3,20}" title="3–20 lowercase letters, numbers or _" autocapitalize="none" spellcheck="false"></label><label>Display name<input name="displayName" maxlength="32" value="${esc(ME.displayName)}"></label><label>City<input name="city" maxlength="40" value="${esc(ME.city)}"></label><label>Bio<textarea name="bio" maxlength="160">${esc(ME.bio)}</textarea></label><label class="wdl-check"><input type="checkbox" name="tickerOn" ${ME.tickerOff ? "" : "checked"}> Show my purchases &amp; entries in the live activity feed</label><button class="wdl-btn">Save</button></form>
   <div class="wdl-grid3"><a class="wdl-card" href="#/spin"><h3>🎁 Welcome game</h3><p>${ME.welcome == null ? "Your free play is ready" : "Played ✓"}</p></a><a class="wdl-card" href="#/jukebox"><h3>🎶 Jukebox</h3><p>Request &amp; vote songs</p></a><a class="wdl-card" href="#/pearls"><h3>🦪 Pearls</h3><p>Tip &amp; send gifts</p></a><a class="wdl-card" href="#/quests"><h3>✅ Quests</h3><p>Daily + milestone points</p></a><a class="wdl-card" href="#/leaderboard"><h3>🏆 Leaderboard</h3><p>Points &amp; top recruiters</p></a><a class="wdl-card" href="#/gifts/redeem"><h3>🎁 Redeem a code</h3><p>Add gift credit</p></a></div>`);
}
function pProfile(h) {
  h = h.toLowerCase().replace(/^@/, "");
  setTimeout(async () => { const box = $("#wdl-pub"); if (!box) return; try { const p = (await api("profile", undefined, "&h=" + encodeURIComponent(h))).profile;
    box.innerHTML = `${bannerHtml(p)}<div class="wdl-card wdl-pro wdl-pro-top">${av(p, 96)}<div><h3>${esc(p.displayName || "@" + p.handle)}</h3><p>@${esc(p.handle)} · Member ${padNo(p.member)}${p.city ? " · " + esc(p.city) : ""}</p>${vipFlair(p)}<p>${esc(p.bio)}</p><p><b>${p.points.toLocaleString()}</b> hall points · <b>${p.refs || 0}</b> recruits${p.passes ? ` · <b>${p.passes}</b> hall passes` : ""}${p.tipsIn ? ` · <b>${p.tipsIn.toLocaleString()}</b> 🦪 received` : ""}</p>${Fun.connectsHtml(p, false)}${ME ? (ME.handle !== p.handle ? `<button class="wdl-btn ghost" data-tip="${esc(p.handle)}" data-tiproom="live">🎁 Send a gift</button>` : "") : `<a class="wdl-btn" href="#/login" data-ref="${esc(p.handle)}">Join with @${esc(p.handle)}\'s link</a>`}</div></div>${passShelf(p)}${qrCard(p.handle, ME && ME.handle === p.handle)}`; bind("/u/" + h); }
    catch (e) { box.innerHTML = `<div class="wdl-card"><p>${e.status === 404 ? "No member with that handle." : esc(errText(e))}</p></div>`; } }, 0);
  return shell("@" + esc(h), `<div id="wdl-pub"><div class="wdl-card"><p>Loading…</p></div></div>`);
}
function reveal(d) {
  const t = [...cfg().VIP, ...cfg().MORE, { ...(cfg().BUNDLE || {}), theme: "champagne" }].find((x) => x.key === d.tier);
  const o = document.createElement("div"); o.className = "wdl-reveal" + (t ? " wdl-th-" + t.theme : "");
  o.innerHTML = `<div class="wdl-reveal-card">${t ? `<div class="wdl-vip-emoji">${esc(t.emoji)}</div><p class="wdl-tag">🎁 Mystery drop unlocked · OG Founding VIP #${d.vipNo}</p><h2>${esc(t.name)}</h2>` : `<h2>Gift credit added</h2>`}
  <p>${money(d.base)} paid</p>${d.bonus ? `<p class="wdl-big">+${money(d.bonus)}</p><p>bonus credit</p>` : ""}<p>Total: <b>${money(d.amount)}</b> gift credit</p><p class="wdl-fine">Credit is not cash.</p><button class="wdl-btn">Let's go</button></div>`;
  document.body.appendChild(o); o.querySelector("button").onclick = () => o.remove(); confetti(); setTimeout(confetti, 700); setTimeout(confetti, 1400);
}
function confetti() { const c = document.createElement("div"); c.className = "wdl-confetti"; c.innerHTML = Array.from({ length: 40 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:hsl(${i * 37} 85% 55%);animation-delay:${Math.random() * .4}s"></i>`).join(""); document.body.appendChild(c); setTimeout(() => c.remove(), 2200); }
function pQuests() {
  const qs = (SRV && SRV.quests) || [], ms = (SRV && SRV.milestones) || [];
  return shell("Quests", Fun.surgeSlot(true) + (ME ? "" : needLogin("claim quest points")) + `<h2 class="wdl-h2">Daily</h2><div class="wdl-list">${qs.map((q) => `<div class="wdl-card wdl-q"><div><h3>${esc(q.title)}</h3><p>${esc(q.sub)}</p></div><div><b>+${q.reward} pts</b>${ME ? (DONE[q.id] ? `<span class="wdl-done">Done ✓</span>` : `<button class="wdl-btn" data-quest="${q.id}" data-href="${esc(q.href || "")}">${esc(q.cta)}</button>`) : ""}</div></div>`).join("")}</div>
  <h2 class="wdl-h2">Milestones · farm your link</h2><div class="wdl-list">${ms.map((q) => `<div class="wdl-card wdl-q"><div><h3>${esc(q.title)}</h3>${/ref/.test(q.id) && ME ? `<p>${Math.min(ME.refs || 0, +q.id.replace(/\D/g, ""))}/${q.id.replace(/\D/g, "")} recruited</p>` : ""}</div><div><b>+${q.reward.toLocaleString()} pts</b>${ME ? (MDONE[q.id] ? `<span class="wdl-done">Done ✓</span>` : `<button class="wdl-btn" data-mile="${q.id}">Claim</button> <a class="wdl-btn ghost" href="${esc(q.href)}">Go</a>`) : ""}</div></div>`).join("")}</div>
  <p class="wdl-fine">Daily quests reset at midnight Arizona time. Milestones are one-time and checked on our server. Points are free, for fun, and have no cash value. Happy Hour surges (1.5x, 2x, 3.5x) and the Champagne Club (2x) multiply points from quests, milestones, referrals, chat, tips you receive and purchases (1 pt per $1). Points never add giveaway entries.</p>`);
}
function pBoard(by) {
  by = ["refs", "tips"].includes(by) ? by : "points";
  setTimeout(async () => { const box = $("#wdl-lb"); if (!box) return; try { const d = await api("lb", undefined, by === "points" ? "" : "&by=" + by);
    box.innerHTML = d.board.length ? `<table class="wdl-table"><tr><th>#</th><th>Member</th><th>${by === "refs" ? "Recruits" : by === "tips" ? "🦪 received" : "Points earned"}</th></tr>${d.board.map((p, i) => `<tr class="${ME && ME.handle === p.handle ? "wdl-mine" : ""}"><td>${i + 1}</td><td><a href="#/u/${esc(p.handle)}" class="wdl-who">${av(p, 28)} @${esc(p.handle)} <small>${padNo(p.member)}</small>${p.vip ? " ⭐" : ""}</a></td><td>${p.score.toLocaleString()}</td></tr>`).join("")}</table><p class="wdl-fine">${d.members.toLocaleString()} members so far.</p>` : "<p>No one here yet. Be the first.</p>"; }
    catch (e) { box.innerHTML = `<p>${esc(errText(e))}</p>`; } }, 0);
  return shell("Leaderboard", `<div class="wdl-row wdl-tabs"><a href="#/leaderboard" class="${by === "points" ? "on" : ""}">Points</a><a href="#/leaderboard?by=refs" class="${by === "refs" ? "on" : ""}">Top recruiters</a><a href="#/leaderboard?by=tips" class="${by === "tips" ? "on" : ""}">Most tipped</a></div>${Fun.surgeSlot(false)}<div class="wdl-card" id="wdl-lb"><p>Loading…</p></div>${ME ? `<p><a class="wdl-btn" href="#/account">Get my share link + QR</a></p>` : ""}<p class="wdl-fine">Real members only. Points are free and for fun.</p>`);
}
function lockerCard(p) {
  const { L, p: partner } = partnerOf(p.slug);
  return `<a class="wdl-card wdl-locker" href="#/product/${esc(p.slug)}"><img src="${esc(p.img)}" alt="" loading="lazy"><div><h3>${esc(p.name)}</h3><p>${esc(p.varietal)}</p><p class="wdl-tag">${partner ? "At " + esc(partner.name) : L.reserve ? "Pre-launch reservation" : "Coming soon"}</p></div></a>`;
}
function pCollections() {
  const P = W().PRODUCTS || [];
  return shell("Pre-launch reservations &amp; partner offers", `<div class="wdl-grid">${P.map(lockerCard).join("")}</div>${LEGAL}`, "Wine is sold and shipped only by licensed partners, to states where they're licensed. Reserve a locker with gift credit, or shop it at a partner.");
}
function pProduct(slug) {
  const p = (W().PRODUCTS || []).find((x) => x.slug === slug); if (!p) return shell("Not found", `<a href="#/collections">See all lockers</a>`);
  const { L, p: partner } = partnerOf(slug); const url = refUrl(L.partnerUrl || (partner && partner.url));
  const shop = url ? `<a class="wdl-btn" href="${esc(url)}" target="_blank" rel="noopener sponsored">Shop at ${esc(partner ? partner.name : "partner")} ↗</a><p class="wdl-fine">Sold and shipped by licensed partner${partner && partner.states && partner.states.length ? " · ships to " + esc(partner.states.join(", ")) : ""}. Prices, availability and age verification are handled by the partner.</p>` : "";
  const reserve = L.reserve ? `<div class="wdl-card"><h3>Reserve with gift credit</h3><p>Hold a spot for this locker before launch. Reservations are free and use no money now; when a licensed partner lists it, you'll get first access and can apply your Wine Detention gift credit where the partner accepts it.</p>${notifyForm("reserve:" + slug)}</div>` : "";
  return shell(esc(p.name), `<div class="wdl-prod"><img src="${esc(p.img)}" alt="${esc(p.name)}"><div><p class="wdl-tag">${esc(p.varietal)}</p><p>${esc(p.desc.replace(/\b(Floor|floor) is \$\d+\.?|The top lot.*$/g, ""))}</p>${shop}${!url && !L.reserve ? notifyForm("locker:" + slug) : ""}</div></div>${reserve}${LEGAL}`);
}
function pGifts() {
  const B = cfg().BONUS; const W2 = cfg().WHOP;
  const card = (a) => `<div class="wdl-card wdl-gift"><div class="wdl-gc">WINE DETENTION<b>${money(a)}</b></div>${B.pct ? `<p class="wdl-tag">+ ${money(a * B.pct / 100)} bonus credit</p>` : ""}${buyBtn("gift-" + a, "Buy " + money(a))}</div>`;
  return shell("Gift cards &amp; pre-launch offers", `<div class="wdl-row wdl-tabs"><a href="#/gifts" class="on">Shop</a><a href="#/gifts/redeem">Redeem</a></div>
   <div class="wdl-grid">${GIFTS.map(card).join("")}${W2["gift-custom"] ? `<div class="wdl-card wdl-gift"><div class="wdl-gc">WINE DETENTION<b>Any $</b></div>${buyBtn("gift-custom", "Choose amount")}</div>` : ""}</div>
   ${B.pct ? `<div class="wdl-card"><h3>${esc(B.label)}</h3><p>Every gift card includes a fixed ${B.pct}% bonus in promotional credit. No spin, no chance: you always get exactly ${B.pct}%.</p><p class="wdl-fine">${esc(B.fine)}</p></div>` : ""}
   <h2 class="wdl-h2">Pre-launch offers</h2><div class="wdl-grid">${cfg().OFFERS.map((o) => `<div class="wdl-card"><h3>${esc(o.name)}</h3><p class="wdl-tag">${esc(o.price)}</p><p>${esc(o.blurb)}</p>${buyBtn(o.key, "Get it")}</div>`).join("")}</div>
   <p class="wdl-fine">Pay by card, Apple Pay, Google Pay, Cash App Pay or crypto at secure checkout. Gift cards and credits are not alcohol and can't be exchanged for cash except where required by law. Your codes appear right after payment (and in My orders); redeem one under Redeem or gift it.</p>${LEGAL}`);
}
function pRedeem() {
  return shell("Redeem a gift code", `<div class="wdl-row wdl-tabs"><a href="#/gifts">Shop</a><a href="#/gifts/redeem" class="on">Redeem</a></div>` + (ME ? `<form class="wdl-card wdl-notify" id="wdl-redeem"><input id="wdl-gcode" required placeholder="WD-XXXX-XXXX-XXXX" aria-label="Gift code"><button class="wdl-btn">Redeem</button></form><p>Your gift credit: <b>${money(ME.credit)}</b></p>` : needLogin("redeem a code")) + LEGAL);
}
const vipPct = () => (SRV && SRV.vipBonusPct) || 35;
const DROP_C = { vip350: ["#E11D48", "#F5C451", "#FFF1F2"], vip888: ["#A87A12", "#E9C46A", "#FFFBEB"], vip1750: ["#1E3A8A", "#7C3AED", "#EEF2FF"], vip1313: ["#9B1B30", "#0E3386", "#FFF1F2"], vip2500: ["#E879A9", "#F5C451", "#FDF2F8"], vip3500: ["#047857", "#E6B73F", "#ECFDF5"], vip5000: ["#6D28D9", "#F5C451", "#F5F3FF"], vipBundle: ["#CC3433", "#E6B73F", "#FFFBEB"] };
const HOOK = { vip350: "Sealed for the troublemakers who showed up first. Everybody's favorite.", vip888: "Pop goes the after-party. What's under the foil?", vip1750: "Locked in velvet. For the ones going all in.", vip1313: "Called to the office. Lucky 13 inside.", vip2500: "Top-floor views. Contents classified.", vip3500: "Goes straight on your permanent record.", vip5000: "The royal vault. Velvet ropes only.", vipBundle: "Three sealed drops, one flash price." };
function boxSvg(key) { const [a, b, bg] = DROP_C[key] || DROP_C.vip350, id = "g" + key;
  return `<svg class="wdl-box" viewBox="0 0 200 170" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><radialGradient id="${id}r"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="${bg}" stop-opacity="0"/></radialGradient></defs>
  <circle cx="100" cy="88" r="84" fill="url(#${id}r)"/>${[[22, 30, "#F59E0B"], [176, 40, "#EC4899"], [30, 120, "#3B82F6"], [172, 126, "#10B981"], [60, 14, "#EF4444"], [148, 12, "#8B5CF6"]].map(([x, y, c], i) => `<rect x="${x}" y="${y}" width="7" height="12" rx="2" fill="${c}" transform="rotate(${i * 37} ${x} ${y})"/>`).join("")}
  <path d="M100 18l4 10 10 1-8 6 3 10-9-6-9 6 3-10-8-6 10-1z" fill="#F5C451"/>
  <rect x="44" y="70" width="112" height="84" rx="10" fill="url(#${id})"/><rect x="36" y="56" width="128" height="24" rx="8" fill="url(#${id})" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>
  <rect x="92" y="56" width="16" height="98" fill="#fff" fill-opacity=".85"/><path d="M100 56c-14-22-40-18-30-2 6 9 30 2 30 2zm0 0c14-22 40-18 30-2-6 9-30 2-30 2z" fill="#fff" fill-opacity=".92" stroke="${a}" stroke-width="2"/>
  <circle cx="100" cy="112" r="17" fill="#fff"/><text x="100" y="121" text-anchor="middle" font-size="24" font-weight="900" fill="${a}" font-family="Anton,sans-serif">?</text>
  <rect x="122" y="100" width="22" height="18" rx="4" fill="#fff" fill-opacity=".9"/><path d="M127 100v-5a6 6 0 0 1 12 0v5" fill="none" stroke="#fff" stroke-width="3"/></svg>`; }
const dropFine = `<p class="wdl-fine wdl-dropfine">What's in it? Revealed after checkout. Same drop for everyone. Not alcohol. <a href="#/policy/terms">Terms &amp; drop details</a></p>`;
function dropCard(t, opt = {}) {
  return `<div class="wdl-drop" style="--a:${(DROP_C[t.key] || DROP_C.vip350)[0]};--b:${(DROP_C[t.key] || DROP_C.vip350)[1]};--bg:${(DROP_C[t.key] || DROP_C.vip350)[2]}">${t.popular ? `<span class="wdl-popular">★ Most popular</span>` : opt.badge ? `<span class="wdl-popular">${opt.badge}</span>` : ""}
  ${boxSvg(t.key)}<h3>${esc(t.name)}</h3><p class="wdl-hook">${esc(HOOK[t.key] || t.tagline || "")}</p>
  <div class="wdl-vip-price">${opt.list ? `<s>${money(opt.list)}</s> ` : ""}${money(t.price)}${opt.per ? `<small>${opt.per}</small>` : ""}</div>${opt.extra || ""}
  ${Shop.stockLine(t.key)}${Shop.ctl(t.key, "Add to bag")}<a class="wds-more" href="#/drop/${esc(t.key)}">Details &amp; comments →</a>${dropFine}</div>`; }
function vipCard(t) { return dropCard(t); }
const buyOr = (key, label) => cfg().WHOP[key] ? `<a class="wdl-btn" href="${esc(cfg().WHOP[key])}" target="_blank" rel="noopener">${esc(label)}</a>` : `<p class="wdl-fine"><b>Reserve your spot</b> — checkout opens soon.</p>${notifyForm("vip:" + key)}`;
/* flashEnd: fixed Mon Nov 30, 2026 11:59 PM Arizona (Cyber Monday), from wd-catalog.js */
function cd() { let ms = Math.max(0, flashEnd() - Date.now()); const D = Math.floor(ms / 864e5); ms -= D * 864e5; const H = Math.floor(ms / 36e5); ms -= H * 36e5; const M = Math.floor(ms / 6e4); const S = Math.floor((ms - M * 6e4) / 1e3); return [D, H, M, S].map((n, i) => `<span><b>${String(n).padStart(2, "0")}</b>${["days", "hrs", "min", "sec"][i]}</span>`).join(""); }
setInterval(() => { const e = document.getElementById("wdl-cd"); if (e) e.innerHTML = cd(); }, 1000);
function bundleCard() { const b = cfg().BUNDLE; if (!b) return ""; const ends = new Date(flashEnd()).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Phoenix" });
  return `<div class="wdl-bundlewrap">${dropCard(b, { badge: "⚡ Flash deal", list: b.list, extra: `<p class="wdl-tag">Save ${money(b.list - b.price)}</p><div class="wdl-cd" id="wdl-cd">${cd()}</div><p class="wdl-fine">Cyber Monday flash price ends ${ends}, 11:59 PM Arizona time.</p>` })}</div>`; }
function monthlyCard() { const m = cfg().MONTHLY; if (!m) return ""; return dropCard(m, { per: "/month", badge: "📅 Monthly" }); }
function wall() { setTimeout(async () => { const e = $("#wdl-wall"); if (!e) return; try { const w = (await api("wall")).wall; e.innerHTML = w.length ? w.map((p) => `<a class="wdl-who" href="#/u/${esc(p.handle)}">${av(p, 30)} #${p.vipNo} @${esc(p.handle)}</a>`).join(" ") : "<p>Be the first name on the wall.</p>"; } catch { e.innerHTML = "<p>Be the first name on the wall.</p>"; } }, 0);
  return `<div class="wdl-card"><h3>🏛️ Founders Wall</h3><div id="wdl-wall" class="wdl-row" style="gap:10px"><p>Loading…</p></div></div>`; }
function pHome() {
  const party = (W().partyHomeHTML && W().partyHomeHTML()) || `<a class="wdl-card" href="#/party"><h3>♪ Detention Radio</h3><p>Open the jukebox.</p></a>`;
  const gifts = `<h2 class="wdl-h2">🎁 VIP gift cards</h2><div class="wdl-grid">${GIFTS.map((a) => `<div class="wdl-card wdl-gift"><div class="wdl-gc">WINE DETENTION<b>${money(a)}</b></div>${cfg().BONUS.pct ? `<p class="wdl-tag">+ ${money(a * cfg().BONUS.pct / 100)} bonus credit</p>` : ""}${buyBtn("gift-" + a, "Buy " + money(a))}</div>`).join("")}</div><p class="wdl-fine"><a href="#/gifts">Shop all gift cards →</a></p>`;
  const fun = `<div class="wdl-funrow"><a class="wdl-card wdl-fun" href="#/spin"><span>🎁</span><b>Free welcome game</b><small>Wheel or claw. Points, Pearls, credit, entries.</small></a><a class="wdl-card wdl-fun" href="#/jukebox"><span>🎶</span><b>Jukebox</b><small>Request, vote &amp; sing along.</small></a><a class="wdl-card wdl-fun" href="#/club"><span>🥂</span><b>Champagne Club</b><small>$88.88 founding OG perks.</small></a><a class="wdl-card wdl-fun" href="#/pearls"><span>🦪</span><b>Pearls</b><small>Tip &amp; send animated gifts.</small></a></div>`;
  return `<section class="wdl">${Shop.naughtyBanner()}${Fun.surgeSlot(false)}${Shop.tickerSlot()}<div class="wdl-homehero"><span class="wdl-tag">Founders · early access · Naughty List pricing</span><h1>OG Founding VIP Drops</h1><p>Sealed mystery drops for the OGs who got here first. Limited runs, real countdowns. 🎁🎆</p>${ME ? "" : `<a class="wdl-btn ghost" href="#/login">Get your free hall pass</a>`} <a class="wdl-btn ghost" href="#/live">🔴 Live room</a></div>
  <div class="wdl-drops wdl-drops-main">${cfg().VIP.map(vipCard).join("")}</div>${bundleCard()}
  ${fun}<div class="wds">${Shop.passesSection()}</div>
  <h2 class="wdl-h2">More drops</h2><div class="wdl-drops">${cfg().MORE.map(vipCard).join("")}</div>
  ${gifts}
  <h2 class="wdl-h2">♪ Detention Radio</h2><a class="wds-clubcta" href="#/jukebox"><span>🎶</span><div><b>New: the Jukebox</b><small>Request songs, vote them up, karaoke &amp; sing-along. Everyone hears the same track.</small></div><em>Open →</em></a>${party}
  ${wall()}${LEGAL}</section>`;
}
function pVip() {
  return shell("OG Founding VIP Drops", `<div class="wdl-vip-hero"><p>Sealed drops for the bad boys and bad girls who showed up first. Limited quantities, real counts. 🎁🎆</p></div>${Shop.tickerSlot()}
  <div class="wdl-drops wdl-drops-main">${cfg().VIP.map(vipCard).join("")}</div>${bundleCard()}<h2 class="wdl-h2">More drops</h2><div class="wdl-drops">${cfg().MORE.map(vipCard).join("")}</div>${wall()}${LEGAL}`);
}
export function vipHero() {
  const T = cfg().VIP; if (!T.length) return "";
  return `<a class="wdl-vip-banner" href="#/vip"><span class="wdl-tag">New · OG Founding VIP</span><b>🎁 The Founding Members: OG VIP Mystery Drop is here</b><span>Most popular: $350 Founding Members Mystery Drop · treat yourself to Let's Pop $888 · or go all in with The Private Reserve $1,750</span><span class="wdl-fine">Sealed mystery drops. Revealed after checkout. Same drop for everyone.</span><span class="wdl-btn">See the drops</span></a>`;
}

function pSoon(name) { return shell(name, `<div class="wdl-card"><h3>Opening after launch</h3><p>Live rooms, parties, trades and giveaways open once the hall has real members. Get notified first.</p>${notifyForm("community")}</div>`); }
function dropTerms() { const all = [...cfg().VIP, cfg().BUNDLE, ...cfg().MORE].filter(Boolean);
  return `<h3 id="drops">OG Founding VIP drop contents</h3><p>Every drop has fixed contents, identical for every buyer. Nothing is random. Contents are Wine Detention gift credit plus profile perks; no alcohol is included. Gift credit is not cash.</p><ul>${all.map((t) => `<li><b>${esc(t.name)}</b> (${money(t.price)}): ${money(t.credit || t.price * (1 + vipPct() / 100))} gift credit; ${esc((t.perks || []).join(", "))}.</li>`).join("")}</ul><p>Bonus portion of credit is promotional and may expire 12 months after issue; paid value never expires.</p>`; }
function pPolicy(k) {
  const T = k === "privacy" ? ["Privacy Policy", `<p><b>Placeholder — to be finalized before launch.</b></p><p>We collect your email (or the sign-in account you choose), your profile details, chat messages and comments, orders, waitlist emails, and referral handles. Sign-in is handled by our authentication provider. We use them to run your account, points and gift credit and to tell you about launches. Payments are processed by Whop (cards, Apple Pay, Google Pay, Cash App Pay, crypto); we never see your card number. You can hide your activity from the public live feed in your profile. If you connect social accounts we store and show only the handle (and whether it was verified through our sign-in provider). We keep your Pearl and points balances and a short ledger. At checkout we ask your date of birth once and store only that you passed the 21+ check, not the date. Wine purchases happen on licensed partner sites under their own privacy policies; partner links include your public @handle as a referral tag. Email hello@winedetention.com to access or delete your data.</p>`] :
    ["Terms of Service", `<p><b>Placeholder — to be finalized before launch.</b></p><p>You must be 21 or older. Wine Detention does not sell, ship or deliver alcohol. Wine purchases are fulfilled by licensed partners, who are the sellers of record and handle age verification and shipping to permitted states. Hall Passes, VIP drops, gift cards and pre-launch credits are sold via Whop and contain no alcohol. Hall Passes return 100% of the price as Wine Detention gift credit plus a collectible profile pass. Quantities are limited; "claimed" counts reflect paid orders. Chat and comments: be 21+, be kind, no links or spam; we may remove messages or mute accounts. Gift card bonus credit is promotional, not cash, and may expire 12 months after issue; paid gift card value does not expire. Hall points have no cash value; they're earned free (quests, chat, referrals, tips received) and, at 1 point per $1, on purchases. Happy Hour surges and the Champagne Club multiply points; points never add giveaway entries and can't be exchanged for anything of value. Welcome game: one free play per account (wheel or claw, same prizes), no purchase possible; prizes and odds are published on the game page and picked by our server.</p>
   <h3 id="pearls">Pearls (virtual goods)</h3><p>Pearls are a limited, revocable license to use a virtual item on Wine Detention for tipping and sending animated gifts. <b>Pearls have no cash value, are not money or a stored-value instrument, cannot be withdrawn, cashed out, redeemed, sold, transferred outside the site or exchanged for cash, gift credit, giveaway entries, prizes or anything of monetary value.</b> Pearls you send are gone; members who receive tips earn hall points (also no cash value). Pearl purchases are final except where required by law. We may adjust balances to fix errors or abuse, and unused Pearls have no value if an account is closed.</p>
   <h3 id="club">Champagne Club</h3><p>The Founding OG (Ruby) tier is a one-time $88.88 purchase that unlocks account perks: a badge and chat flair, 2x base hall points, 1,000 Pearls on joining and 500 Pearls claimable once per calendar month (Arizona time), early access to new drops (24 hours before public launch when a drop has a scheduled start) and jukebox priority. Perks have no cash value, are tied to your account, are not transferable and may change with reasonable notice. The founding run is limited to the quantity shown on the Club page.</p>
   <h3 id="jukebox">Jukebox</h3><p>The jukebox plays only Wine Detention's in-house catalog. Requests, votes and bumps are for fun; bumps cost hall points or Pearls and are final.</p>
   <h3 id="deals">Deal windows</h3><p>Naughty List pre-Black Friday OG deals (VIP drops, Hall Passes and gift-card promos) run through Sun Feb 14, 2027 at 11:59 PM Arizona time unless sold out first. The OG Flash Deal bundle runs through Mon Nov 30, 2026 at 11:59 PM Arizona time. Quantities shown are real.</p>${dropTerms()}`];
  return shell(T[0], `<div class="wdl-card wdl-prose">${T[1]}</div>${LEGAL}`);
}

function pGiveaway() {
  setTimeout(async () => {
    const box = document.getElementById("wdl-gw");
    if (!box) return;
    try {
      await GWPage.load(ME, api);
      box.outerHTML = GWPage.pageHtml(ME);
      GWPage.bind(ME, api);
    } catch (e) {
      box.innerHTML = `<section class="wdl"><div class="wdl-card"><h3>Giveaway loading issue</h3><p>${esc(errText(e))}</p><button class="wdl-btn" onclick="location.reload()">Retry</button></div></section>`;
    }
  }, 0);
  return `<div id="wdl-gw"><section class="wdl"><div class="wdl-card"><p>Loading Founding Detention Giveaway…</p></div></section></div>`;
}

export function page(route) {
  if (route !== "/login" && route !== "/signup") LAST_HASH = location.hash || "#/";
  if (route === "/") return pHome();
  if (!OWN.test(route)) return null;
  if (route === "/login" || route === "/signup") return pLogin();
  if (route === "/account") return pAccount();
  if (route.startsWith("/u/")) return pProfile(route.slice(3));
  if (route === "/spin") return Fun.pSpin();
  if (route === "/jukebox") return Fun.pJukebox();
  if (route === "/club") return Fun.pClub();
  if (route === "/pearls") return Fun.pPearls();
  if (route === "/quests") return pQuests();
  if (route === "/leaderboard") return pBoard(new URLSearchParams(location.hash.split("?")[1] || "").get("by"));
  if (route === "/shop" || route === "/hall-passes") return Shop.pShop();
  if (route.startsWith("/drop/")) return Shop.pDrop(route.slice(6));
  if (route === "/orders") return Shop.pOrders();
  if (route === "/live") return Shop.pLive();
  if (route === "/cart") return Shop.pCart();
  if (route === "/checkout") return Shop.pCheckout();
  if (route === "/confirmation") return Shop.pConfirm();
  if (route === "/how-it-works") { setTimeout(() => location.replace("#/vip"), 0); return pVip(); }
  if (route === "/socials") return shell("Follow @winedetention", `<div class="wdl-card"><div class="wd-soc">${(window.WD_SOCIALS || []).map((x) => `<a href="${esc(x.u)}" target="_blank" rel="noopener me" title="${esc(x.n)}" style="--c:${x.c}"><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="${x.p}"/></svg></a>`).join("")}</div></div>`);
  if (route === "/collections" || route === "/partners" || route.startsWith("/product/")) { setTimeout(() => location.replace("#/vip"), 0); return pVip(); }
  if (route === "/gifts/redeem") return pRedeem();
  if (route === "/vip") return pVip();
  if (route === "/giveaway" || route === "/giveaways") return pGiveaway();
  if (route.startsWith("/gifts")) return pGifts();
  if (route.startsWith("/policy/")) return pPolicy(route.slice(8));
  return pSoon({ "/trade": "Trades" }[route] || "Coming soon");
}
export const owns = (route) => route === "/" || OWN.test(route);
export function bind(route) {
  document.querySelectorAll(".wdl-notify[data-item]").forEach((f) => (f.onsubmit = async (e) => { e.preventDefault(); const i = f.querySelector("input"); try { await api("notify", { email: i.value, item: f.dataset.item }); f.innerHTML = "<p>You're on the list ✓</p>"; } catch (er) { toast(errText(er)); } }));
  document.querySelectorAll("[data-notify]").forEach((b) => (b.onclick = () => { b.outerHTML = notifyForm(b.dataset.notify); bind(route); }));
  document.querySelectorAll("[data-logout]").forEach((b) => (b.onclick = logout));
  document.querySelectorAll("[data-mile]").forEach((b) => (b.onclick = async () => { try { const d = await api("milestone", { id: b.dataset.mile }); MDONE[b.dataset.mile] = 1; ME.points = d.points; toast("+" + d.reward.toLocaleString() + " pts" + Fun.multNote(d)); confetti(); rerender(); } catch (e) { toast(errText(e)); } }));
  Shop.bind(route);
  document.querySelectorAll("[data-ref]").forEach((b) => (b.onclick = () => localStorage.setItem("wd-ref", b.dataset.ref)));
  document.querySelectorAll("[data-share]").forEach((b) => (b.onclick = () => { const u = location.origin + "/" + ME.handle; navigator.share ? navigator.share({ title: "@" + ME.handle + " on Wine Detention", url: u }).catch(() => {}) : navigator.clipboard.writeText(u).then(() => toast("Link copied: " + u)); }));
  document.querySelectorAll("[data-reroll]").forEach((b) => (b.onclick = async () => { try { ME = (await api("reroll", { what: b.dataset.reroll })).me; rerender(); W().paintAuth && W().paintAuth(); } catch (e) { toast(errText(e)); } }));
  document.querySelectorAll("[data-quest]").forEach((b) => (b.onclick = async () => { try { const d = await api("quest", { id: b.dataset.quest }); DONE[b.dataset.quest] = 1; ME.points = d.points; toast("+" + d.reward + " pts" + Fun.multNote(d)); if (b.dataset.quest === "share" && ME) { const u = location.origin + "/" + ME.handle; navigator.share ? navigator.share({ url: u }).catch(() => {}) : navigator.clipboard && navigator.clipboard.writeText(u); } if (b.dataset.href) location.hash = b.dataset.href; else rerender(); } catch (e) { toast(errText(e)); } }));
  const up = $("#wdl-up"); if (up) up.onchange = async () => { const f = up.files[0]; if (!f) return; try { const d = await resizeImg(f); ME = (await api("avatar", { dataUrl: d })).me; toast("Photo updated"); rerender(); W().paintAuth && W().paintAuth(); } catch (e) { toast(errText(e)); } };
  document.querySelectorAll("[data-sharep]").forEach((b) => (b.onclick = () => { const u = location.origin + "/" + b.dataset.sharep; navigator.share ? navigator.share({ url: u }).catch(() => {}) : navigator.clipboard.writeText(u).then(() => toast("Link copied")); }));
  const pf = $("#wdl-prof"); if (pf) pf.onsubmit = async (e) => { e.preventDefault(); const f = new FormData(pf); try { ME = (await api("profile", { displayName: f.get("displayName"), bio: f.get("bio"), city: f.get("city"), cover: f.get("cover") || "0", tickerOff: !f.get("tickerOn") })).me; const nh = String(f.get("handle") || "").toLowerCase(); if (nh && nh !== ME.handle) ME = (await api("reroll", { handle: nh })).me; toast("Saved"); rerender(); } catch (er) { toast(errText(er)); } };
  const rd = $("#wdl-redeem"); if (rd) rd.onsubmit = async (e) => { e.preventDefault(); try { const d = await api("redeem", { code: $("#wdl-gcode").value }); ME.credit = d.credit; if (d.tier) { ME.vip = d.tier; ME.vipNo = d.vipNo; } rerender(); reveal(d); } catch (er) { toast(errText(er)); } };
  Fun.bind(route);
  if (route === "/" && W().bindParty) W().bindParty();
}
export function authBtn() {
  if (ME) return `<a href="#/account" class="account-link wdl-acct" title="@${esc(ME.handle)}">${av(ME, 34)}</a>`;
  return `<a href="#/login" class="login-link">${authState === "soon" ? "Join list" : "Log in"}</a>`;
}
window.WDL = { page, owns, bind, authBtn, avatar, vipHero, openAuth, passGate, bagCount: () => Shop.count(), openBag: () => Shop.openBag() };
/* /handle and /u/handle deep links -> SPA profile; ?ref= captures referrals */
const qref = new URLSearchParams(location.search).get("ref"); if (qref) localStorage.setItem("wd-ref", qref.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20));
const pathOnly = (location.pathname.replace(/\/$/, "") || "/").toLowerCase();
if (!location.hash && /^\/(giveaway|giveaways|vip|gifts|quests|leaderboard|login|signup|party|live|spin|jukebox|club|pearls|account|how-it-works|socials|shop|hall-passes|cart|checkout|orders|confirmation)$/.test(pathOnly)) {
  history.replaceState(null, "", "/#" + (pathOnly === "/giveaways" ? "/giveaway" : pathOnly));
}
const dm = location.pathname.match(/^\/drop\/([a-z0-9]+)\/?$/i); if (dm && !location.hash) history.replaceState(null, "", "/#/drop/" + dm[1]);
const pm = location.pathname.match(/^\/(?:u\/)?@?([a-z0-9_]{3,20})\/?$/i);
if (pm && !location.hash) { localStorage.setItem("wd-ref", pm[1].toLowerCase()); history.replaceState(null, "", "/#/u/" + pm[1].toLowerCase()); }
const CTX = { boxSvg, dropColor: (k) => DROP_C[k] || DROP_C.vip350, hook: (k) => HOOK[k], api, me: () => ME, setMe: (m) => { if (m) { ME = m; W().paintAuth && W().paintAuth(); } }, srv: () => SRV || {}, toast, av, needLogin, confetti, errText, rerender, openAuth, padNo, client: () => client, D: () => D, authReady: () => authState === "ready" };
Shop.init(CTX); Fun.init(CTX);
rerender(); W().paintAuth && W().paintAuth();
bootAuth();
