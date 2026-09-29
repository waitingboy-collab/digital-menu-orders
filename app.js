// app.js — клиентско меню (редизайн „Порцелан“)
/* =========================================================
   Дигитално меню — клиентска част (редизайн)
   Съвместимо със съществуващата Supabase схема:
   menu_items, orders, reservations, restaurant_settings,
   rpc: get_top_selling_items, decrement_menu_stock
   QR на маса: ?table=7  |  Демо без база: ?demo=1
   ========================================================= */
const SUPABASE_URL = "https://rhqirgmxfaeqsihuvqym.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJocWlyZ214ZmFlcXNpaHV2cXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5OTUwOTQsImV4cCI6MjA5ODU3MTA5NH0.ua9LKCdXgTP9cp48t_DGmHyixBqk4F0dJf424B20vec";

const params = new URLSearchParams(location.search);
let inFrame = false;
try { inFrame = window.self !== window.top; } catch (e) { inFrame = true; }
// Демото се пуска само при ?demo или в преглед (iframe) — истинските гости никога не виждат фалшиво меню
const ALLOW_DEMO = params.has("demo") || inFrame;

let sb = null;
try {
  if (!params.has("demo") && window.supabase) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) { console.error(e); }

const state = {
  items: [], name: "", lang: "bg", catTrans: {}, popular: new Set(),
  cart: {}, search: "", table: "", demo: false
};

/* ---------- Текстове на интерфейса ---------- */
const UI = {
  bg: {
    demo: "Демо меню — поръчките не се изпращат.",
    heroSub: "Избери спокойно. Поръчката идва направо на масата ти.",
    reserve: "Резервирай маса", table: "Маса", search: "Какво ти се хапва?",
    results: "Резултати", other: "Други",
    noResults: "Нищо не съвпада с „{q}“.", clearSearch: "Изчисти търсенето",
    empty: "Менюто все още е празно.", popular: "Любимо", left: "Остават {n} бр.",
    noName: "Без име", add: "Добави в поръчката", addShort: "Добави", addBtn: "Добави", dishes1: "ястие", dishesN: "ястия", viewOrder: "Виж поръчката",
    unit1: "артикул", unitN: "артикула", yourOrder: "Поръчката ти", total: "Общо",
    perItem: "/ бр.", tableLabel: "Номер на маса", send: "Изпрати поръчката", sending: "Изпращане…",
    cartEmpty: "Количката е празна.", needTable: "Моля, въведи номер на маса.",
    accepted: "Поръчката е приета!", acceptedSub: "Персоналът вече я вижда и ще я подготви.",
    done: "Готово", loadFail: "Менюто не се зареди. Провери интернет връзката и опитай пак.",
    retry: "Опитай пак", sendErr: "Поръчката не беше изпратена: ", noTable: "Без маса",
    resTitle: "Резервация на маса", rName: "Име", rPhone: "Телефон", rDate: "Дата", rTime: "Час",
    rParty: "Брой хора", rNotes: "Бележка (незадължително)", rSend: "Изпрати заявка за резервация",
    rFill: "Моля, попълни име, телефон, дата и час.", rDone: "Заявката е изпратена!",
    rDoneSub: "Заведението ще потвърди резервацията ти по телефона.", today: "Днес", tomorrow: "Утре",
    addA11y: "Добави", maxReached: "Няма повече налични."
  },
  en: {
    demo: "Demo menu — orders are not sent.",
    heroSub: "Take your time. Your order goes straight to your table.",
    reserve: "Book a table", table: "Table", search: "What are you craving?",
    results: "Results", other: "Other",
    noResults: "Nothing matches “{q}”.", clearSearch: "Clear search",
    empty: "The menu is empty for now.", popular: "Favourite", left: "Only {n} left",
    noName: "Untitled", add: "Add to order", addShort: "Add", addBtn: "Add", dishes1: "item", dishesN: "items", viewOrder: "View order",
    unit1: "item", unitN: "items", yourOrder: "Your order", total: "Total",
    perItem: "each", tableLabel: "Table number", send: "Send order", sending: "Sending…",
    cartEmpty: "Your order is empty.", needTable: "Please enter your table number.",
    accepted: "Order received!", acceptedSub: "The staff can see it and will prepare it now.",
    done: "Done", loadFail: "The menu didn't load. Check your connection and try again.",
    retry: "Try again", sendErr: "The order wasn't sent: ", noTable: "No table",
    resTitle: "Book a table", rName: "Name", rPhone: "Phone", rDate: "Date", rTime: "Time",
    rParty: "Guests", rNotes: "Note (optional)", rSend: "Send booking request",
    rFill: "Please fill in name, phone, date and time.", rDone: "Request sent!",
    rDoneSub: "The restaurant will confirm your booking by phone.", today: "Today", tomorrow: "Tomorrow",
    addA11y: "Add", maxReached: "No more in stock."
  }
};
const t = (k, vars) => {
  let s = (state.lang === "bg" ? UI.bg : UI.en)[k] ?? UI.bg[k] ?? k;
  if (vars) for (const v in vars) s = s.replace("{" + v + "}", vars[v]);
  return s;
};
function applyI18n() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
}

