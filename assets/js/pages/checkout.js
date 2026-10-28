import { SITE, US_STATES, COUNTRIES } from "../config.js?v=12";
import { Cart } from "../store.js?v=12";
import { createOrder, updateOrder, deleteOrder } from "../db.js?v=12";
import { icon, money, esc, initTheme, mountChrome, toast, copyText, pageHero } from "../ui.js?v=12";
import { t } from "../i18n.js?v=12";
import { sendOrderNotification } from "../notify.js?v=12";

initTheme();

const items = Cart.items();
const subtotal = Cart.subtotal();
const promo = Cart.getPromo();
const discount = Cart.discount();
const shippingFee = Cart.shipping();
const total = Cart.total();
let selectedCoin = null;
let selectedMethod = null; // "crypto" | "card"

// Card payments go live once the 1pay Worker URL is set in config.js.
const cardLive = () => !!(SITE.cardPayment?.enabled && SITE.cardPayment?.workerUrl);

function summaryHTML() {
  return `
    <aside class="summary">
      <h2 class="panel__title" style="font-size:1.1rem">${icon("bag", 18)} ${t("order_summary")}</h2>
      <div class="stack" style="--space-4:12px">
        ${items.map((i) => `
          <div style="display:flex;gap:12px;align-items:center">
            <div class="cart-item__img" style="width:54px;height:54px;flex:0 0 auto">${i.image ? `<img src="${esc(i.image)}" alt="">` : ""}</div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(i.name)}</div>
              <div class="muted" style="font-size:.82rem">${i.qty} × ${money(i.price)}</div>
            </div>
            <strong style="font-size:.9rem">${money(i.qty * i.price)}</strong>
          </div>`).join("")}
      </div>
      <div class="summary__row" style="margin-top:12px"><span>${t("subtotal")}</span><span>${money(subtotal)}</span></div>
      ${promo ? `<div class="summary__row" style="color:var(--accent)"><span>${t("discount")} · ${esc(promo.code.toUpperCase())} (${promo.pct}%)</span><span>−${money(discount)}</span></div>` : ""}
      <div class="summary__row"><span>${t("shipping")}</span><span>${shippingFee === 0 ? t("free") : money(shippingFee)}</span></div>
      <div class="summary__total"><span>${t("total_due")}</span><b>${money(total)}</b></div>
      <p class="hint" id="payExact">${t("pay_exact")}</p>
    </aside>`;
}

function coinCards() {
  return SITE.wallets.map((w) => `
    <button type="button" class="coin" data-coin="${w.id}">
      <span class="coin__head">${coinLogo(w)}<span class="coin__sym">${esc(w.symbol)}</span></span>
      <span>${esc(w.name)}</span>
      <span class="coin__net">${esc(w.network)}</span>
      ${w.badge ? `<span class="coin__badge">${esc(w.badge)}</span>` : ""}
    </button>`).join("");
}

