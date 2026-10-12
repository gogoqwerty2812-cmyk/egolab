import { SITE, ORDER_STATUSES } from "../config.js?v=7";
import { getProducts, saveProduct, deleteProduct, getOrders, updateOrderStatus, deleteOrder, getTickets, deleteTicket, ensureAdminSeed, exportProductsJSON, importProductsFromJSON, getCerts, saveCert, deleteCert, ensureCertAdminSeed, exportCertsJSON, importCertsFromJSON, getReviews, saveReview, deleteReview, ensureReviewAdminSeed, exportReviewsJSON, importReviewsFromJSON, getSettings, saveSettings, ensureSettingsAdminSeed, exportSettingsJSON, exportAllJSON, importAllFromJSON } from "../db.js?v=7";
import { icon, money, esc, placeholder, initTheme, mountChrome, toast } from "../ui.js?v=7";

initTheme();

const SESSION_KEY = "mkt_admin_ok";

// The password is never stored in the repo — only its SHA-256 hash is in
// config.js. Hash the typed password the same way and compare the hashes.
async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

let tab = "products";
let editingImages = []; // data URLs for the product form
let knownCats = [];     // categories offered in the product form
let knownSubs = [];     // subcategories offered in the product form
let adminSettings = null; // cached site settings (incl. categories/subcategories)

async function loadSettings(force) {
  if (!adminSettings || force) adminSettings = (await ensureSettingsAdminSeed().catch(() => null)) || {};
  return adminSettings;
}

function refreshTaxonomy(products) {
  const base = (adminSettings && adminSettings.categories && adminSettings.categories.length)
    ? adminSettings.categories : (SITE.categories || []);
  const cats = new Set(base);
  const subs = new Set((adminSettings && adminSettings.subcategories) || []);
  (products || []).forEach((p) => { if (p.category) cats.add(p.category); if (p.subcategory) subs.add(p.subcategory); });
  knownCats = [...cats];
  knownSubs = [...subs];
}

// ---- image downscale to keep IndexedDB light -------------------------------
function fileToResizedDataURL(file, max = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width: w, height: h } = img;
        if (w > max || h > max) {
          const r = Math.min(max / w, max / h);
          w = Math.round(w * r); h = Math.round(h * r);
        }
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        const type = file.type === "image/png" && /alpha/.test("") ? "image/png" : "image/jpeg";
        resolve(c.toDataURL(type, quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
//  LOGIN GATE
// ---------------------------------------------------------------------------
function renderLogin() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div style="max-width:400px;margin:8vh auto 0" class="reveal in">
      <div class="panel">
        <div style="text-align:center;margin-bottom:var(--space-5)">
          <div class="confirm-check" style="margin-bottom:12px">${icon("lock", 30)}</div>
          <h1 style="font-size:1.8rem">Seller dashboard</h1>
          <p class="muted" style="font-size:.9rem">Enter the admin password to manage products and orders.</p>
        </div>
        <form id="loginForm" class="form-grid">
          <div class="field" data-field="pw">
            <label class="label" for="pw">Password</label>
            <input class="input" id="pw" type="password" placeholder="••••••••" autofocus>
            <div class="error-text"></div>
          </div>
          <button class="btn btn--primary btn--block btn--lg" type="submit">${icon("shield", 18)} Enter dashboard</button>
          <p class="hint" style="text-align:center">Dev tool — default password is set in <code>assets/js/config.js</code>.</p>
        </form>
      </div>
    </div>`;
  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = document.getElementById("pw").value;
    let ok = false;
    try { ok = (await sha256Hex(pw)) === SITE.adminPasswordHash; } catch { ok = false; }
    if (ok) {
      sessionStorage.setItem(SESSION_KEY, "1");
      renderDashboard();
    } else {
      document.querySelector('[data-field="pw"]').classList.add("field--invalid");
      document.querySelector('[data-field="pw"] .error-text').textContent = "Incorrect password.";
      toast("Incorrect password", "err");
    }
  });
}

// ---------------------------------------------------------------------------
//  DASHBOARD SHELL
// ---------------------------------------------------------------------------
function renderDashboard() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:var(--space-5)">
      <div>
        <span class="eyebrow">${esc(SITE.name)}</span>
        <h1 style="font-size:2.2rem">Seller dashboard</h1>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;max-width:100%">
        <div class="tabs" id="tabs">
          <button class="tab is-active" data-tab="products">Products</button>
          <button class="tab" data-tab="orders">Orders</button>
          <button class="tab" data-tab="reviews">Reviews</button>
          <button class="tab" data-tab="certs">Certificates</button>
          <button class="tab" data-tab="support">Support</button>
          <button class="tab" data-tab="settings">Settings</button>
        </div>
        <button class="btn btn--primary btn--sm" id="exportAll">${icon("box", 15)} Export all</button>
        <button class="btn btn--ghost btn--sm" id="importAll">${icon("upload", 15)} Import all</button>
        <input type="file" id="importAllFile" accept="application/json,.json" hidden>
        <button class="btn btn--ghost btn--sm" id="logout">Log out</button>
      </div>
    </div>
    <div class="alert alert--info" style="margin-bottom:var(--space-4);font-size:.82rem">${icon("shield", 14)} <span><b>One file for everything:</b> edit anything, then click <b>Export all</b> → replace <code>data/content.json</code> in your repo → commit &amp; push. (Per-tab exports below still work if you prefer separate files.)</span></div>
    <div id="panel"></div>`;

  document.getElementById("tabs").addEventListener("click", (e) => {
    const b = e.target.closest(".tab");
    if (!b) return;
    tab = b.dataset.tab;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-active", t === b));
    if (tab === "products") renderProducts();
    else if (tab === "orders") renderOrders();
    else if (tab === "reviews") renderReviews();
    else if (tab === "certs") renderCerts();
    else if (tab === "settings") renderSettings();
    else renderTickets();
  });
  document.getElementById("logout").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    renderLogin();
  });

  document.getElementById("exportAll").addEventListener("click", async () => {
    try {
      // make sure every store is seeded so nothing exports empty
      await ensureAdminSeed(); await ensureCertAdminSeed(); await ensureReviewAdminSeed(); await ensureSettingsAdminSeed();
      const blob = new Blob([await exportAllJSON()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "content.json"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("content.json downloaded — replace data/content.json to publish everything");
    } catch (err) { toast("Export failed: " + err.message, "err"); }
  });
  document.getElementById("importAll").addEventListener("click", () => document.getElementById("importAllFile").click());
  document.getElementById("importAllFile").addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      await importAllFromJSON(await file.text());
      toast("Everything imported");
      if (tab === "products") renderProducts();
      else if (tab === "orders") renderOrders();
      else if (tab === "reviews") renderReviews();
      else if (tab === "certs") renderCerts();
      else if (tab === "settings") renderSettings();
      else renderTickets();
    } catch (err) { toast("Import failed: " + err.message, "err"); }
  });

  renderProducts();
}

