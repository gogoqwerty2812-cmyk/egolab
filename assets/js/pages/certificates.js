import { SITE } from "../config.js?v=12";
import { getPublishedCerts } from "../db.js?v=12";
import { icon, esc, initTheme, mountChrome, revealOnScroll, pageHero } from "../ui.js?v=12";
import { t, getLang } from "../i18n.js?v=12";

initTheme();

const COPY = {
  en: {
    eyebrow: "Lab reports", title: "Lab-tested. Verified.",
    subtitle: "Every batch comes with third-party certificates of analysis and purity reports. Tap any document to view it full-size.",
    empty: "No certificates published yet.",
  },
  ru: {
    eyebrow: "Анализы", title: "Проверено в лаборатории.",
    subtitle: "Каждая партия сопровождается независимыми сертификатами анализа и отчётами о чистоте. Нажми на документ, чтобы открыть его целиком.",
    empty: "Сертификаты пока не добавлены.",
  },
};
const c = () => COPY[getLang()] || COPY.en;

function card(cert) {
  const img = cert.image
    ? `<img src="${esc(cert.image)}" alt="${esc(cert.title)}" loading="lazy">`
    : `<div class="img-ph">${icon("shield", 34)}</div>`;
  return `
    <button class="cert reveal" data-img="${esc(cert.image || "")}" data-title="${esc(cert.title)}">
      <span class="cert__img">${img}<span class="cert__pass">${icon("check", 11)} passed</span></span>
      <span class="cert__body">
        <span class="cert__title">${esc(cert.title)}</span>
        <span class="cert__meta">${esc([cert.issuer, cert.date].filter(Boolean).join(" · "))}</span>
      </span>
    </button>`;
}

function openLightbox(src, title) {
  const box = document.createElement("div");
  box.className = "lightbox";
  box.innerHTML = `<button class="icon-btn lightbox__close" aria-label="Close">${icon("close", 18)}</button><img src="${esc(src)}" alt="${esc(title)}">`;
  const close = () => box.remove();
  box.addEventListener("click", (e) => { if (e.target === box || e.target.closest(".lightbox__close")) close(); });
  document.addEventListener("keydown", function esc2(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc2); } });
  document.body.appendChild(box);
}

async function init() {
  mountChrome("certificates.html");
  const app = document.getElementById("app");
  const x = c();
  let certs = [];
  try { certs = await getPublishedCerts(); } catch {}

  app.innerHTML = `
    ${pageHero({ eyebrow: `${esc(SITE.name)} · ${esc(x.eyebrow)}`, title: esc(x.title), subtitle: esc(x.subtitle), color: "#86A0A6" })}

    <section class="section" style="padding-top:0">
      ${certs.length
        ? `<div class="cert-grid">${certs.map(card).join("")}</div>`
        : `<div class="empty">${icon("shield", 44)}<h3>${esc(x.empty)}</h3></div>`}
    </section>`;

  app.querySelectorAll(".cert").forEach((el) =>
    el.addEventListener("click", () => {
      const src = el.dataset.img;
      if (src) openLightbox(src, el.dataset.title);
    }));
  revealOnScroll();
}

init();
