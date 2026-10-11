/* Wine Detention live layer: Dynamic sign-in, KV accounts, partner lockers, Whop gift cards, waitlist.
   Loaded as a module after the main app script. Owns the routes listed in OWN. */
const C = window.WD_CONFIG || {}, V = C.DYNAMIC_SDK_VERSION || "1.39.1";
const W = () => window.WD || {};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (n) => "$" + Number(n).toFixed(2).replace(/\.00$/, "");
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
const cfg = () => { const o = OV || {}; return { WHOP: { ...(C.WHOP_LINKS || {}), ...(o.WHOP_LINKS || {}) }, PARTNERS: o.PARTNERS || C.PARTNERS || [], LOCKERS: { ...(C.LOCKERS || {}), ...(o.LOCKERS || {}) }, OFFERS: o.OFFERS || C.OFFERS || [], VIP: o.VIP_TIERS || C.VIP_TIERS || [], BONUS: o.GIFT_BONUS || C.GIFT_BONUS || { pct: 0 } }; };
const GIFTS = [25, 50, 100, 250, 350];
const vipFlair = (m) => { if (!m || !m.vip) return ""; const t = (cfg().VIP.find((x) => x.key === m.vip) || {}); return `<span class="wdl-flair wdl-th-${esc(t.theme || "pass")}">${esc(t.emoji || "⭐")} OG Founding VIP #${m.vipNo} · ${esc(t.name || "")}</span>`; };
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
    const [core, evm, sol] = await Promise.all([import(`https://esm.sh/@dynamic-labs-sdk/client@${V}`), import(`https://esm.sh/@dynamic-labs-sdk/evm@${V}`).catch(() => null), import(`https://esm.sh/@dynamic-labs-sdk/solana@${V}`).catch(() => null)]);
    D = core; client = D.createDynamicClient({ autoInitialize: false, environmentId: SRV.dynamicEnvId, metadata: { name: "Wine Detention", universalLink: location.origin } });
    evm && evm.addEvmExtension && evm.addEvmExtension(); sol && sol.addSolanaExtension && sol.addSolanaExtension();
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
  if (ME) return shell("You're in", `<div class="wdl-card wdl-center">${avatar(ME.avSeed, 88)}<h3>@${esc(ME.handle)}</h3><p>Member #${ME.member}</p><a class="wdl-btn" href="#/account">My account</a> <button class="wdl-btn ghost" data-logout>Log out</button></div>`);
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
  return shell("My account", `<div class="wdl-card wdl-pro">${avatar(ME.avSeed, 96)}<div><h3>${esc(ME.displayName || "@" + ME.handle)}</h3><p>@${esc(ME.handle)} · Member #${ME.member}</p>${vipFlair(ME)}<p><b>${ME.points.toLocaleString()}</b> hall points · <b>${money(ME.credit)}</b> gift credit</p>
    <div class="wdl-row"><button class="wdl-btn ghost" data-reroll="avatar">🎲 New avatar</button><button class="wdl-btn ghost" data-reroll="handle">🎲 Random handle</button><button class="wdl-btn ghost" data-share>Share my link</button><button class="wdl-btn ghost" data-logout>Log out</button></div></div></div>
   <form class="wdl-card wdl-form" id="wdl-prof"><h3>Edit profile</h3><label>Display name<input name="displayName" maxlength="32" value="${esc(ME.displayName)}"></label><label>City<input name="city" maxlength="40" value="${esc(ME.city)}"></label><label>Bio<textarea name="bio" maxlength="160">${esc(ME.bio)}</textarea></label><label>Handle<input name="handle" maxlength="20" value="${esc(ME.handle)}" pattern="[a-z0-9_]{3,20}"></label><button class="wdl-btn">Save</button></form>
   <div class="wdl-grid3"><a class="wdl-card" href="#/spin"><h3>🎡 Welcome Spin</h3><p>${ME.welcome == null ? "Ready to spin" : "Won " + (+ME.welcome).toLocaleString() + " pts"}</p></a><a class="wdl-card" href="#/quests"><h3>✅ Daily quests</h3><p>Free points every day</p></a><a class="wdl-card" href="#/gifts/redeem"><h3>🎁 Redeem a code</h3><p>Add gift credit</p></a></div>`);
}
function pProfile(h) {
  h = h.toLowerCase().replace(/^@/, "");
  setTimeout(async () => { const box = $("#wdl-pub"); if (!box) return; try { const p = (await api("profile", undefined, "&h=" + encodeURIComponent(h))).profile;
    box.innerHTML = `<div class="wdl-card wdl-pro">${avatar(p.avSeed, 96)}<div><h3>${esc(p.displayName || "@" + p.handle)}</h3><p>@${esc(p.handle)} · Member #${p.member}${p.city ? " · " + esc(p.city) : ""}</p>${vipFlair(p)}<p>${esc(p.bio)}</p><p><b>${p.points.toLocaleString()}</b> hall points</p>${ME ? "" : `<a class="wdl-btn" href="#/login" data-ref="${esc(p.handle)}">Join Wine Detention</a>`}</div></div>`; }
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
  const t = cfg().VIP.find((x) => x.key === d.tier);
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
    box.innerHTML = d.board.length ? `<table class="wdl-table"><tr><th>#</th><th>Member</th><th>Points</th></tr>${d.board.map((p, i) => `<tr><td>${i + 1}</td><td><a href="#/u/${esc(p.handle)}" class="wdl-who">${avatar(p.avSeed, 28)} @${esc(p.handle)}</a></td><td>${p.points.toLocaleString()}</td></tr>`).join("")}</table>` : "<p>No members yet. Be the first.</p>"; }
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
function vipCard(t) {
  const credit = t.price * (1 + vipPct() / 100), url = cfg().WHOP[t.key];
  return `<div class="wdl-card wdl-vip wdl-th-${esc(t.theme)}${t.popular ? " wdl-pop" : ""}">${t.popular ? `<span class="wdl-popular">★ Most popular</span>` : ""}<div class="wdl-vip-top"><span class="wdl-vip-emoji">${esc(t.emoji)}</span><span class="wdl-tag">OG Founding VIP</span></div><h3>${esc(t.name)}</h3><p class="wdl-vip-tag">${esc(t.tagline)}</p>
  <div class="wdl-vip-price">${money(t.price)}</div><p class="wdl-vip-credit">= <b>${money(credit)}</b> gift credit <small>(${money(t.price)} + ${vipPct()}% bonus credit)</small></p>
  <ul>${t.perks.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>${url ? `<a class="wdl-btn" href="${esc(url)}" target="_blank" rel="noopener">Get the ${esc(t.name)}</a>` : `<p class="wdl-fine"><b>Reserve your pass</b> — checkout opens soon.</p>${notifyForm("vip:" + t.key)}`}</div>`;
}
function pVip() {
  return shell("OG Founding VIP", `<div class="wdl-vip-hero"><p>Bad kids get the best seats. 🎓 These are the founding passes for the troublemakers who showed up first: a numbered OG badge, VIP flair, and priority on every pre-launch reservation and partner drop.</p></div>
  <div class="wdl-grid wdl-vip-grid">${cfg().VIP.map(vipCard).join("")}</div>
  <div class="wdl-card"><h3>How the credit works</h3><p>Every pass converts to Wine Detention gift credit: the price you pay <b>plus a fixed ${vipPct()}% bonus credit</b>. Same bonus for everyone, no spin, no chance. Credit never drops below what you paid.</p>
  <p class="wdl-fine">Gift credit is not cash, can't be exchanged for cash (except where law requires), and isn't alcohol. Bonus credit is promotional and may expire 12 months after issue; paid value never expires. After checkout we email a VIP code; redeem it under Gifts → Redeem to unlock your numbered badge with a confetti reveal. Passes are paid by card through Whop.</p></div>${LEGAL}`, "For the bad boys and bad girls of detention. Founding members only.");
}
export function vipHero() {
  const T = cfg().VIP; if (!T.length) return "";
  return `<a class="wdl-vip-banner" href="#/vip"><span class="wdl-tag">New · OG Founding VIP</span><b>🎁 The Founding Members: OG VIP Mystery Drop is here</b><span>Most popular: $350 Founding Members Mystery Drop · also Let's Pop $888 · Treat Yo'self $1,750</span><span class="wdl-fine">Get price + ${vipPct()}% in gift credit, a numbered OG badge and first access.</span><span class="wdl-btn">See the passes</span></a>`;
}
function pCart() { return shell("No cart, no wine sales here", `<div class="wdl-card"><p>Wine Detention doesn't sell alcohol directly. Shop lockers at licensed partners, or pick up a gift card.</p><a class="wdl-btn" href="#/collections">Partner offers</a> <a class="wdl-btn ghost" href="#/gifts">Gift cards</a></div>${LEGAL}`); }
function pSoon(name) { return shell(name, `<div class="wdl-card"><h3>Opening after launch</h3><p>Live rooms, parties, trades and giveaways open once the hall has real members. Get notified first.</p>${notifyForm("community")}</div>`); }
function pPolicy(k) {
  const T = k === "privacy" ? ["Privacy Policy", `<p><b>Placeholder — to be finalized before launch.</b></p><p>We collect your email or wallet address (via Dynamic), your profile details, waitlist emails, and referral handles. We use them to run your account, points and gift credit and to tell you about launches. Card payments are processed by Whop; we never see your card number. Wine purchases happen on licensed partner sites under their own privacy policies; partner links include your public @handle as a referral tag. Email hello@winedetention.com to access or delete your data.</p>`] :
    ["Terms of Service", `<p><b>Placeholder — to be finalized before launch.</b></p><p>You must be 21 or older. Wine Detention does not sell, ship or deliver alcohol. Wine purchases are fulfilled by licensed partners, who are the sellers of record and handle age verification and shipping to permitted states. Gift cards, pre-launch credits and memberships are sold via Whop and contain no alcohol. Gift card bonus credit is promotional, not cash, and may expire 12 months after issue; paid gift card value does not expire. Hall points are free, for fun and have no cash value. Welcome Spin odds are published on the spin page.</p>`];
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
  const pf = $("#wdl-prof"); if (pf) pf.onsubmit = async (e) => { e.preventDefault(); const f = new FormData(pf); try { ME = (await api("profile", { displayName: f.get("displayName"), bio: f.get("bio"), city: f.get("city") })).me; const nh = String(f.get("handle") || "").toLowerCase(); if (nh && nh !== ME.handle) ME = (await api("reroll", { handle: nh })).me; toast("Saved"); rerender(); } catch (er) { toast(errText(er)); } };
  const rd = $("#wdl-redeem"); if (rd) rd.onsubmit = async (e) => { e.preventDefault(); try { const d = await api("redeem", { code: $("#wdl-gcode").value }); ME.credit = d.credit; if (d.tier) { ME.vip = d.tier; ME.vipNo = d.vipNo; } rerender(); reveal(d); } catch (er) { toast(errText(er)); } };
  if (route === "/login" || route === "/signup") bindLogin();
  if (route === "/spin") bindSpin();
}
export function authBtn() {
  if (ME) return `<a href="#/account" class="account-link wdl-acct" title="@${esc(ME.handle)}">${avatar(ME.avSeed, 34)}</a>`;
  return `<a href="#/login" class="login-link">${authState === "soon" ? "Join list" : "Log in"}</a>`;
}
window.WDL = { page, owns, bind, authBtn, avatar, vipHero };
/* /handle and /u/handle deep links -> SPA profile; ?ref= captures referrals */
const qref = new URLSearchParams(location.search).get("ref"); if (qref) localStorage.setItem("wd-ref", qref.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20));
const pm = location.pathname.match(/^\/(?:u\/)?@?([a-z0-9_]{3,20})\/?$/i);
if (pm && !location.hash) { localStorage.setItem("wd-ref", pm[1].toLowerCase()); history.replaceState(null, "", "/#/u/" + pm[1].toLowerCase()); }
rerender(); W().paintAuth && W().paintAuth();
bootAuth();
