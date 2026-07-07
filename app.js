// app.js - Финална версия за клиентското меню
const SUPABASE_URL = "https://rhqirgmxfaeqsihuvqym.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJocWlyZ214ZmFlcXNpaHV2cXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5OTUwOTQsImV4cCI6MjA5ODU3MTA5NH0.ua9LKCdXgTP9cp48t_DGmHyixBqk4F0dJf424B20vec";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentCategory = "all";
let searchQuery = "";
let cachedItems = [];
let cachedRestaurantName = "";

function getCategories() {
    const seen = new Set();
    const categories = [];
    cachedItems.forEach(item => {
        const cat = (item.category || "").trim();
        if (cat && !seen.has(cat)) {
            seen.add(cat);
            categories.push(cat);
        }
    });
    return categories;
}

function renderCategoryButtons() {
    const nav = document.getElementById("categories-nav");
    if (!nav) return;

    const categories = getCategories();
    if (categories.length === 0) {
        nav.innerHTML = "";
        return;
    }

    const baseClasses = "flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition whitespace-nowrap cursor-pointer";
    const activeClasses = "bg-cyan-800 text-white shadow-sm";
    const inactiveClasses = "bg-white/70 text-gray-600 border border-gray-200 hover:bg-white";

    const allBtn = `<button type="button" data-category="all" class="${baseClasses} ${currentCategory === "all" ? activeClasses : inactiveClasses}">Всички</button>`;

    const categoryBtns = categories.map(cat => {
        const isActive = currentCategory === cat;
        return `<button type="button" data-category="${cat}" class="${baseClasses} ${isActive ? activeClasses : inactiveClasses}">${cat}</button>`;
    }).join('');

    nav.innerHTML = allBtn + categoryBtns;

    nav.querySelectorAll("button[data-category]").forEach(btn => {
        btn.addEventListener("click", () => {
            currentCategory = btn.getAttribute("data-category");
            renderCategoryButtons();
            renderMenu();
        });
    });
}

function renderMenu() {
    const container = document.getElementById("menu-container");
    const titleEl = document.getElementById("restaurant-title");

    if (titleEl && cachedRestaurantName) titleEl.textContent = cachedRestaurantName;
    if (!container) return;

    if (!cachedItems || cachedItems.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400">Менюто е празно.</p>';
        return;
    }

    const visibleItems = cachedItems.filter(item => {
        const matchesCategory = currentCategory === "all" || (item.category || "").trim() === currentCategory;
        const matchesSearch = !searchQuery || (item.name || "").toLowerCase().includes(searchQuery);
        return matchesCategory && matchesSearch;
    });

    if (visibleItems.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400">Няма намерени артикули.</p>';
        return;
    }

    container.innerHTML = visibleItems.map(item => `
        <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer relative" data-open-item="${item.id}">
            ${item.image_url ? `
            <img src="${item.image_url}" alt="${item.name || ''}"
                 class="w-full h-40 object-cover rounded-lg mb-3"
                 onerror="this.style.display='none'">
            ` : ''}
            <h3 class="text-lg font-bold">${item.name || 'Без име'}</h3>
            <p class="text-sm text-gray-500">${item.description || ''}</p>
            <div class="flex items-center justify-between mt-2">
                <p class="text-amber-600 font-bold">${parseFloat(item.price).toFixed(2)} €</p>
                <button type="button" data-quick-add="${item.id}"
                    class="bg-cyan-800 hover:bg-cyan-900 text-white text-xs font-bold w-8 h-8 rounded-full cursor-pointer">+</button>
            </div>
        </div>
    `).join('');

    container.querySelectorAll("[data-open-item]").forEach(el => {
        el.addEventListener("click", () => openItemModal(el.getAttribute("data-open-item")));
    });

    container.querySelectorAll("[data-quick-add]").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            addToCart(btn.getAttribute("data-quick-add"));
        });
    });
}

// ---------- Модал за детайли на артикул ----------
let currentModalItemId = null;

