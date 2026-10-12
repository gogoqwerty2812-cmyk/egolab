// =============================================================================
//  store.js — cart persistence (localStorage) + pub/sub
// =============================================================================
import { PROMO_CODES, SHIPPING } from "./config.js?v=8";

const KEY = "mkt_cart_v1";
const PROMO_KEY = "mkt_promo_v1";
const listeners = new Set();

function normCode(code) {
  return String(code || "").trim().toLowerCase().replace(/\s+/g, "");
}
function round2(n) {
  return Math.round(n * 100) / 100;
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function write(items) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  listeners.forEach((fn) => fn(items));
}

export const Cart = {
  items: read,

  count() {
    return read().reduce((n, i) => n + i.qty, 0);
  },

  subtotal() {
    return read().reduce((s, i) => s + i.price * i.qty, 0);
  },

  // ---- promo code (codes live in config.js, not the admin panel) -----------
  getPromo() {
    try {
      const code = localStorage.getItem(PROMO_KEY);
      if (!code) return null;
      const pct = PROMO_CODES[code];
      return pct ? { code, pct } : null;
    } catch {
      return null;
    }
  },
  applyPromo(code) {
    const c = normCode(code);
    const pct = PROMO_CODES[c];
    if (!pct) return null;
    try { localStorage.setItem(PROMO_KEY, c); } catch {}
    return { code: c, pct };
  },
  clearPromo() {
    try { localStorage.removeItem(PROMO_KEY); } catch {}
  },

  // ---- money math ----------------------------------------------------------
  discount() {
    const p = this.getPromo();
    if (!p) return 0;
    return round2(this.subtotal() * p.pct / 100);
  },
  // Goods price after the promo discount — this is what the shipping threshold
  // and the final total are based on.
  goods() {
    return round2(this.subtotal() - this.discount());
  },
  shipping() {
    const goods = this.goods();
    if (goods <= 0) return 0;
    return goods >= SHIPPING.freeThreshold ? 0 : SHIPPING.fee;
  },
  total() {
    return round2(this.goods() + this.shipping());
  },

  // item: { id, name, price, image, stock }
  add(item, qty = 1) {
    const items = read();
    const found = items.find((i) => i.id === item.id);
    const max = Number.isFinite(item.stock) ? item.stock : Infinity;
    if (found) {
      found.qty = Math.min(found.qty + qty, max);
    } else {
      items.push({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image || "",
        stock: item.stock,
        qty: Math.min(qty, max),
      });
    }
    write(items);
  },

  setQty(id, qty) {
    let items = read();
    const it = items.find((i) => i.id === id);
    if (!it) return;
    const max = Number.isFinite(it.stock) ? it.stock : Infinity;
    it.qty = Math.max(1, Math.min(qty, max));
    write(items);
  },

  remove(id) {
    write(read().filter((i) => i.id !== id));
  },

  clear() {
    write([]);
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// keep tabs/windows in sync
window.addEventListener("storage", (e) => {
  if (e.key === KEY) listeners.forEach((fn) => fn(read()));
});