// Coin / network logos (inline SVG, brand colours, 32×32 circles).
const COIN = {
  btc: `<circle cx="16" cy="16" r="16" fill="#F7931A"/><path fill="#fff" d="M22 14.1c.3-1.9-1.2-2.9-3.2-3.6l.6-2.6-1.6-.4-.6 2.5-1.3-.3.6-2.5-1.5-.4-.7 2.6-1-.3-2.1-.5-.4 1.7s1.1.2 1.1.3c.6.1.7.5.7.8l-1.7 6.9c-.1.2-.3.4-.6.3 0 0-1.1-.3-1.1-.3l-.8 1.8 2 .5 1.1.3-.7 2.6 1.5.4.7-2.6c.4.1.9.2 1.3.3l-.6 2.6 1.5.4.7-2.6c2.7.5 4.7.3 5.5-2.1.7-1.9 0-3-1.4-3.7 1-.2 1.7-.9 1.9-2.3zm-3.5 4.9c-.5 1.9-3.7.9-4.7.6l.9-3.5c1 .3 4.3.8 3.8 2.9zm.5-5c-.4 1.8-3.1.9-4 .6l.8-3.2c.9.2 3.7.6 3.2 2.6z"/>`,
  eth: `<circle cx="16" cy="16" r="16" fill="#627EEA"/><g fill="#fff"><path fill-opacity=".6" d="M16 4v8.9l7.5 3.4z"/><path d="M16 4 8.5 16.3 16 12.9z"/><path fill-opacity=".6" d="M16 21.9V28l7.5-10.4z"/><path d="M16 28v-6.1l-7.5-4.3z"/><path fill-opacity=".2" d="m16 20.6 7.5-4.3L16 12.9z"/><path fill-opacity=".6" d="M8.5 16.3 16 20.6v-7.7z"/></g>`,
  usdt: `<circle cx="16" cy="16" r="16" fill="#26A17B"/><path fill="#fff" d="M17.9 14v-2.3h5.3V8.2H8.9v3.5h5.3V14c-4.3.2-7.5 1-7.5 2.1s3.2 1.9 7.5 2.1v6.8h3.7v-6.8c4.3-.2 7.5-1 7.5-2.1s-3.2-1.9-7.5-2.1zm0 3.5c-.1 0-.7.1-1.9.1s-1.7 0-1.8-.1c-3.7-.1-6.5-.8-6.5-1.5s2.8-1.3 6.5-1.5v2.3c.1 0 .9.1 1.8.1 1.2 0 1.8-.1 1.9-.1v-2.3c3.7.2 6.4.8 6.4 1.5s-2.7 1.4-6.4 1.5z"/>`,
  bnb: `<circle cx="16" cy="16" r="16" fill="#F3BA2F"/><g fill="#fff"><path d="M16 6.5l5.6 5.6-2 2L16 10.5l-3.6 3.6-2-2z"/><path d="M16 25.5l5.6-5.6-2-2L16 21.5l-3.6-3.6-2 2z"/><path d="M10.2 14l2 2-2 2-2-2z"/><path d="M21.8 14l2 2-2 2-2-2z"/><path d="M16 13.9l2.1 2.1-2.1 2.1-2.1-2.1z"/></g>`,
  sol: `<circle cx="16" cy="16" r="16" fill="#121212"/><defs><linearGradient id="solg" x1="8" y1="24" x2="24" y2="8" gradientUnits="userSpaceOnUse"><stop stop-color="#9945FF"/><stop offset="1" stop-color="#14F195"/></linearGradient></defs><g fill="url(#solg)"><path d="M11.3 9h12.2l-2.8 2.9H8.5z"/><path d="M8.5 14.6h12.2l2.8 2.9H11.3z"/><path d="M11.3 20.1h12.2l-2.8 2.9H8.5z"/></g>`,
  trx: `<circle cx="16" cy="16" r="16" fill="#EB0029"/><g fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"><path d="M8.6 9.3l15 3.4-9.2 11.6z"/><path d="M8.6 9.3l8.9 7.1 6.1-3.7M17.5 16.4l-3.1 7.9"/></g>`,
  ton: `<circle cx="16" cy="16" r="16" fill="#0098EA"/><g fill="none" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"><path d="M10.4 10.2h11.2c1 0 1.6 1.1 1.1 1.9l-5.9 10.1c-.4.7-1.4.7-1.8 0L9.3 12.1c-.5-.8.1-1.9 1.1-1.9z"/><path d="M16 10.2v12.6"/></g>`,
  ltc: `<circle cx="16" cy="16" r="16" fill="#345D9D"/><path fill="#fff" d="M13.6 7.5h3.4l-2 7.4 2.5-1-.6 2.3-2.5 1-1.3 4.8h8l-.7 2.5H9.6l1.7-6.3-2 .8.6-2.3 2-.8z"/>`,
  doge: `<circle cx="16" cy="16" r="16" fill="#C2A633"/><path fill="#fff" d="M11 8.5h5.6c4.6 0 7.4 2.9 7.4 7.5s-2.8 7.5-7.4 7.5H11v-6.1H9v-2.8h2zm3.3 3v3.3h3.4v2.8h-3.4v3.4h2.2c2.6 0 4.1-1.7 4.1-4.5s-1.5-5-4.1-5z"/>`,
};
const NET_NAME = { btc: "Bitcoin", eth: "Ethereum", usdt: "Tether", bnb: "BNB", sol: "Solana", trx: "TRON", ton: "TON", ltc: "Litecoin", doge: "Dogecoin" };
// each SVG gets its own gradient id — a shared id breaks when the first copy is hidden
let svgSeq = 0;
const coinSvg = (key, cls = "paylogo") =>
  `<svg class="${cls}" viewBox="0 0 32 32" role="img" aria-label="${NET_NAME[key] || key}">${(COIN[key] || "").replace(/solg/g, `solg${++svgSeq}`)}</svg>`;
// coin logo with a small network badge for tokens (e.g. USDT on TRON)
const coinLogo = (w) =>
  `<span class="coin__logo">${coinSvg(w.icon, "coin__svg")}${w.chain ? coinSvg(w.chain, "coin__chain") : ""}</span>`;

