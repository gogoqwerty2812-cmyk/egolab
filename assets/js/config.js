// =============================================================================
//  SITE CONFIGURATION  —  EDIT EVERYTHING HERE, IN ONE PLACE
// =============================================================================
//
//  1. MARKETPLACE NAME
//     Change SITE.name below. It is injected automatically into the header,
//     footer, <title>, and <meta> tags on every page. The placeholder
//     "{{MARKETPLACE_NAME}}" is intentional — replace it with your brand.
//
//  2. CRYPTO WALLET ADDRESSES
//     Replace the placeholder addresses in SITE.wallets with your real ones.
//     These are shown to the buyer (with a QR code) at checkout.
//
//  3. ADMIN PASSWORD
//     Stored as a SHA-256 hash in SITE.adminPasswordHash (never in plaintext).
//     Change it with:  python tools/hash-password.py "newPassword"
//     NOTE: this is a lightweight, client-side gate — it is NOT real security.
//
//  4. PROMO CODES
//     Edit PROMO_CODES (near the bottom). These are code-only and cannot be
//     changed from the admin panel.
//
// =============================================================================

export const SITE = {
  // ---- Branding -------------------------------------------------------------
  name: "EgoLab",
  tagline: "Curated goods. Private checkout. Crypto native.",
  metaDescription:
    "A premium marketplace with a curated catalog and fast, private crypto checkout.",

  // ---- Currency shown next to prices ---------------------------------------
  currency: { code: "USD", symbol: "$", locale: "en-US" },

  // ---- Crypto payment options ----------------------------------------------
  // `address` is displayed to the buyer and encoded into the QR code.
  // `uriScheme` builds a wallet-openable payment URI for the QR (optional).
  wallets: [
    {
      id: "BTC",
      name: "Bitcoin",
      symbol: "BTC",
      network: "Bitcoin (BTC)",
      address: "bc1qv4048360wxvcvj0mdv4twxgpm8zgkqxcplha0v",
      uriScheme: "bitcoin",
      accent: "#F7931A",
    },
    {
      id: "ETH",
      name: "Ethereum",
      symbol: "ETH",
      network: "Ethereum (ERC-20)",
      address: "0xEcE0c95e9437C83279cc0E450F5823392c0C4D9a",
      uriScheme: "ethereum",
      accent: "#627EEA",
    },
    // TRC-20 (TRON) temporarily disabled — waiting for a valid TRON address
    // (must start with "T"). Re-enable by filling in `address` and uncommenting.
    // {
    //   id: "USDT",
    //   name: "Tether",
    //   symbol: "USDT",
    //   network: "TRC-20 · TRON",
    //   address: "",
    //   uriScheme: null, // plain-address QR
    //   accent: "#26A17B",
    // },
    {
      id: "USDTSOL",
      name: "Tether",
      symbol: "USDT",
      network: "SPL · Solana",
      address: "AUqXJj6mjA749qV8op8TH2oUcHkEy6mqojVf8npBDd1r",
      uriScheme: null, // plain-address QR
      accent: "#14F195",
      badge: "Low fee",
    },
    {
      id: "USDTBEP",
      name: "Tether",
      symbol: "USDT",
      network: "BEP20 · BNB Smart Chain",
      address: "0xEcE0c95e9437C83279cc0E450F5823392c0C4D9a",
      uriScheme: null, // plain-address QR
      accent: "#F0B90B",
      // Note shown on the payment card. BEP20 fees are tiny but NOT zero — edit
      // this text freely (e.g. "No fee" / "Без комиссии") if you prefer.
      badge: "Low fee",
    },
  ],

  // ---- Admin ----------------------------------------------------------------
  // The password is stored ONLY as a SHA-256 hash, so the plaintext never
  // appears in the repo (the old Telegram token was scraped from here the same
  // way). This is still just a light client-side gate — anyone who reads the
  // code can see the hash, but cannot reverse it to the password.
  // To change it: run  python tools/hash-password.py "newPassword"  and paste
  // the printed hash below.
  adminPasswordHash:
    "d8beecf216e41263269339ddb581cf218067d767b2adaf1abcfb92b21bf77db0",

  // ---- Catalog categories (used by the admin product form + catalog filter) -
  categories: [
    "Protein",
    "Mass Gainers",
    "Pre-Workout",
    "Creatine",
    "Amino Acids",
    "Vitamins & Health",
    "Fat Burners",
    "Recovery",
    "Energy Bars",
    "Accessories",
    "Other",
  ],

  // Calm colour per category — product colour blocks, card tints, carousel.
  categoryColors: {
    "Protein": "#B98B79",
    "Mass Gainers": "#7E9B88",
    "Pre-Workout": "#A98C9C",
    "Creatine": "#8496B0",
    "Amino Acids": "#86A0A6",
    "Vitamins & Health": "#9AAE86",
    "Fat Burners": "#C08A78",
    "Recovery": "#8E93B5",
    "Energy Bars": "#B39A76",
    "Accessories": "#97918B",
    "Other": "#94908C",
  },

  // ---- Optional contact methods shown at checkout (NOT required) ------------
  // Only the phone number is required; everything here is optional.
  // Names of apps are kept as-is; section titles/hints are translated.
  checkoutContacts: [
    { id: "email",     label: "Email",     type: "email", placeholder: "you@email.com",        icon: "mail" },
    { id: "whatsapp",  label: "WhatsApp",  type: "tel",   placeholder: "+1 555 000 0000",      icon: "phone" },
    { id: "telegram",  label: "Telegram",  type: "text",  placeholder: "@username",            icon: "send" },
    { id: "instagram", label: "Instagram", type: "text",  placeholder: "@handle",              icon: "camera" },
    { id: "facebook",  label: "Facebook",  type: "url",   placeholder: "facebook.com/you",     icon: "user" },
    { id: "signal",    label: "Signal",    type: "tel",   placeholder: "+1 555 000 0000",      icon: "shield" },
  ],

  // ---- Support page contact channels (edit these) --------------------------
  supportChannels: [
    { id: "email",    name: "Email",    value: "egolab@mailfence.com", href: "mailto:egolab@mailfence.com", icon: "mail" },
    { id: "telegram", name: "Telegram", value: "@egolab_shop",             href: "https://t.me/egolab_shop",        icon: "send" },
  ],

  // ---- Social media (edit links; shown in footer + on the Reviews page) ----
  socials: [
    { id: "instagram", name: "Instagram", href: "https://instagram.com/peakr", icon: "instagram" },
    { id: "telegram",  name: "Telegram",  href: "https://t.me/peakr",          icon: "send" },
    { id: "tiktok",    name: "TikTok",    href: "https://tiktok.com/@peakr",    icon: "tiktok" },
    { id: "youtube",   name: "YouTube",   href: "https://youtube.com/@peakr",   icon: "youtube" },
    { id: "x",         name: "X",         href: "https://x.com/peakr",          icon: "x" },
  ],

  // ---- Order & support delivery to the seller (works on static hosting) -----
  // On a static host the site can't store data server-side, so every order and
  // support message is sent to YOU on Telegram.
  //   1. In Telegram open @BotFather -> /newbot -> copy the bot token.
  //   2. Open @userinfobot -> copy your numeric "Id" (chatId).
  //   3. Send your bot any message once (so it can write to you).
  //
  // SECURITY NOTE: the raw token must NEVER appear as a plain string in the
  // repo — GitHub-crawling bots scrape the pattern `<digits>:AA...` and abuse
  // the bot within minutes. So the token is stored here ENCODED and split into
  // two parts; notify.js reassembles it at runtime (base64 of the reversed,
  // joined parts). This only hides it from source scanners — it is still
  // readable by anyone who opens the browser devtools. For real secrecy move
  // the send through a serverless proxy (e.g. a Cloudflare Worker) that keeps
  // the token server-side.
  //
  // To change the token: run tools/encode-token (or encode manually) and paste
  // the two parts below. Set enabled: false to disable Telegram delivery.
  telegram: {
    enabled: true,
    // base64(token) -> reverse -> split in half
    tokenParts: [
      "==wcfhTQrxEbDhGba9GRkpEclx0QxZUW",
      "PFHdn9FU01GZxUUQBpDNxYDO1ETO4kDO",
    ],
    chatId: "6929789772",
  },
};

