import { getPublishedProduct, getPublishedProducts } from "../db.js?v=8";
import { Cart } from "../store.js?v=8";
import { icon, money, esc, placeholder, initTheme, mountChrome, revealOnScroll, toast, qs, flyToCart, catColor, sampleCornerColor } from "../ui.js?v=8";
import { t } from "../i18n.js?v=8";

initTheme();

// drag-to-scroll with momentum (mouse); touch keeps native inertia
function enableDragScroll(el) {
  if (!el) return;
  let down = false, startX = 0, startLeft = 0, lastX = 0, vx = 0, lastT = 0, raf = 0;
  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") return;
    down = true; el.classList.add("dragging");
    startX = e.clientX; startLeft = el.scrollLeft; lastX = e.clientX; vx = 0; lastT = performance.now();
    cancelAnimationFrame(raf);
    try { el.setPointerCapture(e.pointerId); } catch {}
  });
  el.addEventListener("pointermove", (e) => {
    if (!down) return;
    const now = performance.now(), dt = now - lastT || 16;
    el.scrollLeft = startLeft - (e.clientX - startX);
    vx = (e.clientX - lastX) / dt; lastX = e.clientX; lastT = now;
  });
  const release = () => {
    if (!down) return;
    down = false; el.classList.remove("dragging");
    let v = vx * 16;
    const decay = () => { if (Math.abs(v) < 0.5) return; el.scrollLeft -= v; v *= 0.92; raf = requestAnimationFrame(decay); };
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) decay();
  };
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
}

function stockLine(p) {
  if (p.stock <= 0) return `<span class="badge badge--out">${icon("box", 14)} ${t("sold_out")}</span>`;
  if (p.stock <= 5) return `<span class="badge badge--low">${icon("box", 14)} ${t("only_left", { n: p.stock })}</span>`;
  return `<span class="badge badge--stock">${icon("check", 14)} ${t("in_stock")}</span>`;
}

async function relatedStrip(current) {
  const all = await getPublishedProducts();
  const rel = all.filter((p) => p.id !== current.id && p.category === current.category).slice(0, 4);
  const pool = rel.length ? rel : all.filter((p) => p.id !== current.id).slice(0, 4);
  if (!pool.length) return "";
  return `
    <section class="section">
      <div class="section-head"><h2 style="font-size:1.8rem">${t("you_may_like")}</h2><span class="rule"></span></div>
      <div class="rail" id="relatedRail">
        ${pool.map((p) => `
          <a class="card" href="product.html?id=${p.id}" style="--cat:${catColor(p.category)}">
            <div class="card__media">${p.images?.[0] ? `<img src="${esc(p.images[0])}" alt="${esc(p.name)}" loading="lazy">` : placeholder()}</div>
            <div class="card__body">
              <span class="card__cat">${esc(p.category)}</span>
              <span class="card__title">${esc(p.name)}</span>
              <div class="card__foot"><span class="price price--sm">${money(p.price)}</span></div>
            </div>
          </a>`).join("")}
      </div>
    </section>`;
}

