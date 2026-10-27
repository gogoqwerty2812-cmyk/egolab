// =============================================================================
//  notify.js — deliver orders & support messages to the seller on Telegram.
//  Works on static hosting (GitHub Pages) because it POSTs straight to the
//  Telegram Bot API from the browser. No-op if not configured in config.js.
// =============================================================================
import { SITE } from "./config.js?v=11";

// Reassemble the bot token that config.js stores encoded + split, so the raw
// `<digits>:AA...` string never appears in the repo for scrapers to grab.
// Supports a plain `botToken` too, as a fallback.
function botToken(tg) {
  if (tg.botToken) return tg.botToken;
  if (Array.isArray(tg.tokenParts) && tg.tokenParts.length) {
    try { return atob(tg.tokenParts.join("").split("").reverse().join("")); }
    catch { return ""; }
  }
  return "";
}

function cfg() {
  const tg = SITE.telegram;
  return tg && tg.enabled && botToken(tg) && tg.chatId ? tg : null;
}

async function tgSend(tg, text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken(tg)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: tg.chatId, text, disable_web_page_preview: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendOrderNotification(order) {
  const tg = cfg();
  if (!tg) return false;
  const c = order.customer || {};
  const p = order.payment || {};
  const sym = SITE.currency?.symbol || "";
  const contacts = c.contacts && Object.keys(c.contacts).length
    ? Object.entries(c.contacts).map(([k, v]) => `  • ${k}: ${v}`).join("\n")
    : "";
  const lines = [
    `🛒 NEW ORDER — ${SITE.name}`,
    `#${String(order.id).toUpperCase()}  ·  ${sym}${order.total} ${order.currency || ""}`,
    "",
    "Items:",
    ...order.items.map((i) => `  • ${i.name} ×${i.qty} — ${sym}${i.price}`),
    "",
    order.subtotal != null ? `Subtotal: ${sym}${order.subtotal}` : "",
    order.discount ? `Discount${order.promoCode ? ` (${order.promoCode} −${order.promoPct || ""}%)` : ""}: −${sym}${order.discount}` : "",
    order.shipping != null ? `Shipping: ${order.shipping === 0 ? "FREE" : sym + order.shipping}` : "",
    `Country: ${c.countryName || c.country || "—"}${c.state ? " / " + c.state : ""}`,
    `City: ${[c.city, c.zip].filter(Boolean).join(", ") || "—"}`,
    `Address: ${c.address || "—"}`,
    `Phone: ${c.phone || "—"}`,
    contacts ? `Contacts:\n${contacts}` : "",
    "",
    ...(p.method === "card"
      ? [
        "Payment: 💳 Bank card via 1pay — AWAITING PAYMENT",
        `1pay payment: ${p.paymentId || "—"}`,
        "A separate ✅ PAID message arrives once the card payment goes through.",
      ]
      : [
        `Payment: ${p.coinName || ""} (${p.coin || ""}) — ${p.network || ""}`,
        `Wallet: ${p.walletAddress || ""}`,
        `TX hash: ${p.txHash || ""}`,
      ]),
  ].filter(Boolean);
  return tgSend(tg, lines.join("\n"));
}

export async function sendTicketNotification(ticket) {
  const tg = cfg();
  if (!tg) return false;
  const lines = [
    `✉️ SUPPORT MESSAGE — ${SITE.name}`,
    `From: ${ticket.name} <${ticket.email}>`,
    ticket.subject ? `Subject: ${ticket.subject}` : "",
    ticket.lang ? `Lang: ${String(ticket.lang).toUpperCase()}` : "",
    "",
    ticket.message,
  ].filter(Boolean);
  return tgSend(tg, lines.join("\n"));
}
