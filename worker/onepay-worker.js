// =============================================================================
//  onepay-worker.js — card payments for EgoLab through 1pay.cx
//  Runs on Cloudflare Workers (free plan). The static site can't keep a secret
//  API key or receive webhooks, so this tiny server does both:
//
//    POST /create   site -> worker: creates a 1pay payment for an order and
//                   returns its checkout URL. The total is RECALCULATED here
//                   from the published catalog, so a buyer can't lower the price.
//    GET  /status   site -> worker: ?id=<paymentId> -> current payment status.
//    POST /hook     1pay -> worker: signed webhook; on payment.paid the seller
//                   gets a "✅ PAID" message on Telegram.
//
//  Secrets / variables (Cloudflare dashboard -> Worker -> Settings ->
//  Variables and Secrets):
//    ONEPAY_API_KEY      secret   pk_test_… while testing, pk_… when live
//    ONEPAY_WEBHOOK_SECRET secret whsec_test_… / whsec_… (API & webhooks page,
//                                 "Per-payment notifyUrl signing secrets")
//    TG_BOT_TOKEN        secret   the same Telegram bot the site already uses
//    TG_CHAT_ID          text     6929789772
//    SITE_URL            text     https://egolab.shop
//
//  Keep PROMO_CODES and SHIPPING in sync with assets/js/config.js.
// =============================================================================

const API = "https://api.1pay.cx";

const PROMO_CODES = {
  all5: 5,
  wow10: 10,
  megaa15: 15,
  ego20: 20,
  testosterone25: 25,
};
const SHIPPING = { fee: 17, freeThreshold: 99 };

const EXTRA_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

const round2 = (n) => Math.round(n * 100) / 100;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = corsHeaders(req, env);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    try {
      if (url.pathname === "/create" && req.method === "POST") return await create(req, env, url, cors);
      if (url.pathname === "/status" && req.method === "GET") return await status(env, url, cors);
      if (url.pathname === "/hook" && req.method === "POST") return await hook(req, env);
      if (url.pathname === "/") return new Response("EgoLab payments: OK", { headers: cors });
      return json({ error: "not_found" }, 404, cors);
    } catch (e) {
      console.error(e);
      return json({ error: "server_error" }, 500, cors);
    }
  },
};