// Card brand badges, all on the same 40×26 card shape.
const CARD = {
  visa: `<svg class="cardlogo" viewBox="0 0 40 26" role="img" aria-label="Visa"><rect x=".5" y=".5" width="39" height="25" rx="4" fill="#fff" stroke="#D9D4CC"/><text x="20" y="17.4" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="11.5" font-weight="900" font-style="italic" letter-spacing=".3" fill="#1434CB">VISA</text></svg>`,
  mc: `<svg class="cardlogo" viewBox="0 0 40 26" role="img" aria-label="Mastercard"><rect x=".5" y=".5" width="39" height="25" rx="4" fill="#fff" stroke="#D9D4CC"/><circle cx="16" cy="13" r="7" fill="#EB001B"/><circle cx="24" cy="13" r="7" fill="#F79E1B"/><path fill="#FF5F00" d="M20 7.25a7 7 0 0 1 0 11.5 7 7 0 0 1 0-11.5z"/></svg>`,
  applepay: `<svg class="cardlogo" viewBox="0 0 40 26" role="img" aria-label="Apple Pay"><rect width="40" height="26" rx="4" fill="#000"/><path fill="#fff" transform="translate(5.6 6.4) scale(.54)" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/><text x="25.4" y="17.2" text-anchor="middle" font-family="-apple-system,'Segoe UI',Arial,sans-serif" font-size="10" font-weight="600" fill="#fff">Pay</text></svg>`,
  paypal: `<svg class="cardlogo" viewBox="0 0 40 26" role="img" aria-label="PayPal"><rect x=".5" y=".5" width="39" height="25" rx="4" fill="#fff" stroke="#D9D4CC"/><text x="20" y="16.6" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="9.4" font-weight="800" font-style="italic"><tspan fill="#003087">Pay</tspan><tspan fill="#009CDE">Pal</tspan></text></svg>`,
};
function payLogos(id) {
  if (id === "crypto") return `<span class="logo-stack">${["btc", "eth", "usdt", "sol", "ton"].map((k) => coinSvg(k)).join("")}</span>`;
  if (id === "card") return `${CARD.visa}${CARD.mc}${CARD.applepay}${CARD.paypal}`;
  return "";
}

// Payment methods. Crypto is live; card is live once the 1pay Worker is set up.
function methodCards() {
  const symbols = [...new Set(SITE.wallets.map((w) => w.symbol))].join(" · ");
  const methods = [
    { id: "crypto", title: t("pm_crypto"), sub: symbols, live: true },
    { id: "card", title: t("pm_card"), sub: "Visa · Mastercard · Apple Pay · PayPal", live: cardLive() },
  ];
  return methods.map((m) => `
    <button type="button" class="method${m.live ? "" : " is-soon"}" data-method="${m.id}" role="radio" aria-checked="false"${m.live ? ` aria-controls="${m.id}Area" aria-expanded="false"` : ' aria-disabled="true"'}>
      <span class="method__logos">${payLogos(m.id)}</span>
      <span class="method__body"><span class="method__title">${esc(m.title)}</span><span class="method__sub">${esc(m.sub)}</span></span>
      ${m.live ? `<span class="method__chev">${icon("arrowRight", 16)}</span>` : `<span class="method__soon">${esc(t("soon"))}</span>`}
    </button>`).join("");
}

function contactFields() {
  return SITE.checkoutContacts.map((c) => `
    <div class="field" data-field="${c.id}">
      <label class="label" for="${c.id}" style="display:flex;align-items:center;gap:6px;color:var(--fg-muted);font-weight:500">${icon(c.icon, 14)} ${esc(c.label)}</label>
      <input class="input" id="${c.id}" name="${c.id}" type="${c.type}" placeholder="${esc(c.placeholder)}" autocomplete="off">
    </div>`).join("");
}