// -----------------------------------------------------------------------------
//  US states — used by the checkout "State" dropdown.
// -----------------------------------------------------------------------------
export const US_STATES = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
  ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
  ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
  ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"],
  ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
  ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
  ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"],
  ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
];

// -----------------------------------------------------------------------------
//  Delivery countries (edit freely). Russia is intentionally excluded.
//  If a country's code is "US", the checkout also shows the US state dropdown.
// -----------------------------------------------------------------------------
export const COUNTRIES = [
  ["US", "United States"],
  ["CA", "Canada"],
  ["GB", "United Kingdom"],
  ["IE", "Ireland"],
  ["DE", "Germany"],
  ["AT", "Austria"],
  ["CH", "Switzerland"],
  ["FR", "France"],
  ["BE", "Belgium"],
  ["NL", "Netherlands"],
  ["ES", "Spain"],
  ["PT", "Portugal"],
  ["IT", "Italy"],
  ["PL", "Poland"],
  ["RS", "Serbia"],
  ["BG", "Bulgaria"],
  ["CZ", "Czechia"],
];

// -----------------------------------------------------------------------------
//  Promo codes — defined HERE in code only. They are NOT editable from the
//  admin panel. Key = the code the buyer types (matched case-insensitively,
//  spaces ignored); value = percent discount off the cart subtotal.
// -----------------------------------------------------------------------------
export const PROMO_CODES = Object.freeze({
  all5: 5,
  wow10: 10,
  megaa15: 15,
  ego20: 20,
  testosterone25: 25,
});

// -----------------------------------------------------------------------------
//  Shipping — a flat fee below the free-shipping threshold, free at/above it.
//  Amounts are in the store currency (USD).
// -----------------------------------------------------------------------------
export const SHIPPING = Object.freeze({
  fee: 17,
  freeThreshold: 99,
});

// -----------------------------------------------------------------------------
//  Order status vocabulary (used by admin + confirmation page).
// -----------------------------------------------------------------------------
export const ORDER_STATUSES = [
  "Pending payment",
  "Payment received",
  "Processing",
  "Shipped",
  "Completed",
  "Cancelled",
];
