import { SITE } from "../config.js?v=10";
import { getPublishedProducts, getPublishedSettings, getPublishedReviews } from "../db.js?v=10";
import { Cart } from "../store.js?v=10";
import { icon, money, esc, placeholder, initTheme, mountChrome, revealOnScroll, toast, skeletonCards, flyToCart, catColor, sampleCornerColor, cutoutImage } from "../ui.js?v=10";
import { t, getLang } from "../i18n.js?v=10";

initTheme();

let ALL = [];
let CATS = []; // category names present in the catalog (drives the landing grid)
const state = { q: "", cat: "all", sort: "new" };

// Landing sections copy (EN/RU; other languages fall back to EN)
const COPY = {
  en: {
    proofLabel: "Reviews worldwide", more: "More",
    toonKicker: "EgoLab SUPPLEMENTS",
    toonDesc: "Lab-tested fuel for lifters, runners and everyday athletes. Genuine brands, honest doses, crypto checkout. Order now and hit your peak.",
    discover: "DISCOVER IT",
    benTitle: "Why EgoLab",
    ben: [
      ["shield", "Lab-tested", "Only genuine brands, verified by third-party labs."],
      ["truck", "Fast shipping", "Discreet worldwide delivery with tracking."],
      ["check", "Anonymous delivery", "No account, no extra data — discreet packaging and private checkout."],
      ["headset", "Real support", "Questions? We reply within hours."],
    ],
    revTitle: "What athletes say",
    allReviews: "All reviews",
    shopEyebrow: "Shop",
    promoEyebrow: "EgoLab · Lab-tested fuel",
    promoTitle: "Built for<br><em>heavy days.</em>",
    promoDesc: "Genuine brands, honest doses and third-party lab reports for every batch. Pay in crypto, ship worldwide — no account needed.",
    promoStats: [["1.3K+", "Athletes"], ["4.9★", "Avg rating"], ["100%", "Lab-tested"]],
    promoCta1: "Shop now",
    promoCta2: "Lab reports",
    rev: [
      ["The pre-workout is insane, energy for the whole session. Shipping was quick too.", "Max K. · powerlifter"],
      ["Legit gear, honest doses. My go-to for whey and creatine now.", "Elena R. · CrossFit"],
      ["Paid in USDT, order tracked, arrived sealed. Ordering again.", "Dmitri V. · bodybuilder"],
    ],
  },
  ru: {
    proofLabel: "Отзывов по всему миру", more: "Ещё",
    toonKicker: "EgoLab СПОРТПИТ",
    toonDesc: "Проверенное топливо для лифтеров, бегунов и любителей. Только оригинал, честные дозировки, оплата криптой. Закажи сейчас и выйди на пик.",
    discover: "СМОТРЕТЬ",
    benTitle: "Почему EgoLab",
    ben: [
      ["shield", "Проверено", "Только оригинал, проверенный сторонними лабораториями."],
      ["truck", "Быстрая доставка", "Аккуратная доставка по миру с трек-номером."],
      ["check", "Анонимная доставка", "Без аккаунта и лишних данных — приватная упаковка и оплата."],
      ["headset", "Поддержка", "Есть вопрос? Отвечаем в течение часов."],
    ],
    revTitle: "Отзывы атлетов",
    allReviews: "Все отзывы",
    shopEyebrow: "Магазин",
    promoEyebrow: "EgoLab · Проверенное топливо",
    promoTitle: "Создано для<br><em>тяжёлых дней.</em>",
    promoDesc: "Оригинальные бренды, честные дозировки и независимые анализы каждой партии. Оплата криптой, доставка по миру — без регистрации.",
    promoStats: [["1.3K+", "Атлетов"], ["4.9★", "Рейтинг"], ["100%", "Проверено"]],
    promoCta1: "В каталог",
    promoCta2: "Анализы",
    rev: [
      ["Предтрен — огонь, энергии на всю тренировку. Доставили быстро.", "Максим К. · пауэрлифтинг"],
      ["Оригинал, честные дозировки. Беру протеин и креатин только тут.", "Елена Р. · кроссфит"],
      ["Оплатил в USDT, заказ отслеживался, пришёл запечатанным. Беру ещё.", "Дмитрий В. · бодибилдинг"],
    ],
  },
};
const L = () => COPY[getLang()] || COPY.en;