/* ---------- Помощни ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = n => (Number(n) || 0).toFixed(2) + " €";
const localISO = (d = new Date()) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const ICON_PLUS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_MINUS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>';

function getItemText(item, field) {
  if (state.lang !== "bg" && item.translations && item.translations[state.lang] && item.translations[state.lang][field]) {
    return item.translations[state.lang][field];
  }
  return item[field] || "";
}
function getCategoryLabel(cat) {
  if (!cat) return t("other");
  if (state.lang !== "bg" && state.catTrans[cat] && state.catTrans[cat][state.lang]) return state.catTrans[cat][state.lang];
  return cat;
}
function getCategories() {
  const seen = new Set(), out = [];
  state.items.forEach(i => { const c = (i.category || "").trim(); if (!seen.has(c)) { seen.add(c); out.push(c); } });
  // Артикулите без категория отиват най-накрая
  return out.sort((a, b) => (a === "") - (b === ""));
}
const findItem = id => state.items.find(i => String(i.id) === String(id));
const maxFor = item => (item && item.quantity !== null && item.quantity !== undefined) ? Number(item.quantity) : Infinity;

/* ---------- Масата от QR кода ---------- */
function readTableFromUrl() {
  const raw = params.get("table") || params.get("masa") || params.get("t") || "";
  const clean = raw.replace(/[^\p{L}\p{N}-]/gu, "").slice(0, 6);
  if (clean) {
    state.table = clean;
    $("table-chip-num").textContent = clean;
    $("table-chip").classList.remove("hidden");
  }
  $("table-number-input").value = state.table;
}

