import { SITE, US_STATES, COUNTRIES } from "../config.js?v=8";
import { Cart } from "../store.js?v=8";
import { createOrder } from "../db.js?v=8";
import { icon, money, esc, initTheme, mountChrome, toast, copyText, pageHero } from "../ui.js?v=8";
import { t } from "../i18n.js?v=8";
import { sendOrderNotification } from "../notify.js?v=8";

initTheme();

const items = Cart.items();
const subtotal = Cart.subtotal();
const promo = Cart.getPromo();
const discount = Cart.discount();
const shippingFee = Cart.shipping();
const total = Cart.total();
let selectedCoin = null;

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
      <p class="hint">${t("pay_exact")}</p>
    </aside>`;
}

function coinCards() {
  return SITE.wallets.map((w) => `
    <button type="button" class="coin" data-coin="${w.id}">
      <span class="coin__sym" style="color:${w.accent}">${esc(w.symbol)}</span>
      <span>${esc(w.name)}</span>
      <span class="coin__net">${esc(w.network)}</span>
      ${w.badge ? `<span class="coin__badge">${esc(w.badge)}</span>` : ""}
    </button>`).join("");
}

// Real brand logos for the payment method picker (inline SVG, brand colours).
const BRAND = {
  btc: `<svg class="paylogo" viewBox="0 0 32 32" aria-label="Bitcoin"><circle cx="16" cy="16" r="16" fill="#F7931A"/><path fill="#fff" d="M22 14.1c.3-1.9-1.2-2.9-3.2-3.6l.6-2.6-1.6-.4-.6 2.5-1.3-.3.6-2.5-1.5-.4-.7 2.6-1-.3-2.1-.5-.4 1.7s1.1.2 1.1.3c.6.1.7.5.7.8l-1.7 6.9c-.1.2-.3.4-.6.3 0 0-1.1-.3-1.1-.3l-.8 1.8 2 .5 1.1.3-.7 2.6 1.5.4.7-2.6c.4.1.9.2 1.3.3l-.6 2.6 1.5.4.7-2.6c2.7.5 4.7.3 5.5-2.1.7-1.9 0-3-1.4-3.7 1-.2 1.7-.9 1.9-2.3zm-3.5 4.9c-.5 1.9-3.7.9-4.7.6l.9-3.5c1 .3 4.3.8 3.8 2.9zm.5-5c-.4 1.8-3.1.9-4 .6l.8-3.2c.9.2 3.7.6 3.2 2.6z"/></svg>`,
  eth: `<svg class="paylogo" viewBox="0 0 32 32" aria-label="Ethereum"><circle cx="16" cy="16" r="16" fill="#627EEA"/><g fill="#fff"><path fill-opacity=".6" d="M16 4v8.9l7.5 3.4z"/><path d="M16 4 8.5 16.3 16 12.9z"/><path fill-opacity=".6" d="M16 21.9V28l7.5-10.4z"/><path d="M16 28v-6.1l-7.5-4.3z"/><path fill-opacity=".2" d="m16 20.6 7.5-4.3L16 12.9z"/><path fill-opacity=".6" d="M8.5 16.3 16 20.6v-7.7z"/></g></svg>`,
  usdt: `<svg class="paylogo" viewBox="0 0 32 32" aria-label="Tether"><circle cx="16" cy="16" r="16" fill="#26A17B"/><path fill="#fff" d="M17.9 14v-2.3h5.3V8.2H8.9v3.5h5.3V14c-4.3.2-7.5 1-7.5 2.1s3.2 1.9 7.5 2.1v6.8h3.7v-6.8c4.3-.2 7.5-1 7.5-2.1s-3.2-1.9-7.5-2.1zm0 3.5c-.1 0-.7.1-1.9.1s-1.7 0-1.8-.1c-3.7-.1-6.5-.8-6.5-1.5s2.8-1.3 6.5-1.5v2.3c.1 0 .9.1 1.8.1 1.2 0 1.8-.1 1.9-.1v-2.3c3.7.2 6.4.8 6.4 1.5s-2.7 1.4-6.4 1.5z"/></svg>`,
  visa: `<svg class="paylogo paylogo--wide" viewBox="0 0 48 16" aria-label="Visa"><text x="24" y="13" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="800" font-style="italic" fill="#1A1F71">VISA</text></svg>`,
  mc: `<svg class="paylogo" viewBox="0 0 48 32" aria-label="Mastercard"><circle cx="19" cy="16" r="11" fill="#EB001B"/><circle cx="29" cy="16" r="11" fill="#F79E1B" fill-opacity=".9"/><path fill="#FF5F00" d="M24 7.6a11 11 0 0 0 0 16.8 11 11 0 0 0 0-16.8z"/></svg>`,
  paypal: `<svg class="paylogo paylogo--wide" viewBox="0 0 74 20" aria-label="PayPal"><text x="0" y="16" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="800" font-style="italic"><tspan fill="#003087">Pay</tspan><tspan fill="#009CDE">Pal</tspan></text></svg>`,
};
function payLogos(id) {
  if (id === "crypto") return `${BRAND.btc}${BRAND.eth}${BRAND.usdt}`;
  if (id === "card") return `${BRAND.visa}${BRAND.mc}`;
  if (id === "paypal") return BRAND.paypal;
  return "";
}

// Payment methods. Only crypto is live; card + PayPal are shown as "coming soon".
function methodCards() {
  const methods = [
    { id: "crypto", icon: "bitcoin", title: t("pm_crypto"), sub: "BTC · ETH · USDT", live: true },
    { id: "card", icon: "card", title: t("pm_card"), sub: "Visa · Mastercard · Apple Pay", live: false },
    { id: "paypal", icon: "paypal", title: "PayPal", sub: t("pm_paypal_sub"), live: false },
  ];
  return methods.map((m) => `
    <button type="button" class="method${m.live ? "" : " is-soon"}" data-method="${m.id}" role="radio" aria-checked="false"${m.live ? ' aria-controls="cryptoArea" aria-expanded="false"' : ' aria-disabled="true"'}>
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
    return /^(0x)?[a-zA-Z0-9]{8,}$/.test(val) ? "" : t("err_txhash");
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
            <input type="hidden" name="coin" id="coinInput">
            <div class="field" data-field="coin" style="margin-top:10px"><div class="error-text"></div></div>
          </section>

          <section class="panel">
            <div class="panel__title"><span class="step-num">3</span> ${t("step_confirm")}</div>
            <div class="field" data-field="txhash">
              <label class="label" for="txhash">${t("tx_hash")} <span class="req">*</span></label>
              <input class="input" id="txhash" name="txhash" placeholder="${t("tx_ph")}">
              <div class="hint">${t("tx_hint")}</div>
              <div class="error-text"></div>
            </div>
            <button class="btn btn--primary btn--block btn--lg" type="submit" style="margin-top:var(--space-4)">
              ${icon("check", 18)} ${t("place_order")} · ${money(total)}
            </button>
            <p class="hint" style="text-align:center;margin-top:10px">${icon("shield", 13)} ${t("pending_note")}</p>
          </section>
        </div>
        ${summaryHTML()}
      </div>
    </form>`;

  // payment method: crypto reveals the coins; card / PayPal are not live yet
  const methodGrid = document.getElementById("methodGrid");
  const cryptoArea = document.getElementById("cryptoArea");
  const openCrypto = () => {
    const btn = methodGrid.querySelector('[data-method="crypto"]');
    btn.classList.add("is-selected");
    btn.setAttribute("aria-checked", "true");
    btn.setAttribute("aria-expanded", "true");
    if (cryptoArea.hidden) {
      cryptoArea.hidden = false;
      cryptoArea.classList.remove("is-in"); void cryptoArea.offsetWidth; cryptoArea.classList.add("is-in");
    }
  };
  methodGrid.addEventListener("click", (e) => {
    const b = e.target.closest(".method");
    if (!b) return;
    if (b.getAttribute("aria-disabled") === "true") {
      toast(t("pm_unavailable"));
      b.classList.remove("nope"); void b.offsetWidth; b.classList.add("nope");
      return;
    }
    openCrypto();
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
    const required = isUS ? [...REQUIRED, "state"] : REQUIRED;
    let ok = true;
    required.forEach((n) => { if (!validateField(n, f[n].value)) ok = false; });
    if (!selectedCoin) { openCrypto(); setError("coin", t("err_coin")); ok = false; }
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
      payment: {
        coin: selectedCoin.id,
        coinName: selectedCoin.name,
        network: selectedCoin.network,
        walletAddress: selectedCoin.address,
        txHash: f.txhash.value.trim(),
      },
    });

    try { await sendOrderNotification(order); } catch {}
    Cart.clear();
    toast(t("order_placed"));
    location.href = `order.html?id=${order.id}`;
  });
}

init();
