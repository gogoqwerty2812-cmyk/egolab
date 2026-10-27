// =============================================================================
//  ui.js — shared chrome: header, footer, theme, toasts, icons, helpers
// =============================================================================
import { SITE } from "./config.js?v=9";
import { Cart } from "./store.js?v=9";
import { getPublishedSettings } from "./db.js?v=9";
import { t, getLang, setLang, LANGUAGES } from "./i18n.js?v=9";

// ---- Icons (inline SVG, Lucide-style) --------------------------------------
export const icon = (name, size = 20) => {
  const p = {
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    arrowLeft: '<path d="m12 19-7-7 7-7M19 12H5"/>',
    arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    box: '<path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20M6 15h4"/>',
    bitcoin: '<circle cx="12" cy="12" r="9.5"/><path d="M9.5 7.5h3.8a2.2 2.2 0 0 1 0 4.5H9.5zM9.5 12h4.3a2.25 2.25 0 0 1 0 4.5H9.5zM9.5 7.5v9M11 6v1.5M11 16.5V18M13.2 6v1.5M13.2 16.5V18"/>',
    paypal: '<path d="M7.2 20 8.8 10h5a3.6 3.6 0 0 1 0 7.2h-3.3"/><path d="M9.7 16.6 11.5 4h5.3a3.6 3.6 0 0 1 0 7.2h-3.4"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    star: '<path d="M12 2l3 6.3 6.9 1-5 4.8 1.2 6.9L12 17.8 5.9 21l1.2-6.9-5-4.8 6.9-1z"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
    truck: '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.68 2.34a2 2 0 0 1-.45 2.11L8.1 9.91a16 16 0 0 0 6 6l1.74-1.74a2 2 0 0 1 2.11-.45c.74.32 1.53.55 2.34.68A2 2 0 0 1 22 16.92Z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/>',
    send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
    headset: '<path d="M3 14v-3a9 9 0 0 1 18 0v3"/><path d="M21 16a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2ZM3 16a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2"/>',
    tiktok: '<path d="M9 12.5a3.5 3.5 0 1 0 3.5 3.5V4c.8 2 2.3 3.2 4.5 3.4"/>',
    youtube: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 8.5l6 3.5-6 3.5z"/>',
    x: '<path d="M4 3l7.2 9.3L4.4 21H7l5.2-6 4.6 6H21l-7.5-9.7L20 3h-2.6l-4.6 5.4L8.7 3z"/>',
  }[name] || "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
};

// ---- Formatting ------------------------------------------------------------
export const money = (n) =>
  new Intl.NumberFormat(SITE.currency.locale, {
    style: "currency",
    currency: SITE.currency.code,
  }).format(Number(n) || 0);

export const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Sanitize a URL used in an href. Blocks script-capable schemes
// (javascript:, data:, vbscript:, file:) even when obfuscated with embedded
// whitespace/control chars; http/https/mailto/tel and relative URLs pass.
// Always wrap the result in esc() too when placing it into an attribute.
export const safeUrl = (u = "") => {
  const raw = String(u).trim();
  if (!raw) return "#";
  const stripped = raw.replace(/[\x00-\x20]+/g, "").toLowerCase();
  if (/^(javascript|data|vbscript|file):/.test(stripped)) return "#";
  return raw;
};

export const placeholder = () => `<div class="img-ph">${icon("box", 34)}</div>`;

// ---- Theme -----------------------------------------------------------------
const THEME_KEY = "mkt_theme";
export function initTheme() {
  // Single calm theme site-wide. Clear any stale saved preference (e.g. old "dark").
  try { localStorage.setItem(THEME_KEY, "light"); } catch (e) {}
  document.documentElement.setAttribute("data-theme", "light");
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(THEME_KEY, next);
  document.querySelectorAll("[data-theme-icon]").forEach((el) => {
    el.innerHTML = icon(next === "light" ? "moon" : "sun");
  });
}

// ---- Toasts ----------------------------------------------------------------
export function toast(msg, type = "ok") {
  let wrap = document.querySelector(".toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.innerHTML = `<span class="toast__dot"></span><span>${esc(msg)}</span>`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.classList.add("hide");
    setTimeout(() => el.remove(), 250);
  }, 2600);
}

// ---- Header + Footer -------------------------------------------------------
function navItems(active) {
  const items = [
    ["index.html", t("nav_catalog")],
    ["reviews.html", t("nav_reviews")],
    ["certificates.html", t("nav_certs")],
    ["support.html", t("nav_support")],
    ["cart.html", t("nav_cart")],
    ["admin.html", t("nav_admin")],
  ];
  return items
    .map(
      ([href, label]) =>
        `<a class="navlink${active === href ? " is-active" : ""}" href="${href}">${label}</a>`
    )
    .join("");
}