/* ---------- Зареждане ---------- */
function renderSkeleton() {
  $("menu-container").innerHTML = '<section class="sec"><div class="grid">' + Array.from({ length: 6 }, () =>
    '<div class="dish" style="cursor:default"><div class="plate"><span class="sk" style="width:70%;height:70%;border-radius:50%"></span></div><span class="sk" style="width:70%;height:18px"></span><span class="sk" style="width:90%;height:11px;margin-top:10px"></span><span class="sk" style="width:40%;height:14px;margin-top:14px"></span><span class="sk" style="width:100%;height:44px;margin-top:14px"></span></div>'
  ).join("") + "</div></section>";
}
const withTimeout = (p, ms = 9000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

async function getSetting(key) {
  try {
    const { data } = await sb.from("restaurant_settings").select("value").eq("key", key).maybeSingle();
    return data ? data.value : null;
  } catch (e) { return null; }
}
async function loadPopular() {
  try {
    const { data, error } = await sb.rpc("get_top_selling_items", { item_limit: 5 });
    if (!error) state.popular = new Set((data || []).map(r => r.name));
  } catch (e) { /* не е критично */ }
}
async function fetchItems() {
  const { data, error } = await sb.from("menu_items").select("*")
    .eq("is_available", true).or("quantity.is.null,quantity.gt.0");
  if (error) throw error;
  return data || [];
}
async function refreshMenuItems() {
  try { state.items = await fetchItems(); syncCartWithItems(); renderAll(); }
  catch (e) { console.error("Грешка при опресняване:", e.message || e); }
}

function applySettings({ name, bg, langs, catTrans }) {
  state.name = name || "";
  const title = $("restaurant-title");
  title.textContent = state.name || "Меню";
  document.title = state.name ? state.name + " | Меню" : "Дигитално QR Меню";
  if (bg) { $("bg-photo").style.backgroundImage = `url("${String(bg).replace(/"/g, "%22")}")`; $("bg-photo-wrap").classList.remove("hidden"); }
  if (catTrans) { try { state.catTrans = typeof catTrans === "string" ? JSON.parse(catTrans) : catTrans; } catch (e) { state.catTrans = {}; } }
  const enabled = Array.isArray(langs) ? langs : (langs ? String(langs).split(",").map(s => s.trim()).filter(Boolean) : []);
  const sel = $("language-select");
  if (enabled.length) {
    const labels = { en: "EN", de: "DE", ru: "RU", el: "EL", ro: "RO", tr: "TR", fr: "FR", it: "IT" };
    sel.innerHTML = '<option value="bg">BG</option>' + enabled.map(c => `<option value="${esc(c)}">${labels[c] || esc(c.toUpperCase())}</option>`).join("");
    sel.classList.remove("hidden");
  }
}

async function loadAll() {
  renderSkeleton();
  if (!sb) return ALLOW_DEMO ? startDemo() : showLoadError();
  try {
    const [name, bg, langs, catTrans] = await withTimeout(Promise.all(
      ["name", "background_image_url", "enabled_languages", "category_translations"].map(getSetting)));
    const [items] = await withTimeout(Promise.all([fetchItems(), loadPopular()]));
    applySettings({ name, bg, langs, catTrans });
    state.items = items;
    restoreCart();
    renderAll();
  } catch (e) {
    console.error("Критична грешка:", e.message || e);
    ALLOW_DEMO ? startDemo() : showLoadError();
  }
}
function showLoadError() {
  $("restaurant-title").textContent = state.name || "Меню";
  $("menu-container").innerHTML = `<div class="state"><p>${esc(t("loadFail"))}</p><button type="button" class="btn-soft" id="retry-btn">${esc(t("retry"))}</button></div>`;
  $("retry-btn").addEventListener("click", loadAll);
}

/* ---------- Рендер ---------- */
function renderAll() { renderCategoryButtons(); renderMenu(); renderCartBadge(); }

function renderCategoryButtons() {
  const nav = $("categories-nav");
  const cats = getCategories();
  const bar = $("cats-bar");
  if (cats.length < 2 || state.search) { nav.innerHTML = ""; bar.classList.add("hidden"); return; }
  bar.classList.remove("hidden");
  nav.innerHTML = cats.map((c, i) =>
    `<button type="button" class="tab" data-category="${esc(c)}" data-target="cat-${i}" aria-current="${i === 0}">${esc(getCategoryLabel(c))}</button>`).join("");
  activeSection = "cat-0";
}

function plateHTML(item, cls = "") {
  const name = getItemText(item, "name") || "";
  const mark = `<span class="plate-mark" aria-hidden="true">${esc(name.charAt(0))}</span>`;
  const img = item.image_url ? `<img src="${esc(item.image_url)}" alt="" loading="lazy" onerror="this.remove()">` : "";
  return `<div class="plate ${cls}">${img}${mark}</div>`;
}

function ctrlHTML(id) {
  const item = findItem(id);
  const qty = state.cart[id] ? state.cart[id].qty : 0;
  const name = esc(getItemText(item, "name"));
  if (!qty) return `<button type="button" class="add-btn" data-quick-add="${esc(id)}" aria-label="${esc(t("addA11y"))}: ${name}">${ICON_PLUS}<span>${esc(t("addBtn"))}</span></button>`;
  const atMax = qty >= maxFor(item);
  return `<div class="stepper"><button type="button" data-qty-change="${esc(id)}" data-delta="-1" aria-label="−1">${ICON_MINUS}</button><span aria-live="polite">${qty}</span><button type="button" data-qty-change="${esc(id)}" data-delta="1" aria-label="+1" ${atMax ? "disabled" : ""}>${ICON_PLUS}</button></div>`;
}
function dishHTML(item) {
  const id = String(item.id);
  const name = getItemText(item, "name") || t("noName");
  const desc = getItemText(item, "description");
  const hasStock = item.quantity !== null && item.quantity !== undefined;
  const low = hasStock && item.quantity > 0 && item.quantity <= 3;
  const pop = state.popular.has(item.name);
  return `<article class="dish" data-open-item="${esc(id)}" tabindex="0">
    ${plateHTML(item)}
    ${pop ? `<div class="fav"><span>${esc(t("popular"))}</span></div>` : ""}
    <h3>${esc(name)}</h3>
    ${desc ? `<p class="desc">${esc(desc)}</p>` : ""}
    <div class="price">${money(item.price)}</div>
    ${low ? `<div class="low">${esc(t("left", { n: item.quantity }))}</div>` : ""}
    <div class="ctrl" data-ctrl="${esc(id)}">${ctrlHTML(id)}</div>
  </article>`;
}
function renderMenu() {
  const box = $("menu-container");
  if (!state.items.length) { box.innerHTML = `<div class="state"><p>${esc(t("empty"))}</p></div>`; return; }
  const q = state.search;
  const head = (title, n, id) => `<div class="sec-head"><h2>${esc(title)}</h2><span class="rule"></span><span class="cnt">${n} ${esc(n === 1 ? t("dishes1") : t("dishesN"))}</span></div>`;
  if (q) {
    const hits = state.items.filter(i =>
      [getItemText(i, "name"), i.name, getItemText(i, "description")].some(s => (s || "").toLowerCase().includes(q)));
    if (!hits.length) {
      box.innerHTML = `<div class="state"><p>${esc(t("noResults", { q: $("search-input").value.trim() }))}</p><button type="button" class="btn-quiet" data-clear-search>${esc(t("clearSearch"))}</button></div>`;
      return;
    }
    box.innerHTML = `<section class="sec">${head(t("results"), hits.length)}<div class="grid">${hits.map(dishHTML).join("")}</div></section>`;
    return;
  }
  box.innerHTML = getCategories().map((c, i) => {
    const list = state.items.filter(it => (it.category || "").trim() === c);
    return `<section class="sec" id="cat-${i}" data-cat="${esc(c)}">${head(getCategoryLabel(c), list.length)}<div class="grid">${list.map(dishHTML).join("")}</div></section>`;
  }).join("");
}
function updateCtrl(id) {
  document.querySelectorAll(`[data-ctrl="${CSS.escape(String(id))}"]`).forEach(el => {
    const hadFocus = el.contains(document.activeElement);
    el.innerHTML = ctrlHTML(id);
    if (hadFocus) (el.querySelector('[data-delta="1"]') || el.querySelector("button"))?.focus();
  });
}

/* ---------- Scroll-spy за категориите ---------- */
let activeSection = "cat-0", spyTicking = false;
function onScroll() {
  if (spyTicking) return;
  spyTicking = true;
  requestAnimationFrame(() => {
    spyTicking = false;
    const bar = $("cats-bar");
    bar.classList.toggle("stuck", bar.getBoundingClientRect().top <= 0);
    if (state.search) return;
    const secs = document.querySelectorAll(".sec[id]");
    let current = secs[0] ? secs[0].id : null;
    secs.forEach(s => { if (s.getBoundingClientRect().top <= 90) current = s.id; });
    if ((innerHeight + scrollY) >= document.body.scrollHeight - 4 && secs.length) current = secs[secs.length - 1].id;
    if (current && current !== activeSection) setActiveChip(current);
  });
}
function setActiveChip(id) {
  activeSection = id;
  const nav = $("categories-nav");
  nav.querySelectorAll(".tab").forEach(b => {
    const on = b.dataset.target === id;
    b.setAttribute("aria-current", on);
    if (on) nav.scrollTo({ left: b.offsetLeft - nav.clientWidth / 2 + b.offsetWidth / 2, behavior: reduced ? "auto" : "smooth" });
  });
}

/* ---------- Количка ---------- */
function saveCart() {
  try {
    const slim = {}; for (const id in state.cart) slim[id] = state.cart[id].qty;
    sessionStorage.setItem("dm-cart", JSON.stringify(slim));
  } catch (e) {}
}
function restoreCart() {
  try {
    const slim = JSON.parse(sessionStorage.getItem("dm-cart") || "{}");
    for (const id in slim) { const item = findItem(id); if (item) state.cart[id] = { item, qty: Math.min(slim[id], maxFor(item)) }; }
  } catch (e) {}
}
function syncCartWithItems() {
  for (const id in state.cart) {
    const item = findItem(id);
    if (!item) delete state.cart[id];
    else { state.cart[id].item = item; state.cart[id].qty = Math.min(state.cart[id].qty, maxFor(item)); if (state.cart[id].qty <= 0) delete state.cart[id]; }
  }
  saveCart();
}
function addToCart(id, qty = 1) {
  const item = findItem(id); if (!item) return;
  const cur = state.cart[id] ? state.cart[id].qty : 0;
  const next = Math.min(cur + qty, maxFor(item));
  if (next <= 0) return;
  state.cart[id] = { item, qty: next };
  saveCart(); updateCtrl(id); renderCartBadge(true);
}
function changeCartQty(id, delta) {
  if (!state.cart[id]) { if (delta > 0) addToCart(id, delta); return; }
  const item = state.cart[id].item;
  state.cart[id].qty = Math.min(state.cart[id].qty + delta, maxFor(item));
  if (state.cart[id].qty <= 0) delete state.cart[id];
  saveCart(); updateCtrl(id); renderCartBadge(delta > 0);
  if (!$("cart-modal").classList.contains("hidden")) renderCartModal();
}
const cartCount = () => Object.values(state.cart).reduce((s, e) => s + e.qty, 0);
const cartTotal = () => Object.values(state.cart).reduce((s, e) => s + parseFloat(e.item.price) * e.qty, 0);

function renderCartBadge(bump) {
  const bar = $("cart-fab"), n = cartCount();
  const cnt = $("cart-fab-count");
  cnt.textContent = n;
  $("cart-fab-total").textContent = money(cartTotal());
  bar.setAttribute("aria-label", `${t("viewOrder")}: ${n} ${n === 1 ? t("unit1") : t("unitN")}, ${money(cartTotal())}`);
  if (n > 0) {
    if (bar.classList.contains("hidden")) {
      bar.classList.remove("hidden");
      requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.add("shown")));
    }
    bar.classList.add("flex");
    document.body.classList.add("has-bar");
    if (bump && !reduced) { cnt.classList.add("bump"); setTimeout(() => cnt.classList.remove("bump"), 220); }
  } else {
    bar.classList.remove("shown", "flex");
    document.body.classList.remove("has-bar");
    setTimeout(() => { if (!cartCount()) bar.classList.add("hidden"); }, reduced ? 0 : 500);
  }
}
function renderCartModal() {
  const list = $("cart-items-list");
  const entries = Object.entries(state.cart);
  $("cart-meta-table").textContent = state.table ? `${t("table")} ${state.table}` : t("noTable");
  $("cart-meta-time").textContent = new Date().toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });
  $("table-field").classList.toggle("hidden", !!params.get("table") && !!state.table);
  if (!entries.length) {
    list.innerHTML = `<p class="empty-cart">${esc(t("cartEmpty"))}</p>`;
  } else {
    list.innerHTML = entries.map(([id, e]) => {
      const atMax = e.qty >= maxFor(e.item);
      return `<div class="cline">
        ${plateHTML(e.item, "xs")}
        <div><p class="cl-name">${esc(getItemText(e.item, "name") || t("noName"))}</p><p class="cl-unit">${money(e.item.price)} ${esc(t("perItem"))}</p></div>
        <div class="cl-right"><span class="cl-sum">${money(parseFloat(e.item.price) * e.qty)}</span>
          <div class="stepper soft"><button type="button" data-qty-change="${esc(id)}" data-delta="-1" aria-label="−1">${ICON_MINUS}</button><span>${e.qty}</span><button type="button" data-qty-change="${esc(id)}" data-delta="1" aria-label="+1" ${atMax ? "disabled" : ""}>${ICON_PLUS}</button></div>
        </div></div>`;
    }).join("");
  }
  $("cart-total").textContent = money(cartTotal());
}
/* ---------- Изпращане на поръчка ---------- */
let sending = false;
async function submitOrder() {
  if (sending) return;
  const input = $("table-number-input"), err = $("order-error"), btn = $("submit-order-btn");
  const tableNumber = (input.value || state.table || "").trim();
  err.classList.add("hidden");
  const fail = msg => { err.textContent = msg; err.classList.remove("hidden"); };
  if (!cartCount()) return fail(t("cartEmpty"));
  if (!tableNumber) { $("table-field").classList.remove("hidden"); input.focus(); return fail(t("needTable")); }

  const orderItems = Object.values(state.cart).map(e => ({ id: e.item.id, name: e.item.name, price: parseFloat(e.item.price), qty: e.qty }));
  const total = cartTotal();
  const snapshot = Object.values(state.cart).map(e => ({ name: getItemText(e.item, "name"), qty: e.qty, sum: parseFloat(e.item.price) * e.qty }));

  sending = true; btn.disabled = true; btn.textContent = t("sending");
  let error = null;
  if (state.demo) await new Promise(r => setTimeout(r, 700));
  else ({ error } = await sb.from("orders").insert([{ table_number: tableNumber, items: orderItems, total, status: "new" }]));
  sending = false; btn.disabled = false; btn.textContent = t("send");
  if (error) return fail(t("sendErr") + error.message);

  state.table = tableNumber;
  const ids = Object.keys(state.cart);
  state.cart = {}; saveCart();
  ids.forEach(updateCtrl); renderCartBadge();
  closeSheet("cart-modal");

  $("success-lines").innerHTML =
    `<div class="r meta"><span>${esc(t("table"))} ${esc(tableNumber)}</span><span>${new Date().toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })}</span></div>` +
    snapshot.map(s => `<div class="r"><span>${s.qty} × ${esc(s.name)}</span><b>${money(s.sum)}</b></div>`).join("") +
    `<div class="r"><strong>${esc(t("total"))}</strong><b>${money(total)}</b></div>`;
  openSheet("order-success-modal");

  if (!state.demo) {
    Promise.all(orderItems.map(o => sb.rpc("decrement_menu_stock", { item_id: o.id, qty: o.qty })
      .then(({ error: e }) => { if (e) console.error("Наличност:", e.message); })))
      .then(refreshMenuItems);
  }
}