function openItemModal(itemId) {
    const item = cachedItems.find(i => String(i.id) === String(itemId));
    if (!item) return;

    currentModalItemId = itemId;

    const modal = document.getElementById("item-modal");
    const img = document.getElementById("item-modal-img");

    document.getElementById("item-modal-name").textContent = item.name || "Без име";
    document.getElementById("item-modal-desc").textContent = item.description || "";
    document.getElementById("item-modal-price").textContent = parseFloat(item.price).toFixed(2) + " €";

    if (item.image_url) {
        img.src = item.image_url;
        img.classList.remove("hidden");
    } else {
        img.classList.add("hidden");
    }

    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function closeItemModal() {
    const modal = document.getElementById("item-modal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
}

// ---------- Количка / поръчка ----------
let cart = {}; // { itemId: { item, qty } }

function addToCart(itemId, qty = 1) {
    const item = cachedItems.find(i => String(i.id) === String(itemId));
    if (!item) return;

    if (cart[itemId]) {
        cart[itemId].qty += qty;
    } else {
        cart[itemId] = { item, qty };
    }
    renderCartBadge();
}

function changeCartQty(itemId, delta) {
    if (!cart[itemId]) return;
    cart[itemId].qty += delta;
    if (cart[itemId].qty <= 0) {
        delete cart[itemId];
    }
    renderCartBadge();
    renderCartModal();
}

function getCartTotal() {
    return Object.values(cart).reduce((sum, entry) => sum + parseFloat(entry.item.price) * entry.qty, 0);
}

function getCartCount() {
    return Object.values(cart).reduce((sum, entry) => sum + entry.qty, 0);
}

function renderCartBadge() {
    const fab = document.getElementById("cart-fab");
    const count = document.getElementById("cart-fab-count");
    const total = document.getElementById("cart-fab-total");
    if (!fab) return;

    const cartCount = getCartCount();
    if (cartCount > 0) {
        fab.classList.remove("hidden");
        fab.classList.add("flex");
    } else {
        fab.classList.add("hidden");
        fab.classList.remove("flex");
    }
    if (count) count.textContent = cartCount;
    if (total) total.textContent = `· ${getCartTotal().toFixed(2)} €`;
}

function renderCartModal() {
    const list = document.getElementById("cart-items-list");
    const totalEl = document.getElementById("cart-total");
    if (!list) return;

    const entries = Object.entries(cart);
    if (entries.length === 0) {
        list.innerHTML = '<p class="text-center text-gray-400 text-sm py-6">Количката е празна.</p>';
    } else {
        list.innerHTML = entries.map(([itemId, entry]) => `
            <div class="flex items-center justify-between gap-3 border-b border-gray-50 pb-3">
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-sm truncate">${entry.item.name || 'Без име'}</p>
                    <p class="text-xs text-gray-400">${parseFloat(entry.item.price).toFixed(2)} € / бр.</p>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <button type="button" data-qty-change="${itemId}" data-delta="-1"
                        class="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 font-bold cursor-pointer">−</button>
                    <span class="font-bold text-sm w-4 text-center">${entry.qty}</span>
                    <button type="button" data-qty-change="${itemId}" data-delta="1"
                        class="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 font-bold cursor-pointer">+</button>
                </div>
            </div>
        `).join('');

        list.querySelectorAll("[data-qty-change]").forEach(btn => {
            btn.addEventListener("click", () => {
                changeCartQty(btn.getAttribute("data-qty-change"), parseInt(btn.getAttribute("data-delta"), 10));
            });
        });
    }

    if (totalEl) totalEl.textContent = getCartTotal().toFixed(2) + " €";
}

function openCartModal() {
    renderCartModal();
    const modal = document.getElementById("cart-modal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function closeCartModal() {
    const modal = document.getElementById("cart-modal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
}

async function submitOrder() {
    const tableInput = document.getElementById("table-number-input");
    const errorEl = document.getElementById("order-error");
    const submitBtn = document.getElementById("submit-order-btn");

    const tableNumber = tableInput ? tableInput.value.trim() : "";
    if (errorEl) errorEl.classList.add("hidden");

    if (!tableNumber) {
        if (errorEl) {
            errorEl.textContent = "Моля, въведи номер на маса.";
            errorEl.classList.remove("hidden");
        }
        return;
    }

    if (getCartCount() === 0) {
        if (errorEl) {
            errorEl.textContent = "Количката е празна.";
            errorEl.classList.remove("hidden");
        }
        return;
    }

    const orderItems = Object.values(cart).map(entry => ({
        id: entry.item.id,
        name: entry.item.name,
        price: parseFloat(entry.item.price),
        qty: entry.qty
    }));

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "⏳ Изпращане...";
    }

    const { error } = await supabaseClient.from("orders").insert([{
        table_number: tableNumber,
        items: orderItems,
        total: getCartTotal(),
        status: "new"
    }]);

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Изпрати поръчката";
    }

    if (error) {
        if (errorEl) {
            errorEl.textContent = "Грешка при изпращане: " + error.message;
            errorEl.classList.remove("hidden");
        }
        return;
    }

    cart = {};
    renderCartBadge();
    closeCartModal();
    if (tableInput) tableInput.value = "";

    const successModal = document.getElementById("order-success-modal");
    if (successModal) {
        successModal.classList.remove("hidden");
        successModal.classList.add("flex");
    }
}

async function loadMenu() {
    const container = document.getElementById("menu-container");
    if (!container) return;

    const modalCloseBtn = document.getElementById("item-modal-close");
    if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeItemModal);

    const modalAddBtn = document.getElementById("item-modal-add-btn");
    if (modalAddBtn) {
        modalAddBtn.addEventListener("click", () => {
            if (currentModalItemId) addToCart(currentModalItemId);
            closeItemModal();
        });
    }

    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            renderMenu();
        });
    }

    const modal = document.getElementById("item-modal");
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target.id === "item-modal") closeItemModal();
        });
    }

    const cartFab = document.getElementById("cart-fab");
    if (cartFab) cartFab.addEventListener("click", openCartModal);

    const cartModalCloseBtn = document.getElementById("cart-modal-close");
    if (cartModalCloseBtn) cartModalCloseBtn.addEventListener("click", closeCartModal);

    const cartModal = document.getElementById("cart-modal");
    if (cartModal) {
        cartModal.addEventListener("click", (e) => {
            if (e.target.id === "cart-modal") closeCartModal();
        });
    }

    const submitOrderBtn = document.getElementById("submit-order-btn");
    if (submitOrderBtn) submitOrderBtn.addEventListener("click", submitOrder);

    const successCloseBtn = document.getElementById("order-success-close");
    if (successCloseBtn) {
        successCloseBtn.addEventListener("click", () => {
            const successModal = document.getElementById("order-success-modal");
            successModal.classList.add("hidden");
            successModal.classList.remove("flex");
        });
    }

    try {
        // 1. Вземане на името на заведението
        const { data: resData } = await supabaseClient
            .from("restaurant_settings")
            .select("value")
            .eq("key", "name")
            .maybeSingle();

        const titleEl = document.getElementById("restaurant-title");
        if (resData && titleEl) {
            cachedRestaurantName = resData.value;
            titleEl.textContent = resData.value;
        }

        // 1б. Фон на менюто (ако е зададен от админ панела)
        const { data: bgData } = await supabaseClient
            .from("restaurant_settings")
            .select("value")
            .eq("key", "background_image_url")
            .maybeSingle();

        if (bgData && bgData.value) {
            const bgPhoto = document.getElementById("bg-photo");
            const bgOverlay = document.getElementById("bg-overlay");
            const bgSun = document.getElementById("bg-sun");
            if (bgPhoto) {
                bgPhoto.style.backgroundImage = `url("${bgData.value}")`;
                bgPhoto.classList.remove("bg-gradient-to-b", "from-sky-200", "via-cyan-100", "to-amber-50");
            }
            if (bgOverlay) bgOverlay.classList.remove("hidden");
            if (bgSun) bgSun.classList.add("hidden");
        }

        // 2. Вземане на менюто
        const { data, error } = await supabaseClient
            .from("menu_items")
            .select("*")
            .eq("is_available", true);

        if (error) {
            container.innerHTML = `<p style="color:red; text-align:center;">Грешка: ${error.message}</p>`;
            return;
        }

        cachedItems = data || [];
        renderCategoryButtons();
        renderMenu();
    } catch (e) {
        console.error("Критична грешка:", e);
    }
}

document.addEventListener("DOMContentLoaded", loadMenu);