/* ---------- TOONHUB-style hero carousel ---------------------------------- */
// Featured rotation — built from products the seller marks "Show on home".
let FEATURED = [];
function buildFeatured(products) {
  let list = products.filter((p) => p.featured);
  if (!list.length) list = products.slice(0, 4); // fallback: newest 4
  FEATURED = list.slice(0, 8).map((p) => ({
    id: p.id, name: p.name, cat: p.category || "",
    img: (p.images && p.images[0]) || "", bg: catColor(p.category),
  }));
  return FEATURED;
}

function toonHeroHTML(l) {
  const items = FEATURED.map((f, i) => `
    <div class="toon__item" data-i="${i}">
      <img src="${esc(f.img)}" alt="${esc(f.name)}" draggable="false">
    </div>`).join("");
  return `
  <section class="toon" id="toon" style="background-color:${FEATURED[0].bg}">
    <div class="toon__stage">
      <div class="toon__grain"></div>
      <div class="toon__ghost" id="toonGhost">${esc(FEATURED[0].cat.toUpperCase())}</div>
      <div class="toon__carousel" id="toonCar">${items}</div>

      <div class="toon__info">
        <p class="toon__kicker" id="toonKicker">${esc(l.toonKicker)}</p>
        <p class="toon__name" id="toonName">${esc(FEATURED[0].name)}</p>
        <p class="toon__desc">${esc(l.toonDesc)}</p>
        <div class="toon__nav">
          <button class="toon__btn" id="toonPrev" aria-label="Previous">${icon("arrowLeft", 26)}</button>
          <button class="toon__btn" id="toonNext" aria-label="Next">${icon("arrowRight", 26)}</button>
        </div>
      </div>

      <a class="toon__discover" id="toonDiscover" href="product.html?id=${FEATURED[0].id}">
        <span>${esc(l.discover)}</span>${icon("arrowRight", 30)}
      </a>

      <div class="toon__dots" id="toonDots">
        ${FEATURED.map((_, i) => `<button class="toon__dot${i === 0 ? " on" : ""}" data-i="${i}" aria-label="Slide ${i + 1}"></button>`).join("")}
      </div>
    </div>
  </section>`;
}