function renderPayBox(w) {
  const box = document.getElementById("payBox");
  box.classList.add("is-open");
  box.innerHTML = `
    <div class="pay-grid">
      <div class="qr-frame" id="qr"></div>
      <div class="stack" style="min-width:0">
        <div>
          <div class="label">${t("send_label")} <b>${esc(w.symbol)}</b> — ${esc(w.network)}</div>
          <div class="addr">
            <span id="addrText">${esc(w.address)}</span>
            <button type="button" class="icon-btn" id="copyAddr" style="width:34px;height:34px;flex:0 0 auto" aria-label="${t("addr_copy")}">${icon("copy", 16)}</button>
          </div>
        </div>
        <p class="hint">${t("scan_hint")}</p>
      </div>
    </div>`;

  try {
    const qr = window.qrcode(0, "M");
    qr.addData(w.address);
    qr.make();
    document.getElementById("qr").innerHTML = qr.createSvgTag({ cellSize: 5, margin: 1, scalable: true });
  } catch (e) {
    document.getElementById("qr").innerHTML = `<div class="img-ph" style="border-radius:8px">QR</div>`;
  }

  document.getElementById("copyAddr").addEventListener("click", () => {
    copyText(w.address).then(() => toast(t("copied")));
  });
}

// Ask the 1pay Worker for a hosted card checkout. It recalculates the total from
// the published catalog and answers 409 "price_changed" if the cart is stale.
async function createCardPayment(order, email) {
  const res = await fetch(`${SITE.cardPayment.workerUrl.replace(/\/$/, "")}/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: order.id,
      items: order.items.map((i) => ({ id: i.id, qty: i.qty })),
      promoCode: order.promoCode,
      total: order.total,
      email: email || "",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || "provider_error");
  return data;
}

// ---- validation ------------------------------------------------------------
const rules = {
  country: (v) => (v ? "" : t("select_country")),
  city: (v) => (v.trim().length >= 2 ? "" : `${t("city")}: ${t("required_word")}`),
  address: (v) => (v.trim().length >= 4 ? "" : t("err_address")),
  state: (v) => (v ? "" : t("err_state")),
  phone: (v) => {
    const digits = v.replace(/\D/g, "");
    if (!v.trim()) return t("err_phone");
    return digits.length >= 7 && digits.length <= 15 ? "" : t("err_phone");
  },
  txhash: (v) => {
    const val = v.trim();
    if (!val) return t("err_txhash");
    // hex / base58 / TON base64 hashes
    return /^[A-Za-z0-9+/=_-]{8,}$/.test(val) ? "" : t("err_txhash");
  },
};
// state is required only when the country is the United States
const REQUIRED = ["country", "city", "address", "phone", "txhash"];

function setError(name, msg) {
  const field = document.querySelector(`[data-field="${name}"]`);
  if (!field) return;
  field.classList.toggle("field--invalid", !!msg);
  const err = field.querySelector(".error-text");
  if (err) err.textContent = msg;
}

function validateField(name, value) {
  const msg = rules[name] ? rules[name](value) : "";
  setError(name, msg);
  return !msg;
}

function init() {
  mountChrome("cart.html");
  const app = document.getElementById("app");

  if (!items.length) {
    app.innerHTML = `<div class="empty">${icon("cart", 46)}<h3>${t("cart_empty")}</h3><p>${t("cart_empty_desc")}</p><a class="btn btn--primary" href="index.html" style="margin-top:16px">${icon("bag", 16)} ${t("start_shopping")}</a></div>`;
    return;
  }

  const countryOpts = `<option value="">${t("select_country")}</option>` +
    COUNTRIES.map(([code, name]) => `<option value="${code}">${esc(name)}</option>`).join("");
  const stateOpts = `<option value="">${t("select_state")}</option>` +
    US_STATES.map(([abbr, name]) => `<option value="${abbr}">${esc(name)}</option>`).join("");

  app.innerHTML = `
    ${pageHero({ eyebrow: `${SITE.name} · ${t("nav_cart")}`, title: t("checkout"), color: "#8496B0" })}
    <a class="navlink" href="cart.html" style="display:inline-flex;gap:6px;align-items:center;margin-bottom:var(--space-4)">${icon("arrowLeft", 16)} ${t("back_to_cart")}</a>
    <form id="checkoutForm" novalidate>
      <div class="checkout-layout">
        <div>
          <section class="panel">
            <div class="panel__title"><span class="step-num">1</span> ${t("step_delivery")}</div>
            <div class="form-grid">
              <div class="field" data-field="country">
                <label class="label" for="country">${t("country")} <span class="req">*</span></label>
                <select class="select" id="country" name="country">${countryOpts}</select>
                <div class="error-text"></div>
              </div>
              <div class="field" data-field="state" id="stateField" hidden>
                <label class="label" for="state">${t("state")} <span class="req">*</span></label>
                <select class="select" id="state" name="state">${stateOpts}</select>
                <div class="error-text"></div>
              </div>
              <div class="form-row">
                <div class="field" data-field="city">
                  <label class="label" for="city">${t("city")} <span class="req">*</span></label>
                  <input class="input" id="city" name="city" autocomplete="address-level2">
                  <div class="error-text"></div>
                </div>
                <div class="field" data-field="zip">
                  <label class="label" for="zip">${t("zip")}</label>
                  <input class="input" id="zip" name="zip" autocomplete="postal-code">
                </div>
              </div>
              <div class="field" data-field="address">
                <label class="label" for="address">${t("delivery_address")} <span class="req">*</span></label>
                <input class="input" id="address" name="address" placeholder="${t("addr_ph")}" autocomplete="address-line1">
                <div class="error-text"></div>
              </div>
              <div class="field" data-field="phone">
                <label class="label" for="phone">${t("phone")} <span class="req">*</span></label>
                <input class="input" id="phone" name="phone" type="tel" placeholder="+1 (555) 000-0000">
                <div class="error-text"></div>
              </div>
              <div>
                <div class="label" style="margin-bottom:2px">${t("contact_more_title")}</div>
                <div class="hint" style="margin-top:0;margin-bottom:12px">${t("contact_more_hint")}</div>
                <div class="contacts-grid">${contactFields()}</div>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel__title"><span class="step-num">2</span> ${t("step_payment")}</div>
            <p class="hint" style="margin-bottom:var(--space-4)">${t("pay_choose")}</p>
            <div class="method-grid" id="methodGrid" role="radiogroup" aria-label="${t("step_payment")}">${methodCards()}</div>
            <div class="crypto-area" id="cryptoArea" hidden>
              <p class="hint" style="margin:var(--space-5) 0 var(--space-4)">${t("payment_crypto")}</p>
              <div class="coin-grid" id="coinGrid">${coinCards()}</div>
              <div class="pay-box" id="payBox"></div>
            </div>
            <div class="crypto-area" id="cardArea" hidden>
              <p class="hint" style="margin:var(--space-5) 0 0">${t("card_note")}</p>
            </div>
            <input type="hidden" name="coin" id="coinInput">
            <div class="field" data-field="coin" style="margin-top:10px"><div class="error-text"></div></div>
          </section>

          <section class="panel">
            <div class="panel__title"><span class="step-num">3</span> ${t("step_confirm")}</div>
            <div class="field" data-field="txhash" id="txField">
              <label class="label" for="txhash">${t("tx_hash")} <span class="req">*</span></label>
              <input class="input" id="txhash" name="txhash" placeholder="${t("tx_ph")}">
              <div class="hint">${t("tx_hint")}</div>
              <div class="error-text"></div>
            </div>
            <button class="btn btn--primary btn--block btn--lg" type="submit" id="submitBtn" style="margin-top:var(--space-4)">
              ${icon("check", 18)} <span id="submitLabel">${t("place_order")}</span> · ${money(total)}
            </button>
            <p class="hint" style="text-align:center;margin-top:10px">${icon("shield", 13)} <span id="pendingNote">${t("pending_note")}</span></p>
          </section>
        </div>
        ${summaryHTML()}
      </div>
    </form>`;

  // payment method: crypto reveals the coins, card explains the 1pay redirect;
  // PayPal is not live yet
  const methodGrid = document.getElementById("methodGrid");
  const selectMethod = (id) => {
    selectedMethod = id;
    methodGrid.querySelectorAll(".method:not(.is-soon)").forEach((btn) => {
      const on = btn.dataset.method === id;
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-checked", String(on));
      btn.setAttribute("aria-expanded", String(on));
    });
    ["crypto", "card"].forEach((m) => {
      const area = document.getElementById(`${m}Area`);
      if (m !== id) { area.hidden = true; return; }
      if (area.hidden) {
        area.hidden = false;
        area.classList.remove("is-in"); void area.offsetWidth; area.classList.add("is-in");
      }
    });
    // a card buyer has no TX hash — 1pay confirms the payment for us
    const isCard = id === "card";
    document.getElementById("txField").hidden = isCard;
    if (isCard) setError("txhash", "");
    setError("coin", "");
    document.getElementById("submitLabel").textContent = isCard ? t("pay_by_card") : t("place_order");
    document.getElementById("pendingNote").textContent = isCard ? t("card_pending_note") : t("pending_note");
    document.getElementById("payExact").textContent = isCard ? t("card_pay_exact") : t("pay_exact");
  };
  const openCrypto = () => selectMethod("crypto");
  methodGrid.addEventListener("click", (e) => {
    const b = e.target.closest(".method");
    if (!b) return;
    if (b.getAttribute("aria-disabled") === "true") {
      toast(t("pm_unavailable"));
      b.classList.remove("nope"); void b.offsetWidth; b.classList.add("nope");
      return;
    }
    selectMethod(b.dataset.method);
  });

  // coin selection
  const grid = document.getElementById("coinGrid");
  grid.addEventListener("click", (e) => {
    const b = e.target.closest(".coin");
    if (!b) return;
    grid.querySelectorAll(".coin").forEach((c) => c.classList.remove("is-selected"));
    b.classList.add("is-selected");
    selectedCoin = SITE.wallets.find((w) => w.id === b.dataset.coin);
    document.getElementById("coinInput").value = selectedCoin.id;
    setError("coin", "");
    renderPayBox(selectedCoin);
  });

  // show the US state dropdown only for the United States
  const countrySel = document.getElementById("country");
  const stateField = document.getElementById("stateField");
  countrySel.addEventListener("change", () => {
    const isUS = countrySel.value === "US";
    stateField.hidden = !isUS;
    if (!isUS) setError("state", "");
    setError("country", "");
  });

  // live validation on blur
  ["country", "city", "address", "phone", "txhash", "state"].forEach((name) => {
    const el = document.getElementById(name);
    if (!el) return;
    el.addEventListener("blur", () => validateField(name, el.value));
    el.addEventListener("input", () => {
      const field = document.querySelector(`[data-field="${name}"]`);
      if (field && field.classList.contains("field--invalid")) validateField(name, el.value);
    });
  });

  // submit
  document.getElementById("checkoutForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const isUS = f.country.value === "US";
    const isCard = selectedMethod === "card";
    let required = isUS ? [...REQUIRED, "state"] : REQUIRED;
    if (isCard) required = required.filter((n) => n !== "txhash");
    let ok = true;
    required.forEach((n) => { if (!validateField(n, f[n].value)) ok = false; });
    if (!isCard && !selectedCoin) { openCrypto(); setError("coin", t("err_coin")); ok = false; }
    if (!ok) {
      toast(t("err_fix"), "err");
      document.querySelector(".field--invalid")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // collect any provided optional contacts
    const contacts = {};
    SITE.checkoutContacts.forEach((c) => {
      const v = f[c.id]?.value.trim();
      if (v) contacts[c.id] = v;
    });

    const countryName = COUNTRIES.find(([code]) => code === f.country.value)?.[1] || f.country.value;
    const stateVal = isUS ? f.state.value : "";
    const stateName = isUS ? (US_STATES.find(([a]) => a === stateVal)?.[1] || stateVal) : "";
    const order = await createOrder({
      items: items.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, image: i.image })),
      subtotal,
      discount,
      shipping: shippingFee,
      promoCode: promo ? promo.code.toUpperCase() : "",
      promoPct: promo ? promo.pct : 0,
      total,
      currency: SITE.currency.code,
      customer: {
        country: f.country.value,
        countryName,
        state: stateVal,
        stateName,
        city: f.city.value.trim(),
        zip: f.zip.value.trim(),
        address: f.address.value.trim(),
        phone: f.phone.value.trim(),
        contacts,
        // kept for backward compatibility with earlier orders / views
        facebook: contacts.facebook || "",
      },
      payment: isCard
        ? { method: "card", provider: "1pay", coin: "CARD", coinName: t("pm_card"), network: "1pay.cx", walletAddress: "", txHash: "" }
        : {
          coin: selectedCoin.id,
          coinName: selectedCoin.name,
          network: selectedCoin.network,
          walletAddress: selectedCoin.address,
          txHash: f.txhash.value.trim(),
        },
    });

    if (isCard) {
      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      toast(t("card_redirecting"));
      let pay;
      try {
        pay = await createCardPayment(order, contacts.email);
      } catch (err) {
        await deleteOrder(order.id);
        btn.disabled = false;
        toast(err.message === "price_changed" ? t("card_price_changed") : t("card_error"), "err");
        return;
      }
      const saved = await updateOrder(order.id, {
        payment: { ...order.payment, paymentId: pay.paymentId, checkoutUrl: pay.url },
      });
      try { await sendOrderNotification(saved); } catch {}
      Cart.clear();
      location.href = pay.url;
      return;
    }

    try { await sendOrderNotification(order); } catch {}
    Cart.clear();
    toast(t("order_placed"));
    location.href = `order.html?id=${order.id}`;
  });
}

init();