/* ---------- Детайли на артикул ---------- */
let modalItemId = null, modalQty = 1;
function openItemModal(id) {
  const item = findItem(id); if (!item) return;
  modalItemId = String(id); modalQty = 1;
  $("item-modal-name").textContent = getItemText(item, "name") || t("noName");
  $("item-modal-desc").textContent = getItemText(item, "description");
  $("item-modal-desc").classList.toggle("hidden", !getItemText(item, "description"));
  $("item-modal-price").textContent = money(item.price);
  const low = item.quantity !== null && item.quantity !== undefined && item.quantity > 0 && item.quantity <= 3;
  $("item-modal-tags").innerHTML = (state.popular.has(item.name) ? `<span class="tag-pop">${esc(t("popular"))}</span> ` : "") + (low ? `<span class="tag-low">${esc(t("left", { n: item.quantity }))}</span>` : "");
  const img = $("item-modal-img");
  $("item-plate-mark").textContent = (getItemText(item, "name") || "").charAt(0);
  if (item.image_url) {
    img.onerror = () => img.classList.add("hidden");
    img.src = item.image_url; img.alt = getItemText(item, "name");
    img.classList.remove("hidden");
  } else { img.classList.add("hidden"); img.removeAttribute("src"); }
  updateModalQty();
  openSheet("item-modal");
}
function updateModalQty() {
  const item = findItem(modalItemId); if (!item) return;
  const inCart = state.cart[modalItemId] ? state.cart[modalItemId].qty : 0;
  const room = Math.max(0, maxFor(item) - inCart);
  modalQty = Math.max(1, Math.min(modalQty, room || 1));
  $("item-qty-val").textContent = modalQty;
  $("item-qty").querySelector('[data-item-delta="-1"]').disabled = modalQty <= 1;
  $("item-qty").querySelector('[data-item-delta="1"]').disabled = modalQty >= room;
  const add = $("item-modal-add-btn");
  add.disabled = room <= 0;
  $("item-modal-sum").textContent = room <= 0 ? t("maxReached") : money(parseFloat(item.price) * modalQty);
}