// ---------------------------------------------------------------------------
//  PRODUCTS TAB
// ---------------------------------------------------------------------------
function dbErrorHTML(err) {
  return `<div class="empty">${icon("box", 44)}<h3>Couldn’t load data</h3><p style="max-width:40ch;margin-inline:auto">${esc(err.message || String(err))}</p><button class="btn btn--primary js-reload" style="margin-top:16px">Reload</button></div>`;
}
// Delegated handler (no inline onclick, so a strict CSP can forbid inline JS).
document.addEventListener("click", (e) => { if (e.target.closest(".js-reload")) location.reload(); });

async function renderProducts() {
  const panel = document.getElementById("panel");
  let products;
  try {
    await ensureAdminSeed();
    await loadSettings();
    products = await getProducts();
  } catch (err) {
    panel.innerHTML = dbErrorHTML(err);
    return;
  }
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:var(--space-3)">
      <p class="muted">${products.length} product${products.length === 1 ? "" : "s"}</p>
      <div class="row-actions" style="flex-wrap:wrap">
        <button class="btn btn--ghost btn--sm" id="importBtn">${icon("upload", 15)} Import</button>
        <button class="btn btn--ghost btn--sm" id="exportBtn">${icon("box", 15)} Export products.json</button>
        <button class="btn btn--primary btn--sm" id="newBtn">${icon("plus", 16)} Add product</button>
        <input type="file" id="importFile" accept="application/json,.json" hidden>
      </div>
    </div>
    <div class="alert alert--info" style="margin-bottom:var(--space-4);font-size:.82rem">${icon("shield", 14)} <span>Recommended: use <b>Export all</b> (top) → <code>data/content.json</code> — one file for the whole site. The button below exports only products.</span></div>
    ${products.length ? `
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th></th><th>Name</th><th>Category</th><th>Home</th><th>Price</th><th>Stock</th><th></th></tr></thead>
        <tbody>
          ${products.map((p) => `
            <tr>
              <td>${p.images?.[0] ? `<img class="thumb-xs" src="${esc(p.images[0])}" alt="">` : `<div class="thumb-xs"></div>`}</td>
              <td style="font-weight:600">${esc(p.name)}${p.subcategory ? `<br><small class="muted" style="font-weight:400">${esc(p.subcategory)}</small>` : ""}</td>
              <td><span class="badge">${esc(p.category)}</span></td>
              <td>${p.featured ? `<span class="badge badge--accent" title="On the home carousel">${icon("bolt", 12)} On</span>` : `<span class="muted">—</span>`}</td>
              <td>${money(p.price)}</td>
              <td>${p.stock <= 0 ? '<span class="badge badge--out">0</span>' : p.stock <= 5 ? `<span class="badge badge--low">${p.stock}</span>` : p.stock}</td>
              <td><div class="row-actions">
                <button class="icon-btn edit" data-id="${p.id}" style="width:34px;height:34px" aria-label="Edit">${icon("edit", 15)}</button>
                <button class="icon-btn del" data-id="${p.id}" style="width:34px;height:34px" aria-label="Delete">${icon("trash", 15)}</button>
              </div></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>` : `<div class="empty">${icon("box", 44)}<h3>No products yet</h3><p>Add your first product to get started.</p></div>`}`;

  document.getElementById("newBtn").addEventListener("click", () => openProductModal(null));
  document.getElementById("exportBtn").addEventListener("click", async () => {
    const list = await getProducts();
    const blob = new Blob([exportProductsJSON(list)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "products.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("products.json downloaded — commit it to publish");
  });
  document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
  document.getElementById("importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { await importProductsFromJSON(await file.text()); toast("Products imported"); renderProducts(); }
    catch (err) { toast("Import failed: " + err.message, "err"); }
  });
  refreshTaxonomy(products);
  panel.querySelectorAll(".edit").forEach((b) => b.addEventListener("click", async () => {
    const p = products.find((x) => x.id === b.dataset.id);
    openProductModal(p);
  }));
  panel.querySelectorAll(".del").forEach((b) => b.addEventListener("click", async () => {
    const p = products.find((x) => x.id === b.dataset.id);
    if (confirm(`Delete “${p.name}”? This cannot be undone.`)) {
      await deleteProduct(b.dataset.id);
      toast("Product deleted");
      renderProducts();
    }
  }));
}

// ---- product modal (create / edit) -----------------------------------------
function openProductModal(product) {
  editingImages = product ? [...(product.images || [])] : [];
  const isEdit = !!product;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__head">
        <h2 style="font-family:var(--font-body);font-size:1.2rem;font-weight:600">${isEdit ? "Edit product" : "Add product"}</h2>
        <button class="icon-btn" id="mClose" aria-label="Close">${icon("close", 18)}</button>
      </div>
      <div class="modal__body">
        <form id="prodForm" class="form-grid">
          <div class="field" data-field="name">
            <label class="label">Name <span class="req">*</span></label>
            <input class="input" name="name" value="${esc(product?.name || "")}" placeholder="Product name">
            <div class="error-text"></div>
          </div>
          <div class="field">
            <label class="label">Description</label>
            <textarea class="textarea" name="description" placeholder="Describe the product…">${esc(product?.description || "")}</textarea>
          </div>
          <div class="form-row">
            <div class="field" data-field="price">
              <label class="label">Price (${SITE.currency.code}) <span class="req">*</span></label>
              <input class="input" name="price" type="number" min="0" step="0.01" value="${product?.price ?? ""}" placeholder="0.00">
              <div class="error-text"></div>
            </div>
            <div class="field">
              <label class="label">Stock quantity</label>
              <input class="input" name="stock" type="number" min="0" step="1" value="${product?.stock ?? 0}">
            </div>
          </div>
          <div class="form-row">
            <div class="field">
              <label class="label">Category</label>
              <input class="input" name="category" list="catList" value="${esc(product?.category || "")}" placeholder="e.g. Protein — or type a new one" autocomplete="off">
              <datalist id="catList">${knownCats.map((c) => `<option value="${esc(c)}"></option>`).join("")}</datalist>
              <div class="hint">Pick one or type your own.</div>
            </div>
            <div class="field">
              <label class="label">Subcategory</label>
              <input class="input" name="subcategory" list="subList" value="${esc(product?.subcategory || "")}" placeholder="e.g. Isolate (optional)" autocomplete="off">
              <datalist id="subList">${knownSubs.map((c) => `<option value="${esc(c)}"></option>`).join("")}</datalist>
            </div>
          </div>
          <label class="field" style="display:flex;gap:11px;align-items:flex-start;cursor:pointer;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-input);padding:13px 14px">
            <input type="checkbox" name="featured" ${product?.featured ? "checked" : ""} style="width:18px;height:18px;margin-top:1px;accent-color:var(--accent);flex:0 0 auto">
            <span><span style="font-weight:600;display:block">${icon("bolt", 14)} Show on the home screen</span><span class="hint" style="margin-top:2px">Featured in the big rotating carousel on the homepage.</span></span>
          </label>
          <div class="field">
            <label class="label">Photos</label>
            <div class="uploader" id="uploader">
              ${icon("upload", 26)}
              <div style="margin-top:8px;font-weight:600">Click or drop images here</div>
              <div class="hint">JPG/PNG · first image is the cover · drag thumbnails to reorder</div>
              <input type="file" id="fileInput" accept="image/*" multiple hidden>
            </div>
            <div class="thumbs" id="thumbs"></div>
          </div>
        </form>
      </div>
      <div class="modal__foot">
        <button class="btn btn--ghost" id="mCancel">Cancel</button>
        <button class="btn btn--primary" id="mSave">${icon("check", 16)} ${isEdit ? "Save changes" : "Create product"}</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  document.getElementById("mClose").addEventListener("click", close);
  document.getElementById("mCancel").addEventListener("click", close);

  // ---- image handling ----
  const fileInput = document.getElementById("fileInput");
  const uploader = document.getElementById("uploader");
  uploader.addEventListener("click", () => fileInput.click());
  ["dragover", "dragenter"].forEach((ev) => uploader.addEventListener(ev, (e) => { e.preventDefault(); uploader.classList.add("is-drag"); }));
  ["dragleave", "drop"].forEach((ev) => uploader.addEventListener(ev, (e) => { e.preventDefault(); uploader.classList.remove("is-drag"); }));
  uploader.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));
  fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

  async function handleFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith("image/"));
    for (const f of files) {
      try { editingImages.push(await fileToResizedDataURL(f)); }
      catch { toast("Couldn’t read an image", "err"); }
    }
    renderThumbs();
  }

  function renderThumbs() {
    const wrap = document.getElementById("thumbs");
    wrap.innerHTML = editingImages.map((src, i) => `
      <div class="thumb" draggable="true" data-i="${i}">
        <img src="${esc(src)}" alt="">
        ${i === 0 ? `<span class="thumb__main">COVER</span>` : ""}
        <button type="button" class="thumb__del" data-i="${i}" aria-label="Remove">✕</button>
      </div>`).join("");

    wrap.querySelectorAll(".thumb__del").forEach((b) =>
      b.addEventListener("click", () => { editingImages.splice(+b.dataset.i, 1); renderThumbs(); }));

    // drag to reorder
    let dragI = null;
    wrap.querySelectorAll(".thumb").forEach((t) => {
      t.addEventListener("dragstart", () => { dragI = +t.dataset.i; t.classList.add("dragging"); });
      t.addEventListener("dragend", () => t.classList.remove("dragging"));
      t.addEventListener("dragover", (e) => e.preventDefault());
      t.addEventListener("drop", (e) => {
        e.preventDefault();
        const dropI = +t.dataset.i;
        if (dragI === null || dragI === dropI) return;
        const [moved] = editingImages.splice(dragI, 1);
        editingImages.splice(dropI, 0, moved);
        renderThumbs();
      });
    });
  }
  renderThumbs();

  // ---- save ----
  document.getElementById("mSave").addEventListener("click", async () => {
    const form = document.getElementById("prodForm");
    let ok = true;
    const nameField = form.querySelector('[data-field="name"]');
    const priceField = form.querySelector('[data-field="price"]');
    const setErr = (field, msg) => { field.classList.toggle("field--invalid", !!msg); field.querySelector(".error-text").textContent = msg; };

    if (!form.name.value.trim()) { setErr(nameField, "Name is required."); ok = false; } else setErr(nameField, "");
    if (form.price.value === "" || +form.price.value < 0) { setErr(priceField, "Enter a valid price."); ok = false; } else setErr(priceField, "");
    if (!ok) return;

    await saveProduct({
      id: product?.id,
      createdAt: product?.createdAt,
      name: form.name.value,
      description: form.description.value,
      price: +form.price.value,
      stock: +form.stock.value || 0,
      category: form.category.value.trim() || "Other",
      subcategory: form.subcategory.value,
      featured: form.featured.checked,
      images: editingImages,
    });
    // remember any brand-new category / subcategory so it joins the managed lists
    const nc = form.category.value.trim(), ns = form.subcategory.value.trim();
    const cats = ((adminSettings && adminSettings.categories) || []).slice();
    const subs = ((adminSettings && adminSettings.subcategories) || []).slice();
    let changed = false;
    if (nc && !cats.includes(nc)) { cats.push(nc); changed = true; }
    if (ns && !subs.includes(ns)) { subs.push(ns); changed = true; }
    if (changed) { try { adminSettings = await saveSettings({ categories: cats, subcategories: subs }); } catch {} }
    toast(isEdit ? "Product updated" : "Product created");
    close();
    renderProducts();
  });
}

