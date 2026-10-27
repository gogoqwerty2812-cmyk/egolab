import { SITE } from "../config.js?v=11";
import { createTicket } from "../db.js?v=11";
import { icon, esc, safeUrl, initTheme, mountChrome, toast, pageHero } from "../ui.js?v=11";
import { t } from "../i18n.js?v=11";
import { sendTicketNotification } from "../notify.js?v=11";

initTheme();

function channelCard(c) {
  return `
    <a class="channel" href="${esc(safeUrl(c.href))}" target="_blank" rel="noopener noreferrer">
      <span class="channel__ic">${icon(c.icon, 18)}</span>
      <span class="channel__body">
        <span class="channel__name">${esc(c.name)}</span>
        <span class="channel__val">${esc(c.value)}</span>
      </span>
      ${icon("arrowRight", 16)}
    </a>`;
}

function setError(name, msg) {
  const field = document.querySelector(`[data-field="${name}"]`);
  if (!field) return;
  field.classList.toggle("field--invalid", !!msg);
  const err = field.querySelector(".error-text");
  if (err) err.textContent = msg;
}

function init() {
  mountChrome("support.html");
  const app = document.getElementById("app");

  app.innerHTML = `
    ${pageHero({ eyebrow: `${SITE.name} · ${t("nav_support")}`, title: t("support_title"), subtitle: t("support_desc"), color: "#7E9B88" })}

    <div class="checkout-layout">
      <section class="panel">
        <div class="panel__title">${icon("chat", 18)} ${t("sup_form_title")}</div>
        <form id="supportForm" class="form-grid" novalidate>
          <div class="form-row">
            <div class="field" data-field="name">
              <label class="label" for="s_name">${t("sup_name")} <span class="req">*</span></label>
              <input class="input" id="s_name" name="name" autocomplete="name">
              <div class="error-text"></div>
            </div>
            <div class="field" data-field="email">
              <label class="label" for="s_email">${t("sup_email")} <span class="req">*</span></label>
              <input class="input" id="s_email" name="email" type="email" placeholder="you@email.com">
              <div class="error-text"></div>
            </div>
          </div>
          <div class="field" data-field="subject">
            <label class="label" for="s_subject">${t("sup_subject")}</label>
            <input class="input" id="s_subject" name="subject" placeholder="Order #, product, payment…">
          </div>
          <div class="field" data-field="message">
            <label class="label" for="s_message">${t("sup_message")} <span class="req">*</span></label>
            <textarea class="textarea" id="s_message" name="message" style="min-height:150px"></textarea>
            <div class="error-text"></div>
          </div>
          <button class="btn btn--primary btn--lg" type="submit">${icon("send", 18)} ${t("sup_send")}</button>
        </form>
      </section>

      <aside class="summary" style="position:static">
        <div class="panel__title">${icon("headset", 18)} ${t("sup_channels_title")}</div>
        <p class="hint" style="margin-top:-6px;margin-bottom:14px">${t("sup_channels_desc")}</p>
        <div class="stack" style="--space-4:10px">
          ${SITE.supportChannels.map(channelCard).join("")}
        </div>
        <div class="badge badge--accent" style="margin-top:16px">${icon("clock", 13)} ${t("sup_response")}</div>
      </aside>
    </div>`;

  const form = document.getElementById("supportForm");
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    let ok = true;
    if (!f.name.value.trim()) { setError("name", t("required_word")); ok = false; } else setError("name", "");
    if (!emailRe.test(f.email.value.trim())) { setError("email", t("required_word")); ok = false; } else setError("email", "");
    if (!f.message.value.trim()) { setError("message", t("required_word")); ok = false; } else setError("message", "");
    if (!ok) { toast(t("err_fix"), "err"); return; }

    const ticket = {
      name: f.name.value.trim(),
      email: f.email.value.trim(),
      subject: f.subject.value.trim(),
      message: f.message.value.trim(),
      lang: document.documentElement.lang,
    };
    await createTicket(ticket);
    try { await sendTicketNotification(ticket); } catch {}

    const panel = form.closest(".panel");
    panel.innerHTML = `
      <div class="empty" style="padding-block:var(--space-7)">
        <div class="confirm-check" style="margin-bottom:16px">${icon("check", 34)}</div>
        <h3>${t("sup_success")}</h3>
      </div>`;
  });
}

init();
