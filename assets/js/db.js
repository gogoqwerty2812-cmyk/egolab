// =============================================================================
//  db.js — IndexedDB storage layer (products + orders) with seed data
// =============================================================================
import { SITE } from "./config.js?v=6";

const DB_NAME = "marketplace_db";
const DB_VERSION = 4;
const STORE_PRODUCTS = "products";
const STORE_ORDERS = "orders";
const STORE_TICKETS = "tickets";
const STORE_CERTS = "certs";
const STORE_REVIEWS = "reviews";
const STORE_SETTINGS = "settings";

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, arg) => { if (!settled) { settled = true; clearTimeout(timer); fn(arg); } };

    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }

    // Never hang forever: if another tab holds an older version open, the
    // upgrade is "blocked" and onsuccess never fires — reject so the UI can react.
    const timer = setTimeout(() => {
      finish(reject, new Error("IndexedDB is blocked — please close other tabs of this site and reload."));
    }, 4000);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        db.createObjectStore(STORE_PRODUCTS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_ORDERS)) {
        const os = db.createObjectStore(STORE_ORDERS, { keyPath: "id" });
        os.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains(STORE_TICKETS)) {
        const ts = db.createObjectStore(STORE_TICKETS, { keyPath: "id" });
        ts.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains(STORE_CERTS)) {
        const cs = db.createObjectStore(STORE_CERTS, { keyPath: "id" });
        cs.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains(STORE_REVIEWS)) {
        const rs = db.createObjectStore(STORE_REVIEWS, { keyPath: "id" });
        rs.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: "key" });
      }
    };
    req.onblocked = () => {
      // an older connection elsewhere is preventing the upgrade
      finish(reject, new Error("IndexedDB upgrade blocked by another tab. Close other tabs of this site and reload."));
    };
    req.onsuccess = () => {
      const db = req.result;
      // if a newer version is requested elsewhere later, close so it isn't blocked
      db.onversionchange = () => { try { db.close(); } catch {} _dbPromise = null; };
      finish(resolve, db);
    };
    req.onerror = () => finish(reject, req.error);
  }).catch((e) => { _dbPromise = null; throw e; }); // allow a later retry
  return _dbPromise;
}