function initToon() {
  const section = document.getElementById("toon");
  const car = document.getElementById("toonCar");
  if (!section || !car) return;
  const ghost = document.getElementById("toonGhost");
  const nameEl = document.getElementById("toonName");
  const discover = document.getElementById("toonDiscover");
  const dots = [...document.querySelectorAll("#toonDots .toon__dot")];
  const items = [...car.querySelectorAll(".toon__item")];
  const N = items.length;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DUR = 820;

  let activeIndex = 0, isAnimating = false;
  let isMobile = window.innerWidth < 640;

  // preload
  FEATURED.forEach((f) => { const im = new Image(); im.src = f.img; });

  const Z = { center: 20, left: 10, right: 10, back: 5, hidden: 0 };
  function styleFor(role) {
    if (role === "hidden") return {
      transform: "translateX(-50%) scale(.6)", filter: "blur(6px)", opacity: "0", left: "50%",
      height: isMobile ? "13%" : "20%", bottom: isMobile ? "34%" : "16%",
    };
    if (role === "center") return {
      transform: `translateX(-50%) scale(${isMobile ? 1 : 1})`,
      filter: "none", opacity: "1", left: "50%",
      height: isMobile ? "44%" : "66%", bottom: isMobile ? "22%" : "4%",
    };
    if (role === "back") return {
      transform: "translateX(-50%) scale(1)", filter: "blur(4px)", opacity: "0.85", left: "50%",
      height: isMobile ? "13%" : "20%", bottom: isMobile ? "34%" : "16%",
    };
    // left / right
    const isLeft = role === "left";
    return {
      transform: "translateX(-50%) scale(1)", filter: "blur(2px)", opacity: "0.8",
      left: isMobile ? (isLeft ? "20%" : "80%") : (isLeft ? "26%" : "74%"),
      height: isMobile ? "16%" : "26%", bottom: isMobile ? "34%" : "16%",
    };
  }

  function roleOf(i) {
    if (i === activeIndex) return "center";
    if (N >= 2 && i === (activeIndex + 1) % N) return "right";
    if (N >= 3 && i === (activeIndex + N - 1) % N) return "left";
    if (N >= 4 && i === (activeIndex + 2) % N) return "back";
    return "hidden";
  }

  // Scale the giant background word so the WHOLE name fits the viewport on any
  // device — long names like "CAFFEINE POUCHES" were overflowing and getting
  // cut. The ghost is a full-width flex box, so its own scrollWidth equals the
  // viewport (not the text), and a canvas misses faux-bold + letter-spacing.
  // So measure the TRUE rendered width with an off-screen clone that copies the
  // exact font, weight and letter-spacing, then scale from that ratio.
  const BASE = 200;
  function measurer() {
    if (fitGhost._m) return fitGhost._m;
    const s = document.createElement("span");
    s.style.cssText =
      "position:absolute;left:-99999px;top:0;visibility:hidden;white-space:nowrap;" +
      "font-family:'Anton','Oswald','Arial Narrow',sans-serif;font-weight:900;" +
      "letter-spacing:-0.02em;text-transform:uppercase;font-size:" + BASE + "px;";
    document.body.appendChild(s);
    return (fitGhost._m = s);
  }
  function fitGhost() {
    if (!ghost) return;
    const vw = section.getBoundingClientRect().width || window.innerWidth || document.documentElement.clientWidth;
    const text = ghost.textContent || "";
    if (!vw || !text) return;
    const m = measurer();
    m.textContent = text;
    const w = m.getBoundingClientRect().width;
    if (!w) return;
    let size = BASE * (vw * 0.92 / w);        // fit to 92% of the width
    size = Math.max(22, Math.min(size, 460)); // never cut; just cap very short words
    ghost.style.whiteSpace = "nowrap";
    ghost.style.fontSize = size + "px";
  }

  function render() {
    items.forEach((el, i) => {
      const role = roleOf(i);
      Object.assign(el.style, styleFor(role));
      el.style.zIndex = String(Z[role] ?? 0);
      el.style.pointerEvents = role === "hidden" ? "none" : "auto";
    });
    const f = FEATURED[activeIndex];
    section.style.backgroundColor = items[activeIndex]?.dataset.bg || f.bg;
    if (ghost) { ghost.textContent = f.cat.toUpperCase(); fitGhost(); }
    if (nameEl) nameEl.textContent = f.name;
    if (discover) discover.href = `product.html?id=${f.id}`;
    dots.forEach((d, i) => d.classList.toggle("on", i === activeIndex));
  }

  function goTo(i) {
    if (isAnimating || i === activeIndex) return;
    isAnimating = true;
    activeIndex = ((i % N) + N) % N;
    render();
    setTimeout(() => { isAnimating = false; }, reduce ? 0 : DUR);
  }
  function navigate(dir) {
    goTo(dir === "next" ? activeIndex + 1 : activeIndex - 1);
  }

  document.getElementById("toonPrev")?.addEventListener("click", () => navigate("prev"));
  document.getElementById("toonNext")?.addEventListener("click", () => navigate("next"));
  dots.forEach((d) => d.addEventListener("click", () => goTo(+d.dataset.i)));
  // click a side figurine to bring it forward
  items.forEach((el, i) => el.addEventListener("click", () => {
    const role = roleOf(i);
    if (role === "left") navigate("prev");
    else if (role === "right") navigate("next");
  }));

  // swipe the stage (touch + mouse) — TikTok-style direct manipulation
  let downX = null;
  const stage = section.querySelector(".toon__stage");
  stage.addEventListener("pointerdown", (e) => { downX = e.clientX; });
  stage.addEventListener("pointerup", (e) => {
    if (downX === null) return;
    const dx = e.clientX - downX; downX = null;
    if (Math.abs(dx) > 45) navigate(dx < 0 ? "next" : "prev");
  });
  stage.addEventListener("pointercancel", () => { downX = null; });

  window.addEventListener("resize", () => {
    const m = window.innerWidth < 640;
    if (m !== isMobile) { isMobile = m; render(); }
    else fitGhost();
  });
  // re-fit once the display font has actually loaded (measuring with the
  // fallback font gives the wrong width)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitGhost);

  // pointer parallax — the jars drift gently toward the cursor for depth
  if (!reduce) {
    car.style.transition = "transform .45s var(--ease-out)";
    stage.addEventListener("pointermove", (e) => {
      const r = stage.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      car.style.transform = `translate(${nx * 16}px, ${ny * 11}px)`;
    });
    stage.addEventListener("pointerleave", () => { car.style.transform = "translate(0,0)"; });
  }

  // autoplay — advances on its own, pauses on hover / touch / hidden tab
  const DELAY = 5000;
  let timer = null;
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  const play = () => { if (reduce) return; stop(); timer = setInterval(() => navigate("next"), DELAY); };
  section.addEventListener("pointerenter", stop);
  section.addEventListener("pointerleave", play);
  section.addEventListener("pointerdown", stop);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : play()));
  // manual controls reset the countdown
  ["toonPrev", "toonNext"].forEach((id) => document.getElementById(id)?.addEventListener("click", play));
  dots.forEach((d) => d.addEventListener("click", play));

  render();
  // carousel: paint the section with the photo's own background colour AND knock
  // that flat background out of the image, so the giant word shows through the
  // transparent area instead of being covered by a rectangle.
  items.forEach((el, i) => {
    const im = el.querySelector("img");
    if (!im) return;
    sampleCornerColor(im, (col) => { el.dataset.bg = col; if (i === activeIndex) section.style.backgroundColor = col; });
    cutoutImage(im);
  });
  play();
}

