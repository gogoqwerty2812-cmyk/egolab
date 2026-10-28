import { Cart } from "../store.js?v=14";
import { SITE, SHIPPING } from "../config.js?v=14";
import { icon, money, esc, placeholder, initTheme, mountChrome, toast, pageHero } from "../ui.js?v=14";
import { t } from "../i18n.js?v=14";

initTheme();

function line(i) {
  const img = i.image ? `<img src="${esc(i.image)}" alt="${esc(i.name)}">` : placeholder();
  return `
  <div class="cart-item" data-id="${i.id}">
    <a class="cart-item__img" href="product.html?id=${i.id}">${img}</a>
    <div>
      <a class="card__title" href="product.html?id=${i.id}">${esc(i.name)}</a>
      <div class="muted" style="font-size:.9rem">${money(i.price)} ${t("each")}</div>
      <button class="btn btn--danger btn--sm remove" data-id="${i.id}" style="margin-top:8px">${icon("trash", 14)} ${t("remove")}</button>
    </div>
    <div class="cart-item__ctrl" style="text-align:right;display:flex;flex-direction:column;gap:10px;align-items:flex-end">
      <div class="qty">
        <button class="dec" data-id="${i.id}" aria-label="Decrease">−</button>
        <input class="qty-in" data-id="${i.id}" type="number" value="${i.qty}" min="1" max="${i.stock ?? 99}" aria-label="Quantity">
        <button class="inc" data-id="${i.id}" aria-label="Increase">+</button>
      </div>
      <strong class="price--sm price">${money(i.price * i.qty)}</strong>
    </div>
  </div>`;
}

function render() {
  const app = document.getElementById("app");
  const items = Cart.items();

  if (!items.length) {
    app.innerHTML = `
      <div class="empty">${icon("cart", 46)}
        <h3>${t("cart_empty")}</h3>
        <p>${t("cart_empty_desc")}</p>
        <a class="btn btn--primary" href="index.html" style="margin-top:18px">${icon("bag", 16)} ${t("start_shopping")}</a>
      </div>`;
    return;
  }

  const promo = Cart.getPromo();
  const ship = Cart.shipping();

  app.innerHTML = `
    ${pageHero({ eyebrow: `${SITE.name} · ${t("nav_cart")}`, title: t("your_cart"), color: "#B98B79" })}
    <div class="cart-layout">
      <div class="stack" id="lines">${items.map(line).join("")}</div>
      <aside class="summary">
        <h2 class="panel__title" style="font-size:1.1rem">${t("order_summary")}</h2>
        <div class="summary__row"><span>${t("subtotal")} (${Cart.count()})</span><span>${money(Cart.subtotal())}</span></div>
        ${promo ? `<div class="summary__row" style="color:var(--accent)"><span>${t("discount")} · ${esc(promo.code.toUpperCase())} (${promo.pct}%)</span><span>−${money(Cart.discount())}</span></div>` : ""}
        <div class="summary__row"><span>${t("shipping")}</span><span>${ship === 0 ? t("free") : money(ship)}</span></div>
        <div class="promo-box" style="margin-top:14px">
          <div style="display:flex;gap:8px">
            <input class="input" id="promoInput" placeholder="${t("promo_ph")}" value="${promo ? esc(promo.code) : ""}" autocomplete="off" spellcheck="false" style="flex:1;text-transform:uppercase">
            <button class="btn ${promo ? "btn--danger" : "btn--ghost"}" id="promoBtn" type="button">${promo ? t("remove") : t("apply")}</button>
          </div>
          <div class="hint" id="promoMsg" style="margin-top:6px">${ship !== 0 ? t("free_ship_hint", { n: money(SHIPPING.freeThreshold) }) : ""}</div>
        </div>
        <div class="summary__total" style="margin-top:14px"><span>${t("total")}</span><b>${money(Cart.total())}</b></div>
        <a class="btn btn--primary btn--block btn--lg" href="checkout.html" style="margin-top:var(--space-4)">${icon("lock", 18)} ${t("secure_checkout")}</a>
        <a class="btn btn--ghost btn--block" href="index.html" style="margin-top:10px">${t("continue_shopping")}</a>
      </aside>
    </div>`;

  const promoBtn = document.getElementById("promoBtn");
  const promoInput = document.getElementById("promoInput");
  const applyPromo = () => {
    if (Cart.getPromo()) { Cart.clearPromo(); toast(t("promo_removed")); render(); return; }
    const res = Cart.applyPromo(promoInput.value);
    if (res) { toast(t("promo_applied", { n: res.pct })); render(); }
    else {
      const m = document.getElementById("promoMsg");
      if (m) { m.textContent = t("promo_invalid"); m.style.color = "var(--danger, #b4472e)"; }
      promoInput.focus();
    }
  };
  promoBtn?.addEventListener("click", applyPromo);
  promoInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); applyPromo(); } });

  const lines = document.getElementById("lines");
  lines.addEventListener("click", (e) => {
    const rm = e.target.closest(".remove");
    const dec = e.target.closest(".dec");
    const inc = e.target.closest(".inc");
    if (rm) { Cart.remove(rm.dataset.id); toast(t("item_removed")); render(); }
    else if (dec) { const it = Cart.items().find((x) => x.id === dec.dataset.id); Cart.setQty(dec.dataset.id, it.qty - 1); render(); }
    else if (inc) { const it = Cart.items().find((x) => x.id === inc.dataset.id); Cart.setQty(inc.dataset.id, it.qty + 1); render(); }
  });
  lines.addEventListener("change", (e) => {
    const inp = e.target.closest(".qty-in");
    if (!inp) return;
    Cart.setQty(inp.dataset.id, parseInt(inp.value, 10) || 1);
    render();
  });
}

mountChrome("cart.html");
render();