// ---------------------------------------------------------------------------
//  ORDERS TAB
// ---------------------------------------------------------------------------
function statusClass(s) {
  return {
    "Pending payment": "status--pending", "Payment received": "status--paid",
    Processing: "status--processing", Shipped: "status--shipped",
    Completed: "status--completed", Cancelled: "status--cancelled",
  }[s] || "status--pending";
}

function contactsCell(customer) {
  const list = customer.contacts && Object.keys(customer.contacts).length
    ? customer.contacts
    : (customer.facebook ? { facebook: customer.facebook } : {});
  const rows = SITE.checkoutContacts
    .filter((m) => list[m.id])
    .map((m) => `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span class="muted" style="font-size:.68rem">${esc(m.label)}:</span> ${esc(list[m.id])}</div>`);
  return rows.length ? rows.join("") : '<span class="muted">—</span>';
}

async function renderOrders() {
  const panel = document.getElementById("panel");
  let orders;
  try { orders = await getOrders(); } catch (err) { panel.innerHTML = dbErrorHTML(err); return; }
  panel.innerHTML = `
    <p class="muted" style="margin-bottom:var(--space-4)">${orders.length} order${orders.length === 1 ? "" : "s"}</p>
    ${orders.length ? `
    <div class="table-wrap">
      <table class="data">
        <thead><tr>
          <th>Order</th><th>Items</th><th>Total</th><th>Address</th><th>Country</th>
          <th>Phone</th><th>Contacts</th><th>Coin</th><th>TX hash</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          ${orders.map((o) => `
            <tr>
              <td><b>#${o.id.slice(0, 6).toUpperCase()}</b><br><small class="muted">${esc(new Date(o.createdAt).toLocaleDateString())}</small></td>
              <td style="max-width:200px">${o.items.map((i) => `${esc(i.name)} ×${i.qty}`).join("<br>")}</td>
              <td><b>${money(o.total)}</b></td>
              <td style="max-width:180px;white-space:pre-wrap">${esc([o.customer.address, o.customer.city, o.customer.zip].filter(Boolean).join(", "))}</td>
              <td>${esc(o.customer.countryName || o.customer.country || "")}${o.customer.state ? " / " + esc(o.customer.state) : ""}</td>
              <td>${esc(o.customer.phone)}</td>
              <td style="max-width:170px;font-size:.78rem">${contactsCell(o.customer)}</td>
              <td><span class="badge">${esc(o.payment.coin)}</span></td>
              <td style="max-width:140px;font-family:ui-monospace,monospace;font-size:.76rem;word-break:break-all">${esc(o.payment.txHash)}</td>
              <td>
                <span class="badge ${statusClass(o.status)}" style="margin-bottom:6px"><span class="status-dot"></span>${esc(o.status)}</span>
                <select class="select st-sel" data-id="${o.id}" style="padding:6px 26px 6px 10px;font-size:.8rem">
                  ${ORDER_STATUSES.map((s) => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}
                </select>
              </td>
              <td><button class="icon-btn del-order" data-id="${o.id}" style="width:34px;height:34px" aria-label="Delete">${icon("trash", 15)}</button></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>` : `<div class="empty">${icon("bag", 44)}<h3>No orders yet</h3><p>Orders placed at checkout will appear here.</p></div>`}`;

  panel.querySelectorAll(".st-sel").forEach((sel) =>
    sel.addEventListener("change", async () => {
      await updateOrderStatus(sel.dataset.id, sel.value);
      toast("Order status updated");
      renderOrders();
    }));
  panel.querySelectorAll(".del-order").forEach((b) =>
    b.addEventListener("click", async () => {
      if (confirm("Delete this order?")) { await deleteOrder(b.dataset.id); toast("Order deleted"); renderOrders(); }
    }));
}

// ---------------------------------------------------------------------------
//  SUPPORT TAB (messages submitted from the Support page)
// ---------------------------------------------------------------------------
async function renderTickets() {
  const panel = document.getElementById("panel");
  let tickets;
  try { tickets = await getTickets(); } catch (err) { panel.innerHTML = dbErrorHTML(err); return; }
  panel.innerHTML = `
    <p class="muted" style="margin-bottom:var(--space-4)">${tickets.length} message${tickets.length === 1 ? "" : "s"}</p>
    ${tickets.length ? `
    <div class="stack">
      ${tickets.map((tk) => `
        <div class="panel" style="padding:var(--space-4)">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
            <div style="min-width:0">
              <div style="font-weight:600">${esc(tk.subject || "(no subject)")}</div>
              <div class="muted" style="font-size:.82rem">${esc(tk.name)} · <a href="mailto:${esc(tk.email)}" style="color:var(--accent-ink)">${esc(tk.email)}</a> · ${esc(new Date(tk.createdAt).toLocaleString())}${tk.lang ? ` · ${esc(String(tk.lang).toUpperCase())}` : ""}</div>
            </div>
            <button class="icon-btn del-ticket" data-id="${tk.id}" style="width:34px;height:34px" aria-label="Delete">${icon("trash", 15)}</button>
          </div>
          <p style="margin-top:10px;white-space:pre-wrap">${esc(tk.message)}</p>
        </div>`).join("")}
    </div>` : `<div class="empty">${icon("chat", 44)}<h3>No messages yet</h3><p>Messages from the Support page appear here.</p></div>`}`;

  panel.querySelectorAll(".del-ticket").forEach((b) =>
    b.addEventListener("click", async () => {
      if (confirm("Delete this message?")) { await deleteTicket(b.dataset.id); toast("Message deleted"); renderTickets(); }
    }));
}

// ---------------------------------------------------------------------------
//  CERTIFICATES TAB (lab reports / certificates of analysis)
// ---------------------------------------------------------------------------
async function renderCerts() {
  const panel = document.getElementById("panel");
  let certs;
  try { await ensureCertAdminSeed(); certs = await getCerts(); }
  catch (err) { panel.innerHTML = dbErrorHTML(err); return; }
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:var(--space-3)">
      <p class="muted">${certs.length} certificate${certs.length === 1 ? "" : "s"}</p>
      <div class="row-actions" style="flex-wrap:wrap">
        <button class="btn btn--ghost btn--sm" id="certImportBtn">${icon("upload", 15)} Import</button>
        <button class="btn btn--ghost btn--sm" id="certExportBtn">${icon("box", 15)} Export certificates.json</button>
        <button class="btn btn--primary btn--sm" id="certNewBtn">${icon("plus", 16)} Add certificate</button>
        <input type="file" id="certImportFile" accept="application/json,.json" hidden>
      </div>
    </div>
    <div class="alert alert--info" style="margin-bottom:var(--space-4);font-size:.82rem">${icon("shield", 14)} <span>Recommended: use <b>Export all</b> (top) → <code>data/content.json</code> — one file for the whole site. The button below exports only certificates.</span></div>
    ${certs.length ? `
    <div class="table-wrap"><table class="data">
      <thead><tr><th></th><th>Title</th><th>Issuer / lab</th><th>Date</th><th>Category</th><th></th></tr></thead>
      <tbody>
        ${certs.map((cc) => `<tr>
          <td>${cc.image ? `<img class="thumb-xs" src="${esc(cc.image)}" alt="">` : `<div class="thumb-xs"></div>`}</td>
          <td style="font-weight:600;max-width:280px">${esc(cc.title)}</td>
          <td>${esc(cc.issuer || "—")}</td>
          <td>${esc(cc.date || "—")}</td>
          <td>${cc.category ? `<span class="badge">${esc(cc.category)}</span>` : ""}</td>
          <td><div class="row-actions">
            <button class="icon-btn cert-edit" data-id="${cc.id}" style="width:34px;height:34px" aria-label="Edit">${icon("edit", 15)}</button>
            <button class="icon-btn cert-del" data-id="${cc.id}" style="width:34px;height:34px" aria-label="Delete">${icon("trash", 15)}</button>
          </div></td>
        </tr>`).join("")}
      </tbody></table></div>`
    : `<div class="empty">${icon("shield", 44)}<h3>No certificates yet</h3><p>Add lab reports and certificates of analysis your customers can view.</p></div>`}`;

  document.getElementById("certNewBtn").addEventListener("click", () => openCertModal(null));
  document.getElementById("certExportBtn").addEventListener("click", async () => {
    const list = await getCerts();
    const blob = new Blob([exportCertsJSON(list)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "certificates.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("certificates.json downloaded — commit it to publish");
  });
  document.getElementById("certImportBtn").addEventListener("click", () => document.getElementById("certImportFile").click());
  document.getElementById("certImportFile").addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { await importCertsFromJSON(await file.text()); toast("Certificates imported"); renderCerts(); }
    catch (err) { toast("Import failed: " + err.message, "err"); }
  });
  panel.querySelectorAll(".cert-edit").forEach((b) => b.addEventListener("click", () => openCertModal(certs.find((c) => c.id === b.dataset.id))));
  panel.querySelectorAll(".cert-del").forEach((b) => b.addEventListener("click", async () => {
    if (confirm("Delete this certificate?")) { await deleteCert(b.dataset.id); toast("Certificate deleted"); renderCerts(); }
  }));
}

function openCertModal(cert) {
  const isEdit = !!cert;
  let img = cert?.image || "";
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__head">
        <h2 style="font-family:var(--font-body);font-size:1.2rem;font-weight:600">${isEdit ? "Edit certificate" : "Add certificate"}</h2>
        <button class="icon-btn" id="cmClose" aria-label="Close">${icon("close", 18)}</button>
      </div>
      <div class="modal__body">
        <form id="certForm" class="form-grid">
          <div class="field" data-field="ctitle">
            <label class="label">Title <span class="req">*</span></label>
            <input class="input" name="title" value="${esc(cert?.title || "")}" placeholder="e.g. Whey Isolate — Purity Report">
            <div class="error-text"></div>
          </div>
          <div class="form-row">
            <div class="field"><label class="label">Issuer / lab</label><input class="input" name="issuer" value="${esc(cert?.issuer || "")}" placeholder="e.g. Eurofins"></div>
            <div class="field"><label class="label">Date</label><input class="input" name="date" value="${esc(cert?.date || "")}" placeholder="e.g. Feb 2026"></div>
          </div>
          <div class="field">
            <label class="label">Category</label>
            <select class="select" name="category"><option value="">—</option>${SITE.categories.map((cat) => `<option ${cert?.category === cat ? "selected" : ""}>${esc(cat)}</option>`).join("")}</select>
          </div>
          <div class="field">
            <label class="label">Document image</label>
            <div class="uploader" id="certUploader">${icon("upload", 26)}<div style="margin-top:8px;font-weight:600">Click to upload a scan or photo</div><div class="hint">JPG / PNG (screenshot a PDF if needed)</div><input type="file" id="certFile" accept="image/*" hidden></div>
            <div class="thumbs" id="certThumb"></div>
          </div>
        </form>
      </div>
      <div class="modal__foot">
        <button class="btn btn--ghost" id="cmCancel">Cancel</button>
        <button class="btn btn--primary" id="cmSave">${icon("check", 16)} ${isEdit ? "Save changes" : "Create"}</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  document.getElementById("cmClose").addEventListener("click", close);
  document.getElementById("cmCancel").addEventListener("click", close);

  const uploader = document.getElementById("certUploader");
  const fileInput = document.getElementById("certFile");
  const renderThumb = () => {
    const wrap = document.getElementById("certThumb");
    wrap.innerHTML = img ? `<div class="thumb" style="width:110px;height:140px"><img src="${esc(img)}" alt=""><button type="button" class="thumb__del" id="certDel">✕</button></div>` : "";
    const d = document.getElementById("certDel");
    if (d) d.addEventListener("click", () => { img = ""; renderThumb(); });
  };
  uploader.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { img = await fileToResizedDataURL(f, 1400, 0.82); renderThumb(); }
    catch { toast("Couldn’t read the image", "err"); }
  });
  renderThumb();

  document.getElementById("cmSave").addEventListener("click", async () => {
    const form = document.getElementById("certForm");
    const tf = form.querySelector('[data-field="ctitle"]');
    if (!form.title.value.trim()) { tf.classList.add("field--invalid"); tf.querySelector(".error-text").textContent = "Title is required."; return; }
    await saveCert({ id: cert?.id, createdAt: cert?.createdAt, title: form.title.value, issuer: form.issuer.value, date: form.date.value, category: form.category.value, image: img });
    toast(isEdit ? "Certificate updated" : "Certificate created");
    close();
    renderCerts();
  });
}

