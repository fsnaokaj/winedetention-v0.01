/* Wine Detention live layer: Dynamic sign-in, KV accounts, partner lockers, Whop gift cards, waitlist.
   Loaded as a module after the main app script. Owns the routes listed in OWN. */
const C = window.WD_CONFIG || {}, V = C.DYNAMIC_SDK_VERSION || "1.39.1";
const W = () => window.WD || {};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\.00$/, "");
const $ = (s) => document.querySelector(s);
const OWN = /^\/(login|signup|account|spin|quests|leaderboard|collections|product\/.+|cart|checkout|confirmation|gifts(\/.*)?|vip|policy\/(privacy|terms)|partners|u\/.+|live|party|trade|giveaways)$/;
let SRV = null, D = null, client = null, ME = null, DONE = {}, OV = null, authState = "loading", authMsg = "";

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
  if (!r.ok || !d.ok) throw Object.assign(new Error(d.error || "error"), { status: r.status }); return d;
}
const ERR = { store_not_configured: "Accounts database isn't connected yet (KV not configured). Try again soon.", auth_not_configured: "Accounts are opening soon.", already_spun: "You already took your Welcome Spin.", already_done: "Already claimed today. Come back tomorrow.", handle_taken: "That handle is taken.", bad_handle: "Handles are 3–20 letters, numbers or _.", bad_code: "That code wasn't found.", code_used: "That code was already redeemed.", bad_email: "Enter a valid email.", api_unavailable: "Service unavailable. Try again soon." };
const errText = (e) => ERR[e && e.message] || (e && e.message) || "Something went wrong";
const toast = (m) => (W().toast ? W().toast(m) : alert(m));
const rerender = () => W().render && W().render();

/* ---------- offers (config + admin overrides) ---------- */
const cfg = () => { const o = OV || {}; return { WHOP: { ...(C.WHOP_LINKS || {}), ...(o.WHOP_LINKS || {}) }, PARTNERS: o.PARTNERS || C.PARTNERS || [], LOCKERS: { ...(C.LOCKERS || {}), ...(o.LOCKERS || {}) }, OFFERS: o.OFFERS || C.OFFERS || [], VIP: o.VIP_TIERS || C.VIP_TIERS || [], MONTHLY: o.VIP_MONTHLY || C.VIP_MONTHLY, MORE: o.MORE_DROPS || C.MORE_DROPS || [], BUNDLE: o.VIP_BUNDLE || C.VIP_BUNDLE, BONUS: o.GIFT_BONUS || C.GIFT_BONUS || { pct: 0 } }; };
const GIFTS = [25, 50, 100, 250, 350];
const vipFlair = (m) => { if (!m || !m.vip) return ""; const t = ([...cfg().VIP, ...cfg().MORE, { ...(cfg().MONTHLY || {}), theme: "pass" }, { ...(cfg().BUNDLE || {}), theme: "champagne" }].find((x) => x.key === m.vip) || {}); return `<span class="wdl-flair wdl-th-${esc(t.theme || "pass")}">${esc(t.emoji || "⭐")} OG Founding VIP #${m.vipNo} · ${esc(t.name || "")}</span>`; };
function buyBtn(key, label) {
  const url = cfg().WHOP[key];
  return url ? `<a class="wdl-btn" href="${esc(url)}" target="_blank" rel="noopener">${esc(label || "Buy with card")}</a>` : `<button class="wdl-btn ghost" data-notify="${esc(key)}">Notify me</button>`;
}
function partnerOf(slug) { const L = cfg().LOCKERS[slug] || {}; const p = cfg().PARTNERS.find((x) => x.id === L.partner); return { L, p }; }
function refUrl(u) { if (!u) return ""; try { const x = new URL(u); if (ME) x.searchParams.set("ref", ME.handle); else x.searchParams.set("ref", "winedetention"); return x.toString(); } catch { return ""; } }

/* ---------- auth (Dynamic headless SDK) ---------- */
async function bootAuth() {
  try { SRV = await api("config", undefined); } catch (e) { SRV = { dynamicEnvId: null, store: false, welcome: [], quests: [] }; }
  try { OV = (await api("offers")).overrides; } catch {}
  if (!SRV.dynamicEnvId || !SRV.store) { authState = "soon"; authMsg = SRV.dynamicEnvId ? "Accounts database not configured yet." : "Sign-in not configured yet."; rerender(); return; }
  try {
    const [core, evm] = await Promise.all([import(`https://esm.sh/@dynamic-labs-sdk/client@${V}`), import(`https://esm.sh/@dynamic-labs-sdk/evm@${V}`).catch(() => null)]);
    D = core; client = D.createDynamicClient({ autoInitialize: false, environmentId: SRV.dynamicEnvId, metadata: { name: "Wine Detention", universalLink: location.origin } });
    evm && evm.addEvmExtension && evm.addEvmExtension();
    await D.initializeClient(); authState = "ready";
    if (D.isSignedIn()) await loadMe();
  } catch (e) { authState = "error"; authMsg = String((e && e.message) || e); console.warn("Dynamic init failed", e); }
  rerender();
}
async function loadMe() {
  try { const d = await api("me", { ref: localStorage.getItem("wd-ref") || "" }); ME = d.me; DONE = d.done || {}; localStorage.removeItem("wd-ref"); }
  catch (e) { ME = null; authMsg = errText(e); }
  W().paintAuth && W().paintAuth();
}
async function logout() { ME = null; try { D && (await D.logout()); } catch {} rerender(); W().paintAuth && W().paintAuth(); }

