/* Site-wide Founding Detention giveaway promo bar.
   Text + end date from /api/wd?a=gw. Mobile: fixed bottom. Desktop: slim bar at top.
   Light theme only — no near-black. Hidden on #/giveaway. Dismiss = 24h. */
(function () {
  const KEY = "wd-gwbar-hide";
  const hash = () => (location.hash || "#/").replace(/^#/, "") || "/";
  try { if (+localStorage.getItem(KEY) > Date.now()) return; } catch (e) {}
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const css = `.gwbar{display:flex;align-items:center;gap:.7rem;justify-content:center;padding:.42rem 2.6rem .42rem 1rem;background:linear-gradient(90deg,#FFF1F2,#FFE4E6 40%,#FEF3C7);color:#0E3386;font:600 .85rem 'Plus Jakarta Sans',system-ui,sans-serif;border-bottom:1px solid #F5C2C7;position:relative;z-index:60}
.gwbar a.gwb-main{display:flex;align-items:center;gap:.7rem;color:#0E3386;text-decoration:none;min-width:0}
.gwb-chip{font:900 .66rem 'Plus Jakarta Sans',sans-serif;letter-spacing:.08em;text-transform:uppercase;background:#CC3433;color:#fff;border-radius:999px;padding:.22rem .6rem;white-space:nowrap}
.gwb-hook{font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gwb-cd{font:800 .78rem 'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;color:#A51E24;white-space:nowrap}
.gwb-go{background:#0E3386;color:#FFF8E6;border-radius:999px;padding:.3rem .8rem;font-weight:800;white-space:nowrap}
.gwb-x{position:absolute;right:.5rem;top:50%;transform:translateY(-50%);border:0;background:rgba(14,51,134,.1);color:#0E3386;width:26px;height:26px;border-radius:50%;font-size:1rem;line-height:1;cursor:pointer}
@media (max-width:760px){.gwbar{position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));z-index:85;border-radius:16px;border:1px solid #F5C2C7;box-shadow:0 10px 30px rgba(14,51,134,.2);padding:.55rem 2.4rem .55rem .7rem;justify-content:flex-start}
 .gwbar a.gwb-main{flex-wrap:wrap;gap:.25rem .5rem;flex:1}.gwb-hook{flex-basis:100%;white-space:normal;font-size:.82rem;line-height:1.2;order:3}.gwb-go{margin-left:auto;padding:.25rem .7rem;font-size:.78rem}
 body.has-gwbar{padding-bottom:calc(92px + env(safe-area-inset-bottom))}
 body.has-gwbar .botfab{bottom:calc(104px + env(safe-area-inset-bottom))!important}}`;
  function mount(d) {
    if (!d || !d.ok || !d.open || document.querySelector(".gwbar")) return;
    if (/^\/giveaway/.test(hash())) return;
    const p = (d.config && d.config.promo) || {};
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const bar = document.createElement("div"); bar.className = "gwbar"; bar.setAttribute("role", "region"); bar.setAttribute("aria-label", "Giveaway");
    bar.innerHTML = `<a class="gwb-main" href="#/giveaway"><span class="gwb-chip">${esc(p.chip || "🎁 Free giveaway · live")}</span><span class="gwb-hook">${esc(p.hook || "")}</span><span class="gwb-cd" aria-label="Time left"></span><span class="gwb-go">${esc(p.cta || "Enter free →")}</span></a><button class="gwb-x" type="button" aria-label="Dismiss for 24 hours">×</button>`;
    document.body.insertBefore(bar, document.body.firstChild); document.body.classList.add("has-gwbar");
    const cd = bar.querySelector(".gwb-cd");
    const tick = () => {
      let s = Math.max(0, (d.end - Date.now()) / 1000 | 0);
      const dd = s / 86400 | 0; s %= 86400; const h = s / 3600 | 0; s %= 3600; const m = s / 60 | 0; s %= 60;
      cd.textContent = `${dd}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      if (d.end <= Date.now()) close();
    };
    const t = setInterval(tick, 1000); tick();
    function close() { clearInterval(t); bar.remove(); document.body.classList.remove("has-gwbar"); }
    bar.querySelector(".gwb-x").onclick = () => { try { localStorage.setItem(KEY, String(Date.now() + 864e5)); } catch (e) {} close(); };
    window.addEventListener("hashchange", () => { if (/^\/giveaway/.test(hash())) close(); });
  }
  const go = () => fetch("/api/wd?a=gw").then((r) => r.json()).then(mount).catch(() => {});
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", go) : go();
})();
