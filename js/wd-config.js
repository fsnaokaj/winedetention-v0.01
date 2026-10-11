/* ============================================================
   WINE DETENTION — LAUNCH CONFIG (edit this file, then push)
   No alcohol is sold on winedetention.com. Wine is sold and shipped
   by licensed partners. Whop sells only non-alcohol items:
   gift cards, pre-launch credits and memberships.
   Leave a link "" and that item shows "Notify me" (saved to the waitlist).
   Admin (/admin) can override offers without a deploy.
   ============================================================ */
window.WD_CONFIG = {
  /* Whop checkout links (https://whop.com/checkout/... or https://whop.com/<store>/<product>) */
  WHOP_LINKS: {
    "gift-25": "",
    "gift-50": "",
    "gift-100": "",
    "gift-250": "",
    "gift-350": "",
    "gift-custom": "",          // only if you create a pay-what-you-want product in Whop
    "founding-pass": "",        // Founding Member Pass (membership)
    "credit-bundle": "",        // Pre-launch credit bundle
    "vip350": "",               // Founding Members: OG VIP Mystery Drop ($350)
    "vip888": "",               // Let's Pop: Champagne After Hours Special ($888)
    "vip1750": "",              // Treat Yo'self ($1,750)
    "vipMonthly": "",           // Founding Members Monthly ($36/month subscription)
    "vipBundle": ""             // OG Flash Deal: All Three ($2,738 one-time)               // Treat Yo'self: The Lavish Pour ($1,750)
  },

  /* OG Founding VIP passes. Credit = price + fixed 35% bonus credit (set server-side in api/_lib/rules.js). */
  VIP_MONTHLY: { key: "vipMonthly", name: "Founding Members Monthly", price: 36, emoji: "📅", perks: ["$36 + 35% bonus = $48.60 gift credit every month", "OG Founding VIP # badge", "Member perks and early drops", "Cancel anytime"] },
  VIP_BUNDLE: { key: "vipBundle", name: "OG Flash Deal: All Three", price: 2738, list: 2988, credit: 4033.80, emoji: "⚡", perks: ["All three passes at once", "$4,033.80 total gift credit", "Top VIP number range (#1–#100)", "Your name on the Founders Wall", "Everything in every pass"] },
  VIP_TIERS: [
    { key: "vip350", name: "Founding Members: OG VIP Mystery Drop", price: 350, emoji: "🎁", theme: "pass", popular: true, tagline: "The one everybody grabs. Unlock your mystery welcome drop and find out what the hall has waiting for you.", perks: ["Mystery welcome reveal with confetti", "OG Founding VIP # badge", "VIP flair on your profile", "Priority pre-launch reservations", "First access to partner offers"] },
    { key: "vip888", name: "Let's Pop: Champagne After Hours Special", price: 888, emoji: "🍾", theme: "champagne", tagline: "Detention lets out late. The bubbles stay on.", perks: ["Everything in the Mystery Drop", "Champagne-gold VIP flair", "After-hours priority on pre-launch reservations", "First access to partner offers"] },
    { key: "vip1750", name: "Treat Yo'self: The Lavish Pour", price: 1750, emoji: "🥂", theme: "principal", tagline: "Live lavish. Don't cheat yourself. You earned the big pour.", perks: ["Everything in Champagne After Hours", "Top-tier Lavish Pour flair", "First in line for every reservation", "First access to partner offers"] }
  ],

  /* Pre-launch offers sold through Whop (non-alcohol) */
  OFFERS: [
    { key: "founding-pass", name: "Founding Member Pass", price: "$36 / year", blurb: "Founding member number, badge on your profile, early access to partner drops and member-only events. No alcohol included." },
    { key: "credit-bundle", name: "Pre-launch Credit Bundle", price: "$100", blurb: "$100 of Wine Detention gift credit plus a fixed $10 promotional bonus credit. Use it on future site purchases (not alcohol on this site)." }
  ],

  /* Fixed promo on gift cards (replaces the old random "+35% unveil"). Promotional credit, never cash. */
  GIFT_BONUS: { pct: 10, label: "+10% bonus credit", fine: "Bonus is promotional credit, not cash, not redeemable for cash, may expire 12 months after issue, and is separate from the paid gift card value. Paid gift card value never expires." },

  /* Licensed partners. url = their shop; we append ?ref=<handle>. logo = image URL or "". */
  PARTNERS: [
    // { id: "example-winery", name: "Example Winery", url: "https://example.com/shop", logo: "", states: ["CA","NY","FL"] }
  ],

  /* Each locker: partner (id from PARTNERS) + partnerUrl (product page), and/or reserve (true = reserve with gift credit) */
  LOCKERS: {
    "patio-rose":        { partner: "", partnerUrl: "", reserve: true },
    "weeknight-bubbles": { partner: "", partnerUrl: "", reserve: true },
    "napa-cab-lane":     { partner: "", partnerUrl: "", reserve: true },
    "coastal-pinot":     { partner: "", partnerUrl: "", reserve: true },
    "class-chardonnay":  { partner: "", partnerUrl: "", reserve: true },
    "rutherford-dust":   { partner: "", partnerUrl: "", reserve: true },
    "mountain-icon":     { partner: "", partnerUrl: "", reserve: true },
    "prestige-cuvee":    { partner: "", partnerUrl: "", reserve: true }
  },

  DYNAMIC_SDK_VERSION: "1.39.1",
  SUSHIBUTT_URL: "https://sushibutt.com"
};
