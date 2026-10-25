/* ===================================================================
   WINE DETENTION GIVEAWAY CONFIG — the ONE file to edit.
   Prize names, ARVs, winner counts, entry values, dates and sponsor
   contact. Served by GET /api/wd?a=gw to the giveaway page + promo bar.
   Paid items (VIP drops, gift cards, Whop) NEVER add entries — there is
   no code path for that; do not add one. NO ALCOHOL AS PRIZES.
   =================================================================== */
export const GIVEAWAY = {
  id: "wd-fd26",
  name: "Founding Detention Giveaway '26",
  promo: {
    chip: "🎁 Free giveaway · 🌍 worldwide · 21+",
    hook: "Win whitening strips, $350 gift cards & VIP drop credit",
    cta: "Enter free →",
  },
  startsAt: "2026-10-25T14:00:00Z",
  endsAt: "2026-11-27T04:59:00Z", // Thu Nov 26 2026, 11:59 PM ET
  durationDays: 32,
  sponsor: "Wine Detention",
  sponsorEmail: "hello@winedetention.com",
  drawWithinDays: 7,
  claimDays: 7,
  /* Worldwide, 21+ (or age of majority if older). Void where prohibited.
     Same geo exclusions as PuckGold; brand is alcohol-adjacent so minAge is 21. */
  eligibility: {
    minAge: 21,
    excludedCountries: {
      IT: "Italy", BR: "Brazil", CN: "China (mainland)", CU: "Cuba",
      IR: "Iran", KP: "North Korea", SY: "Syria", RU: "Russia", BY: "Belarus",
    },
    excludedRegions: {
      "CA-QC": "Province of Quebec (Canada)",
      "UA-43": "Crimea", "UA-40": "Sevastopol",
      "UA-14": "Donetsk region", "UA-09": "Luhansk region",
    },
    regionRequired: {
      CA: {
        "CA-AB": "Alberta", "CA-BC": "British Columbia", "CA-MB": "Manitoba",
        "CA-NB": "New Brunswick", "CA-NL": "Newfoundland and Labrador",
        "CA-NS": "Nova Scotia", "CA-NT": "Northwest Territories", "CA-NU": "Nunavut",
        "CA-ON": "Ontario", "CA-PE": "Prince Edward Island", "CA-QC": "Quebec",
        "CA-SK": "Saskatchewan", "CA-YT": "Yukon",
      },
      UA: {
        "UA-43": "Crimea", "UA-40": "Sevastopol", "UA-14": "Donetsk region",
        "UA-09": "Luhansk region", "UA-OTHER": "Another region of Ukraine",
      },
    },
    otherExcluded: "any jurisdiction where registration, bonding or a local permit would be required to run this promotion",
    skillQuestionCountries: ["CA"],
  },

  entries: {
    account: 1,
    followX: 2,
    followTikTok: 2,
    share: 1,
    referral: 5,
    referralCap: 50,
    quest: 1,
    questDailyCap: 6,
  },

  /* Everyone who enters gets hall points + badge. Points are free, for fun, no cash value. */
  participant: { badge: "Founding Detention Giveaway '26", badgeEmoji: "🎁", points: 500 },

  /* Prizes. ARV = approximate retail value in USD. NO ALCOHOL. */
  prizes: [
    { place: "1st", title: "$350 Wine Detention gift card", detail: "Store credit for VIP drops, gift cards and partner offers on winedetention.com. Not alcohol. Not cash.", arv: 350, qty: 1, tier: "grand" },
    { place: "Featured", title: "Professional teeth whitening strips kit", detail: "A 14-day professional-style whitening strips kit — pairs perfectly with wine nights and coffee mornings. Third-party product, text name only; not sponsored.", arv: 64.99, qty: 5, tier: "featured" },
    { place: "2nd–3rd", title: "$175 Wine Detention gift card", detail: "Store credit. Not alcohol. Not cash.", arv: 175, qty: 2, tier: "grand" },
    { place: "4th–8th", title: "$88 Wine Detention gift card", detail: "Five winners. Store credit. Not alcohol. Not cash.", arv: 88, qty: 5, tier: "mid" },
    { place: "9th–18th", title: "$36 Wine Detention gift card", detail: "Ten winners. Store credit. Not alcohol. Not cash.", arv: 36, qty: 10, tier: "mid" },
    { place: "Bonus", title: "Founding VIP Mystery Drop credit ($350)", detail: "Wine Detention gift credit equal to the Founding Members OG VIP Mystery Drop paid value. Profile VIP flair may be issued separately by the Sponsor. Not alcohol. Not cash.", arv: 350, qty: 1, tier: "vip" },
    { place: "Bonus", title: "Coffee-bar mug + whitening travel kit", detail: "Detention-branded mug plus a travel whitening kit for the commute.", arv: 40, qty: 5, tier: "swag" },
    { place: "Bonus", title: "Premium corkscrew & stopper set", detail: "Hardware only — no wine included. A cork-popping tool kit for the mancave.", arv: 45, qty: 3, tier: "swag" },
    { place: "Bonus", title: "Detention sticker + enamel pin pack", detail: "Hall-pass stickers and a Founding Detention enamel pin.", arv: 15, qty: 20, tier: "swag" },
  ],
};

export function gwWindow(g = GIVEAWAY) {
  const start = Date.parse(g.startsAt);
  const end = g.endsAt ? Date.parse(g.endsAt) : start + g.durationDays * 864e5;
  return { start, end };
}
export const totalArv = (g = GIVEAWAY) =>
  Math.round(g.prizes.reduce((s, p) => s + p.arv * p.qty, 0) * 100) / 100;

/** Returns null if eligible, else 'bad_country' | 'need_region' | 'excluded'. */
export function eligibility(country, region, ipCountry = "", g = GIVEAWAY) {
  const e = g.eligibility;
  const c = String(country || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "bad_country";
  const ip = String(ipCountry || "").toUpperCase();
  if (e.excludedCountries[c] || (ip && e.excludedCountries[ip])) return "excluded";
  const regs = e.regionRequired[c];
  if (regs) {
    const r = String(region || "").toUpperCase();
    if (!regs[r]) return "need_region";
    if (e.excludedRegions[r]) return "excluded";
  }
  return null;
}