function langSelect() {
  const cur = getLang();
  return `<div class="lang-picker" title="${t("lang_label")}">
    ${icon("globe", 16)}
    <select id="langSel" aria-label="${t("lang_label")}">
      ${LANGUAGES.map((l) => `<option value="${l.code}" ${l.code === cur ? "selected" : ""}>${l.short}</option>`).join("")}
    </select>
  </div>`;
}

// Auto-remove a flat image background in the browser (edge flood-fill), so a
// product photo on white/black blends into the coloured carousel/cards without
// editing content.json. Same-origin images only (canvas stays untainted).
export function cutoutImage(img, { tol = 50 } = {}) {
  if (!img || img.dataset.cut) return;
  const run = () => {
    if (img.dataset.cut) return;
    img.dataset.cut = "1";
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return;
    try {
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, w, h);
      const px = data.data;
      const cs = [0, (w - 1) * 4, (h - 1) * w * 4, (w * h - 1) * 4];
      let r = 0, g = 0, b = 0, a = 0;
      for (const o of cs) { r += px[o]; g += px[o + 1]; b += px[o + 2]; a += px[o + 3]; }
      r /= 4; g /= 4; b /= 4; a /= 4;
      if (a < 12) return; // background already transparent → leave as is
      const tol2 = tol * tol, N = w * h, seen = new Uint8Array(N), st = [];
      const push = (x, y) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const i = y * w + x; if (seen[i]) return;
        const o = i * 4, dr = px[o] - r, dg = px[o + 1] - g, db = px[o + 2] - b;
        if (dr * dr + dg * dg + db * db <= tol2) { seen[i] = 1; st.push(i); }
      };
      for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
      for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
      while (st.length) { const i = st.pop(); px[i * 4 + 3] = 0; const x = i % w, y = (i / w) | 0; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
      // Anti-alias the hard flood-fill boundary so the cut-out isn't ragged:
      // 3×3 box-blur of the alpha channel turns the 1px step into a soft edge.
      const alpha = new Uint8ClampedArray(N);
      for (let i = 0; i < N; i++) alpha[i] = px[i * 4 + 3];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let sum = 0, cnt = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const ny = y + dy; if (ny < 0 || ny >= h) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx; if (nx < 0 || nx >= w) continue;
              sum += alpha[ny * w + nx]; cnt++;
            }
          }
          px[(y * w + x) * 4 + 3] = (sum / cnt) | 0;
        }
      }
      ctx.putImageData(data, 0, 0);
      img.src = c.toDataURL("image/png");
    } catch {}
  };
  if (img.complete && img.naturalWidth) run();
  else img.addEventListener("load", run, { once: true });
}

// Sample a product photo's own (flat) background colour from its corners, so the
// site/card/carousel background can be set to match it — no seam. Same-origin
// images only. Skips images whose corners are transparent (cut-outs).
export function sampleCornerColor(img, cb) {
  if (!img) return;
  const run = () => {
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return;
    try {
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const pts = [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]];
      let r = 0, g = 0, b = 0, a = 0;
      for (const [x, y] of pts) { const d = ctx.getImageData(x, y, 1, 1).data; r += d[0]; g += d[1]; b += d[2]; a += d[3]; }
      a /= 4; if (a < 12) return; // transparent corners → nothing to match
      cb(`rgb(${Math.round(r / 4)}, ${Math.round(g / 4)}, ${Math.round(b / 4)})`);
    } catch {}
  };
  if (img.complete && img.naturalWidth) run();
  else img.addEventListener("load", run, { once: true });
}