function tx(store, mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const os = t.objectStore(store);
        let result;
        Promise.resolve(fn(os)).then((r) => (result = r));
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// ---- Products ---------------------------------------------------------------
export async function getProducts() {
  const list = await tx(STORE_PRODUCTS, "readonly", (os) => reqP(os.getAll()));
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
export async function getProduct(id) {
  return tx(STORE_PRODUCTS, "readonly", (os) => reqP(os.get(id)));
}
export async function saveProduct(p) {
  const now = Date.now();
  const rec = {
    id: p.id || uid(),
    name: p.name?.trim() || "Untitled",
    description: p.description || "",
    price: Number(p.price) || 0,
    category: (p.category || SITE.categories[0] || "Other").trim(),
    subcategory: (p.subcategory || "").trim(),
    featured: !!p.featured,
    stock: Number.isFinite(+p.stock) ? +p.stock : 0,
    images: Array.isArray(p.images) ? p.images : [],
    createdAt: p.createdAt || now,
    updatedAt: now,
  };
  await tx(STORE_PRODUCTS, "readwrite", (os) => os.put(rec));
  return rec;
}
export async function deleteProduct(id) {
  return tx(STORE_PRODUCTS, "readwrite", (os) => os.delete(id));
}

// ---- Published (shared) catalog -------------------------------------------
// On a static host (e.g. GitHub Pages) every visitor sees the SAME catalog,
// read from data/products.json committed to the repo. The admin edits a local
// IndexedDB workspace and exports an updated products.json to publish.
const PUBLISHED_URL = "data/products.json";

// One-file publishing: everything (products, certificates, reviews, settings)
// can live in a single data/content.json. If present it wins; otherwise we fall
// back to the individual data/*.json files. Fetched once per page load.
const PUBLISHED_BUNDLE_URL = "data/content.json";
let _bundlePromise;
function getBundle() {
  if (_bundlePromise !== undefined) return _bundlePromise;
  _bundlePromise = (async () => {
    try {
      const res = await fetch(PUBLISHED_BUNDLE_URL + "?t=" + Date.now(), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === "object" && !Array.isArray(data)) return data;
      }
    } catch {}
    return null;
  })();
  return _bundlePromise;
}

export async function getPublishedProducts() {
  const b = await getBundle();
  if (b && Array.isArray(b.products) && b.products.length) {
    return b.products.slice().sort((a, b2) => (b2.createdAt || 0) - (a.createdAt || 0));
  }
  try {
    const res = await fetch(PUBLISHED_URL + "?t=" + Date.now(), { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        return data.slice().sort((a, b3) => (b3.createdAt || 0) - (a.createdAt || 0));
      }
    }
  } catch {}
  // fallback if the file is missing: local seed
  await ensureSeed();
  await upgradeSeedImages();
  return getProducts();
}

export async function getPublishedProduct(id) {
  const all = await getPublishedProducts();
  return all.find((p) => p.id === id) || null;
}

export function exportProductsJSON(list) {
  return JSON.stringify(list, null, 2);
}

// seed the admin's local workspace from the published catalog on first use
export async function ensureAdminSeed() {
  const count = await tx(STORE_PRODUCTS, "readonly", (os) => reqP(os.count()));
  if (count > 0 || localStorage.getItem("mkt_admin_seeded")) return;
  try {
    const res = await fetch(PUBLISHED_URL + "?t=" + Date.now(), { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        const now = Date.now();
        await tx(STORE_PRODUCTS, "readwrite", (os) =>
          data.forEach((p, i) => os.put({ ...p, id: p.id || uid(), createdAt: p.createdAt || now - i, updatedAt: now }))
        );
        localStorage.setItem("mkt_admin_seeded", "1");
        return;
      }
    }
  } catch {}
  await ensureSeed(); // fallback to the inline seed
  await upgradeSeedImages();
  localStorage.setItem("mkt_admin_seeded", "1");
}

export async function importProductsFromJSON(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("JSON must be an array of products");
  const now = Date.now();
  await tx(STORE_PRODUCTS, "readwrite", (os) => os.clear());
  await tx(STORE_PRODUCTS, "readwrite", (os) =>
    data.forEach((p, i) => os.put({ ...p, id: p.id || uid(), createdAt: p.createdAt || now - i, updatedAt: now }))
  );
  localStorage.setItem("mkt_admin_seeded", "1");
}

// ---- Orders -----------------------------------------------------------------
export async function getOrders() {
  const list = await tx(STORE_ORDERS, "readonly", (os) => reqP(os.getAll()));
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
export async function getOrder(id) {
  return tx(STORE_ORDERS, "readonly", (os) => reqP(os.get(id)));
}
export async function createOrder(order) {
  const rec = { id: uid(), createdAt: Date.now(), status: "Pending payment", ...order };
  await tx(STORE_ORDERS, "readwrite", (os) => os.put(rec));
  return rec;
}
export async function updateOrderStatus(id, status) {
  const o = await getOrder(id);
  if (!o) return null;
  o.status = status;
  await tx(STORE_ORDERS, "readwrite", (os) => os.put(o));
  return o;
}
export async function deleteOrder(id) {
  return tx(STORE_ORDERS, "readwrite", (os) => os.delete(id));
}

// ---- Support tickets --------------------------------------------------------
export async function createTicket(ticket) {
  const rec = { id: uid(), createdAt: Date.now(), status: "New", ...ticket };
  await tx(STORE_TICKETS, "readwrite", (os) => os.put(rec));
  return rec;
}
export async function getTickets() {
  const list = await tx(STORE_TICKETS, "readonly", (os) => reqP(os.getAll()));
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
export async function deleteTicket(id) {
  return tx(STORE_TICKETS, "readwrite", (os) => os.delete(id));
}

// ---- Certificates & lab analyses ------------------------------------------
const PUBLISHED_CERTS_URL = "data/certificates.json";

export async function getCerts() {
  const list = await tx(STORE_CERTS, "readonly", (os) => reqP(os.getAll()));
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
export async function saveCert(cRec) {
  const now = Date.now();
  const rec = {
    id: cRec.id || uid(),
    title: cRec.title?.trim() || "Untitled",
    issuer: cRec.issuer?.trim() || "",
    date: cRec.date || "",
    category: cRec.category || "",
    image: cRec.image || "",
    createdAt: cRec.createdAt || now,
    updatedAt: now,
  };
  await tx(STORE_CERTS, "readwrite", (os) => os.put(rec));
  return rec;
}
export async function deleteCert(id) {
  return tx(STORE_CERTS, "readwrite", (os) => os.delete(id));
}
export async function getPublishedCerts() {
  const b = await getBundle();
  if (b && Array.isArray(b.certificates)) return b.certificates.slice().sort((a, c) => (c.createdAt || 0) - (a.createdAt || 0));
  try {
    const res = await fetch(PUBLISHED_CERTS_URL + "?t=" + Date.now(), { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
  } catch {}
  return getCerts();
}
export async function ensureCertAdminSeed() {
  const count = await tx(STORE_CERTS, "readonly", (os) => reqP(os.count()));
  if (count > 0 || localStorage.getItem("mkt_certs_seeded")) return;
  try {
    const res = await fetch(PUBLISHED_CERTS_URL + "?t=" + Date.now(), { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        const now = Date.now();
        await tx(STORE_CERTS, "readwrite", (os) => data.forEach((c, i) => os.put({ ...c, id: c.id || uid(), createdAt: c.createdAt || now - i, updatedAt: now })));
      }
    }
  } catch {}
  localStorage.setItem("mkt_certs_seeded", "1");
}
export function exportCertsJSON(list) {
  return JSON.stringify(list, null, 2);
}
export async function importCertsFromJSON(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("JSON must be an array of certificates");
  const now = Date.now();
  await tx(STORE_CERTS, "readwrite", (os) => os.clear());
  await tx(STORE_CERTS, "readwrite", (os) => data.forEach((c, i) => os.put({ ...c, id: c.id || uid(), createdAt: c.createdAt || now - i, updatedAt: now })));
  localStorage.setItem("mkt_certs_seeded", "1");
}

// ---- Reviews ----------------------------------------------------------------
const PUBLISHED_REVIEWS_URL = "data/reviews.json";

export async function getReviews() {
  const list = await tx(STORE_REVIEWS, "readonly", (os) => reqP(os.getAll()));
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
export async function saveReview(r) {
  const now = Date.now();
  const rec = {
    id: r.id || uid(),
    name: r.name?.trim() || "Anonymous",
    role: r.role?.trim() || "",
    rating: Math.max(1, Math.min(5, Number(r.rating) || 5)),
    text: r.text?.trim() || "",
    verified: r.verified !== false,
    createdAt: r.createdAt || now,
    updatedAt: now,
  };
  await tx(STORE_REVIEWS, "readwrite", (os) => os.put(rec));
  return rec;
}
export async function deleteReview(id) {
  return tx(STORE_REVIEWS, "readwrite", (os) => os.delete(id));
}
export async function getPublishedReviews() {
  const b = await getBundle();
  if (b && Array.isArray(b.reviews)) return b.reviews.slice().sort((a, c) => (c.createdAt || 0) - (a.createdAt || 0));
  try {
    const res = await fetch(PUBLISHED_REVIEWS_URL + "?t=" + Date.now(), { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
  } catch {}
  return getReviews();
}
export async function ensureReviewAdminSeed() {
  const count = await tx(STORE_REVIEWS, "readonly", (os) => reqP(os.count()));
  if (count > 0 || localStorage.getItem("mkt_reviews_seeded")) return;
  try {
    const res = await fetch(PUBLISHED_REVIEWS_URL + "?t=" + Date.now(), { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        const now = Date.now();
        await tx(STORE_REVIEWS, "readwrite", (os) => data.forEach((r, i) => os.put({ ...r, id: r.id || uid(), createdAt: r.createdAt || now - i, updatedAt: now })));
      }
    }
  } catch {}
  localStorage.setItem("mkt_reviews_seeded", "1");
}
export function exportReviewsJSON(list) {
  return JSON.stringify(list, null, 2);
}
export async function importReviewsFromJSON(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("JSON must be an array of reviews");
  const now = Date.now();
  await tx(STORE_REVIEWS, "readwrite", (os) => os.clear());
  await tx(STORE_REVIEWS, "readwrite", (os) => data.forEach((r, i) => os.put({ ...r, id: r.id || uid(), createdAt: r.createdAt || now - i, updatedAt: now })));
  localStorage.setItem("mkt_reviews_seeded", "1");
}

// ---- Site settings (reviews channel link + social links) --------------------
const PUBLISHED_SETTINGS_URL = "data/site.json";
const DEFAULT_SETTINGS = {
  reviewsChannelUrl: "",
  socials: SITE.socials || [],
  categories: [...(SITE.categories || [])],
  subcategories: [],
};

export async function getSettings() {
  const doc = await tx(STORE_SETTINGS, "readonly", (os) => reqP(os.get("site")));
  return doc?.value || null;
}
// Merge-save: fields not passed are preserved (so saving socials won't wipe
// categories, and vice-versa).
export async function saveSettings(obj) {
  const cur = (await getSettings().catch(() => null)) || {};
  const value = { ...DEFAULT_SETTINGS, ...cur, ...obj };
  value.reviewsChannelUrl = (value.reviewsChannelUrl || "").trim();
  value.socials = Array.isArray(value.socials) ? value.socials.filter((s) => s && s.href) : [];
  value.categories = Array.isArray(value.categories) ? value.categories.filter(Boolean) : [...(SITE.categories || [])];
  value.subcategories = Array.isArray(value.subcategories) ? value.subcategories.filter(Boolean) : [];
  value.updatedAt = Date.now();
  await tx(STORE_SETTINGS, "readwrite", (os) => os.put({ key: "site", value }));
  return value;
}
export async function getPublishedSettings() {
  const b = await getBundle();
  if (b && b.settings && typeof b.settings === "object" && !Array.isArray(b.settings)) return { ...DEFAULT_SETTINGS, ...b.settings };
  try {
    const res = await fetch(PUBLISHED_SETTINGS_URL + "?t=" + Date.now(), { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object" && !Array.isArray(data)) return { ...DEFAULT_SETTINGS, ...data };
    }
  } catch {}
  const local = await getSettings().catch(() => null);
  return local ? { ...DEFAULT_SETTINGS, ...local } : { ...DEFAULT_SETTINGS };
}
export async function ensureSettingsAdminSeed() {
  const existing = await getSettings().catch(() => null);
  if (existing) return existing;
  let seed = null;
  try {
    const res = await fetch(PUBLISHED_SETTINGS_URL + "?t=" + Date.now(), { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object" && !Array.isArray(data)) seed = data;
    }
  } catch {}
  return saveSettings(seed || DEFAULT_SETTINGS);
}
export function exportSettingsJSON(obj) {
  return JSON.stringify(obj, null, 2);
}
export async function importSettingsFromJSON(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("JSON must be a settings object");
  return saveSettings(data);
}

// ---- One-file publishing: everything in a single content.json ---------------
export async function exportAllJSON() {
  const [products, certificates, reviews, settings] = await Promise.all([
    getProducts(), getCerts(), getReviews(), getSettings(),
  ]);
  return JSON.stringify({ products, certificates, reviews, settings: settings || DEFAULT_SETTINGS }, null, 2);
}
export async function importAllFromJSON(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("JSON must be a content object with products / certificates / reviews / settings");
  const now = Date.now();
  if (Array.isArray(data.products)) {
    await tx(STORE_PRODUCTS, "readwrite", (os) => os.clear());
    await tx(STORE_PRODUCTS, "readwrite", (os) => data.products.forEach((p, i) => os.put({ ...p, id: p.id || uid(), createdAt: p.createdAt || now - i, updatedAt: now })));
    localStorage.setItem("mkt_admin_seeded", "1");
  }
  if (Array.isArray(data.certificates)) {
    await tx(STORE_CERTS, "readwrite", (os) => os.clear());
    await tx(STORE_CERTS, "readwrite", (os) => data.certificates.forEach((c, i) => os.put({ ...c, id: c.id || uid(), createdAt: c.createdAt || now - i, updatedAt: now })));
    localStorage.setItem("mkt_certs_seeded", "1");
  }
  if (Array.isArray(data.reviews)) {
    await tx(STORE_REVIEWS, "readwrite", (os) => os.clear());
    await tx(STORE_REVIEWS, "readwrite", (os) => data.reviews.forEach((r, i) => os.put({ ...r, id: r.id || uid(), createdAt: r.createdAt || now - i, updatedAt: now })));
    localStorage.setItem("mkt_reviews_seeded", "1");
  }
  if (data.settings && typeof data.settings === "object" && !Array.isArray(data.settings)) await saveSettings(data.settings);
}

// =============================================================================
//  Seed data — runs once on first load so the catalog is never empty.
// =============================================================================
// Elegant inline-SVG placeholder "photos" (no network needed).
function seedImage(label, c1, c2) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1000'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/>
      </linearGradient>
    </defs>
    <rect width='800' height='1000' fill='url(#g)'/>
    <circle cx='620' cy='230' r='150' fill='rgba(255,255,255,.08)'/>
    <circle cx='170' cy='760' r='210' fill='rgba(0,0,0,.10)'/>
    <text x='50%' y='52%' text-anchor='middle' font-family='Georgia, serif' font-size='120'
      fill='rgba(255,255,255,.92)' font-weight='700'>${label}</text>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

// Local product photos (downloaded to assets/img/products/).
const IMG = "assets/img/products/";
const PHOTOS = {
  overcoat:   [IMG + "overcoat-1.jpg", IMG + "overcoat-2.jpg"],
  watch:      [IMG + "watch-1.jpg", IMG + "watch-2.jpg"],
  headphones: [IMG + "headphones-1.jpg", IMG + "headphones-2.jpg"],
  lamp:       [IMG + "lamp-1.jpg", IMG + "lamp-2.jpg"],
  perfume:    [IMG + "perfume-1.jpg", IMG + "perfume-2.jpg"],
  chess:      [IMG + "chess-1.jpg", IMG + "chess-2.jpg"],
  bag:        [IMG + "bag-1.jpg", IMG + "bag-2.jpg"],
  scarf:      [IMG + "scarf-1.jpg", IMG + "scarf-2.jpg"],
};
// seed product name -> photo slug (drives fresh seed AND the image migration)
const NAME_TO_SLUG = {
  "Aurelia Wool Overcoat": "overcoat",
  "Meridian Automatic Watch": "watch",
  "Nocturne Wireless Headphones": "headphones",
  "Lumen Ceramic Table Lamp": "lamp",
  "Velvet Rose Eau de Parfum": "perfume",
  "Obsidian Chess Set": "chess",
  "Atlas Leather Weekender": "bag",
  "Solace Cashmere Scarf": "scarf",
};

const SEED = [
  {
    name: "Aurelia Wool Overcoat",
    category: "Apparel",
    price: 389,
    stock: 12,
    description:
      "A tailored double-faced wool overcoat with a clean, elongated silhouette. Fully lined, horn buttons, and a soft shoulder for an effortless drape. A timeless layer for cold-weather dressing.",
    images: [...PHOTOS.overcoat],
  },
  {
    name: "Meridian Automatic Watch",
    category: "Accessories",
    price: 640,
    stock: 6,
    description:
      "Swiss-style automatic movement housed in a 40mm brushed-steel case. Sapphire crystal, sunray dial, and a supple leather strap. Water resistant to 50m.",
    images: [...PHOTOS.watch],
  },
  {
    name: "Nocturne Wireless Headphones",
    category: "Electronics",
    price: 279,
    stock: 20,
    description:
      "Over-ear active-noise-cancelling headphones with 40-hour battery life, plush memory-foam cushions, and studio-tuned drivers. USB-C fast charge.",
    images: [...PHOTOS.headphones],
  },
  {
    name: "Lumen Ceramic Table Lamp",
    category: "Home & Living",
    price: 149,
    stock: 15,
    description:
      "Hand-glazed ceramic base with a linen drum shade that casts a warm, diffused glow. Dimmable, with a fabric cord and inline switch.",
    images: [...PHOTOS.lamp],
  },
  {
    name: "Velvet Rose Eau de Parfum",
    category: "Beauty",
    price: 118,
    stock: 30,
    description:
      "A modern floral built on Damask rose, warm amber, and a whisper of oud. Long-lasting, unisex, 50ml. Presented in a weighted glass flacon.",
    images: [...PHOTOS.perfume],
  },
  {
    name: "Obsidian Chess Set",
    category: "Collectibles",
    price: 210,
    stock: 8,
    description:
      "Weighted resin pieces in matte obsidian and bone finishes on a walnut-and-maple board. A heirloom-grade set for the serious player.",
    images: [...PHOTOS.chess],
  },
  {
    name: "Atlas Leather Weekender",
    category: "Accessories",
    price: 465,
    stock: 5,
    description:
      "Full-grain vegetable-tanned leather holdall with brass hardware, a suede-lined interior, and a detachable shoulder strap. Ages beautifully.",
    images: [...PHOTOS.bag],
  },
  {
    name: "Solace Cashmere Scarf",
    category: "Apparel",
    price: 135,
    stock: 24,
    description:
      "Featherweight two-ply Mongolian cashmere, generously sized, with hand-knotted fringe. Impossibly soft and warm without bulk.",
    images: [...PHOTOS.scarf],
  },
];

export async function ensureSeed() {
  const existing = await tx(STORE_PRODUCTS, "readonly", (os) => reqP(os.count()));
  const seededFlag = localStorage.getItem("mkt_seeded");
  if (existing > 0 || seededFlag) return;
  const now = Date.now();
  await tx(STORE_PRODUCTS, "readwrite", (os) => {
    SEED.forEach((p, i) => os.put({ ...p, id: uid(), createdAt: now - i * 1000, updatedAt: now }));
  });
  localStorage.setItem("mkt_seeded", "1");
}

// One-time upgrade: replace old SVG-placeholder images on seed products with
// real photos. Only touches products that still carry SVG placeholders AND
// match a known seed name — anything added via the admin is left untouched.
export async function upgradeSeedImages() {
  if (localStorage.getItem("mkt_img_v") === "2") return;
  const all = await getProducts();
  const updates = [];
  for (const p of all) {
    const isPlaceholder =
      !p.images?.length ||
      p.images.every((s) => typeof s === "string" && s.startsWith("data:image/svg"));
    const slug = NAME_TO_SLUG[p.name];
    if (isPlaceholder && slug && PHOTOS[slug]) {
      p.images = [...PHOTOS[slug]];
      updates.push(p);
    }
  }
  if (updates.length) {
    await tx(STORE_PRODUCTS, "readwrite", (os) => updates.forEach((p) => os.put(p)));
  }
  localStorage.setItem("mkt_img_v", "2");
}
