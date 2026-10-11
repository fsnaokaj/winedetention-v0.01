/* Light-theme share card (1200x630 PNG) + OG meta injection for winedetention.com/<handle>. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fonts");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
export function glassSvg(seed) {
  const h = hash(seed), hue = h % 360, wine = ["#9B1B30", "#CC3433", "#E7A0B4", "#F2D16B", "#7A1F4A"][h % 5], eyes = ["dots", "happy", "wink", "shades"][(h >> 3) % 4], mouth = ["smile", "o", "grin"][(h >> 6) % 3];
  const E = { dots: '<circle cx="42" cy="40" r="3.5" fill="#161823"/><circle cx="58" cy="40" r="3.5" fill="#161823"/>', happy: '<path d="M38 41q4-5 8 0M54 41q4-5 8 0" stroke="#161823" stroke-width="3" fill="none" stroke-linecap="round"/>', wink: '<circle cx="42" cy="40" r="3.5" fill="#161823"/><path d="M54 40h8" stroke="#161823" stroke-width="3" stroke-linecap="round"/>', shades: '<rect x="35" y="35" width="13" height="8" rx="3" fill="#161823"/><rect x="52" y="35" width="13" height="8" rx="3" fill="#161823"/><path d="M48 38h4" stroke="#161823" stroke-width="2"/>' }[eyes];
  const M = { smile: '<path d="M44 50q6 6 12 0" stroke="#161823" stroke-width="3" fill="none" stroke-linecap="round"/>', o: '<ellipse cx="50" cy="52" rx="3.5" ry="4.5" fill="#161823"/>', grin: '<path d="M43 49h14q-2 8-7 8t-7-8z" fill="#161823"/>' }[mouth];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="400" height="400"><rect width="100" height="100" fill="hsl(${hue},85%,92%)"/><path d="M28 24h44q2 30-22 38-24-8-22-38z" fill="#fff" stroke="#0E3386" stroke-width="3"/><path d="M30 34h40q-2 22-20 27-18-5-20-27z" fill="${wine}"/>${E}${M}<path d="M50 62v18M38 82h24" stroke="#0E3386" stroke-width="4" stroke-linecap="round"/></svg>`;
}
export function cardSvg(c) {
  const handle = "@" + c.handle, hs = Math.min(84, Math.floor(620 / (handle.length * 0.58)));
  const av = c.avatar || "data:image/svg+xml;base64," + Buffer.from(glassSvg(c.avSeed || c.handle)).toString("base64");
  const num = `Member #${Number(c.member || 0).toLocaleString("en-US")}`, vip = c.vipName ? `OG Founding VIP #${c.vipNo}` : "";
  const link = `${c.host}/${c.handle}`, ls = Math.min(32, Math.floor(600 / (link.length * 0.56)));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".6" stop-color="#F3F6FF"/><stop offset="1" stop-color="#FFF1E6"/></linearGradient>
<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6E3B4"/><stop offset="1" stop-color="#C9A962"/></linearGradient>
<clipPath id="av"><circle cx="260" cy="315" r="180"/></clipPath></defs>
<rect width="1200" height="630" fill="url(#bg)"/><rect y="610" width="1200" height="20" fill="#CC3433"/>
<circle cx="260" cy="315" r="196" fill="url(#gold)"/><rect x="80" y="135" width="360" height="360" fill="#fff" clip-path="url(#av)"/><image href="${av}" x="80" y="135" width="360" height="360" clip-path="url(#av)" preserveAspectRatio="xMidYMid slice"/>
<text x="500" y="110" font-size="40" font-weight="800" fill="#CC3433" letter-spacing="4">WINE DETENTION</text>
<text x="500" y="225" font-size="${hs}" font-weight="800" fill="#0E3386">${esc(handle)}</text>
<rect x="500" y="255" width="${num.length * 21 + 56}" height="58" rx="29" fill="#0E3386"/><text x="528" y="295" font-size="32" font-weight="800" fill="#FFFFFF">${esc(num)}</text>
${vip ? `<rect x="${num.length * 21 + 572}" y="255" width="${vip.length * 18 + 50}" height="58" rx="29" fill="url(#gold)"/><text x="${num.length * 21 + 596}" y="294" font-size="29" font-weight="800" fill="#3D2E12">${esc(vip)}</text>` : ""}
<text x="500" y="385" font-size="38" font-weight="800" fill="#161823">Join the hall with my link</text>
<text x="500" y="430" font-size="26" font-weight="600" fill="#73747B">Free Welcome Spin + hall points. 21+ only.</text>
<rect x="500" y="470" width="${Math.round(link.length * ls * 0.56 + 60)}" height="68" rx="34" fill="#CC3433"/><text x="530" y="${515 - (32 - ls) / 2}" font-size="${ls}" font-weight="800" fill="#FFFFFF">${esc(link)}</text></svg>`;
}
let Resvg = null;
export async function cardPng(c) {
  if (!Resvg) Resvg = (await import("@resvg/resvg-js")).Resvg;
  const r = new Resvg(cardSvg(c), { fitTo: { mode: "width", value: 1200 }, font: { fontFiles: ["bric-800.ttf", "bric-600.ttf"].map((f) => path.join(DIR, f)), loadSystemFonts: false, defaultFontFamily: "Bricolage Grotesque" } });
  return r.render().asPng();
}
export function injectMeta(html, m) {
  const t = [`<meta property="og:site_name" content="Wine Detention">`, `<meta property="og:type" content="profile">`, `<meta property="og:url" content="${esc(m.url)}">`, `<meta property="og:title" content="${esc(m.title)}">`, `<meta property="og:description" content="${esc(m.description)}">`, `<meta property="og:image" content="${esc(m.image)}">`, `<meta property="og:image:width" content="1200">`, `<meta property="og:image:height" content="630">`, `<meta name="twitter:card" content="summary_large_image">`, `<meta name="twitter:title" content="${esc(m.title)}">`, `<meta name="twitter:image" content="${esc(m.image)}">`, `<meta name="description" content="${esc(m.description)}">`].join("\n");
  return html.replace(/<meta (property|name)="(og|twitter):[^"]*"[^>]*>/g, "").replace(/<meta name="description"[^>]*>/g, "").replace(/<title>[^<]*<\/title>/, `<title>${esc(m.title)}</title>`).replace("</head>", t + "\n</head>");
}
