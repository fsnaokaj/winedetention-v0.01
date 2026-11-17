/* Seeded, generated profile banners + QR codes. No external services. Light/bright palettes only. */
import qrcode from "./vendor/qrcode.mjs";
const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
function rng(seed) { let x = hash(seed) || 1; return () => ((x = Math.imul(x ^ (x >>> 15), 2246822507) ^ Math.imul(x ^ (x >>> 13), 3266489909)) >>> 0) / 4294967296; }
const PAL = [["#FFF1F2", "#FFE4E6", "#CC3433", "#0E3386", "#F5C451"], ["#EFF6FF", "#DBEAFE", "#0E3386", "#60A5FA", "#F472B6"], ["#FEFCE8", "#FEF3C7", "#EA580C", "#0E3386", "#22C55E"],
  ["#F0FDF4", "#DCFCE7", "#059669", "#0E3386", "#F59E0B"], ["#FDF4FF", "#FAE8FF", "#A21CAF", "#0E3386", "#FB7185"], ["#ECFEFF", "#CFFAFE", "#0E7490", "#CC3433", "#FDE047"],
  ["#FFF7ED", "#FFEDD5", "#C2410C", "#7C3AED", "#0E3386"], ["#F5F3FF", "#EDE9FE", "#6D28D9", "#CC3433", "#FBBF24"]];
export const BANNER_STYLES = 8;
/** style: 0 confetti · 1 hall-pass tickets · 2 polka · 3 stripes · 4 stars · 5 waves · 6 chalk doodles · 7 bubbles */
export function bannerSvg(seed, style) {
  const R = rng(seed), st = style >= 0 ? style % BANNER_STYLES : Math.floor(R() * BANNER_STYLES), p = PAL[Math.floor(R() * PAL.length)], W = 600, H = 200; let g = "";
  const c = () => p[2 + Math.floor(R() * 3)];
  if (st === 0) for (let i = 0; i < 70; i++) g += `<rect x="${R() * W}" y="${R() * H}" width="${4 + R() * 8}" height="${8 + R() * 12}" rx="2" fill="${c()}" opacity=".8" transform="rotate(${R() * 360} ${R() * W} ${R() * H})"/>`;
  if (st === 1) for (let i = 0; i < 14; i++) { const x = R() * W, y = R() * H, a = R() * 50 - 25, col = c(); g += `<g transform="translate(${x} ${y}) rotate(${a})" opacity=".85"><rect x="-34" y="-16" width="68" height="32" rx="6" fill="#fff" stroke="${col}" stroke-width="3"/><circle cx="-34" cy="0" r="6" fill="${p[0]}"/><circle cx="34" cy="0" r="6" fill="${p[0]}"/><text x="0" y="5" text-anchor="middle" font-size="12" font-weight="900" font-family="sans-serif" fill="${col}">PASS</text></g>`; }
  if (st === 2) for (let y = 10; y < H; y += 30) for (let x = (y / 30 % 2) * 15 + 10; x < W; x += 30) g += `<circle cx="${x}" cy="${y}" r="${5 + R() * 4}" fill="${c()}" opacity=".55"/>`;
  if (st === 3) for (let x = -H; x < W; x += 36) g += `<path d="M${x} ${H}L${x + H} 0" stroke="${c()}" stroke-width="${8 + R() * 10}" opacity=".35"/>`;
  if (st === 4) for (let i = 0; i < 30; i++) { const x = R() * W, y = R() * H, s = 6 + R() * 12; g += `<path transform="translate(${x} ${y}) scale(${s / 10})" d="M0-10l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="${c()}" opacity=".8"/>`; }
  if (st === 5) for (let i = 0; i < 6; i++) { const y = 20 + i * 32; g += `<path d="M0 ${y}q50 -${18 + R() * 12} 100 0t100 0t100 0t100 0t100 0t100 0" fill="none" stroke="${c()}" stroke-width="6" opacity=".5"/>`; }
  if (st === 6) { const d = ["A+", "F-", "2+2", "☆", "♥", "∞", "?!", "πr²", "ABC", "x=?"]; for (let i = 0; i < 22; i++) g += `<text x="${R() * W}" y="${R() * H}" font-size="${16 + R() * 18}" font-family="Comic Sans MS,Chalkboard,cursive" fill="${c()}" opacity=".6" transform="rotate(${R() * 40 - 20} ${R() * W} ${R() * H})">${d[Math.floor(R() * d.length)]}</text>`; }
  if (st === 7) for (let i = 0; i < 26; i++) g += `<circle cx="${R() * W}" cy="${R() * H}" r="${6 + R() * 26}" fill="none" stroke="${c()}" stroke-width="3" opacity=".5"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true"><defs><linearGradient id="bg${hash(seed + st)}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset="1" stop-color="${p[1]}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#bg${hash(seed + st)})"/>${g}</svg>`;
}
export function qrSvg(text, size = 180, fg = "#0E3386") {
  const q = qrcode(0, "M"); q.addData(text); q.make(); const n = q.getModuleCount(), m = 2, s = n + m * 2; let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${s}" height="${s}" fill="#fff"/><path d="${d}" fill="${fg}"/></svg>`;
}