function stockBadge(p) {
  if (p.stock <= 0) return `<span class="badge badge--out">${t("sold_out")}</span>`;
  if (p.stock <= 5) return `<span class="badge badge--low">${t("only_left", { n: p.stock })}</span>`;
  return "";
}

function card(p) {
  const img = p.images?.[0]
    ? `<img src="${esc(p.images[0])}" alt="${esc(p.name)}" loading="lazy">`
    : placeholder();
  const out = p.stock <= 0;
  return `
  <article class="card reveal" data-id="${p.id}" style="--cat:${catColor(p.category)}">
    <a class="card__media" href="product.html?id=${p.id}" aria-label="${esc(p.name)}">
      ${img}
      ${stockBadge(p) ? `<span style="position:absolute;top:12px;left:12px">${stockBadge(p)}</span>` : ""}
      <div class="card__quick">
        <button class="btn btn--primary btn--block btn--sm add-btn" data-id="${p.id}" ${out ? "disabled" : ""}>
          ${icon("cart", 16)} ${out ? t("sold_out") : t("add_to_cart")}
        </button>
      </div>
    </a>
    <div class="card__body">
      <span class="card__cat">${esc(p.category)}</span>
      <a class="card__title" href="product.html?id=${p.id}">${esc(p.name)}</a>
      <div class="card__foot">
        <span class="price price--sm">${money(p.price)}</span>
        <a class="navlink" href="product.html?id=${p.id}" aria-label="${t("add_to_cart")}">${icon("arrowRight", 18)}</a>
      </div>
    </div>
  </article>`;
}

// A clickable category tile for the landing view (reuses the product card look).
function categoryCard(cat) {
  const items = ALL.filter((p) => p.category === cat);
  const cover = items.find((p) => p.images?.[0])?.images?.[0];
  const media = cover ? `<img src="${esc(cover)}" alt="${esc(cat)}" loading="lazy">` : placeholder();
  return `
  <a class="card cat-card reveal" href="#catalog" data-gocat="${esc(cat)}" style="--cat:${catColor(cat)}">
    <div class="card__media">${media}</div>
    <div class="card__body">
      <span class="card__title">${esc(cat)}</span>
      <div class="card__foot"><span class="price price--sm">${t("items_label", { n: items.length })}</span><span class="cat-card__go">${icon("arrowRight", 18)}</span></div>
    </div>
  </a>`;
}

// paint each media block with its photo's own background colour (no seam)
function tintMedia(grid) {
  grid.querySelectorAll(".card__media").forEach((media) => {
    const im = media.querySelector("img");
    if (im) sampleCornerColor(im, (col) => { media.style.background = col; im.style.filter = "none"; });
  });
}

