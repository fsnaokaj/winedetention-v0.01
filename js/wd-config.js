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
    "credit-bundle": ""         // Pre-launch credit bundle
  },

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
