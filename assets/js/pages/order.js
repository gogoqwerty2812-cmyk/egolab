import { getOrder } from "../db.js?v=7";
import { SITE } from "../config.js?v=7";
import { icon, money, esc, safeUrl, initTheme, mountChrome, qs, copyText, toast } from "../ui.js?v=7";
import { t } from "../i18n.js?v=7";

initTheme();

function contactHref(id, v) {
  const s = v.trim();
  switch (id) {
    case "email": return "mailto:" + s;
    case "telegram": return "https://t.me/" + s.replace(/^@/, "");
    case "instagram": return "https://instagram.com/" + s.replace(/^@/, "");
    case "whatsapp": return "https://wa.me/" + s.replace(/[^0-9]/g, "");
    case "facebook": return /^https?:/i.test(s) ? s : "https://" + s;
    default: return null;
  }
}
function contactsRows(customer) {
  const list = customer.contacts && Object.keys(customer.contacts).length
    ? customer.contacts
    : (customer.facebook ? { facebook: customer.facebook } : {});
  return SITE.checkoutContacts.filter((m) => list[m.id]).map((m) => {
    const v = list[m.id];
    const href = contactHref(m.id, v);
    const val = href
      ? `<a href="${esc(safeUrl(href))}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-ink)">${esc(v)}</a>`
      : esc(v);
    return `<dt>${esc(m.label)}</dt><dd>${val}</dd>`;
  }).join("");
}

function statusClass(s) {
  const map = {
    "Pending payment": "status--pending",
    "Payment received": "status--paid",
    Processing: "status--processing",
    Shipped: "status--shipped",
    Completed: "status--completed",
    Cancelled: "status--cancelled",
  };
  return map[s] || "status--pending";
}

async function init() {
  mountChrome("index.html");
  const app = document.getElementById("app");
  const o = await getOrder(qs("id"));

  if (!o) {
    app.innerHTML = `<div class="empty">${icon("box", 46)}<h3>${t("prod_not_found")}</h3><a class="btn btn--primary" href="index.html" style="margin-top:16px">${icon("bag", 16)} ${t("back_to_catalog")}</a></div>`;
    return;
  }

  const date = new Date(o.createdAt).toLocaleString();
  app.innerHTML = `
    <div class="confirm-hero reveal in">
      <div class="confirm-check">${icon("check", 38)}</div>
      <h1 style="font-size:2.6rem">${t("thank_you")}</h1>
      <p class="muted">${t("order_word")} <b>#${o.id.toUpperCase()}</b> · ${esc(date)}</p>
      <p style="margin-top:8px"><span class="badge ${statusClass(o.status)}"><span class="status-dot"></span> ${esc(o.status)}</span></p>
    </div>

    <div class="checkout-layout" style="align-items:start">
      <div>
        <section class="panel">
          <div class="panel__title">${icon("bag", 18)} ${t("items_word")}</div>
          <div class="stack" style="--space-4:12px">
            ${o.items.map((i) => `
              <div style="display:flex;gap:12px;align-items:center">
                <div class="cart-item__img" style="width:54px;height:54px;flex:0 0 auto">${i.image ? `<img src="${esc(i.image)}" alt="">` : ""}</div>
                <div style="flex:1"><div style="font-weight:600">${esc(i.name)}</div><div class="muted" style="font-size:.85rem">${i.qty} × ${money(i.price)}</div></div>
                <strong>${money(i.qty * i.price)}</strong>
              </div>`).join("")}
          </div>
          ${o.subtotal != null ? `<div class="summary__row" style="margin-top:12px"><span>${t("subtotal")}</span><span>${money(o.subtotal)}</span></div>` : ""}
          ${o.discount ? `<div class="summary__row" style="color:var(--accent)"><span>${t("discount")}${o.promoCode ? ` · ${esc(String(o.promoCode))}` : ""}</span><span>−${money(o.discount)}</span></div>` : ""}
          ${o.shipping != null ? `<div class="summary__row"><span>${t("shipping")}</span><span>${o.shipping === 0 ? t("free") : money(o.shipping)}</span></div>` : ""}
          <div class="summary__total"><span>${t("total")}</span><b>${money(o.total)}</b></div>
        </section>

        <section class="panel">
          <div class="panel__title">${icon("truck", 18)} ${t("delivery")}</div>
          <dl class="kv">
            ${o.customer.countryName ? `<dt>${t("country")}</dt><dd>${esc(o.customer.countryName)}</dd>` : ""}
            ${o.customer.stateName ? `<dt>${t("state")}</dt><dd>${esc(o.customer.stateName)}${o.customer.state ? ` (${esc(o.customer.state)})` : ""}</dd>` : ""}
            ${o.customer.city ? `<dt>${t("city")}</dt><dd>${esc(o.customer.city)}${o.customer.zip ? `, ${esc(o.customer.zip)}` : ""}</dd>` : ""}
            <dt>${t("delivery_address")}</dt><dd>${esc(o.customer.address)}</dd>
            <dt>${t("phone")}</dt><dd>${esc(o.customer.phone)}</dd>
            ${contactsRows(o.customer)}
          </dl>
        </section>
      </div>

      <aside class="summary" style="position:static">
        <div class="panel__title">${icon("shield", 18)} ${t("payment")}</div>
        <dl class="kv" style="grid-template-columns:110px 1fr">
          <dt>${t("coin")}</dt><dd>${esc(o.payment.coinName)} (${esc(o.payment.coin)})</dd>
          <dt>${t("network")}</dt><dd>${esc(o.payment.network)}</dd>
          <dt>${t("wallet")}</dt><dd style="font-family:var(--font-mono);font-size:.8rem;word-break:break-all">${esc(o.payment.walletAddress)}</dd>
          <dt>${t("tx_hash")}</dt><dd style="font-family:var(--font-mono);font-size:.8rem;word-break:break-all">${esc(o.payment.txHash)} <button class="icon-btn" id="copyTx" style="width:28px;height:28px;vertical-align:middle" aria-label="${t("copied")}">${icon("copy", 13)}</button></dd>
        </dl>
        <a class="btn btn--primary btn--block" href="index.html" style="margin-top:var(--space-5)">${icon("bag", 16)} ${t("continue_shopping")}</a>
        <a class="btn btn--ghost btn--block" href="admin.html" style="margin-top:10px">${t("view_dashboard")}</a>
      </aside>
    </div>`;

  document.getElementById("copyTx")?.addEventListener("click", () => copyText(o.payment.txHash).then(() => toast(t("copied"))));
}

init();