function apply() {
  const grid = document.getElementById("grid");
  const count = document.getElementById("count");
  const back = document.getElementById("catBack");

  // LANDING: no category chosen and no search → show the category tiles first.
  if (state.cat === "all" && !state.q.trim()) {
    if (back) back.innerHTML = "";
    count.textContent = CATS.length ? t("cats_count", { n: CATS.length }) : "";
    if (!CATS.length) {
      grid.className = "";
      grid.innerHTML = `<div class="empty">${icon("box", 44)}<h3>${t("nothing_found")}</h3></div>`;
      return;
    }
    grid.className = "grid-products";
    grid.innerHTML = CATS.map(categoryCard).join("");
    tintMedia(grid);
    revealOnScroll();
    return;
  }

  // PRODUCTS: a category (or search) is active → show the matching products.
  let list = ALL.slice();
  if (state.cat !== "all") list = list.filter((p) => p.category === state.cat);
  if (state.q.trim()) {
    const q = state.q.toLowerCase();
    list = list.filter((p) => (p.name + " " + p.description + " " + p.category).toLowerCase().includes(q));
  }
  if (state.sort === "price-asc") list.sort((a, b) => a.price - b.price);
  else if (state.sort === "price-desc") list.sort((a, b) => b.price - a.price);
  else list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (back) back.innerHTML = state.cat !== "all"
    ? `<button type="button" class="cat-back__btn" id="catBackBtn">${icon("arrowLeft", 16)} ${t("all_categories")}</button><span class="cat-back__now">${esc(state.cat)}</span>`
    : "";

  count.textContent = t("items_label", { n: list.length });
  if (!list.length) {
    grid.className = "";
    grid.innerHTML = `<div class="empty">${icon("search", 44)}<h3>${t("nothing_found")}</h3><p>${t("nothing_found_desc")}</p></div>`;
    return;
  }
  grid.className = "grid-products";
  grid.innerHTML = list.map(card).join("");
  tintMedia(grid);
  revealOnScroll();
}