// ---------------------------------------------------------------------------
//  REVIEWS TAB
// ---------------------------------------------------------------------------
const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);

async function renderReviews() {
  const panel = document.getElementById("panel");
  let reviews;
  try { await ensureReviewAdminSeed(); reviews = await getReviews(); }
  catch (err) { panel.innerHTML = dbErrorHTML(err); return; }
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:var(--space-3)">
      <p class="muted">${reviews.length} review${reviews.length === 1 ? "" : "s"}</p>
      <div class="row-actions" style="flex-wrap:wrap">
        <button class="btn btn--ghost btn--sm" id="revImportBtn">${icon("upload", 15)} Import</button>
        <button class="btn btn--ghost btn--sm" id="revExportBtn">${icon("box", 15)} Export reviews.json</button>
        <button class="btn btn--primary btn--sm" id="revNewBtn">${icon("plus", 16)} Add review</button>
        <input type="file" id="revImportFile" accept="application/json,.json" hidden>
      </div>
    </div>
    <div class="alert alert--info" style="margin-bottom:var(--space-4);font-size:.82rem">${icon("shield", 14)} <span>Recommended: use <b>Export all</b> (top) → <code>data/content.json</code> — one file for the whole site. The button below exports only reviews.</span></div>
    ${reviews.length ? `
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Name</th><th>Role</th><th>Rating</th><th>Review</th><th></th></tr></thead>
      <tbody>
        ${reviews.map((r) => `<tr>
          <td style="font-weight:600;white-space:nowrap">${esc(r.name)}${r.verified ? ` <span class="badge badge--stock" style="font-size:.62rem">✓</span>` : ""}</td>
          <td>${esc(r.role || "—")}</td>
          <td style="color:var(--accent-ink);white-space:nowrap">${stars(r.rating)}</td>
          <td style="max-width:360px">${esc(r.text)}</td>
          <td><div class="row-actions">
            <button class="icon-btn rev-edit" data-id="${r.id}" style="width:34px;height:34px" aria-label="Edit">${icon("edit", 15)}</button>
            <button class="icon-btn rev-del" data-id="${r.id}" style="width:34px;height:34px" aria-label="Delete">${icon("trash", 15)}</button>
          </div></td>
        </tr>`).join("")}
      </tbody></table></div>`
    : `<div class="empty">${icon("chat", 44)}<h3>No reviews yet</h3><p>Add customer reviews shown on the Reviews page.</p></div>`}`;

  document.getElementById("revNewBtn").addEventListener("click", () => openReviewModal(null));
  document.getElementById("revExportBtn").addEventListener("click", async () => {
    const list = await getReviews();
    const blob = new Blob([exportReviewsJSON(list)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "reviews.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("reviews.json downloaded — commit it to publish");
  });
  document.getElementById("revImportBtn").addEventListener("click", () => document.getElementById("revImportFile").click());
  document.getElementById("revImportFile").addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { await importReviewsFromJSON(await file.text()); toast("Reviews imported"); renderReviews(); }
    catch (err) { toast("Import failed: " + err.message, "err"); }
  });
  panel.querySelectorAll(".rev-edit").forEach((b) => b.addEventListener("click", () => openReviewModal(reviews.find((r) => r.id === b.dataset.id))));
  panel.querySelectorAll(".rev-del").forEach((b) => b.addEventListener("click", async () => {
    if (confirm("Delete this review?")) { await deleteReview(b.dataset.id); toast("Review deleted"); renderReviews(); }
  }));
}

function openReviewModal(review) {
  const isEdit = !!review;
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__head">
        <h2 style="font-family:var(--font-body);font-size:1.2rem;font-weight:600">${isEdit ? "Edit review" : "Add review"}</h2>
        <button class="icon-btn" id="rvClose" aria-label="Close">${icon("close", 18)}</button>
      </div>
      <div class="modal__body">
        <form id="revForm" class="form-grid">
          <div class="form-row">
            <div class="field" data-field="rname">
              <label class="label">Name <span class="req">*</span></label>
              <input class="input" name="name" value="${esc(review?.name || "")}" placeholder="e.g. Max K.">
              <div class="error-text"></div>
            </div>
            <div class="field"><label class="label">Role / sport</label><input class="input" name="role" value="${esc(review?.role || "")}" placeholder="e.g. Powerlifter"></div>
          </div>
          <div class="form-row">
            <div class="field">
              <label class="label">Rating</label>
              <select class="select" name="rating">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}" ${(review?.rating || 5) === n ? "selected" : ""}>${stars(n)} (${n})</option>`).join("")}</select>
            </div>
            <div class="field">
              <label class="label">Verified badge</label>
              <select class="select" name="verified"><option value="yes" ${review?.verified !== false ? "selected" : ""}>Yes</option><option value="no" ${review?.verified === false ? "selected" : ""}>No</option></select>
            </div>
          </div>
          <div class="field" data-field="rtext">
            <label class="label">Review text <span class="req">*</span></label>
            <textarea class="textarea" name="text" placeholder="What the customer said…">${esc(review?.text || "")}</textarea>
            <div class="error-text"></div>
          </div>
        </form>
      </div>
      <div class="modal__foot">
        <button class="btn btn--ghost" id="rvCancel">Cancel</button>
        <button class="btn btn--primary" id="rvSave">${icon("check", 16)} ${isEdit ? "Save changes" : "Create"}</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  document.getElementById("rvClose").addEventListener("click", close);
  document.getElementById("rvCancel").addEventListener("click", close);

  document.getElementById("rvSave").addEventListener("click", async () => {
    const form = document.getElementById("revForm");
    let ok = true;
    const nf = form.querySelector('[data-field="rname"]');
    const tf = form.querySelector('[data-field="rtext"]');
    const setErr = (field, msg) => { field.classList.toggle("field--invalid", !!msg); field.querySelector(".error-text").textContent = msg; };
    if (!form.name.value.trim()) { setErr(nf, "Name is required."); ok = false; } else setErr(nf, "");
    if (!form.text.value.trim()) { setErr(tf, "Review text is required."); ok = false; } else setErr(tf, "");
    if (!ok) return;
    await saveReview({
      id: review?.id, createdAt: review?.createdAt,
      name: form.name.value, role: form.role.value,
      rating: +form.rating.value, text: form.text.value,
      verified: form.verified.value === "yes",
    });
    toast(isEdit ? "Review updated" : "Review created");
    close();
    renderReviews();
  });
}