/* ---------- Резервации ---------- */
async function submitReservation() {
  const err = $("reservation-error"), btn = $("submit-reservation-btn");
  err.classList.add("hidden");
  const name = $("reservation-name").value.trim(), phone = $("reservation-phone").value.trim();
  const date = $("reservation-date").value, time = $("reservation-time").value;
  const partySize = parseInt($("reservation-party-size").value, 10) || 1;
  const notes = $("reservation-notes").value.trim() || null;
  if (!name || !phone || !date || !time) { err.textContent = t("rFill"); err.classList.remove("hidden"); return; }
  btn.disabled = true; btn.textContent = t("sending");
  let error = null;
  if (state.demo) await new Promise(r => setTimeout(r, 700));
  else ({ error } = await sb.from("reservations").insert([{ customer_name: name, phone, reservation_date: date, reservation_time: time, party_size: partySize, notes, status: "pending" }]));
  btn.disabled = false; btn.textContent = t("rSend");
  if (error) { err.textContent = t("sendErr") + error.message; err.classList.remove("hidden"); return; }
  ["reservation-name", "reservation-phone", "reservation-date", "reservation-time", "reservation-notes"].forEach(i => $(i).value = "");
  $("reservation-party-size").value = "2";
  syncDateChips();
  closeSheet("reservation-modal");
  openSheet("reservation-success-modal");
}
function syncDateChips() {
  const v = $("reservation-date").value;
  document.querySelectorAll("#date-quick [data-day]").forEach(b => {
    const d = new Date(); d.setDate(d.getDate() + Number(b.dataset.day));
    b.setAttribute("aria-pressed", v === localISO(d));
  });
}

