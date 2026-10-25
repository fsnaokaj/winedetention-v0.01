/* Founding Detention Giveaway '26 — PuckGold-style landing (SPA hash route #/giveaway). */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const fmt = (n) => Number(n || 0).toLocaleString("en-US");
const $ = (s) => document.querySelector(s);
const W = () => window.WD || {};
const WDL = () => window.WDL || {};

let D = null, me = null, ME = null;

const COUNTRIES = [
  ["US", "United States"], ["CA", "Canada"], ["GB", "United Kingdom"], ["AU", "Australia"],
  ["NZ", "New Zealand"], ["IE", "Ireland"], ["DE", "Germany"], ["FR", "France"], ["ES", "Spain"],
  ["NL", "Netherlands"], ["SE", "Sweden"], ["NO", "Norway"], ["DK", "Denmark"], ["FI", "Finland"],
  ["MX", "Mexico"], ["JP", "Japan"], ["KR", "South Korea"], ["SG", "Singapore"], ["AE", "United Arab Emirates"],
  ["IN", "India"], ["PH", "Philippines"], ["ZA", "South Africa"], ["OTHER", "Other / not listed"],
].filter(([c]) => !["IT", "BR", "CN", "CU", "IR", "KP", "SY", "RU", "BY"].includes(c));

function cdHtml(end, start) {
  const tgt = Date.now() < start ? start : end;
  let s = Math.max(0, (tgt - Date.now()) / 1000 | 0);
  const d = s / 86400 | 0; s %= 86400; const h = s / 3600 | 0; s %= 3600; const m = s / 60 | 0; s %= 60;
  return [["Days", d], ["Hrs", h], ["Min", m], ["Sec", s]].map(([l, v]) => `<div><b>${String(v).padStart(2, "0")}</b><small>${l}</small></div>`).join("");
}

function NPN() {
  return `<div class="gw-npn"><b>NO PURCHASE NECESSARY.</b> A purchase will not increase your chances of winning. Paid items (VIP drops, gift cards, Whop checkout) never add entries.</div>`;
}

function rules(c) {
  const e = c.entries, el = c.eligibility, excl = Object.values(el.excludedCountries).concat(Object.values(el.excludedRegions));
  const prizeLines = c.prizes.map((p) => `<li><b>${esc(p.place)} — ${esc(p.title)}</b> (qty ${p.qty}, ARV ${money(p.arv)} each): ${esc(p.detail)}</li>`).join("");
  return `<div class="gw-rules"><h3>Official Rules · ${esc(c.name)}</h3>
  <p><b>1. NO PURCHASE NECESSARY TO ENTER OR WIN.</b> A purchase or payment of any kind will not increase your chances of winning. Void where prohibited.</p>
  <p><b>2. Sponsor.</b> ${esc(c.sponsor)}, contact ${esc(c.sponsorEmail)}. Promotion runs on winedetention.com.</p>
  <p><b>3. Eligibility (worldwide, 21+).</b> Open to legal residents of any country or territory who are at least ${el.minAge} years old or the age of majority where they live, if older. Void in ${esc(excl.join("; "))}; and ${esc(el.otherExcluded)}. Must be able to accept delivery of non-alcohol prizes. This brand is alcohol-adjacent; entrants must meet the site age gate (21+).</p>
  <p><b>4. Entry period.</b> Starts ${new Date(c.startsAt).toUTCString()} and ends ${new Date(c.endsAt).toUTCString()} (Thu Nov 26, 2026, 11:59 PM ET).</p>
  <p><b>5. How to enter (all free).</b> (a) Create a free Wine Detention account: +${e.account} entry. (b) Follow @winedetention on X: +${e.followX} (self-reported). (c) Follow @winedetention on TikTok: +${e.followTikTok} (self-reported). (d) Share your profile link once per day: +${e.share}. (e) Each friend who signs up with your link: +${e.referral} (verified, max ${e.referralCap}). (f) Complete daily quests: +${e.quest} each (max ${e.questDailyCap}/day). Paid products never add entries.</p>
  <p><b>6. Prizes &amp; ARV.</b> Total approximate retail value of all prizes: <b>${money(D.totalArv)}</b>. Prize list:</p><ul>${prizeLines}</ul>
  <p><b>No alcohol.</b> No wine, beer, spirits or any alcoholic beverage is awarded as a prize. Gift cards and VIP Mystery Drop credit are store credit only (not cash, not alcohol). Third-party product names identify prizes only; this promotion is not sponsored, endorsed or administered by those brands.</p>
  <p><b>7. Winner selection.</b> Winners are selected at random from eligible entries within ${c.drawWithinDays} days after the Entry Period ends. Odds depend on the number of eligible entries. Winners have ${c.claimDays} days to respond; an alternate may be drawn. Canadian winners may need a skill-testing math question.</p>
  <p><b>8. Participant rewards.</b> Every eligible entrant receives the virtual "${esc(c.participant.badge)}" badge and ${c.participant.points} hall points. Hall points are free, for fun, have no cash value and are not exchangeable for prizes.</p>
  <p><b>9. Publicity &amp; privacy.</b> Entry constitutes agreement to these rules and the Sponsor's <a href="#/policy/privacy">Privacy Policy</a> and <a href="#/policy/terms">Terms</a>. Winners list: email ${esc(c.sponsorEmail)} within 30 days after the drawing.</p>
  <p><b>10. General.</b> Sponsor may cancel or modify the promotion if fraud or technical failure compromises it. English rules control.</p></div>`;
}