// Calm colour for a category — from config, or a deterministic muted tone for
// custom categories the seller adds in the admin.
export function catColor(name) {
  const map = (SITE.categoryColors) || {};
  if (name && map[name]) return map[name];
  let h = 0;
  for (const ch of String(name || "")) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 26% 60%)`;
}

// Bold colour-block page header — the home/product look, reused everywhere.
export function pageHero({ eyebrow = "", title = "", subtitle = "", color = "#94908c", image = "" } = {}) {
  return `
  <section class="page-hero${image ? " page-hero--photo" : ""}" style="background:${color}">
    ${image ? `<img class="page-hero__photo" src="${esc(image)}" alt="" aria-hidden="true" data-parallax="0.08">` : ""}
    <div class="page-hero__grain"></div>
    <div class="page-hero__inner">
      ${eyebrow ? `<span class="page-hero__eyebrow">${eyebrow}</span>` : ""}
      <h1 class="page-hero__title">${title}</h1>
      ${subtitle ? `<p class="page-hero__sub">${subtitle}</p>` : ""}
    </div>
  </section>`;
}

export function mountChrome(activePage = "index.html") {
  // language
  document.documentElement.lang = getLang();
  // document meta / title
  document.title = `${SITE.name} — ${document.body.dataset.pageTitle || t("tagline")}`;
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "description";
    document.head.appendChild(meta);
  }
  meta.content = SITE.metaDescription;

  const isLight = document.documentElement.getAttribute("data-theme") === "light";

  // header
  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <div class="container site-header__inner">
      <a class="brand" href="index.html">
        <span class="brand__mark"><img src="assets/img/logo-mark.svg" alt="" width="30" height="30"></span>
        <span class="brand__name">${esc(SITE.name)}</span>
      </a>
      <nav class="site-nav" id="siteNav">${navItems(activePage)}<span class="nav-underline" id="navUnderline"></span></nav>
      <div class="header-tools" style="display:flex;gap:8px;align-items:center;margin-left:auto">
        ${langSelect()}
        <a class="icon-btn" href="cart.html" id="cartLink" aria-label="${t("nav_cart")}">
          ${icon("cart")}
          <span class="cart-count" id="cartCount" hidden>0</span>
        </a>
        <button class="icon-btn nav-toggle" id="navToggle" aria-label="Menu" aria-expanded="false">${icon("menu")}</button>
      </div>
    </div>`;
  document.body.prepend(header);

  // footer
  const footer = document.createElement("footer");
  footer.className = "site-footer";
  const year = new Date().getFullYear();
  footer.innerHTML = `
    <div class="container site-footer__inner">
      <div>
        <div class="brand" style="font-size:1.25rem"><span class="brand__mark" style="width:26px;height:26px"><img src="assets/img/logo-mark.svg" alt="" width="26" height="26"></span> ${esc(SITE.name)}</div>
        <small>${esc(t("tagline"))}</small>
      </div>
      <div style="display:flex;gap:18px;flex-wrap:wrap">
        <a class="navlink" href="index.html">${t("nav_catalog")}</a>
        <a class="navlink" href="reviews.html">${t("nav_reviews")}</a>
        <a class="navlink" href="certificates.html">${t("nav_certs")}</a>
        <a class="navlink" href="support.html">${t("nav_support")}</a>
        <a class="navlink" href="cart.html">${t("nav_cart")}</a>
        <a class="navlink" href="admin.html">${t("nav_admin")}</a>
      </div>
      <div class="socials" id="footerSocials">
        ${(SITE.socials || []).map((sc) => `<a class="social" href="${esc(safeUrl(sc.href))}" target="_blank" rel="noopener noreferrer" aria-label="${esc(sc.name)}">${icon(sc.icon, 18)}</a>`).join("")}
      </div>
      <small>© ${year} ${esc(SITE.name)}.</small>
    </div>`;
  document.body.appendChild(footer);

  // social links are editable in the admin → refresh them from published settings
  getPublishedSettings().then((s) => {
    const box = document.getElementById("footerSocials");
    if (box && s && Array.isArray(s.socials) && s.socials.length) {
      box.innerHTML = s.socials.map((sc) => `<a class="social" href="${esc(safeUrl(sc.href))}" target="_blank" rel="noopener noreferrer" aria-label="${esc(sc.name || "")}">${icon(sc.icon, 18)}</a>`).join("");
    }
  }).catch(() => {});

  // wiring
  const langSel = document.getElementById("langSel");
  if (langSel) langSel.addEventListener("change", (e) => { setLang(e.target.value); location.reload(); });
  const nav = document.getElementById("siteNav");
  const navToggle = document.getElementById("navToggle");
  navToggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });

  // header elevation on scroll + gentle parallax on colour-block page headers
  const reduceMo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let phInner = null, phGrain = null, ticking = false;
  const onScrollUI = () => {
    if (!reduceMo) {
      if (!phInner) phInner = document.querySelector(".page-hero__inner");
      if (!phGrain) phGrain = document.querySelector(".page-hero__grain");
      const y = window.scrollY;
      if (phInner) { phInner.style.transform = `translateY(${Math.min(y * 0.16, 70)}px)`; phInner.style.opacity = String(Math.max(0, 1 - y / 560)); }
      if (phGrain) phGrain.style.transform = `translateY(${Math.min(y * 0.26, 110)}px)`;
      // subtle parallax for any photo marked data-parallax="strength"
      const vh = window.innerHeight;
      document.querySelectorAll("[data-parallax]").forEach((el) => {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const k = parseFloat(el.dataset.parallax) || 0.1;
        const off = ((r.top + r.height / 2) - vh / 2) * -k;
        el.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0) scale(1.08)`;
      });
    }
    ticking = false;
  };
  const onScroll = () => {
    document.body.classList.toggle("hdr-shrink", window.scrollY > 8);
    if (!ticking) { ticking = true; requestAnimationFrame(onScrollUI); }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // sliding nav active indicator — one physical object that moves & springs
  const underline = document.getElementById("navUnderline");
  const activeLink = nav.querySelector(".navlink.is-active");
  const isHorizontal = () => window.matchMedia("(min-width: 901px)").matches;
  const moveUnderline = (target) => {
    if (!underline) return;
    if (!target || !isHorizontal()) { underline.style.opacity = "0"; return; }
    const nr = nav.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    underline.style.width = `${tr.width}px`;
    underline.style.transform = `translateX(${tr.left - nr.left}px)`;
    underline.style.opacity = "1";
  };
  const resetUnderline = () => moveUnderline(activeLink);
  nav.querySelectorAll(".navlink").forEach((a) => a.addEventListener("mouseenter", () => moveUnderline(a)));
  nav.addEventListener("mouseleave", resetUnderline);
  requestAnimationFrame(resetUnderline);
  setTimeout(resetUnderline, 300);
  window.addEventListener("load", resetUnderline);
  window.addEventListener("resize", resetUnderline);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resetUnderline);

  // cart badge (live)
  const badge = document.getElementById("cartCount");
  const render = () => {
    const c = Cart.count();
    badge.textContent = c;
    badge.hidden = c === 0;
    if (c > 0) { badge.classList.remove("bump"); void badge.offsetWidth; badge.classList.add("bump"); }
  };
  render();
  Cart.subscribe(render);
}

// ---- reveal-on-scroll ------------------------------------------------------
export function revealOnScroll() {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window) || !els.length) {
    els.forEach((e) => e.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
    { threshold: 0.12 }
  );
  els.forEach((e) => io.observe(e));
}

// ---- number count-up (smooth) ----------------------------------------------
export function countUp(el, to, { dur = 1100, decimals = 0, suffix = "" } = {}) {
  if (!el) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = to.toFixed(decimals) + suffix; return;
  }
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
    el.textContent = (to * eased).toFixed(decimals) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---- skeleton loading placeholders (presentation only) ---------------------
export function skeletonCards(n = 8) {
  return Array.from({ length: n }).map(() => `
    <div class="sk-card">
      <div class="sk sk-media"></div>
      <div class="sk sk-line sh"></div>
      <div class="sk sk-line lg"></div>
      <div class="sk sk-line sh" style="margin-bottom:16px"></div>
    </div>`).join("");
}

// ---- misc helpers ----------------------------------------------------------
export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement("textarea");
  ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); } catch {}
  ta.remove();
  return Promise.resolve();
}

export const qs = (k) => new URLSearchParams(location.search).get(k);

// ---- fly-to-cart: physical feedback when adding a product ------------------
export function flyToCart(sourceEl, imgSrc) {
  const cart = document.getElementById("cartLink");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !cart || !sourceEl || !imgSrc) return; // counter still springs via cart subscribe

  const s = sourceEl.getBoundingClientRect();
  const c = cart.getBoundingClientRect();
  if (!s.width || !c.width) return;
  const size = Math.min(96, Math.max(52, s.width * 0.5));
  const clone = document.createElement("img");
  clone.src = imgSrc;
  clone.className = "fly-clone";
  clone.style.width = clone.style.height = `${size}px`;
  clone.style.left = `${s.left + s.width / 2 - size / 2}px`;
  clone.style.top = `${s.top + s.height / 2 - size / 2}px`;
  document.body.appendChild(clone);

  const dx = c.left + c.width / 2 - (s.left + s.width / 2);
  const dy = c.top + c.height / 2 - (s.top + s.height / 2);
  const anim = clone.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 46}px) scale(.7)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${dx}px, ${dy}px) scale(.16)`, opacity: 0.25 },
    ],
    { duration: 640, easing: "cubic-bezier(.5,.05,.85,.5)" }
  );
  anim.onfinish = () => clone.remove();
  anim.oncancel = () => clone.remove();
}