/* ---------- Листове (модали) ---------- */
let sheetStack = [], focusStack = [];
function openSheet(id) {
  const m = $(id);
  focusStack.push(document.activeElement);
  m.classList.remove("hidden"); m.classList.add("flex");
  requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add("open")));
  sheetStack.push(id);
  document.body.classList.add("locked");
  const s = m.querySelector(".sheet"); s && s.focus({ preventScroll: true });
  const sc = m.querySelector(".sheet-scroll"); if (sc) sc.scrollTop = 0;
}
function closeSheet(id) {
  const m = $(id);
  if (m.classList.contains("hidden")) return;
  m.classList.remove("open");
  sheetStack = sheetStack.filter(x => x !== id);
  const done = () => { if (!m.classList.contains("open")) { m.classList.add("hidden"); m.classList.remove("flex"); } };
  reduced ? done() : setTimeout(done, 260);
  if (!sheetStack.length) document.body.classList.remove("locked");
  const f = focusStack.pop();
  if (f && f.focus && document.contains(f)) f.focus({ preventScroll: true });
}

/* ---------- Демо ---------- */
function startDemo() {
  state.demo = true;
  $("demo-note").classList.remove("hidden");
  const tr = (en, d) => ({ en: { name: en, description: d } });
  applySettings({
    name: "Бистро Орех", langs: ["en"],
    catTrans: { "Салати": { en: "Salads" }, "Предястия": { en: "Starters" }, "Основни": { en: "Mains" }, "Десерти": { en: "Desserts" }, "Напитки": { en: "Drinks" } }
  });
  state.popular = new Set(["Шопска салата", "Свинско с праз"]);
  state.items = [
    { id: 1, category: "Салати", name: "Шопска салата", description: "Домати, краставици, печени чушки, лук и настъргано краве сирене.", price: 7.5, quantity: null, translations: tr("Shopska salad", "Tomatoes, cucumbers, roasted peppers, onion and grated white cheese.") },
    { id: 2, category: "Салати", name: "Снежанка", description: "Цедено кисело мляко, краставици, копър, чесън и орехи.", price: 5.9, quantity: 2, translations: tr("Snezhanka", "Strained yoghurt, cucumber, dill, garlic and walnuts.") },
    { id: 3, category: "Салати", name: "Зелена салата с авокадо", description: "Айсберг, рукола, авокадо, репички и лимонов дресинг.", price: 8.4, quantity: null, translations: tr("Green salad with avocado", "Iceberg, rocket, avocado, radishes and lemon dressing.") },
    { id: 4, category: "Предястия", name: "Пататник", description: "Родопски картофен пай със сирене и джоджен.", price: 6.8, quantity: null, translations: tr("Patatnik", "Rhodope potato pie with white cheese and mint.") },
    { id: 5, category: "Предястия", name: "Чушки бюрек", description: "Печени чушки, пълнени със сирене и яйце, панирани.", price: 7.2, quantity: null, translations: tr("Peppers byurek", "Roasted peppers stuffed with cheese and egg, breaded.") },
    { id: 6, category: "Предястия", name: "Кашкавал пане", description: "С боровинково сладко.", price: 6.2, quantity: null, translations: tr("Breaded kashkaval", "With blueberry jam.") },
    { id: 7, category: "Основни", name: "Свинско с праз", description: "Бавно задушено свинско, праз и бяло вино, с картофено пюре.", price: 13.9, quantity: null, translations: tr("Pork with leeks", "Slow-braised pork, leeks and white wine, with mashed potatoes.") },
    { id: 8, category: "Основни", name: "Кавърма в гювече", description: "Свинско, гъби, лук и яйце, запечени в глинен съд.", price: 14.5, quantity: 3, translations: tr("Kavarma in a clay pot", "Pork, mushrooms, onion and egg baked in a clay pot.") },
    { id: 9, category: "Основни", name: "Пъстърва на скара", description: "С лимон, масло с копър и печени зеленчуци.", price: 15.8, quantity: null, translations: tr("Grilled trout", "With lemon, dill butter and roasted vegetables.") },
    { id: 10, category: "Десерти", name: "Мекици със сладко", description: "Три броя, с пудра захар и домашно сладко.", price: 4.9, quantity: null, translations: tr("Mekitsi with jam", "Three fried dough pieces, icing sugar and homemade jam.") },
    { id: 11, category: "Десерти", name: "Домашен сладолед", description: "Три топки по избор.", price: 5.2, quantity: null, translations: tr("Homemade ice cream", "Three scoops of your choice.") },
    { id: 12, category: "Напитки", name: "Айрян", description: "300 мл", price: 2.4, quantity: null, translations: tr("Ayran", "300 ml") },
    { id: 13, category: "Напитки", name: "Домашна лимонада с мента", description: "500 мл", price: 3.9, quantity: null, translations: tr("Homemade mint lemonade", "500 ml") },
    { id: 14, category: "Напитки", name: "Боза", description: "250 мл", price: 2.2, quantity: null, translations: tr("Boza", "250 ml") }
  ];
  restoreCart();
  renderAll();
}