async function init() {
  mountChrome("index.html");
  const id = qs("id");
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="pdp" aria-busy="true">
      <div class="sk" style="aspect-ratio:1/1;border-radius:var(--r-card)"></div>
      <div>
        <div class="sk sk-line sh" style="margin:0 0 18px"></div>
        <div class="sk sk-line lg" style="height:34px;margin:0 0 18px;width:80%"></div>
        <div class="sk sk-line" style="margin:0 0 10px"></div>
        <div class="sk sk-line" style="margin:0 0 10px"></div>
        <div class="sk sk-line sh" style="margin:0 0 28px"></div>
        <div class="sk" style="height:48px;width:220px;border-radius:var(--r-pill)"></div>
      </div>
    </div>`;
  const p = id ? await getPublishedProduct(id) : null;

  if (!p) {
    app.innerHTML = `<div class="empty">${icon("box", 44)}<h3>${t("prod_not_found")}</h3><p>${t("prod_not_found_desc")}</p><a class="btn btn--primary" href="index.html" style="margin-top:16px">${icon("arrowLeft", 16)} ${t("back_to_catalog")}</a></div>`;
    return;
  }

  const imgs = p.images?.length ? p.images : [];
  const galleryInner = imgs.length
    ? `<div class="gallery__track" id="galTrack">${imgs.map((src) => `<img src="${esc(src)}" alt="${esc(p.name)}" draggable="false">`).join("")}</div>${imgs.length > 1 ? `<div class="gallery__dots" id="galDots">${imgs.map((_, i) => `<i class="${i === 0 ? "on" : ""}"></i>`).join("")}</div>` : ""}`
    : placeholder();
  const out = p.stock <= 0;
  let currentIndex = 0;

  app.innerHTML = `
    <section class="pdp-hero" style="background:${catColor(p.category)}">
      <div class="pdp-hero__grain"></div>
      <div class="pdp-hero__inner">
        <a class="navlink pdp-back" href="index.html" style="display:inline-flex;gap:6px;align-items:center;margin-bottom:var(--space-4)">${icon("arrowLeft", 16)} ${t("back_to_catalog")}</a>
        <div class="pdp reveal">
          <div>
            <div class="gallery__main" id="galMain">${galleryInner}</div>
        ${imgs.length > 1 ? `<div class="gallery__thumbs" id="thumbs">
          ${imgs.map((src, i) => `<button class="gallery__thumb${i === 0 ? " is-active" : ""}" data-i="${i}"><img src="${esc(src)}" alt="View ${i + 1}" draggable="false"></button>`).join("")}
        </div>` : ""}
      </div>
      <div class="stack">
        <span class="card__cat">${esc(p.category)}${p.subcategory ? ` · ${esc(p.subcategory)}` : ""}</span>
        <h1 class="pdp__title">${esc(p.name)}</h1>
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <span class="price">${money(p.price)}</span>
          ${stockLine(p)}
        </div>
        <p class="muted" style="white-space:pre-line">${esc(p.description)}</p>
        <div class="hr" style="margin-block:var(--space-3)"></div>
        <div style="display:flex;gap:var(--space-4);align-items:center;flex-wrap:wrap">
          <div class="qty" ${out ? 'style="opacity:.5;pointer-events:none"' : ""}>
            <button id="minus" aria-label="Decrease">−</button>
            <input id="qty" type="number" value="1" min="1" max="${Math.max(1, p.stock)}" aria-label="Quantity">
            <button id="plus" aria-label="Increase">+</button>
          </div>
          <button class="btn btn--primary btn--lg" id="addBtn" ${out ? "disabled" : ""} style="flex:1;min-width:200px">
            ${icon("cart", 18)} ${out ? t("sold_out") : t("add_to_cart")}
          </button>
        </div>
        <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:8px" class="muted">
          <span style="display:inline-flex;gap:6px;align-items:center">${icon("truck", 16)} ${t("ships_worldwide")}</span>
        </div>
      </div>
    </div>
      </div>
    </section>
    <div id="related" class="pdp-related"></div>`;

  // match the colour block to the product photo's own background colour
  const heroImg = app.querySelector(".gallery__track img, .gallery__main img");
  const heroEl = app.querySelector(".pdp-hero");
  if (heroImg && heroEl) sampleCornerColor(heroImg, (col) => {
    heroEl.style.background = col;
    app.querySelectorAll(".gallery__track img, .gallery__main img").forEach((i2) => { i2.style.filter = "none"; });
  });

  // swipeable gallery — drag with rubber-band + spring snap
  const track = document.getElementById("galTrack");
  if (track && imgs.length > 1) {
    const main = document.getElementById("galMain");
    const dots = document.getElementById("galDots");
    const thumbs = document.getElementById("thumbs");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let index = 0, width = main.clientWidth, startX = 0, dx = 0, dragging = false;

    const setTransition = (on) => { track.style.transition = on && !reduce ? "transform .42s var(--ease-spring)" : "none"; };
    const place = (extra = 0) => { track.style.transform = `translateX(${-index * width + extra}px)`; };
    const sync = () => {
      currentIndex = index;
      if (dots) [...dots.children].forEach((d, i) => d.classList.toggle("on", i === index));
      if (thumbs) [...thumbs.children].forEach((b, i) => b.classList.toggle("is-active", i === index));
    };
    const go = (i) => { index = Math.max(0, Math.min(imgs.length - 1, i)); setTransition(true); place(); sync(); };

    setTransition(false); place(); sync();
    window.addEventListener("resize", () => { width = main.clientWidth; setTransition(false); place(); });

    track.addEventListener("pointerdown", (e) => {
      dragging = true; startX = e.clientX; dx = 0; width = main.clientWidth;
      track.classList.add("dragging"); setTransition(false);
      try { track.setPointerCapture(e.pointerId); } catch {}
    });
    track.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      dx = e.clientX - startX;
      if ((index === 0 && dx > 0) || (index === imgs.length - 1 && dx < 0)) dx *= 0.35; // rubber-band
      place(dx);
    });
    const end = () => {
      if (!dragging) return;
      dragging = false; track.classList.remove("dragging");
      const threshold = Math.max(40, width * 0.16);
      go(dx <= -threshold ? index + 1 : dx >= threshold ? index - 1 : index);
      dx = 0;
    };
    track.addEventListener("pointerup", end);
    track.addEventListener("pointercancel", end);

    if (thumbs) thumbs.addEventListener("click", (e) => {
      const b = e.target.closest(".gallery__thumb");
      if (b) go(+b.dataset.i);
    });
  }

  // qty
  const qty = document.getElementById("qty");
  const clamp = () => {
    let v = parseInt(qty.value, 10);
    if (!Number.isFinite(v) || v < 1) v = 1;
    if (v > p.stock) v = p.stock;
    qty.value = v;
  };
  document.getElementById("minus")?.addEventListener("click", () => { qty.value = Math.max(1, (+qty.value || 1) - 1); });
  document.getElementById("plus")?.addEventListener("click", () => { qty.value = Math.min(p.stock, (+qty.value || 1) + 1); clamp(); });
  qty?.addEventListener("change", clamp);

  document.getElementById("addBtn")?.addEventListener("click", () => {
    if (out) return;
    clamp();
    const src = document.getElementById("galMain");
    if (src && imgs[currentIndex]) flyToCart(src, imgs[currentIndex]);
    Cart.add({ id: p.id, name: p.name, price: p.price, image: imgs[0] || "", stock: p.stock }, +qty.value || 1);
    toast(t("added_toast", { name: `${qty.value} × ${p.name}` }));
  });

  document.getElementById("related").innerHTML = await relatedStrip(p);
  document.querySelectorAll("#related .card__media").forEach((media) => {
    const im = media.querySelector("img");
    if (im) sampleCornerColor(im, (col) => { media.style.background = col; im.style.filter = "none"; });
  });
  enableDragScroll(document.getElementById("relatedRail"));
  revealOnScroll();
}

init();