function stack(c, gw) {
  const signed = !!ME;
  const joined = gw && gw.joined;
  const loc = `<div class="gw-loc"><label>Country <select id="gwCountry"><option value="">Pick your country</option>${COUNTRIES.map(([k, n]) => `<option value="${k}" ${gw && gw.country === k ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
    <label id="gwRegionWrap" hidden>Region <select id="gwRegion"></select></label></div>`;
  const btn = (label, act, extra = "") => `<button type="button" class="wdl-btn" data-gw="${esc(act)}" ${extra}>${label}</button>`;
  const rows = [
    { id: "account", title: "Create your account", sub: "Sign up free and enter.", entries: c.entries.account, done: joined, cta: joined ? "Entered ✓" : (signed ? "Enter free" : "Sign up free · enter"), act: signed ? "join" : "signup" },
    { id: "followX", title: "Follow @winedetention on X", sub: "Self-reported: tap Follow, we count the click.", entries: c.entries.followX, done: gw && gw.followedX, cta: "Follow on X", act: "follow", p: "x" },
    { id: "followTikTok", title: "Follow @winedetention on TikTok", sub: "Self-reported: tap Follow, we count the click.", entries: c.entries.followTikTok, done: gw && gw.followedTikTok, cta: "Follow on TikTok", act: "follow", p: "tiktok" },
    { id: "share", title: "Share your profile link", sub: "Once per day.", entries: c.entries.share, done: gw && gw.sharedToday, cta: "Share today", act: "share" },
    { id: "referral", title: "Friends who sign up with your link", sub: `+${c.entries.referral} each · max ${c.entries.referralCap}. Verified server-side.`, entries: c.entries.referral, done: false, cta: "Copy invite link", act: "invite" },
    { id: "quest", title: "Daily quests", sub: `+${c.entries.quest} per quest · max ${c.entries.questDailyCap}/day. Today: ${(gw && gw.questToday) || 0}.`, entries: c.entries.quest, done: false, cta: "Open quests", act: "quests" },
  ];
  return `<div class="gw-stack">${loc}${rows.map((r) => `<div class="gw-card ${r.done ? "done" : ""}"><div class="gw-plus">+${r.entries}</div><div><h3>${esc(r.title)}</h3><p>${esc(r.sub)}</p></div><div>${r.done ? `<span class="wdl-done">Done ✓</span>` : btn(r.cta, r.act, r.p ? `data-p="${r.p}"` : "")}</div></div>`).join("")}</div>`;
}

function prizes(c) {
  return `<div class="gw-prizes">${c.prizes.map((p) => `<div class="gw-prize gw-tier-${esc(p.tier || "mid")}"><span class="gw-place">${esc(p.place)}</span><h3>${esc(p.title)}</h3><p>${esc(p.detail)}</p><div class="gw-arv"><b>${money(p.arv)}</b> ARV · ×${p.qty}</div></div>`).join("")}</div>
  <p class="wdl-fine">Total published ARV: <b>${money(D.totalArv)}</b>. No alcohol is awarded.</p>`;
}

function board() {
  const rows = (D.board || []).map((r) => `<tr><td>${r.rank}</td><td><a href="#/u/${esc(r.handle)}">@${esc(r.handle)}</a></td><td><b>${fmt(r.entries)}</b></td></tr>`).join("");
  return `<div class="gw-tbl"><table><thead><tr><th>#</th><th>Entrant</th><th>Entries</th></tr></thead><tbody>${rows || `<tr><td colspan="3" class="muted">No entrants yet — be the first.</td></tr>`}</tbody></table></div>`;
}

function render() {
  if (!D || !D.config) return `<section class="wdl"><div class="wdl-card"><p>Loading giveaway…</p></div></section>`;
  const c = D.config;
  const open = D.open;
  const you = me ? `<div class="gw-you"><b>${fmt(me.entries)}</b> your entries${me.rank ? ` · rank #${me.rank}` : ""}${me.badge ? ` · 🏅 ${esc(me.badge)}` : ""}</div>` : "";
  return `<section class="wdl gw-page">
  <nav class="gw-tabs" aria-label="Giveaway sections">
    ${[["gw-home", "Home"], ["gw-enter", "How to enter"], ["gw-prizes", "Prizes"], ["gw-board", "Board"], ["gw-rules", "Rules"]].map(([id, t]) => `<a href="#${id}" data-spy="${id}">${t}</a>`).join("")}
  </nav>
  <header class="gw-hero" id="gw-home">
    <span class="wdl-tag">🌍 Worldwide · 🎁 Enter free · Live now · 21+</span>
    <h1>${esc(c.name)}</h1>
    <p class="lead">Win up to a <b>$350 gift card</b>, professional <b>teeth whitening strips</b>, VIP Mystery Drop credit and Detention swag — ${money(D.totalArv)} in published ARV. Everyone who enters gets a badge and ${c.participant.points} hall points.</p>
    ${NPN()}
    <div class="gw-cd" id="gwCd">${cdHtml(D.end, D.start)}</div>
    <p class="wdl-fine">Entries close Nov 26, 2026 · 11:59 PM ET</p>
    <div class="gw-stats"><div><b id="gwTotal">${fmt(D.total)}</b><span>entries</span></div><div><b id="gwEnt">${fmt(D.entrants)}</b><span>entrants</span></div></div>
    ${you}
    ${open ? (ME ? `<a class="wdl-btn" href="#gw-enter">Stack free entries</a>` : `<a class="wdl-btn" href="#/login">Create account · enter free</a>`) : `<p class="wdl-card">This giveaway is closed.</p>`}
    <a class="wdl-btn ghost" href="#gw-rules">Official rules</a>
  </header>
  <section id="gw-enter" class="gw-sec"><span class="kicker">Stack entries</span><h2>How to enter</h2><p class="lead">Every way to enter is free. Entries count only during the entry period.</p>${stack(c, me)}${NPN()}</section>
  <section id="gw-prizes" class="gw-sec"><span class="kicker">Prize vault</span><h2>Prizes</h2><p class="lead">Whitening strips are featured because they go great with wine nights and coffee mornings. Gift cards and VIP credit are store credit only — never alcohol.</p>${prizes(c)}</section>
  <section id="gw-board" class="gw-sec"><span class="kicker">Live board</span><h2>Board</h2><p class="lead">Most free entries so far. More entries = better odds, not a guaranteed win.</p>${board()}</section>
  <section id="gw-rules" class="gw-sec"><span class="kicker">Read before entering</span><h2>Rules</h2>${NPN()}${rules(c)}</section>
  <p class="wdl-fine">Hall points are free, for fun and have no cash value. Must be 21+.</p>
  </section>`;
}

async function api(a, body) {
  const headers = { "Content-Type": "application/json" };
  try {
    const tok = window.__WD_TOKEN || (window.WDL && window.WDL._tok);
    // pull token from live layer via a small hook
  } catch {}
  const liveApi = window.__wdApi;
  if (liveApi) return liveApi(a, body);
  const r = await fetch("/api/wd?a=" + a, { method: "POST", headers, body: JSON.stringify(body || {}) });
  const d = await r.json();
  if (!r.ok || !d.ok) throw Object.assign(new Error(d.error || "error"), { status: r.status });
  return d;
}

function toast(m) { if (W().toast) W().toast(m); else alert(m); }

function wireLoc() {
  const sel = $("#gwCountry"), wrap = $("#gwRegionWrap"), rs = $("#gwRegion");
  if (!sel || !D) return;
  const regs = (D.config.eligibility.regionRequired) || {};
  const sync = () => {
    const list = regs[sel.value];
    wrap.hidden = !list;
    if (!list) { rs.innerHTML = ""; return; }
    rs.innerHTML = `<option value="">Pick region</option>` + Object.entries(list).map(([k, n]) => `<option value="${k}" ${me && me.region === k ? "selected" : ""}>${esc(n)}</option>`).join("");
  };
  sel.onchange = sync; sync();
}

function tick() {
  const el = $("#gwCd"); if (!el || !D) return;
  el.innerHTML = cdHtml(D.end, D.start);
}

async function act(b) {
  const k = b.dataset.gw;
  try {
    if (k === "signup") { location.hash = "#/login"; return; }
    if (k === "quests") { location.hash = "#/quests"; return; }
    if (k === "invite") {
      if (!ME) { location.hash = "#/login"; return; }
      const u = location.origin + "/" + ME.handle;
      if (navigator.clipboard) await navigator.clipboard.writeText(u);
      toast("Invite link copied: " + u);
      return;
    }
    if (!ME) { location.hash = "#/login"; return; }
    if (k === "join") {
      const country = ($("#gwCountry") || {}).value || "";
      const region = ($("#gwRegion") || {}).value || "";
      if (!country) { toast("Pick your country first"); ($("#gwCountry") || {}).focus?.(); return; }
      const d = await api("gwjoin", { country, region });
      me = d.gw; ME = d.me || ME;
      toast(d.justJoined ? `You're in! +${D.config.entries.account} entry · badge · +${D.config.participant.points} pts` : "Already entered ✓");
      rerender(); return;
    }
    if (k === "follow") {
      const p = b.dataset.p;
      window.open(p === "x" ? "https://x.com/winedetention" : "https://www.tiktok.com/@winedetention", "_blank", "noopener");
      const d = await api("gwfollow", { platform: p });
      me = d.gw; toast(d.added ? `+${d.added} entries` : "Already counted ✓");
      rerender(); return;
    }
    if (k === "share") {
      if (ME) {
        const u = location.origin + "/" + ME.handle;
        if (navigator.share) navigator.share({ title: "@" + ME.handle + " on Wine Detention", url: u }).catch(() => {});
        else if (navigator.clipboard) await navigator.clipboard.writeText(u);
      }
      const d = await api("gwshare", {});
      me = d.gw; toast(d.added ? `+${d.added} entry` : "Already shared today ✓");
      rerender(); return;
    }
  } catch (e) {
    const m = e && e.message;
    if (m === "need_region") toast("Pick your region / province");
    else if (m === "location_excluded" || m === "excluded") toast("Sorry — not available in your location");
    else if (m === "bad_country") toast("Pick a valid country");
    else if (m === "giveaway_closed") toast("Giveaway is closed");
    else toast(m || "Something went wrong");
  }
}

function rerender() {
  const root = document.getElementById("app") || document.querySelector("main") || document.querySelector("[data-view]");
  // Prefer Wine Detention's own render
  if (W().render) { W().render(); return; }
}

export function pageHtml(member) {
  ME = member || ME;
  return render();
}

export async function load(member, apiFn) {
  ME = member || null;
  if (apiFn) window.__wdApi = apiFn;
  try {
    const pub = await fetch("/api/wd?a=gw").then((r) => r.json());
    if (!pub.ok) throw new Error(pub.error || "gw_unavailable");
    D = pub;
  } catch (e) {
    D = { ok: false, config: null, error: String(e && e.message || e) };
  }
  if (ME && window.__wdApi) {
    try { const d = await window.__wdApi("gwme", {}); me = d.gw; if (d.me) ME = d.me; } catch { me = null; }
  } else me = null;
  return D;
}

export function bind(member, apiFn) {
  ME = member || ME;
  if (apiFn) window.__wdApi = apiFn;
  wireLoc();
  tick();
  clearInterval(window._wdGwT); window._wdGwT = setInterval(tick, 1000);
  document.querySelectorAll("[data-gw]").forEach((b) => (b.onclick = () => act(b)));
}

export function setMember(m) { ME = m; }