/* ---------- Събития ---------- */
function bindEvents() {
  // Меню: делегиране на кликове
  $("menu-container").addEventListener("click", e => {
    const quick = e.target.closest("[data-quick-add]");
    if (quick) { e.stopPropagation(); addToCart(quick.dataset.quickAdd); return; }
    const step = e.target.closest("[data-qty-change]");
    if (step) { e.stopPropagation(); changeCartQty(step.dataset.qtyChange, parseInt(step.dataset.delta, 10)); return; }
    if (e.target.closest("[data-clear-search]")) { clearSearch(); return; }
    const dish = e.target.closest("[data-open-item]");
    if (dish) openItemModal(dish.dataset.openItem);
  });
  $("menu-container").addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-open-item]")) { e.preventDefault(); openItemModal(e.target.dataset.openItem); }
  });

  // Категории
  $("categories-nav").addEventListener("click", e => {
    const b = e.target.closest("[data-target]"); if (!b) return;
    const sec = $(b.dataset.target); if (!sec) return;
    setActiveChip(b.dataset.target);
    sec.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  });
  addEventListener("scroll", onScroll, { passive: true });

  // Търсене
  const search = $("search-input");
  search.addEventListener("input", () => {
    state.search = search.value.trim().toLowerCase();
    $("search-clear").classList.toggle("hidden", !search.value);
    renderCategoryButtons(); renderMenu();
  });
  $("search-clear").addEventListener("click", () => { clearSearch(); search.focus(); });

  // Език
  $("language-select").addEventListener("change", e => {
    state.lang = e.target.value;
    applyI18n(); renderAll();
    if (!$("cart-modal").classList.contains("hidden")) renderCartModal();
  });

  // Количка
  $("cart-fab").addEventListener("click", () => { renderCartModal(); openSheet("cart-modal"); });
  $("cart-items-list").addEventListener("click", e => {
    const s = e.target.closest("[data-qty-change]");
    if (s) changeCartQty(s.dataset.qtyChange, parseInt(s.dataset.delta, 10));
  });
  $("cart-modal-close").addEventListener("click", () => closeSheet("cart-modal"));
  $("submit-order-btn").addEventListener("click", submitOrder);
  $("table-number-input").addEventListener("input", e => { state.table = e.target.value.trim(); });
  $("order-success-close").addEventListener("click", () => closeSheet("order-success-modal"));

  // Артикул
  $("item-modal-close").addEventListener("click", () => closeSheet("item-modal"));
  $("item-qty").addEventListener("click", e => {
    const b = e.target.closest("[data-item-delta]"); if (!b) return;
    modalQty += parseInt(b.dataset.itemDelta, 10); updateModalQty();
  });
  $("item-modal-add-btn").addEventListener("click", () => {
    if (modalItemId) addToCart(modalItemId, modalQty);
    closeSheet("item-modal");
  });

  // Резервации
  $("reservation-fab").addEventListener("click", () => {
    $("reservation-date").min = localISO();
    openSheet("reservation-modal");
  });
  $("reservation-modal-close").addEventListener("click", () => closeSheet("reservation-modal"));
  $("submit-reservation-btn").addEventListener("click", submitReservation);
  $("reservation-success-close").addEventListener("click", () => closeSheet("reservation-success-modal"));
  $("date-quick").addEventListener("click", e => {
    const b = e.target.closest("[data-day]"); if (!b) return;
    const d = new Date(); d.setDate(d.getDate() + Number(b.dataset.day));
    $("reservation-date").value = localISO(d); syncDateChips();
  });
  $("reservation-date").addEventListener("change", syncDateChips);
  document.querySelector(".party").addEventListener("click", e => {
    const b = e.target.closest("[data-party]"); if (!b) return;
    const inp = $("reservation-party-size");
    inp.value = Math.max(1, Math.min(50, (parseInt(inp.value, 10) || 1) + Number(b.dataset.party)));
  });

  // Затваряне с клик извън листа и с Esc
  ["item-modal", "cart-modal", "order-success-modal", "reservation-modal", "reservation-success-modal"].forEach(id =>
    $(id).addEventListener("click", e => { if (e.target.id === id) closeSheet(id); }));
  document.addEventListener("keydown", e => { if (e.key === "Escape" && sheetStack.length) closeSheet(sheetStack[sheetStack.length - 1]); });
}
function clearSearch() {
  $("search-input").value = ""; state.search = "";
  $("search-clear").classList.add("hidden");
  renderCategoryButtons(); renderMenu();
}

document.addEventListener("DOMContentLoaded", () => {
  applyI18n();
  readTableFromUrl();
  bindEvents();
  loadAll();
});