async function init() {
  mountChrome("index.html");
  document.body.classList.add("home");

  const l = L();
  const app = document.getElementById("app");

  // load the shared catalog first — it drives both the hero carousel and the grid
  try {
    ALL = await getPublishedProducts();
  } catch (err) {
    app.innerHTML = `<div class="empty" style="padding-top:120px">${icon("box", 44)}<h3>${t("nothing_found")}</h3><p style="max-width:38ch;margin-inline:auto">${esc(err.message || String(err))}</p><button class="btn btn--primary" id="reloadBtn" style="margin-top:16px">${icon("arrowRight", 16)} ${t("start_shopping")}</button></div>`;
    document.getElementById("reloadBtn")?.addEventListener("click", () => location.reload());
    return;
  }
  buildFeatured(ALL);

  // category order comes from admin-managed settings (falls back to config)
  let siteSettings = {};
  try { siteSettings = await getPublishedSettings(); } catch {}
  const managed = (siteSettings.categories && siteSettings.categories.length) ? siteSettings.categories : SITE.categories;
  const present = new Set(ALL.map((p) => p.category).filter(Boolean));
  const cats = ["all", ...managed.filter((c) => present.has(c)), ...[...present].filter((c) => !managed.includes(c))];
  CATS = cats.filter((c) => c !== "all"); // category tiles shown on the landing

  // real reviews (fixed text — do NOT change with the site language)
  let reviewsList = [];
  try { reviewsList = await getPublishedReviews(); } catch {}
  const homeRevs = reviewsList.length
    ? reviewsList.slice(0, 3).map((r) => ({ text: r.text, who: `${r.name}${r.role ? " · " + r.role : ""}`, rating: r.rating || 5 }))
    : l.rev.map(([txt, name]) => ({ text: txt, who: name, rating: 5 }));
  const homeReviewsHTML = homeRevs.map((r) => `<div class="review"><div class="review__stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</div><p class="review__text">${esc(r.text)}</p><div class="review__name">${esc(r.who)}</div></div>`).join("");

  app.innerHTML = `
    ${toonHeroHTML(l)}

    <section class="section section--tight">
      <div class="bennies reveal">
        ${l.ben.map(([ic, ttl, desc]) => `<div class="benny"><span class="benny__ic">${icon(ic, 20)}</span><div><h3>${ttl}</h3><p>${desc}</p></div></div>`).join("")}
      </div>
    </section>

    <section id="catalog" class="section">
      <div class="catalog-head">
        <div><span class="eyebrow">${esc(SITE.name)} · ${l.shopEyebrow}</span><h2>${t("nav_catalog")}</h2></div>
        <span class="catalog-count" id="count"></span>
      </div>
      <div class="toolbar">
        <div class="field search">${icon("search", 18)}<input class="input" id="q" type="search" placeholder="${t("search_ph")}" aria-label="${t("search_ph")}"></div>
        <select class="select" id="sort" aria-label="${t("sort_new")}">
          <option value="new">${t("sort_new")}</option>
          <option value="price-asc">${t("sort_price_asc")}</option>
          <option value="price-desc">${t("sort_price_desc")}</option>
        </select>
      </div>
      <div class="chips" id="cats" role="group" aria-label="${t("cat_all")}">
        ${cats.map((c) => c === "all"
          ? `<button type="button" class="chip is-active" data-cat="all" aria-pressed="true">${t("cat_all")}</button>`
          : `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="false" style="--cat:${catColor(c)}"><i></i>${esc(c)}</button>`).join("")}
      </div>
      <div id="catBack" class="cat-back"></div>
      <div id="grid" class="grid-products"></div>
    </section>

    <section class="section">
      <div class="promo reveal">
        <img class="promo__img" src="assets/img/bg/barbell.jpg" alt="" aria-hidden="true" loading="lazy" data-parallax="0.1">
        <div class="promo__scrim"></div>
        <div class="promo__body">
          <span class="promo__eyebrow">${l.promoEyebrow}</span>
          <h2 class="promo__title">${l.promoTitle}</h2>
          <p class="promo__desc">${l.promoDesc}</p>
          <div class="promo__stats">${l.promoStats.map(([n, s]) => `<div class="promo__stat"><b>${n}</b><span>${s}</span></div>`).join("")}</div>
          <div class="promo__actions">
            <a class="btn btn--light btn--lg" href="#catalog">${icon("bag", 18)} ${l.promoCta1}</a>
            <a class="btn btn--outline-light btn--lg" href="certificates.html">${icon("shield", 18)} ${l.promoCta2}</a>
          </div>
        </div>
      </div>
    </section>

    <section class="section reveal" style="padding-top:0">
      <div class="section-head"><h2>${l.revTitle}</h2><span class="rule"></span><a class="section-head__link" href="reviews.html">${l.allReviews} ${icon("arrowRight", 14)}</a></div>
      <div class="reviews">${homeReviewsHTML}</div>
    </section>`;

  initToon();

  // header turns solid once the coloured hero scrolls away
  const onScroll = () => document.body.classList.toggle("scrolled", window.scrollY > window.innerHeight * 0.72);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // central place to switch category: keep chips in sync, re-render, scroll up
  function selectCat(cat, scroll) {
    state.cat = cat;
    document.querySelectorAll("#cats .chip").forEach((c) => {
      const on = c.dataset.cat === cat;
      c.classList.toggle("is-active", on);
      c.setAttribute("aria-pressed", String(on));
    });
    apply();
    if (scroll) document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.getElementById("q").addEventListener("input", (e) => { state.q = e.target.value; apply(); });
  document.getElementById("cats").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    selectCat(chip.dataset.cat);
  });
  // click a category tile on the landing → open that category
  document.getElementById("grid").addEventListener("click", (e) => {
    const tile = e.target.closest("[data-gocat]");
    if (!tile) return;
    e.preventDefault();
    selectCat(tile.dataset.gocat, true);
  });
  // "← All categories" back button returns to the category landing
  document.getElementById("catBack").addEventListener("click", (e) => {
    if (e.target.closest("#catBackBtn")) selectCat("all", true);
  });
  // drag-to-scroll the category chips (mouse) + vertical wheel → horizontal
  (function enableChipDrag() {
    const el = document.getElementById("cats");
    if (!el) return;
    let down = false, moved = false, startX = 0, startLeft = 0;
    el.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch") return; down = true; moved = false; startX = e.clientX; startLeft = el.scrollLeft; });
    el.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 4) { moved = true; el.classList.add("dragging"); } // only a real drag disables chip clicks
      if (moved) el.scrollLeft = startLeft - dx;
    });
    const up = () => { down = false; el.classList.remove("dragging"); };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointerleave", up);
    el.addEventListener("click", (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    el.addEventListener("wheel", (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { el.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  })();

  document.getElementById("sort").addEventListener("change", (e) => { state.sort = e.target.value; apply(); });

  document.getElementById("grid").addEventListener("click", (e) => {
    const btn = e.target.closest(".add-btn");
    if (!btn) return;
    e.preventDefault();
    const p = ALL.find((x) => x.id === btn.dataset.id);
    if (!p || p.stock <= 0) return;
    const src = btn.closest(".card")?.querySelector(".card__media img");
    if (src && p.images?.[0]) flyToCart(src, p.images[0]);
    Cart.add({ id: p.id, name: p.name, price: p.price, image: p.images?.[0] || "", stock: p.stock });
    toast(t("added_toast", { name: p.name }));
  });

  apply();
  revealOnScroll();
}

init();