// ---- POST /create -----------------------------------------------------------
async function create(req, env, url, cors) {
  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "bad_json" }, 400, cors);

  const orderId = String(body.orderId || "");
  if (!/^[a-z0-9]{4,40}$/i.test(orderId)) return json({ error: "bad_order_id" }, 400, cors);
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50) {
    return json({ error: "bad_items" }, 400, cors);
  }

  // Prices come from the published catalog, never from the browser.
  const catalog = await loadCatalog(env);
  let subtotal = 0;
  const names = [];
  for (const it of body.items) {
    const p = catalog.get(String(it.id));
    const qty = Number(it.qty);
    if (!p) return json({ error: "unknown_item", id: it.id }, 400, cors);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) return json({ error: "bad_qty" }, 400, cors);
    subtotal += p.price * qty;
    names.push(`${p.name} ×${qty}`);
  }
  const code = String(body.promoCode || "").trim().toLowerCase().replace(/\s+/g, "");
  const pct = PROMO_CODES[code] || 0;
  const discount = pct ? round2(subtotal * pct / 100) : 0;
  const goods = round2(subtotal - discount);
  const shipping = goods <= 0 ? 0 : goods >= SHIPPING.freeThreshold ? 0 : SHIPPING.fee;
  const total = round2(goods + shipping);

  // The site shows its own total; if they differ the buyer saw an old price.
  if (body.total != null && Math.abs(Number(body.total) - total) > 0.009) {
    return json({ error: "price_changed", total }, 409, cors);
  }
  if (!(total > 0)) return json({ error: "bad_total" }, 400, cors);

  const site = (env.SITE_URL || "https://egolab.shop").replace(/\/$/, "");
  const payload = {
    amount: total,
    currency: "USD",
    productName: `EgoLab order #${orderId.toUpperCase()}`,
    reference: orderId,
    redirectUrl: `${site}/order.html?id=${encodeURIComponent(orderId)}`,
    notifyUrl: `${url.origin}/hook`,
    cryptoAssets: [], // cards only — crypto is paid straight to our wallets on the site
  };
  const email = String(body.email || "").trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200) payload.email = email;

  const res = await fetch(`${API}/v1/payments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.ONEPAY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) {
    console.error("1pay create failed", res.status, JSON.stringify(data));
    return json({ error: "provider_error" }, 502, cors);
  }
  return json({ paymentId: data.id, url: data.url, amount: total }, 200, cors);
}

// ---- GET /status?id=<paymentId> ----------------------------------------------
async function status(env, url, cors) {
  const id = url.searchParams.get("id") || "";
  if (!/^[A-Za-z0-9]{6,16}$/.test(id)) return json({ error: "bad_id" }, 400, cors);
  const p = await getPayment(env, id);
  if (!p) return json({ error: "not_found" }, 404, cors);
  return json({
    status: p.status,
    amount: p.amount,
    currency: p.currency,
    reference: p.reference,
    paidAt: p.paidAt,
    livemode: p.livemode,
  }, 200, cors);
}

// ---- POST /hook (1pay webhook) ------------------------------------------------
async function hook(req, env) {
  const raw = await req.text();
  const sig = req.headers.get("x-1pay-signature-v2") || "";
  const m = /^t=([0-9]+),v1=([a-f0-9]{64})$/.exec(sig);
  if (!m || Math.abs(Date.now() / 1000 - Number(m[1])) > 300) return new Response("bad signature", { status: 401 });
  const expected = await hmacHex(env.ONEPAY_WEBHOOK_SECRET, `${m[1]}.${raw}`);
  if (!safeEqual(expected, m[2])) return new Response("bad signature", { status: 401 });

  const { event, data } = JSON.parse(raw);
  if (event === "webhook.test") return new Response("ok");
  if (!data || data.livemode !== isLive(env)) return new Response("wrong mode", { status: 400 });

  if (event === "payment.paid") {
    // Never trust the webhook body alone — re-read the payment with our key.
    const p = await getPayment(env, data.paymentId);
    if (!p || p.status !== "paid") throw new Error(`payment ${data.paymentId} not paid on re-read`);
    await tg(env, [
      `✅ PAID BY CARD${p.livemode ? "" : " (TEST)"}`,
      `Order #${String(p.reference || "").toUpperCase()}`,
      `Amount: $${p.baseAmount ?? p.amount} ${p.currency}`,
      p.settledAmount != null ? `You receive: ~$${p.settledAmount} (${p.settledAsset || "crypto"})` : "",
      p.txidOut ? `Payout tx: ${p.txidOut}` : "",
      `1pay payment: ${p.id}`,
      p.buyerCountry ? `Buyer country: ${p.buyerCountry}` : "",
    ]);
  } else if (event === "payment.underpaid") {
    await tg(env, [
      `⚠️ UNDERPAID card payment — order is NOT paid`,
      `Order #${String(data.reference || "").toUpperCase()}`,
      `1pay payment: ${data.paymentId}`,
    ]);
  }
  return new Response("ok");
}

// ---- helpers ------------------------------------------------------------------
let catalogCache = null;
async function loadCatalog(env) {
  if (catalogCache && Date.now() - catalogCache.at < 60_000) return catalogCache.map;
  const site = (env.SITE_URL || "https://egolab.shop").replace(/\/$/, "");
  const res = await fetch(`${site}/data/content.json?ts=${Date.now()}`, { cf: { cacheTtl: 0 } });
  if (!res.ok) throw new Error(`catalog ${res.status}`);
  const data = await res.json();
  const list = Array.isArray(data) ? data : data.products || [];
  const map = new Map(list.map((p) => [String(p.id), { name: p.name, price: Number(p.price) }]));
  catalogCache = { at: Date.now(), map };
  return map;
}

async function getPayment(env, id) {
  const res = await fetch(`${API}/v1/payments/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${env.ONEPAY_API_KEY}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`1pay read ${res.status}`);
  return res.json();
}

function isLive(env) {
  return !String(env.ONEPAY_API_KEY || "").startsWith("pk_test_");
}

async function tg(env, lines) {
  if (!env.TG_BOT_TOKEN || !env.TG_CHAT_ID) return;
  const res = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TG_CHAT_ID, text: lines.filter(Boolean).join("\n"), disable_web_page_preview: true }),
  });
  // Throwing makes /hook answer 500, so 1pay retries and the message isn't lost.
  if (!res.ok) throw new Error(`telegram ${res.status}`);
}

async function hmacHex(secret, msg) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret || ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function corsHeaders(req, env) {
  const origin = req.headers.get("Origin") || "";
  const site = (env.SITE_URL || "https://egolab.shop").replace(/\/$/, "");
  const allowed = [site, site.replace("://", "://www."), ...EXTRA_ORIGINS];
  const h = { "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" };
  if (allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: { ...headers, "Content-Type": "application/json" } });
}