// ---------------------------------------------------------------------------
//  SETTINGS TAB (reviews channel link + social links)
// ---------------------------------------------------------------------------
const SOCIAL_ICONS = [
  ["instagram", "Instagram"], ["send", "Telegram / Send"], ["tiktok", "TikTok"],
  ["youtube", "YouTube"], ["x", "X"], ["globe", "Website"], ["mail", "Email"], ["phone", "Phone"], ["chat", "Chat"],
];

function socialRow(s = {}) {
  return `
    <div class="social-row" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
      <input class="input s-name" placeholder="Name" value="${esc(s.name || "")}" style="flex:0 0 130px">
      <select class="select s-icon" style="flex:0 0 150px">${SOCIAL_ICONS.map(([v, l]) => `<option value="${v}" ${s.icon === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <input class="input s-href" placeholder="https://…" value="${esc(s.href || "")}" style="flex:1;min-width:180px">
      <button type="button" class="icon-btn s-del" style="width:38px;height:38px;flex:0 0 auto" aria-label="Remove">${icon("trash", 15)}</button>
    </div>`;
}

async function renderSettings() {
  const panel = document.getElementById("panel");
  let s, prods = [];
  try { s = await ensureSettingsAdminSeed(); prods = await getProducts().catch(() => []); }
  catch (err) { panel.innerHTML = dbErrorHTML(err); return; }
  adminSettings = s;
  const catCount = (n) => prods.filter((p) => p.category === n).length;
  const subCount = (n) => prods.filter((p) => p.subcategory === n).length;
  const taxChips = (items, kind, count) => (items || []).length
    ? items.map((n) => `<span class="tax-chip" data-kind="${kind}" data-name="${esc(n)}">${esc(n)}${count(n) ? `<em>${count(n)}</em>` : ""}<button type="button" class="tax-del" aria-label="Delete">${icon("close", 12)}</button></span>`).join("")
    : `<span class="hint">—</span>`;
  panel.innerHTML = `
    <div class="alert alert--info" style="margin-bottom:var(--space-4);font-size:.82rem">${icon("shield", 14)} <span>Recommended: use <b>Export all</b> (top) → <code>data/content.json</code> — one file for the whole site. The button below exports only these settings.</span></div>
    <div class="panel" style="max-width:720px">
      <div class="panel__title">${icon("chat", 18)} Reviews channel</div>
      <div class="field" style="margin-top:12px">
        <label class="label">Link to your channel with reviews (Telegram, Instagram, etc.)</label>
        <input class="input" id="revChannel" value="${esc(s.reviewsChannelUrl || "")}" placeholder="https://t.me/yourchannel">
        <p class="hint">Shown as a button on the Reviews page. Leave empty to hide it.</p>
      </div>

      <div class="hr" style="margin-block:var(--space-5)"></div>

      <div class="panel__title">${icon("globe", 18)} Social links (footer)</div>
      <div id="socialsList" style="margin-top:12px">${(s.socials || []).map(socialRow).join("")}</div>
      <button type="button" class="btn btn--ghost btn--sm" id="addSocial">${icon("plus", 15)} Add social</button>

      <div class="row-actions" style="margin-top:var(--space-5);flex-wrap:wrap">
        <button class="btn btn--primary" id="saveSettings">${icon("check", 16)} Save</button>
        <button class="btn btn--ghost" id="settingsExport">${icon("box", 15)} Export site.json</button>
      </div>
    </div>

    <div class="panel" style="max-width:720px;margin-top:var(--space-5)">
      <div class="panel__title">${icon("box", 18)} Categories</div>
      <p class="hint" style="margin-top:0">Shown as filter chips on the homepage and in the product form. Deleting one removes its chip; existing products keep their value.</p>
      <div class="tax-wrap" id="catWrap" style="margin:12px 0">${taxChips(s.categories, "cat", catCount)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input class="input" id="newCat" placeholder="New category" style="flex:1;min-width:160px">
        <button type="button" class="btn btn--ghost btn--sm" id="addCat">${icon("plus", 15)} Add</button>
      </div>

      <div class="hr" style="margin-block:var(--space-5)"></div>

      <div class="panel__title">${icon("box", 18)} Subcategories</div>
      <div class="tax-wrap" id="subWrap" style="margin:12px 0">${taxChips(s.subcategories, "sub", subCount)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input class="input" id="newSub" placeholder="New subcategory" style="flex:1;min-width:160px">
        <button type="button" class="btn btn--ghost btn--sm" id="addSub">${icon("plus", 15)} Add</button>
      </div>
    </div>`;

  const list = document.getElementById("socialsList");
  const bindDelete = () => list.querySelectorAll(".s-del").forEach((b) => b.onclick = () => b.closest(".social-row").remove());
  bindDelete();
  document.getElementById("addSocial").addEventListener("click", () => {
    list.insertAdjacentHTML("beforeend", socialRow({ icon: "instagram" }));
    bindDelete();
  });

  const collect = () => ({
    reviewsChannelUrl: document.getElementById("revChannel").value,
    socials: [...list.querySelectorAll(".social-row")].map((row) => ({
      name: row.querySelector(".s-name").value.trim(),
      icon: row.querySelector(".s-icon").value,
      href: row.querySelector(".s-href").value.trim(),
      id: row.querySelector(".s-name").value.trim().toLowerCase().replace(/[^a-z0-9]/g, "") || row.querySelector(".s-icon").value,
    })).filter((x) => x.href),
  });

  document.getElementById("saveSettings").addEventListener("click", async () => {
    await saveSettings(collect());
    toast("Settings saved — Export site.json to publish");
  });
  document.getElementById("settingsExport").addEventListener("click", async () => {
    const saved = await saveSettings(collect()); // persist current form, then export it
    const blob = new Blob([exportSettingsJSON(saved)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "site.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("site.json downloaded — commit it to publish");
  });

  // ---- categories / subcategories manager (saves immediately) ----
  const applyTax = async (patch) => { adminSettings = await saveSettings(patch); renderSettings(); };
  const addFrom = async (inputId, key) => {
    const v = document.getElementById(inputId).value.trim(); if (!v) return;
    const cur = (adminSettings[key] || []);
    if (cur.includes(v)) { toast("Already in the list"); return; }
    await applyTax({ [key]: [...cur, v] });
    toast("Added");
  };
  document.getElementById("addCat").addEventListener("click", () => addFrom("newCat", "categories"));
  document.getElementById("addSub").addEventListener("click", () => addFrom("newSub", "subcategories"));
  ["newCat", "newSub"].forEach((id) => document.getElementById(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); addFrom(id, id === "newCat" ? "categories" : "subcategories"); }
  }));
  document.getElementById("catWrap").addEventListener("click", async (e) => {
    const b = e.target.closest(".tax-del"); if (!b) return;
    const name = b.closest(".tax-chip").dataset.name;
    const used = (await getProducts().catch(() => [])).filter((p) => p.category === name).length;
    if (used && !confirm(`“${name}” is used by ${used} product(s). Remove it from the list anyway? Those products keep the category.`)) return;
    await applyTax({ categories: (adminSettings.categories || []).filter((c) => c !== name) });
    toast("Category removed");
  });
  document.getElementById("subWrap").addEventListener("click", async (e) => {
    const b = e.target.closest(".tax-del"); if (!b) return;
    const name = b.closest(".tax-chip").dataset.name;
    await applyTax({ subcategories: (adminSettings.subcategories || []).filter((c) => c !== name) });
    toast("Subcategory removed");
  });
}

// ---------------------------------------------------------------------------
mountChrome("admin.html");
if (sessionStorage.getItem(SESSION_KEY)) renderDashboard();
else renderLogin();