/* ---------- pages ---------- */
const shell = (title, inner, sub) => `<section class="wdl"><header class="wdl-head"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</header>${inner}</section>`;
const LEGAL = `<p class="wdl-fine">Wine purchases are fulfilled by licensed partners. Must be 21+. Hall points are free, for fun and have no cash value.</p>`;
const needLogin = (what) => authState === "soon" ? `<div class="wdl-card"><h3>Accounts opening soon</h3><p class="wdl-fine">${esc(authMsg)}</p><p>Sign-in launches shortly. Join the list and we'll tell you when ${esc(what)} opens.</p>${notifyForm("accounts")}</div>` : `<div class="wdl-card"><h3>Sign in to ${esc(what)}</h3><p>Free. Email code or wallet, powered by Dynamic.</p><a class="wdl-btn" href="#/login">Sign in / sign up</a></div>`;
const notifyForm = (item) => `<form class="wdl-notify" data-item="${esc(item)}"><input type="email" required placeholder="you@email.com" aria-label="Email"><button class="wdl-btn">Notify me</button></form>`;

function pLogin() {
  if (ME) return shell("You're in", `<div class="wdl-card wdl-center">${av(ME, 88)}<h3>@${esc(ME.handle)}</h3><p>Member #${ME.member}</p><a class="wdl-btn" href="#/account">My account</a> <button class="wdl-btn ghost" data-logout>Log out</button></div>`);
  if (authState === "soon") return shell("Accounts opening soon", needLogin("your hall pass"));
  if (authState === "loading") return shell("Sign in", `<div class="wdl-card"><p>Loading sign-in…</p></div>`);
  if (authState === "error") return shell("Sign in", `<div class="wdl-card"><h3>Sign-in is having trouble</h3><p class="wdl-fine">${esc(authMsg)}</p>${notifyForm("accounts")}</div>`);
  return shell("Get your hall pass", `<div class="wdl-card wdl-auth">
   <div data-step="email"><p>Free. You get a member number, a random @handle and a Welcome Spin for hall points.</p><form id="wdl-email" class="wdl-notify"><input id="wdl-em" type="email" required placeholder="you@email.com" autocomplete="email" aria-label="Email"><button class="wdl-btn">Send code</button></form>
   <div class="wdl-or">or connect a wallet</div><div id="wdl-wallets" class="wdl-wallets"></div></div>
   <div data-step="otp" hidden><p>Enter the 6-digit code sent to <b id="wdl-to"></b></p><form id="wdl-otp" class="wdl-notify"><input id="wdl-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" aria-label="Code"><button class="wdl-btn">Verify</button></form></div>
   <p id="wdl-msg" class="wdl-msg" role="status"></p><p class="wdl-fine">By continuing you confirm you're 21+ and agree to the <a href="#/policy/terms">Terms</a> and <a href="#/policy/privacy">Privacy Policy</a>. Login by Dynamic.</p></div>`);
}
function bindLogin() {
  if (!D || ME || authState !== "ready") return;
  const msg = (t) => { const m = $("#wdl-msg"); if (m) m.textContent = t; };
  let ver = null, email = "";
  const done = async () => { msg("Signed in. Setting up your hall pass…"); await loadMe(); location.hash = ME && ME.welcome == null ? "#/spin" : "#/account"; };
  $("#wdl-email").onsubmit = async (e) => { e.preventDefault(); email = $("#wdl-em").value.trim(); msg("Sending code…"); try { ver = await D.sendEmailOTP({ email }); $("#wdl-to").textContent = email; document.querySelector('[data-step="email"]').hidden = true; document.querySelector('[data-step="otp"]').hidden = false; msg("Check your inbox (and spam)."); } catch (err) { msg(err.message || String(err)); } };
  $("#wdl-otp").onsubmit = async (e) => { e.preventDefault(); msg("Verifying…"); try { await D.verifyOTP({ otpVerification: ver, verificationToken: $("#wdl-code").value.trim() }); await done(); } catch (err) { msg(err.message || String(err)); } };
  const L = $("#wdl-wallets"); let ps = []; try { ps = D.getAvailableWalletProvidersData() || []; } catch {}
  const seen = new Set(); ps = ps.filter((p) => !seen.has(p.key) && seen.add(p.key));
  L.innerHTML = ps.length ? ps.slice(0, 8).map((p) => `<button class="wdl-btn ghost" data-k="${esc(p.key)}">${esc((p.metadata && p.metadata.displayName) || p.key)}</button>`).join("") : '<p class="wdl-fine">No browser wallet found. Email sign-in works everywhere.</p>';
  L.querySelectorAll("[data-k]").forEach((b) => (b.onclick = async () => { msg("Check your wallet to connect and sign…"); try { await D.connectAndVerifyWithWalletProvider({ walletProviderKey: b.dataset.k }); await done(); } catch (err) { msg(err.message || String(err)); } }));
}
function pAccount() {
  if (!ME) return shell("My account", needLogin("your account"));
  return shell("My account", `<div class="wdl-cover" style="background:${coverCss(ME.cover)}"></div><div class="wdl-card wdl-pro wdl-pro-top">${av(ME, 96)}<div><h3>${esc(ME.displayName || "@" + ME.handle)}</h3><p>@${esc(ME.handle)} · Member #${ME.member}</p>${vipFlair(ME)}<p><b>${ME.points.toLocaleString()}</b> hall points · <b>${money(ME.credit)}</b> gift credit</p>
    <div class="wdl-row"><button class="wdl-btn ghost" data-reroll="avatar">🎲 New avatar</button><button class="wdl-btn ghost" data-reroll="handle">🎲 Random handle</button><button class="wdl-btn ghost" data-share>Share my link</button><a class="wdl-btn ghost" href="/api/wd?a=card&h=${esc(ME.handle)}&v=${esc(ME.avSeed)}${ME.hasAv}" target="_blank" rel="noopener">My share card</a><label class="wdl-btn ghost">📷 Upload photo<input type="file" accept="image/*" id="wdl-up" hidden></label><button class="wdl-btn ghost" data-logout>Log out</button></div></div></div>
   <div class="wdl-card"><h3>Invite friends</h3><p>Your link: <b>${esc(location.host)}/${esc(ME.handle)}</b>. Friends get +500 pts, you get +1,000 pts per signup. Joined so far: <b>${ME.refs || 0}</b>.</p></div><form class="wdl-card wdl-form" id="wdl-prof"><h3>Edit profile</h3><div class="wdl-covers">${COVERS.map((c, i) => `<label style="background:${c}"><input type="radio" name="cover" value="${i}" ${String(ME.cover || 0) === String(i) ? "checked" : ""}><span></span></label>`).join("")}</div><label>Display name<input name="displayName" maxlength="32" value="${esc(ME.displayName)}"></label><label>City<input name="city" maxlength="40" value="${esc(ME.city)}"></label><label>Bio<textarea name="bio" maxlength="160">${esc(ME.bio)}</textarea></label><label>Handle<input name="handle" maxlength="20" value="${esc(ME.handle)}" pattern="[a-z0-9_]{3,20}"></label><button class="wdl-btn">Save</button></form>
   <div class="wdl-grid3"><a class="wdl-card" href="#/spin"><h3>🎡 Welcome Spin</h3><p>${ME.welcome == null ? "Ready to spin" : "Won " + (+ME.welcome).toLocaleString() + " pts"}</p></a><a class="wdl-card" href="#/quests"><h3>✅ Daily quests</h3><p>Free points every day</p></a><a class="wdl-card" href="#/gifts/redeem"><h3>🎁 Redeem a code</h3><p>Add gift credit</p></a></div>`);
}
function pProfile(h) {
  h = h.toLowerCase().replace(/^@/, "");
  setTimeout(async () => { const box = $("#wdl-pub"); if (!box) return; try { const p = (await api("profile", undefined, "&h=" + encodeURIComponent(h))).profile;
    box.innerHTML = `<div class="wdl-cover" style="background:${coverCss(p.cover)}"></div><div class="wdl-card wdl-pro wdl-pro-top">${av(p, 96)}<div><h3>${esc(p.displayName || "@" + p.handle)}</h3><p>@${esc(p.handle)} · Member #${p.member}${p.city ? " · " + esc(p.city) : ""}</p>${vipFlair(p)}<p>${esc(p.bio)}</p><p><b>${p.points.toLocaleString()}</b> hall points</p>${ME ? "" : `<a class="wdl-btn" href="#/login" data-ref="${esc(p.handle)}">Join with @${esc(p.handle)}\'s link</a>`}<button class="wdl-btn ghost" data-sharep="${esc(p.handle)}">Share</button></div></div>`; }
    catch (e) { box.innerHTML = `<div class="wdl-card"><p>${e.status === 404 ? "No member with that handle." : esc(errText(e))}</p></div>`; } }, 0);
  return shell("@" + esc(h), `<div id="wdl-pub"><div class="wdl-card"><p>Loading…</p></div></div>`);
}
function pSpin() {
  const odds = (SRV && SRV.welcome) || []; const tot = odds.reduce((s, x) => s + x.w, 0) || 1;
  const table = `<table class="wdl-table"><tr><th>Prize</th><th>Odds</th></tr>${odds.map((x) => `<tr><td>${x.v.toLocaleString()} pts</td><td>${(x.w / tot * 100).toFixed(1)}% (1 in ${(tot / x.w).toFixed(1)})</td></tr>`).join("")}</table><p class="wdl-fine">One free Welcome Spin per account. Odds are set on our server and shown exactly. Hall points are free, for fun, and have no cash value. They can't be bought, sold, redeemed or exchanged for cash, credit, wine or prizes.</p>`;
  const top = !ME ? needLogin("take your Welcome Spin") : ME.welcome != null && ME.welcome > 0 ? `<div class="wdl-card wdl-center"><div class="wdl-big">+${(+ME.welcome).toLocaleString()}</div><p>Your Welcome Spin is done. Daily quests keep the points coming.</p><a class="wdl-btn" href="#/quests">Daily quests</a></div>` : `<div class="wdl-card wdl-center"><div class="wdl-big" id="wdl-reel">🎡</div><button class="wdl-btn" id="wdl-spin">Spin (free)</button></div>`;
  return shell("Welcome Spin", top + `<div class="wdl-card"><h3>Published odds</h3>${table}</div>`);
}
function bindSpin() {
  const b = $("#wdl-spin"); if (!b) return;
  b.onclick = async () => { b.disabled = true; const reel = $("#wdl-reel"); const vals = SRV.welcome.map((x) => x.v); let i = 0; const t = setInterval(() => (reel.textContent = "+" + vals[i++ % vals.length].toLocaleString()), 80);
    try { const d = await api("spin", {}); setTimeout(() => { clearInterval(t); reel.textContent = "+" + d.value.toLocaleString(); ME.welcome = d.value; ME.points = d.points; confetti(); toast("+" + d.value.toLocaleString() + " hall points"); }, 1400); }
    catch (e) { clearInterval(t); reel.textContent = "🎡"; toast(errText(e)); b.disabled = false; } };
}
function reveal(d) {
  const t = [...cfg().VIP, ...cfg().MORE, { ...(cfg().MONTHLY || {}), theme: "pass" }, { ...(cfg().BUNDLE || {}), theme: "champagne" }].find((x) => x.key === d.tier);
  const o = document.createElement("div"); o.className = "wdl-reveal" + (t ? " wdl-th-" + t.theme : "");
  o.innerHTML = `<div class="wdl-reveal-card">${t ? `<div class="wdl-vip-emoji">${esc(t.emoji)}</div><p class="wdl-tag">🎁 Mystery drop unlocked · OG Founding VIP #${d.vipNo}</p><h2>${esc(t.name)}</h2>` : `<h2>Gift credit added</h2>`}
  <p>${money(d.base)} paid</p>${d.bonus ? `<p class="wdl-big">+${money(d.bonus)}</p><p>bonus credit</p>` : ""}<p>Total: <b>${money(d.amount)}</b> gift credit</p><p class="wdl-fine">Credit is not cash.</p><button class="wdl-btn">Let's go</button></div>`;
  document.body.appendChild(o); o.querySelector("button").onclick = () => o.remove(); confetti(); setTimeout(confetti, 700); setTimeout(confetti, 1400);
}
function confetti() { const c = document.createElement("div"); c.className = "wdl-confetti"; c.innerHTML = Array.from({ length: 40 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:hsl(${i * 37} 85% 55%);animation-delay:${Math.random() * .4}s"></i>`).join(""); document.body.appendChild(c); setTimeout(() => c.remove(), 2200); }
function pQuests() {
  const qs = (SRV && SRV.quests) || [];
  return shell("Daily quests", (ME ? "" : needLogin("claim quest points")) + `<div class="wdl-list">${qs.map((q) => `<div class="wdl-card wdl-q"><div><h3>${esc(q.title)}</h3><p>${esc(q.sub)}</p></div><div><b>+${q.reward} pts</b>${ME ? (DONE[q.id] ? `<span class="wdl-done">Done ✓</span>` : `<button class="wdl-btn" data-quest="${q.id}" data-href="${esc(q.href || "")}">${esc(q.cta)}</button>`) : ""}</div></div>`).join("")}</div><p class="wdl-fine">Quests reset daily (Arizona time). Points are free and have no cash value.</p>`);
}
function pBoard() {
  setTimeout(async () => { const box = $("#wdl-lb"); if (!box) return; try { const d = await api("lb");
    box.innerHTML = d.board.length ? `<table class="wdl-table"><tr><th>#</th><th>Member</th><th>Points</th></tr>${d.board.map((p, i) => `<tr><td>${i + 1}</td><td><a href="#/u/${esc(p.handle)}" class="wdl-who">${av(p, 28)} @${esc(p.handle)}${p.vip ? " ⭐" : ""}</a></td><td>${p.points.toLocaleString()}</td></tr>`).join("")}</table>` : "<p>No members yet. Be the first.</p>"; }
    catch (e) { box.innerHTML = `<p>${esc(errText(e))}</p>`; } }, 0);
  return shell("Leaderboard", `<div class="wdl-card" id="wdl-lb"><p>Loading…</p></div><p class="wdl-fine">Real members only. Points are free and for fun.</p>`);
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
   <p class="wdl-fine">Paid by card through Whop. Gift cards and credits are not alcohol and can't be exchanged for cash except where required by law. After purchase we email your code; redeem it under Redeem.</p>${LEGAL}`);
}
function pRedeem() {
  return shell("Redeem a gift code", `<div class="wdl-row wdl-tabs"><a href="#/gifts">Shop</a><a href="#/gifts/redeem" class="on">Redeem</a></div>` + (ME ? `<form class="wdl-card wdl-notify" id="wdl-redeem"><input id="wdl-gcode" required placeholder="WD-XXXX-XXXX-XXXX" aria-label="Gift code"><button class="wdl-btn">Redeem</button></form><p>Your gift credit: <b>${money(ME.credit)}</b></p>` : needLogin("redeem a code")) + LEGAL);
}
const vipPct = () => (SRV && SRV.vipBonusPct) || 35;
const DROP_C = { vip350: ["#E11D48", "#F5C451", "#FFF1F2"], vip888: ["#E8C77A", "#FFF4D6", "#FFFBEB"], vip1750: ["#1E3A8A", "#7C3AED", "#EEF2FF"], vip1313: ["#9B1B30", "#0E3386", "#FFF1F2"], vip2500: ["#E879A9", "#F5C451", "#FDF2F8"], vip3500: ["#047857", "#E6B73F", "#ECFDF5"], vip5000: ["#6D28D9", "#F5C451", "#F5F3FF"], vipMonthly: ["#0E3386", "#60A5FA", "#EFF6FF"], vipBundle: ["#CC3433", "#E6B73F", "#FFFBEB"] };
const HOOK = { vip350: "Sealed for the troublemakers who showed up first. Everybody's favorite.", vip888: "Pop goes the after-party. What's under the foil?", vip1750: "Locked in velvet. For the ones going all in.", vip1313: "Called to the office. Lucky 13 inside.", vip2500: "Top-floor views. Contents classified.", vip3500: "Goes straight on your permanent record.", vip5000: "The royal vault. Velvet ropes only.", vipMonthly: "A fresh sealed drop every month. Cancel anytime.", vipBundle: "Three sealed drops, one flash price." };
function boxSvg(key) { const [a, b, bg] = DROP_C[key] || DROP_C.vip350, id = "g" + key;
  return `<svg class="wdl-box" viewBox="0 0 200 170" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><radialGradient id="${id}r"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="${bg}" stop-opacity="0"/></radialGradient></defs>
  <circle cx="100" cy="88" r="84" fill="url(#${id}r)"/>${[[22, 30, "#F59E0B"], [176, 40, "#EC4899"], [30, 120, "#3B82F6"], [172, 126, "#10B981"], [60, 14, "#EF4444"], [148, 12, "#8B5CF6"]].map(([x, y, c], i) => `<rect x="${x}" y="${y}" width="7" height="12" rx="2" fill="${c}" transform="rotate(${i * 37} ${x} ${y})"/>`).join("")}
  <path d="M100 18l4 10 10 1-8 6 3 10-9-6-9 6 3-10-8-6 10-1z" fill="#F5C451"/>
  <rect x="44" y="70" width="112" height="84" rx="10" fill="url(#${id})"/><rect x="36" y="56" width="128" height="24" rx="8" fill="url(#${id})" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>
  <rect x="92" y="56" width="16" height="98" fill="#fff" fill-opacity=".85"/><path d="M100 56c-14-22-40-18-30-2 6 9 30 2 30 2zm0 0c14-22 40-18 30-2-6 9-30 2-30 2z" fill="#fff" fill-opacity=".92" stroke="${a}" stroke-width="2"/>
  <circle cx="100" cy="112" r="17" fill="#fff"/><text x="100" y="121" text-anchor="middle" font-size="24" font-weight="900" fill="${a}" font-family="Anton,sans-serif">?</text>
  <rect x="122" y="100" width="22" height="18" rx="4" fill="#fff" fill-opacity=".9"/><path d="M127 100v-5a6 6 0 0 1 12 0v5" fill="none" stroke="#fff" stroke-width="3"/></svg>`; }
const dropFine = `<p class="wdl-fine wdl-dropfine">What's in it? Revealed after checkout. Same drop for everyone. Not alcohol. <a href="#/policy/terms">Terms &amp; drop details</a></p>`;
function dropCard(t, opt = {}) { const url = cfg().WHOP[t.key];
  return `<div class="wdl-drop" style="--a:${(DROP_C[t.key] || DROP_C.vip350)[0]};--b:${(DROP_C[t.key] || DROP_C.vip350)[1]};--bg:${(DROP_C[t.key] || DROP_C.vip350)[2]}">${t.popular ? `<span class="wdl-popular">★ Most popular</span>` : opt.badge ? `<span class="wdl-popular">${opt.badge}</span>` : ""}
  ${boxSvg(t.key)}<h3>${esc(t.name)}</h3><p class="wdl-hook">${esc(HOOK[t.key] || t.tagline || "")}</p>
  <div class="wdl-vip-price">${opt.list ? `<s>${money(opt.list)}</s> ` : ""}${money(t.price)}${opt.per ? `<small>${opt.per}</small>` : ""}</div>${opt.extra || ""}
  ${url ? `<a class="wdl-btn wdl-claim" href="${esc(url)}" target="_blank" rel="noopener">Claim your drop</a>` : `<div class="wdl-notifywrap">${notifyForm("vip:" + t.key)}</div>`}${dropFine}</div>`; }
function vipCard(t) { return dropCard(t); }
const buyOr = (key, label) => cfg().WHOP[key] ? `<a class="wdl-btn" href="${esc(cfg().WHOP[key])}" target="_blank" rel="noopener">${esc(label)}</a>` : `<p class="wdl-fine"><b>Reserve your spot</b> — checkout opens soon.</p>${notifyForm("vip:" + key)}`;
function flashEnd() { // next Sunday 11:59:59 PM Arizona (UTC-7, no DST); rolls forward weekly
  const az = new Date(Date.now() - 7 * 3600e3); const d = new Date(Date.UTC(az.getUTCFullYear(), az.getUTCMonth(), az.getUTCDate(), 23, 59, 59));
  d.setUTCDate(d.getUTCDate() + ((7 - az.getUTCDay()) % 7)); return d.getTime() + 7 * 3600e3;
}
function cd() { let ms = Math.max(0, flashEnd() - Date.now()); const D = Math.floor(ms / 864e5); ms -= D * 864e5; const H = Math.floor(ms / 36e5); ms -= H * 36e5; const M = Math.floor(ms / 6e4); const S = Math.floor((ms - M * 6e4) / 1e3); return [D, H, M, S].map((n, i) => `<span><b>${String(n).padStart(2, "0")}</b>${["days", "hrs", "min", "sec"][i]}</span>`).join(""); }
setInterval(() => { const e = document.getElementById("wdl-cd"); if (e) e.innerHTML = cd(); }, 1000);
function bundleCard() { const b = cfg().BUNDLE; if (!b) return ""; const ends = new Date(flashEnd()).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Phoenix" });
  return `<div class="wdl-bundlewrap">${dropCard(b, { badge: "⚡ Flash deal", list: b.list, extra: `<p class="wdl-tag">Save ${money(b.list - b.price)}</p><div class="wdl-cd" id="wdl-cd">${cd()}</div><p class="wdl-fine">Flash price ends ${ends}, 11:59 PM Arizona time.</p>` })}</div>`; }
function monthlyCard() { const m = cfg().MONTHLY; if (!m) return ""; return dropCard(m, { per: "/month", badge: "📅 Monthly" }); }
function wall() { setTimeout(async () => { const e = $("#wdl-wall"); if (!e) return; try { const w = (await api("wall")).wall; e.innerHTML = w.length ? w.map((p) => `<a class="wdl-who" href="#/u/${esc(p.handle)}">${av(p, 30)} #${p.vipNo} @${esc(p.handle)}</a>`).join(" ") : "<p>Be the first name on the wall.</p>"; } catch { e.innerHTML = "<p>Be the first name on the wall.</p>"; } }, 0);
  return `<div class="wdl-card"><h3>🏛️ Founders Wall</h3><div id="wdl-wall" class="wdl-row" style="gap:10px"><p>Loading…</p></div></div>`; }
function pVip() {
  return shell("OG Founding VIP Drops", `<div class="wdl-vip-hero"><p>Sealed drops for the bad boys and bad girls who showed up first. 🎁🎆</p></div>
  <div class="wdl-drops wdl-drops-main">${cfg().VIP.map(vipCard).join("")}</div>${bundleCard()}<h2 class="wdl-h2">Monthly drop</h2><div class="wdl-drops">${monthlyCard()}</div><h2 class="wdl-h2">More drops</h2><div class="wdl-drops">${cfg().MORE.map(vipCard).join("")}</div>${wall()}${LEGAL}`);
}
export function vipHero() {
  const T = cfg().VIP; if (!T.length) return "";
  return `<a class="wdl-vip-banner" href="#/vip"><span class="wdl-tag">New · OG Founding VIP</span><b>🎁 The Founding Members: OG VIP Mystery Drop is here</b><span>Most popular: $350 Founding Members Mystery Drop · treat yourself to Let's Pop $888 · or go all in with The Private Reserve $1,750</span><span class="wdl-fine">Sealed mystery drops. Revealed after checkout. Same drop for everyone.</span><span class="wdl-btn">See the drops</span></a>`;
}
function pCart() { return shell("No cart, no wine sales here", `<div class="wdl-card"><p>Wine Detention doesn't sell alcohol directly. Shop lockers at licensed partners, or pick up a gift card.</p><a class="wdl-btn" href="#/collections">Partner offers</a> <a class="wdl-btn ghost" href="#/gifts">Gift cards</a></div>${LEGAL}`); }
function pSoon(name) { return shell(name, `<div class="wdl-card"><h3>Opening after launch</h3><p>Live rooms, parties, trades and giveaways open once the hall has real members. Get notified first.</p>${notifyForm("community")}</div>`); }
function dropTerms() { const all = [...cfg().VIP, cfg().BUNDLE, cfg().MONTHLY, ...cfg().MORE].filter(Boolean);
  return `<h3 id="drops">OG Founding VIP drop contents</h3><p>Every drop has fixed contents, identical for every buyer. Nothing is random. Contents are Wine Detention gift credit plus profile perks; no alcohol is included. Gift credit is not cash.</p><ul>${all.map((t) => `<li><b>${esc(t.name)}</b> (${money(t.price)}${t.key === "vipMonthly" ? "/month" : ""}): ${money(t.credit || t.price * (1 + vipPct() / 100))} gift credit${t.key === "vipMonthly" ? " each month" : ""}; ${esc((t.perks || []).join(", "))}.</li>`).join("")}</ul><p>Bonus portion of credit is promotional and may expire 12 months after issue; paid value never expires.</p>`; }
function pPolicy(k) {
  const T = k === "privacy" ? ["Privacy Policy", `<p><b>Placeholder — to be finalized before launch.</b></p><p>We collect your email or wallet address (via Dynamic), your profile details, waitlist emails, and referral handles. We use them to run your account, points and gift credit and to tell you about launches. Card payments are processed by Whop; we never see your card number. Wine purchases happen on licensed partner sites under their own privacy policies; partner links include your public @handle as a referral tag. Email hello@winedetention.com to access or delete your data.</p>`] :
    ["Terms of Service", `<p><b>Placeholder — to be finalized before launch.</b></p><p>You must be 21 or older. Wine Detention does not sell, ship or deliver alcohol. Wine purchases are fulfilled by licensed partners, who are the sellers of record and handle age verification and shipping to permitted states. Gift cards, pre-launch credits and memberships are sold via Whop and contain no alcohol. Gift card bonus credit is promotional, not cash, and may expire 12 months after issue; paid gift card value does not expire. Hall points are free, for fun and have no cash value. Welcome Spin odds are published on the spin page.</p>${dropTerms()}`];
  return shell(T[0], `<div class="wdl-card wdl-prose">${T[1]}</div>${LEGAL}`);
}
export function page(route) {
  if (!OWN.test(route)) return null;
  if (route === "/login" || route === "/signup") return pLogin();
  if (route === "/account") return pAccount();
  if (route.startsWith("/u/")) return pProfile(route.slice(3));
  if (route === "/spin") return pSpin();
  if (route === "/quests") return pQuests();
  if (route === "/leaderboard") return pBoard();
  if (route === "/collections" || route === "/partners") return pCollections();
  if (route.startsWith("/product/")) return pProduct(route.slice(9));
  if (route === "/gifts/redeem") return pRedeem();
  if (route === "/vip") return pVip();
  if (route.startsWith("/gifts")) return pGifts();
  if (/^\/(cart|checkout|confirmation)$/.test(route)) return pCart();
  if (route.startsWith("/policy/")) return pPolicy(route.slice(8));
  return pSoon({ "/live": "Live rooms", "/party": "Party", "/trade": "Trades", "/giveaways": "Giveaways" }[route] || "Coming soon");
}
export const owns = (route) => OWN.test(route);
export function bind(route) {
  document.querySelectorAll(".wdl-notify[data-item]").forEach((f) => (f.onsubmit = async (e) => { e.preventDefault(); const i = f.querySelector("input"); try { await api("notify", { email: i.value, item: f.dataset.item }); f.innerHTML = "<p>You're on the list ✓</p>"; } catch (er) { toast(errText(er)); } }));
  document.querySelectorAll("[data-notify]").forEach((b) => (b.onclick = () => { b.outerHTML = notifyForm(b.dataset.notify); bind(route); }));
  document.querySelectorAll("[data-logout]").forEach((b) => (b.onclick = logout));
  document.querySelectorAll("[data-ref]").forEach((b) => (b.onclick = () => localStorage.setItem("wd-ref", b.dataset.ref)));
  document.querySelectorAll("[data-share]").forEach((b) => (b.onclick = () => { const u = location.origin + "/" + ME.handle; navigator.share ? navigator.share({ title: "@" + ME.handle + " on Wine Detention", url: u }).catch(() => {}) : navigator.clipboard.writeText(u).then(() => toast("Link copied: " + u)); }));
  document.querySelectorAll("[data-reroll]").forEach((b) => (b.onclick = async () => { try { ME = (await api("reroll", { what: b.dataset.reroll })).me; rerender(); W().paintAuth && W().paintAuth(); } catch (e) { toast(errText(e)); } }));
  document.querySelectorAll("[data-quest]").forEach((b) => (b.onclick = async () => { try { const d = await api("quest", { id: b.dataset.quest }); DONE[b.dataset.quest] = 1; ME.points = d.points; toast("+" + d.reward + " pts"); if (b.dataset.quest === "share" && ME) { const u = location.origin + "/" + ME.handle; navigator.share ? navigator.share({ url: u }).catch(() => {}) : navigator.clipboard && navigator.clipboard.writeText(u); } if (b.dataset.href) location.hash = b.dataset.href; else rerender(); } catch (e) { toast(errText(e)); } }));
  const up = $("#wdl-up"); if (up) up.onchange = async () => { const f = up.files[0]; if (!f) return; try { const d = await resizeImg(f); ME = (await api("avatar", { dataUrl: d })).me; toast("Photo updated"); rerender(); W().paintAuth && W().paintAuth(); } catch (e) { toast(errText(e)); } };
  document.querySelectorAll("[data-sharep]").forEach((b) => (b.onclick = () => { const u = location.origin + "/" + b.dataset.sharep; navigator.share ? navigator.share({ url: u }).catch(() => {}) : navigator.clipboard.writeText(u).then(() => toast("Link copied")); }));
  const pf = $("#wdl-prof"); if (pf) pf.onsubmit = async (e) => { e.preventDefault(); const f = new FormData(pf); try { ME = (await api("profile", { displayName: f.get("displayName"), bio: f.get("bio"), city: f.get("city"), cover: f.get("cover") || "0" })).me; const nh = String(f.get("handle") || "").toLowerCase(); if (nh && nh !== ME.handle) ME = (await api("reroll", { handle: nh })).me; toast("Saved"); rerender(); } catch (er) { toast(errText(er)); } };
  const rd = $("#wdl-redeem"); if (rd) rd.onsubmit = async (e) => { e.preventDefault(); try { const d = await api("redeem", { code: $("#wdl-gcode").value }); ME.credit = d.credit; if (d.tier) { ME.vip = d.tier; ME.vipNo = d.vipNo; } rerender(); reveal(d); } catch (er) { toast(errText(er)); } };
  if (route === "/login" || route === "/signup") bindLogin();
  if (route === "/spin") bindSpin();
}
export function authBtn() {
  if (ME) return `<a href="#/account" class="account-link wdl-acct" title="@${esc(ME.handle)}">${av(ME, 34)}</a>`;
  return `<a href="#/login" class="login-link">${authState === "soon" ? "Join list" : "Log in"}</a>`;
}
window.WDL = { page, owns, bind, authBtn, avatar, vipHero };
/* /handle and /u/handle deep links -> SPA profile; ?ref= captures referrals */
const qref = new URLSearchParams(location.search).get("ref"); if (qref) localStorage.setItem("wd-ref", qref.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20));
const pm = location.pathname.match(/^\/(?:u\/)?@?([a-z0-9_]{3,20})\/?$/i);
if (pm && !location.hash) { localStorage.setItem("wd-ref", pm[1].toLowerCase()); history.replaceState(null, "", "/#/u/" + pm[1].toLowerCase()); }
rerender(); W().paintAuth && W().paintAuth();
bootAuth();
