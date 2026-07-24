const SUPABASE_URL = "https://rhqirgmxfaeqsihuvqym.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJocWlyZ214ZmFlcXNpaHV2cXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5OTUwOTQsImV4cCI6MjA5ODU3MTA5NH0.ua9LKCdXgTP9cp48t_DGmHyixBqk4F0dJf424B20vec";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STORAGE_BUCKET = "menu-images";

// Функция за извличане и показване на артикулите
async function fetchAndRender() {
    const { data, error } = await supabaseClient.from("menu_items").select("*");
    if (error) {
        console.error("Грешка при зареждане:", error.message);
        return;
    }

    const tbody = document.getElementById("admin-items-table");
    const countEl = document.getElementById("items-count");
    if (tbody) {
        tbody.innerHTML = "";
        if (countEl) countEl.textContent = `${data.length} позиции`;

        data.forEach(item => {
            const available = item.is_available !== false; // treat null as available
            const thumb = item.image_url
                ? `<img src="${item.image_url}" alt="" class="w-12 h-12 object-cover rounded-md">`
                : `<div class="w-12 h-12 rounded-md bg-gray-100 flex items-center justify-center text-gray-300 text-xs">няма</div>`;

            const hasStock = item.quantity !== null && item.quantity !== undefined;
            const qty = hasStock ? item.quantity : null;
            const stockCell = hasStock ? `
                <div class="flex items-center justify-center gap-1.5">
                    <button onclick="adjustStock('${item.id}', ${qty}, -1)"
                        class="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 font-bold text-xs cursor-pointer">−</button>
                    <span class="font-bold text-sm w-6 text-center ${qty === 0 ? 'text-red-600' : 'text-slate-700'}">${qty}</span>
                    <button onclick="adjustStock('${item.id}', ${qty}, 1)"
                        class="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 font-bold text-xs cursor-pointer">+</button>
                </div>
            ` : `<span class="text-xs text-gray-400">∞</span>`;

            tbody.innerHTML += `
                <tr class="border-b">
                    <td class="p-3">${thumb}</td>
                    <td class="p-3">${item.name || ''}</td>
                    <td class="p-3">${item.category || ''}</td>
                    <td class="p-3 font-bold">€${item.price || '0'}</td>
                    <td class="p-3 text-center">${stockCell}</td>
                    <td class="p-3 text-center">
                        <button onclick="toggleAvailability('${item.id}', ${available})"
                            class="px-2 py-1 rounded-full text-xs font-semibold ${available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                            ${available ? 'Наличен' : 'Изчерпан'}
                        </button>
                    </td>
                    <td class="p-3 text-right">
                        <button onclick="editItem('${item.id}', '${item.name || ''}', '${item.category || ''}', ${item.price || 0}, '${item.description || ''}', '${item.image_url || ''}', ${available}, ${qty === null ? 'null' : qty})" class="text-blue-600 mr-4">Редактирай</button>
                        <button onclick="deleteItem('${item.id}')" class="text-red-600">Изтрий</button>
                    </td>
                </tr>`;
        });
    }
}

// Бърза промяна на наличността директно от таблицата (+1 / -1)
window.adjustStock = async (id, currentQty, delta) => {
    const newQty = Math.max(0, currentQty + delta);
    const { error } = await supabaseClient
        .from("menu_items")
        .update({ quantity: newQty })
        .eq("id", id);

    if (error) {
        alert("Грешка при промяна на наличността: " + error.message);
        return;
    }
    fetchAndRender();
};

// Бързо превключване на наличност директно от таблицата
window.toggleAvailability = async (id, currentlyAvailable) => {
    const { error } = await supabaseClient
        .from("menu_items")
        .update({ is_available: !currentlyAvailable })
        .eq("id", id);

    if (error) {
        alert("Грешка при промяна на наличността: " + error.message);
        return;
    }
    fetchAndRender();
};

// Смалява и компресира снимката в браузъра, преди да я качи в Storage
function compressImage(file, maxWidth = 1200, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => { img.src = e.target.result; };
        reader.onerror = reject;

        img.onload = () => {
            let { width, height } = img;
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            canvas.getContext("2d").drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error("Компресирането на снимката не успя"));
                        return;
                    }
                    resolve(new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: "image/jpeg" }));
                },
                "image/jpeg",
                quality
            );
        };
        img.onerror = reject;

        reader.readAsDataURL(file);
    });
}

// Качване на снимка в Supabase Storage, връща публичен URL
async function uploadImageIfSelected() {
    const fileInput = document.getElementById("item-image-file");
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        // няма нова снимка - пази текущия URL от скритото поле
        return document.getElementById("item-image").value || null;
    }

    const originalFile = fileInput.files[0];
    let fileToUpload = originalFile;

    try {
        fileToUpload = await compressImage(originalFile);
    } catch (e) {
        console.warn("Компресирането не успя, качва се оригиналният файл:", e);
    }

    const filePath = `${Date.now()}_${fileToUpload.name.replace(/\s+/g, '_')}`;

    const { error: uploadError } = await supabaseClient
        .storage
        .from(STORAGE_BUCKET)
        .upload(filePath, fileToUpload, { upsert: true });

    if (uploadError) {
        alert("Грешка при качване на снимката: " + uploadError.message);
        return document.getElementById("item-image").value || null;
    }

    const { data: publicUrlData } = supabaseClient
        .storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
}

// Функция за редактиране (прехвърля данните във формата)
window.editItem = (id, name, cat, price, desc, img, available, qty) => {
    document.getElementById("item-id").value = id;
    document.getElementById("item-name").value = name;
    document.getElementById("item-category").value = cat;
    document.getElementById("item-price").value = price;
    document.getElementById("item-desc").value = desc;
    document.getElementById("item-image").value = img;

    const qtyInput = document.getElementById("item-quantity");
    if (qtyInput) qtyInput.value = (qty === null || qty === undefined) ? "" : qty;

    const availCheckbox = document.getElementById("item-available");
    if (availCheckbox) availCheckbox.checked = available;

    const preview = document.getElementById("item-image-preview");
    if (preview) {
        preview.src = img || "";
        preview.classList.toggle("hidden", !img);
    }

    document.getElementById("form-title").textContent = "Редактиране на артикул";
    document.getElementById("submit-form-btn").textContent = "💾 Запази промените";
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Функция за изтриване
window.deleteItem = async (id) => {
    if(confirm("Сигурен ли си, че искаш да изтриеш този артикул?")) {
        await supabaseClient.from("menu_items").delete().eq("id", id);
        fetchAndRender();
    }
};

// Зарежда текущото име на заведението в полето
async function loadRestaurantName() {
    const input = document.getElementById("restaurant-name-input");
    if (!input) return;

    const { data, error } = await supabaseClient
        .from("restaurant_settings")
        .select("value")
        .eq("key", "name")
        .maybeSingle();

    if (!error && data) {
        input.value = data.value;
    }
}

// Записва новото име на заведението
async function saveRestaurantName() {
    const input = document.getElementById("restaurant-name-input");
    const btn = document.getElementById("save-res-name-btn");
    if (!input) return;

    const newName = input.value.trim();
    if (!newName) {
        alert("Моля, въведете име на заведението.");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = "⏳ Запазване...";
    }

    const { error } = await supabaseClient
        .from("restaurant_settings")
        .upsert({ key: "name", value: newName }, { onConflict: "key" });

    if (btn) {
        btn.disabled = false;
        btn.textContent = "💾 Запази името";
    }

    if (error) {
        alert("Грешка при запазване на името: " + error.message);
    } else {
        alert("Името е запазено успешно!");
    }
}

// Зарежда текущия фон на менюто (ако има) в превюто
async function loadBackgroundImage() {
    const preview = document.getElementById("bg-image-preview");
    if (!preview) return;

    const { data, error } = await supabaseClient
        .from("restaurant_settings")
        .select("value")
        .eq("key", "background_image_url")
        .maybeSingle();

    if (!error && data && data.value) {
        preview.src = data.value;
        preview.classList.remove("hidden");
    }
}

// Записва новата фонова снимка в Storage + Supabase
async function saveBackgroundImage() {
    const fileInput = document.getElementById("bg-image-file");
    const btn = document.getElementById("save-bg-btn");

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert("Моля, избери снимка първо.");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = "⏳ Качване...";
    }

    let fileToUpload = fileInput.files[0];
    try {
        fileToUpload = await compressImage(fileToUpload, 1600, 0.8);
    } catch (e) {
        console.warn("Компресирането не успя, качва се оригиналният файл:", e);
    }

    const filePath = `bg_${Date.now()}_${fileToUpload.name.replace(/\s+/g, '_')}`;

    const { error: uploadError } = await supabaseClient
        .storage
        .from(STORAGE_BUCKET)
        .upload(filePath, fileToUpload, { upsert: true });

    if (uploadError) {
        alert("Грешка при качване на фона: " + uploadError.message);
        if (btn) { btn.disabled = false; btn.textContent = "🖼️ Запази фона"; }
        return;
    }

    const { data: publicUrlData } = supabaseClient
        .storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

    const { error: saveError } = await supabaseClient
        .from("restaurant_settings")
        .upsert({ key: "background_image_url", value: publicUrlData.publicUrl }, { onConflict: "key" });

    if (btn) { btn.disabled = false; btn.textContent = "🖼️ Запази фона"; }

    if (saveError) {
        alert("Грешка при запазване на фона: " + saveError.message);
        return;
    }

    const preview = document.getElementById("bg-image-preview");
    if (preview) {
        preview.src = publicUrlData.publicUrl;
        preview.classList.remove("hidden");
    }
    alert("Фонът е запазен успешно!");
}

// Премахва фоновата снимка (връща менюто към морския пейзаж по подразбиране)
async function removeBackgroundImage() {
    if (!confirm("Да премахна ли фоновата снимка на менюто?")) return;

    const { error } = await supabaseClient
        .from("restaurant_settings")
        .upsert({ key: "background_image_url", value: "" }, { onConflict: "key" });

    if (error) {
        alert("Грешка: " + error.message);
        return;
    }

    const preview = document.getElementById("bg-image-preview");
    if (preview) preview.classList.add("hidden");
    const fileInput = document.getElementById("bg-image-file");
    if (fileInput) fileInput.value = "";
    alert("Фонът е премахнат.");
}

// ---------- Статистика на продажбите ----------
function getStatsStartDate(period) {
    const now = new Date();
    if (period === "today") {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return start.toISOString();
    }
    if (period === "week") {
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    }
    if (period === "month") {
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
    return null; // "all"
}

async function loadSalesStats() {
    const periodSelect = document.getElementById("stats-period");
    const period = periodSelect ? periodSelect.value : "today";
    const startIso = getStatsStartDate(period);

    let query = supabaseClient
        .from("orders")
        .select("*")
        .eq("status", "done");

    if (startIso) {
        query = query.gte("created_at", startIso);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Грешка при зареждане на статистиката:", error.message);
        return;
    }

    const orders = data || [];
    const perItem = {}; // { name: { qty, revenue } }
    let totalRevenue = 0;
    let totalItemsSold = 0;

    orders.forEach(order => {
        const items = Array.isArray(order.items) ? order.items : [];
        items.forEach(it => {
            const name = it.name || "Без име";
            const qty = Number(it.qty) || 0;
            const revenue = (Number(it.price) || 0) * qty;

            if (!perItem[name]) perItem[name] = { qty: 0, revenue: 0 };
            perItem[name].qty += qty;
            perItem[name].revenue += revenue;

            totalItemsSold += qty;
            totalRevenue += revenue;
        });
    });

    const ordersCountEl = document.getElementById("stats-orders-count");
    const itemsCountEl = document.getElementById("stats-items-count");
    const totalRevenueEl = document.getElementById("stats-total-revenue");
    if (ordersCountEl) ordersCountEl.textContent = orders.length;
    if (itemsCountEl) itemsCountEl.textContent = totalItemsSold;
    if (totalRevenueEl) totalRevenueEl.textContent = totalRevenue.toFixed(2) + " €";

    const tbody = document.getElementById("stats-items-table");
    const emptyEl = document.getElementById("stats-empty");
    if (!tbody) return;

    const sortedItems = Object.entries(perItem).sort((a, b) => b[1].qty - a[1].qty);

    if (sortedItems.length === 0) {
        tbody.innerHTML = "";
        if (emptyEl) emptyEl.classList.remove("hidden");
        return;
    }
    if (emptyEl) emptyEl.classList.add("hidden");

    tbody.innerHTML = sortedItems.map(([name, stats]) => `
        <tr>
            <td class="p-2">${name}</td>
            <td class="p-2 text-center font-bold">${stats.qty}</td>
            <td class="p-2 text-right font-bold text-amber-600">${stats.revenue.toFixed(2)} €</td>
        </tr>
    `).join('');
}

// ============================================================
// СКЛАД
// ============================================================

let receiptLineCount = 0;
let cachedInventoryItems = []; // за попълване на select-ите в реда

function stockLevelInfo(item) {
    if (!item.min_stock_alert || item.min_stock_alert <= 0) {
        return { label: "Наред", cls: "bg-green-100 text-green-700" };
    }
    const ratio = item.current_stock / item.min_stock_alert;
    if (ratio <= 1) return { label: "Критично", cls: "bg-red-100 text-red-700" };
    if (ratio <= 1.6) return { label: "Ниско", cls: "bg-amber-100 text-amber-700" };
    return { label: "Наред", cls: "bg-green-100 text-green-700" };
}

// Зарежда и показва наличностите
async function fetchAndRenderInventory() {
    const { data, error } = await supabaseClient
        .from("inventory_items")
        .select("*")
        .eq("is_active", true)
        .order("name");

    if (error) {
        console.error("Грешка при зареждане на склада:", error.message);
        return;
    }

    cachedInventoryItems = data || [];

    const tbody = document.getElementById("inventory-table");
    const countEl = document.getElementById("inventory-count");
    if (countEl) countEl.textContent = `${cachedInventoryItems.length} артикула`;

    if (tbody) {
        tbody.innerHTML = cachedInventoryItems.map(item => {
            const level = stockLevelInfo(item);
            const price = item.last_purchase_price != null ? `${Number(item.last_purchase_price).toFixed(2)} €` : "—";
            const usage = item.usage_per_sale || 1;
            const servings = usage > 0 ? Math.floor(item.current_stock / usage) : null;
            const servingsCell = (item.menu_item_id && usage !== 1)
                ? `${servings} бр.`
                : `<span class="text-gray-400">—</span>`;
            return `
                <tr>
                    <td class="p-3 font-bold">${item.name}</td>
                    <td class="p-3 text-center">
                        <div class="flex items-center justify-center gap-1.5">
                            <button onclick="adjustInventoryStock('${item.id}', ${item.current_stock}, -1)"
                                class="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 font-bold text-xs cursor-pointer">−</button>
                            <span class="font-bold text-sm min-w-[3.5rem] text-center">${item.current_stock} ${item.unit || 'бр'}</span>
                            <button onclick="adjustInventoryStock('${item.id}', ${item.current_stock}, 1)"
                                class="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 font-bold text-xs cursor-pointer">+</button>
                        </div>
                    </td>
                    <td class="p-3 text-center">${servingsCell}</td>
                    <td class="p-3">
                        <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${level.cls}">${level.label}</span>
                    </td>
                    <td class="p-3 text-right">${price}</td>
                    <td class="p-3 text-right">
                        <button onclick='editInventoryItem(${JSON.stringify(item)})' class="text-blue-600 mr-3 text-xs font-bold cursor-pointer">Редактирай</button>
                        <button onclick="deleteInventoryItem('${item.id}')" class="text-red-600 text-xs font-bold cursor-pointer">Деактивирай</button>
                    </td>
                </tr>`;
        }).join('');
    }

    populateReceiptLineSelects();
}

// Зарежда доставчиците в select-а на формата
async function loadSuppliersIntoForm() {
    const select = document.getElementById("receipt-supplier");
    if (!select) return;

    const { data, error } = await supabaseClient.from("suppliers").select("*").order("name");
    if (error) {
        console.error("Грешка при зареждане на доставчици:", error.message);
        return;
    }

    select.innerHTML = `<option value="">— без доставчик —</option>` +
        (data || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

// Добавя нов ред в списъка "Артикули" във формата за зареждане
function addReceiptLine() {
    receiptLineCount++;
    const id = `line-${receiptLineCount}`;
    const container = document.getElementById("receipt-lines");
    if (!container) return;

    const options = cachedInventoryItems.map(it => `<option value="${it.id}">${it.name}</option>`).join('');

    const row = document.createElement("div");
    row.id = id;
    row.className = "flex items-center gap-2";
    row.innerHTML = `
        <select class="receipt-line-item flex-1 bg-white border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-slate-500">
            ${options}
        </select>
        <input type="number" step="0.01" min="0" placeholder="Кол." class="receipt-line-qty w-20 bg-white border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-slate-500">
        <input type="number" step="0.01" min="0" placeholder="Цена €" class="receipt-line-price w-24 bg-white border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-slate-500">
        <button type="button" class="remove-line-btn text-red-500 hover:text-red-700 font-bold px-1 cursor-pointer">✕</button>
    `;
    container.appendChild(row);

    row.querySelector(".remove-line-btn").addEventListener("click", () => row.remove());
}

function populateReceiptLineSelects() {
    // Обновява опциите във вече съществуващи редове, ако артикулите са се презаредили
    document.querySelectorAll(".receipt-line-item").forEach(select => {
        const current = select.value;
        select.innerHTML = cachedInventoryItems.map(it => `<option value="${it.id}">${it.name}</option>`).join('');
        if (current) select.value = current;
    });
}

// Записва зареждането — глава + редове; тригерът в базата обновява наличността автоматично
async function submitReceipt() {
    const errorEl = document.getElementById("receipt-error");
    const saveBtn = document.getElementById("save-receipt-btn");
    if (errorEl) errorEl.classList.add("hidden");

    const supplierId = document.getElementById("receipt-supplier").value || null;
    const invoiceNumber = document.getElementById("receipt-invoice").value.trim() || null;

    const lineRows = document.querySelectorAll("#receipt-lines > div");
    const lines = [];
    lineRows.forEach(row => {
        const itemId = row.querySelector(".receipt-line-item").value;
        const qty = parseFloat(row.querySelector(".receipt-line-qty").value);
        const price = parseFloat(row.querySelector(".receipt-line-price").value);
        if (itemId && qty > 0 && price >= 0) {
            lines.push({ inventory_item_id: itemId, quantity: qty, purchase_price: price });
        }
    });

    if (lines.length === 0) {
        if (errorEl) {
            errorEl.textContent = "Добави поне един ред с валидно количество и цена.";
            errorEl.classList.remove("hidden");
        }
        return;
    }

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = "⏳ Запазване...";
    }

    const { data: receipt, error: receiptErr } = await supabaseClient
        .from("stock_receipts")
        .insert({ supplier_id: supplierId, invoice_number: invoiceNumber })
        .select()
        .single();

    if (receiptErr) {
        if (errorEl) {
            errorEl.textContent = receiptErr.message;
            errorEl.classList.remove("hidden");
        }
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "💾 Запази зареждане"; }
        return;
    }

    const rows = lines.map(l => ({ ...l, receipt_id: receipt.id }));
    const { error: linesErr } = await supabaseClient.from("stock_receipt_items").insert(rows);

    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "💾 Запази зареждане"; }

    if (linesErr) {
        if (errorEl) {
            errorEl.textContent = linesErr.message;
            errorEl.classList.remove("hidden");
        }
        return;
    }

    // Успех — нулира формата и презарежда таблицата
    document.getElementById("receipt-lines").innerHTML = "";
    document.getElementById("receipt-invoice").value = "";
    document.getElementById("receipt-form-wrapper").classList.add("hidden");
    fetchAndRenderInventory();
}

// Зарежда menu_items в select-а за връзка с нов складов артикул
async function loadMenuItemsIntoInventoryForm() {
    const select = document.getElementById("new-item-menu-link");
    if (!select) return;

    const { data, error } = await supabaseClient.from("menu_items").select("id, name").order("name");
    if (error) {
        console.error("Грешка при зареждане на менюто:", error.message);
        return;
    }

    select.innerHTML = `<option value="">— без връзка с менюто —</option>` +
        (data || []).map(m => `<option value="${m.id}">${m.name}</option>`).join('');

    // При избор на продукт от менюто, автоматично предлага същото име за складовия артикул
    select.addEventListener("change", () => {
        const nameInput = document.getElementById("new-item-name");
        const selectedOption = select.options[select.selectedIndex];
        if (nameInput && !nameInput.value && select.value) {
            nameInput.value = selectedOption.textContent;
        }
    });
}

// Записва нов доставчик
async function submitNewSupplier() {
    const errorEl = document.getElementById("supplier-error");
    const saveBtn = document.getElementById("save-supplier-btn");
    if (errorEl) errorEl.classList.add("hidden");

    const name = document.getElementById("new-supplier-name").value.trim();
    const contact = document.getElementById("new-supplier-contact").value.trim() || null;

    if (!name) {
        if (errorEl) {
            errorEl.textContent = "Въведи име на доставчика.";
            errorEl.classList.remove("hidden");
        }
        return;
    }

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "⏳ Запазване..."; }

    const { error } = await supabaseClient.from("suppliers").insert({ name, contact });

    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "💾 Запази доставчик"; }

    if (error) {
        if (errorEl) {
            errorEl.textContent = error.message;
            errorEl.classList.remove("hidden");
        }
        return;
    }

    document.getElementById("new-supplier-name").value = "";
    document.getElementById("new-supplier-contact").value = "";
    document.getElementById("supplier-form-wrapper").classList.add("hidden");
    loadSuppliersIntoForm();
}

// Бърза ръчна корекция на наличността директно от таблицата (+1 / -1)
window.adjustInventoryStock = async (id, currentStock, delta) => {
    const newStock = Math.max(0, Number(currentStock) + delta);

    const { error: updateErr } = await supabaseClient
        .from("inventory_items")
        .update({ current_stock: newStock, updated_at: new Date().toISOString() })
        .eq("id", id);

    if (updateErr) {
        alert("Грешка при промяна на наличността: " + updateErr.message);
        return;
    }

    // Записва движението за одиторска следа
    await supabaseClient.from("stock_movements").insert({
        inventory_item_id: id,
        change_amount: delta,
        reason: "adjustment"
    });

    fetchAndRenderInventory();
};

// Отваря формата предварително попълнена за редакция на съществуващ артикул
window.editInventoryItem = (item) => {
    document.getElementById("editing-inventory-item-id").value = item.id;
    document.getElementById("new-item-menu-link").value = item.menu_item_id || "";
    document.getElementById("new-item-name").value = item.name || "";
    document.getElementById("new-item-unit").value = item.unit || "бр";
    document.getElementById("new-item-stock").value = item.current_stock != null ? item.current_stock : 0;
    document.getElementById("new-item-min-stock").value = item.min_stock_alert || "";
    document.getElementById("new-item-usage").value = item.usage_per_sale != null ? item.usage_per_sale : 1;

    document.getElementById("inventory-item-form-title").textContent = "Редактиране на складов артикул";
    document.getElementById("save-inventory-item-btn").textContent = "💾 Запази промените";

    updateUsageHint();
    document.getElementById("inventory-item-form-wrapper").classList.remove("hidden");
    window.scrollTo({ top: document.getElementById("inventory-item-form-wrapper").offsetTop - 80, behavior: 'smooth' });
};

// Деактивира складов артикул (не изтрива физически — историята на
// зарежданията остава, а артикулът просто изчезва от активния списък)
window.deleteInventoryItem = async (id) => {
    if (!confirm("Да деактивирам ли този складов артикул? Историята на зарежданията се запазва, но артикулът вече няма да е активен.")) return;

    const { error } = await supabaseClient.from("inventory_items").update({ is_active: false }).eq("id", id);
    if (error) {
        alert("Грешка при деактивиране: " + error.message);
        return;
    }
    fetchAndRenderInventory();
};

// Показва изчислен брой порции при въвеждане на разход за 1 продажба
function updateUsageHint() {
    const usageInput = document.getElementById("new-item-usage");
    const unitSelect = document.getElementById("new-item-unit");
    const hintEl = document.getElementById("usage-calc-hint");
    if (!usageInput || !hintEl) return;

    const usage = parseFloat(usageInput.value);
    const unit = unitSelect ? unitSelect.value : "бр";

    if (usage > 0 && usage !== 1) {
        const servingsPerUnit = Math.floor(1 / usage);
        hintEl.textContent = `= ${servingsPerUnit} продажби от 1 ${unit}`;
    } else {
        hintEl.textContent = "Остави 1, ако продажбата = 1 цяла единица (напр. 1 бутилка бира)";
    }
}

// Нулира формата обратно в режим "нов артикул"
function resetInventoryItemForm() {
    document.getElementById("editing-inventory-item-id").value = "";
    document.getElementById("new-item-menu-link").value = "";
    document.getElementById("new-item-name").value = "";
    document.getElementById("new-item-unit").value = "бр";
    document.getElementById("new-item-stock").value = "";
    document.getElementById("new-item-min-stock").value = "";
    document.getElementById("new-item-usage").value = "";
    document.getElementById("inventory-item-form-title").textContent = "Нов складов артикул";
    document.getElementById("save-inventory-item-btn").textContent = "💾 Запази артикул";
    updateUsageHint();
}

// Записва нов складов артикул ИЛИ обновява съществуващ (в зависимост от editing-inventory-item-id)
async function submitNewInventoryItem() {
    const errorEl = document.getElementById("inventory-item-error");
    const saveBtn = document.getElementById("save-inventory-item-btn");
    if (errorEl) errorEl.classList.add("hidden");

    const editingId = document.getElementById("editing-inventory-item-id").value || null;
    const menuItemId = document.getElementById("new-item-menu-link").value || null;
    const name = document.getElementById("new-item-name").value.trim();
    const unit = document.getElementById("new-item-unit").value;
    const minStockRaw = document.getElementById("new-item-min-stock").value;
    const minStock = minStockRaw === "" ? 0 : parseFloat(minStockRaw);
    const stockRaw = document.getElementById("new-item-stock").value;
    const currentStock = stockRaw === "" ? 0 : parseFloat(stockRaw);
    const usageRaw = document.getElementById("new-item-usage").value;
    const usage = usageRaw === "" ? 1 : parseFloat(usageRaw);

    if (!name) {
        if (errorEl) {
            errorEl.textContent = "Въведи име на складовия артикул.";
            errorEl.classList.remove("hidden");
        }
        return;
    }

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "⏳ Запазване..."; }

    const payload = {
        menu_item_id: menuItemId,
        name,
        unit,
        min_stock_alert: minStock,
        usage_per_sale: usage,
        current_stock: currentStock
    };

    let error;
    if (editingId) {
        ({ error } = await supabaseClient.from("inventory_items").update(payload).eq("id", editingId));
    } else {
        ({ error } = await supabaseClient.from("inventory_items").insert(payload));
    }

    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = editingId ? "💾 Запази промените" : "💾 Запази артикул"; }

    if (error) {
        if (errorEl) {
            errorEl.textContent = error.message;
            errorEl.classList.remove("hidden");
        }
        return;
    }

    resetInventoryItemForm();
    document.getElementById("inventory-item-form-wrapper").classList.add("hidden");
    fetchAndRenderInventory();
}

// ============================================================
// ЕЗИЦИ / ПРЕВОД
// ============================================================

const AVAILABLE_LANGUAGES = [
    { code: "en", label: "English" },
    { code: "de", label: "Deutsch" },
    { code: "ru", label: "Русский" },
    { code: "el", label: "Ελληνικά" },
    { code: "ro", label: "Română" },
    { code: "tr", label: "Türkçe" },
    { code: "fr", label: "Français" },
    { code: "it", label: "Italiano" },
];

let enabledLanguages = [];

async function loadLanguageSettings() {
    const { data } = await supabaseClient
        .from("restaurant_settings")
        .select("value")
        .eq("key", "enabled_languages")
        .maybeSingle();

    enabledLanguages = data && data.value ? data.value.split(",").filter(Boolean) : [];

    const container = document.getElementById("language-checkboxes");
    if (!container) return;

    container.innerHTML = AVAILABLE_LANGUAGES.map(lang => `
        <label class="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm cursor-pointer">
            <input type="checkbox" class="language-checkbox" value="${lang.code}" ${enabledLanguages.includes(lang.code) ? "checked" : ""}>
            ${lang.label}
        </label>
    `).join('');
}

async function saveLanguageSettings() {
    const checked = Array.from(document.querySelectorAll(".language-checkbox:checked")).map(cb => cb.value);
    enabledLanguages = checked;

    const { error } = await supabaseClient
        .from("restaurant_settings")
        .upsert({ key: "enabled_languages", value: checked.join(",") }, { onConflict: "key" });

    if (error) {
        alert("Грешка при запазване: " + error.message);
        return;
    }
    alert("Езиците са запазени!");
}

// Вика собствената /api/translate serverless функция (DeepL зад нея, ключът е скрит там)
async function translateTexts(texts, targetLang) {
    const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts, targetLang }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Грешка при превод");
    return data.translations;
}

// Превежда цялото меню на всички избрани езици и кешира резултата в menu_items.translations
async function translateMenu() {
    const statusEl = document.getElementById("translate-status");
    const errorEl = document.getElementById("translate-error");
    const btn = document.getElementById("translate-menu-btn");

    if (errorEl) errorEl.classList.add("hidden");

    if (enabledLanguages.length === 0) {
        if (errorEl) { errorEl.textContent = "Избери поне един език и запази, преди да превеждаш."; errorEl.classList.remove("hidden"); }
        return;
    }

    const { data: items, error: fetchErr } = await supabaseClient.from("menu_items").select("*");
    if (fetchErr) {
        if (errorEl) { errorEl.textContent = fetchErr.message; errorEl.classList.remove("hidden"); }
        return;
    }
    if (!items || items.length === 0) return;

    btn.disabled = true;
    if (statusEl) statusEl.classList.remove("hidden");

    // Уникалните категории (превеждат се веднъж на категория, не по артикул)
    const uniqueCategories = [...new Set(items.map(it => (it.category || "").trim()).filter(Boolean))];

    const { data: catSettingData } = await supabaseClient
        .from("restaurant_settings")
        .select("value")
        .eq("key", "category_translations")
        .maybeSingle();

    let categoryTranslations = {};
    if (catSettingData && catSettingData.value) {
        try { categoryTranslations = JSON.parse(catSettingData.value); } catch (e) { categoryTranslations = {}; }
    }

    for (const lang of enabledLanguages) {
        if (statusEl) statusEl.textContent = `Превеждам на ${lang.toUpperCase()}...`;

        // Събира име+описание на всички артикули в един заявка (по-ефективно от превод на всеки поотделно)
        const names = items.map(it => it.name || "");
        const descriptions = items.map(it => it.description || "");

        try {
            const translatedNames = await translateTexts(names, lang);
            const translatedDescriptions = await translateTexts(descriptions, lang);

            // Записва резултата за всеки артикул поотделно (jsonb колона, не може bulk update лесно)
            for (let i = 0; i < items.length; i++) {
                const currentTranslations = items[i].translations || {};
                currentTranslations[lang] = {
                    name: translatedNames[i],
                    description: translatedDescriptions[i],
                };
                await supabaseClient
                    .from("menu_items")
                    .update({ translations: currentTranslations })
                    .eq("id", items[i].id);
                items[i].translations = currentTranslations; // за следващия език в цикъла
            }

            // Превежда категориите за този език (веднъж на категория)
            if (uniqueCategories.length > 0) {
                const translatedCategories = await translateTexts(uniqueCategories, lang);
                uniqueCategories.forEach((cat, idx) => {
                    if (!categoryTranslations[cat]) categoryTranslations[cat] = {};
                    categoryTranslations[cat][lang] = translatedCategories[idx];
                });
            }
        } catch (e) {
            if (errorEl) { errorEl.textContent = `Грешка при ${lang}: ${e.message}`; errorEl.classList.remove("hidden"); }
            btn.disabled = false;
            if (statusEl) statusEl.classList.add("hidden");
            return;
        }
    }

    // Записва преводите на категориите като настройка
    await supabaseClient
        .from("restaurant_settings")
        .upsert({ key: "category_translations", value: JSON.stringify(categoryTranslations) }, { onConflict: "key" });

    btn.disabled = false;
    if (statusEl) { statusEl.textContent = "Готово! Менюто е преведено на всички избрани езици."; }
    setTimeout(() => { if (statusEl) statusEl.classList.add("hidden"); }, 4000);
}

// ============================================================
// РЕЗЕРВАЦИИ
// ============================================================

async function fetchAndRenderReservations() {
    const { data, error } = await supabaseClient
        .from("reservations")
        .select("*")
        .neq("status", "cancelled")
        .order("reservation_date", { ascending: true })
        .order("reservation_time", { ascending: true });

    if (error) {
        console.error("Грешка при зареждане на резервациите:", error.message);
        return;
    }

    const reservations = data || [];
    const tbody = document.getElementById("reservations-table");
    const emptyEl = document.getElementById("reservations-empty");
    const countEl = document.getElementById("reservations-count");

    const pendingCount = reservations.filter(r => r.status === "pending").length;
    if (countEl) countEl.textContent = `${pendingCount} чакащи`;

    if (reservations.length === 0) {
        if (tbody) tbody.innerHTML = "";
        if (emptyEl) emptyEl.classList.remove("hidden");
        return;
    }
    if (emptyEl) emptyEl.classList.add("hidden");

    const statusStyles = {
        pending: "bg-amber-100 text-amber-700",
        confirmed: "bg-green-100 text-green-700",
    };
    const statusLabels = { pending: "Чакаща", confirmed: "Потвърдена" };

    if (tbody) {
        tbody.innerHTML = reservations.map(r => `
            <tr>
                <td class="p-3 font-bold">${r.customer_name}<br><span class="text-xs text-gray-400 font-normal">${r.phone}</span></td>
                <td class="p-3">${r.reservation_date} · ${r.reservation_time.slice(0,5)}</td>
                <td class="p-3 text-center">${r.party_size}</td>
                <td class="p-3 text-gray-500">${r.notes || '—'}</td>
                <td class="p-3 text-center">
                    <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${statusStyles[r.status] || ''}">${statusLabels[r.status] || r.status}</span>
                </td>
                <td class="p-3 text-right whitespace-nowrap">
                    ${r.status === "pending" ? `<button onclick="confirmReservation('${r.id}')" class="text-green-600 text-xs font-bold cursor-pointer mr-3">Потвърди</button>` : ''}
                    <button onclick="cancelReservation('${r.id}')" class="text-red-600 text-xs font-bold cursor-pointer">Откажи</button>
                </td>
            </tr>
        `).join('');
    }
}

window.confirmReservation = async (id) => {
    const { error } = await supabaseClient.from("reservations").update({ status: "confirmed" }).eq("id", id);
    if (error) { alert("Грешка: " + error.message); return; }
    fetchAndRenderReservations();
};

window.cancelReservation = async (id) => {
    if (!confirm("Да отменя ли тази резервация?")) return;
    const { error } = await supabaseClient.from("reservations").update({ status: "cancelled" }).eq("id", id);
    if (error) { alert("Грешка: " + error.message); return; }
    fetchAndRenderReservations();
};

// ============================================================
// СМЕНИ — персонал, работен график, каса
// ============================================================

let currentUserEmail = null;
let cachedStaffMembers = [];

function switchShiftsTab(tabName) {
    ["staff", "schedule", "cash"].forEach(name => {
        const panel = document.getElementById(`shifts-panel-${name}`);
        const btn = document.querySelector(`[data-shifts-tab="${name}"]`);
        if (panel) panel.classList.toggle("hidden", name !== tabName);
        if (btn) {
            btn.classList.toggle("bg-slate-100", name === tabName);
            btn.classList.toggle("text-slate-700", name === tabName);
            btn.classList.toggle("text-gray-500", name !== tabName);
        }
    });
    if (tabName === "cash") renderCashShiftStatus();
}

// ---------- Персонал ----------

async function fetchAndRenderStaff() {
    const { data, error } = await supabaseClient
        .from("staff_members")
        .select("*")
        .eq("is_active", true)
        .order("name");

    if (error) {
        console.error("Грешка при зареждане на персонала:", error.message);
        return;
    }

    cachedStaffMembers = data || [];

    const tbody = document.getElementById("staff-table");
    if (tbody) {
        tbody.innerHTML = cachedStaffMembers.map(s => `
            <tr>
                <td class="p-2 font-bold">${s.name}</td>
                <td class="p-2 text-gray-500">${s.role || '—'}</td>
                <td class="p-2 text-right">
                    <button onclick="deactivateStaff('${s.id}')" class="text-red-600 text-xs font-bold cursor-pointer">Деактивирай</button>
                </td>
            </tr>
        `).join('');
    }

    const shiftSelect = document.getElementById("new-shift-staff");
    if (shiftSelect) {
        const current = shiftSelect.value;
        shiftSelect.innerHTML = `<option value="">— избери служител —</option>` +
            cachedStaffMembers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        if (current) shiftSelect.value = current;
    }
}

async function addStaffMember() {
    const errorEl = document.getElementById("staff-error");
    if (errorEl) errorEl.classList.add("hidden");

    const name = document.getElementById("new-staff-name").value.trim();
    const role = document.getElementById("new-staff-role").value.trim() || null;

    if (!name) {
        if (errorEl) { errorEl.textContent = "Въведи име на служителя."; errorEl.classList.remove("hidden"); }
        return;
    }

    const { error } = await supabaseClient.from("staff_members").insert({ name, role });
    if (error) {
        if (errorEl) { errorEl.textContent = error.message; errorEl.classList.remove("hidden"); }
        return;
    }

    document.getElementById("new-staff-name").value = "";
    document.getElementById("new-staff-role").value = "";
    fetchAndRenderStaff();
}

window.deactivateStaff = async (id) => {
    if (!confirm("Да деактивирам ли този служител? Историята на смените му се запазва.")) return;
    const { error } = await supabaseClient.from("staff_members").update({ is_active: false }).eq("id", id);
    if (error) { alert("Грешка: " + error.message); return; }
    fetchAndRenderStaff();
};

// ---------- Работен график ----------

async function fetchAndRenderSchedule() {
    const { data, error } = await supabaseClient
        .from("staff_shifts")
        .select("*, staff_members(name)")
        .order("shift_date", { ascending: true })
        .limit(50);

    if (error) {
        console.error("Грешка при зареждане на графика:", error.message);
        return;
    }

    const tbody = document.getElementById("schedule-table");
    if (!tbody) return;

    tbody.innerHTML = (data || []).map(shift => `
        <tr>
            <td class="p-2 font-bold">${shift.staff_members ? shift.staff_members.name : '—'}</td>
            <td class="p-2">${shift.shift_date}</td>
            <td class="p-2 text-gray-500">${shift.start_time.slice(0,5)}–${shift.end_time.slice(0,5)}</td>
            <td class="p-2 text-right">
                <button onclick="deleteShift('${shift.id}')" class="text-red-600 text-xs font-bold cursor-pointer">Изтрий</button>
            </td>
        </tr>
    `).join('');
}

async function addShift() {
    const errorEl = document.getElementById("shift-error");
    if (errorEl) errorEl.classList.add("hidden");

    const staffId = document.getElementById("new-shift-staff").value;
    const date = document.getElementById("new-shift-date").value;
    const start = document.getElementById("new-shift-start").value;
    const end = document.getElementById("new-shift-end").value;

    if (!staffId || !date || !start || !end) {
        if (errorEl) { errorEl.textContent = "Попълни служител, дата и часове."; errorEl.classList.remove("hidden"); }
        return;
    }

    const { error } = await supabaseClient.from("staff_shifts").insert({
        staff_id: staffId, shift_date: date, start_time: start, end_time: end
    });

    if (error) {
        if (errorEl) { errorEl.textContent = error.message; errorEl.classList.remove("hidden"); }
        return;
    }

    document.getElementById("new-shift-date").value = "";
    document.getElementById("new-shift-start").value = "";
    document.getElementById("new-shift-end").value = "";
    fetchAndRenderSchedule();
}

window.deleteShift = async (id) => {
    if (!confirm("Да изтрия ли тази смяна от графика?")) return;
    const { error } = await supabaseClient.from("staff_shifts").delete().eq("id", id);
    if (error) { alert("Грешка: " + error.message); return; }
    fetchAndRenderSchedule();
};

// ---------- Каса ----------

async function getOpenCashShift() {
    const { data, error } = await supabaseClient
        .from("cash_shifts")
        .select("*")
        .eq("status", "open")
        .maybeSingle();

    if (error) {
        console.error("Грешка при проверка на касата:", error.message);
        return null;
    }
    return data;
}

// Изчислява сумата от завършени поръчки от даден момент насам (приема плащане в брой за всички)
async function calculateExpectedCash(openedAt, startingCash) {
    const { data, error } = await supabaseClient
        .from("orders")
        .select("total")
        .eq("status", "done")
        .gte("created_at", openedAt);

    if (error) {
        console.error("Грешка при изчисление на очакваната сума:", error.message);
        return startingCash;
    }

    const salesSum = (data || []).reduce((sum, o) => sum + Number(o.total || 0), 0);
    return startingCash + salesSum;
}

async function renderCashShiftStatus() {
    const container = document.getElementById("cash-shift-status");
    if (!container) return;

    const openShift = await getOpenCashShift();

    if (!openShift) {
        container.innerHTML = `
            <p class="text-sm text-gray-500 mb-3">В момента няма отворена смяна на касата.</p>
            <div class="flex items-center gap-2">
                <input type="number" step="0.01" min="0" id="opening-cash-input" placeholder="Начална сума в брой €" class="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-slate-500">
                <button id="open-cash-shift-btn" class="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap">▶️ Отвори смяна</button>
            </div>
        `;
        const openBtn = document.getElementById("open-cash-shift-btn");
        if (openBtn) openBtn.addEventListener("click", openCashShift);
    } else {
        const openedTime = new Date(openShift.opened_at).toLocaleString("bg-BG");
        const expected = await calculateExpectedCash(openShift.opened_at, Number(openShift.starting_cash));

        container.innerHTML = `
            <p class="text-sm font-bold text-green-700 mb-1">🟢 Смяна отворена</p>
            <p class="text-xs text-gray-500 mb-3">от ${openedTime}${openShift.opened_by ? ' · ' + openShift.opened_by : ''}</p>
            <div class="grid grid-cols-2 gap-2 mb-3 text-sm">
                <div class="bg-white rounded-lg p-2 border border-gray-100">
                    <p class="text-[10px] text-gray-400 uppercase font-bold">Начална сума</p>
                    <p class="font-bold">${Number(openShift.starting_cash).toFixed(2)} €</p>
                </div>
                <div class="bg-white rounded-lg p-2 border border-gray-100">
                    <p class="text-[10px] text-gray-400 uppercase font-bold">Очаквана в момента</p>
                    <p class="font-bold text-amber-600">${expected.toFixed(2)} €</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <input type="number" step="0.01" min="0" id="closing-cash-input" placeholder="Преброена сума в брой €" class="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-slate-500">
                <button id="close-cash-shift-btn" class="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap">⏹️ Затвори смяна</button>
            </div>
        `;
        const closeBtn = document.getElementById("close-cash-shift-btn");
        if (closeBtn) closeBtn.addEventListener("click", () => closeCashShift(openShift, expected));
    }
}

async function openCashShift() {
    const errorEl = document.getElementById("cash-error");
    if (errorEl) errorEl.classList.add("hidden");

    const startingRaw = document.getElementById("opening-cash-input").value;
    const startingCash = startingRaw === "" ? 0 : parseFloat(startingRaw);

    const { error } = await supabaseClient.from("cash_shifts").insert({
        starting_cash: startingCash,
        opened_by: currentUserEmail,
        status: "open"
    });

    if (error) {
        if (errorEl) { errorEl.textContent = error.message; errorEl.classList.remove("hidden"); }
        return;
    }

    renderCashShiftStatus();
}

async function closeCashShift(openShift, expected) {
    const errorEl = document.getElementById("cash-error");
    if (errorEl) errorEl.classList.add("hidden");

    const closingRaw = document.getElementById("closing-cash-input").value;
    if (closingRaw === "") {
        if (errorEl) { errorEl.textContent = "Въведи преброената сума в брой."; errorEl.classList.remove("hidden"); }
        return;
    }
    const closingCash = parseFloat(closingRaw);
    const difference = closingCash - expected;

    const { error } = await supabaseClient
        .from("cash_shifts")
        .update({
            closed_at: new Date().toISOString(),
            closing_cash: closingCash,
            expected_cash: expected,
            difference: difference,
            status: "closed"
        })
        .eq("id", openShift.id);

    if (error) {
        if (errorEl) { errorEl.textContent = error.message; errorEl.classList.remove("hidden"); }
        return;
    }

    const diffLabel = difference === 0 ? "точно" : (difference > 0 ? `излишък ${difference.toFixed(2)} €` : `недостиг ${Math.abs(difference).toFixed(2)} €`);
    alert(`Смяната е затворена. Резултат: ${diffLabel}`);

    renderCashShiftStatus();
    fetchAndRenderCashHistory();
}

async function fetchAndRenderCashHistory() {
    const { data, error } = await supabaseClient
        .from("cash_shifts")
        .select("*")
        .eq("status", "closed")
        .order("closed_at", { ascending: false })
        .limit(20);

    if (error) {
        console.error("Грешка при зареждане на историята на касата:", error.message);
        return;
    }

    const tbody = document.getElementById("cash-history-table");
    if (!tbody) return;

    tbody.innerHTML = (data || []).map(s => {
        const diff = Number(s.difference || 0);
        const diffClass = diff === 0 ? "text-gray-500" : (diff > 0 ? "text-green-600" : "text-red-600");
        return `
            <tr>
                <td class="p-2">${new Date(s.opened_at).toLocaleString("bg-BG")}</td>
                <td class="p-2">${s.closed_at ? new Date(s.closed_at).toLocaleString("bg-BG") : '—'}</td>
                <td class="p-2 text-right">${Number(s.starting_cash).toFixed(2)} €</td>
                <td class="p-2 text-right">${Number(s.expected_cash || 0).toFixed(2)} €</td>
                <td class="p-2 text-right">${Number(s.closing_cash || 0).toFixed(2)} €</td>
                <td class="p-2 text-right font-bold ${diffClass}">${diff.toFixed(2)} €</td>
            </tr>
        `;
    }).join('');
}

// ============================================================
// НАСТРОЙКИ НА МОДУЛИТЕ
// ============================================================

const MODULE_LABELS = {
    stats: "📊 Статистика на продажбите",
    inventory: "📦 Склад",
    languages: "🌍 Езици / превод",
    reservations: "📅 Резервации",
    shifts: "👥 Смени"
};

const DEFAULT_MODULES = {
    stats: true,
    inventory: true,
    languages: true,
    reservations: true,
    shifts: true
};

let enabledModules = { ...DEFAULT_MODULES };

async function loadModuleSettings() {
    const { data, error } = await supabaseClient
        .from("restaurant_settings")
        .select("value")
        .eq("key", "enabled_modules")
        .maybeSingle();

    if (!error && data && data.value) {
        try {
            enabledModules = { ...DEFAULT_MODULES, ...JSON.parse(data.value) };
        } catch (e) {
            enabledModules = { ...DEFAULT_MODULES };
        }
    } else {
        enabledModules = { ...DEFAULT_MODULES };
    }

    renderModuleToggleList();
    applyModuleVisibility();
}

function renderModuleToggleList() {
    const container = document.getElementById("module-toggle-list");
    if (!container) return;

    container.innerHTML = Object.keys(MODULE_LABELS).map(key => `
        <label class="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
            <span class="text-sm font-bold text-slate-700">${MODULE_LABELS[key]}</span>
            <input type="checkbox" class="module-toggle-checkbox w-4 h-4" data-key="${key}" ${enabledModules[key] ? "checked" : ""}>
        </label>
    `).join('');
}

async function saveModuleSettings() {
    const btn = document.getElementById("save-modules-btn");
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Запазване..."; }

    document.querySelectorAll(".module-toggle-checkbox").forEach(cb => {
        enabledModules[cb.dataset.key] = cb.checked;
    });

    const { error } = await supabaseClient
        .from("restaurant_settings")
        .upsert({ key: "enabled_modules", value: JSON.stringify(enabledModules) }, { onConflict: "key" });

    if (btn) { btn.disabled = false; btn.textContent = "💾 Запази настройките"; }

    if (error) {
        alert("Грешка при запазване на настройките: " + error.message);
        return;
    }

    applyModuleVisibility();
    alert("Настройките на модулите са запазени!");
}

function applyModuleVisibility() {
    Object.keys(MODULE_LABELS).forEach(key => {
        const section = document.getElementById(`module-section-${key}`);
        if (section) section.classList.toggle("hidden", enabledModules[key] === false);
    });
}

// Инициализация при зареждане на DOM
document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = document.getElementById("login-btn");
    const loginForm = document.getElementById("login-card");
    const adminDashboard = document.getElementById("admin-dashboard");
    const addForm = document.getElementById("add-item-form");

    // Логика за вход
    if (loginBtn) {
        loginBtn.addEventListener("click", async () => {
            const email = document.getElementById("login-email").value;
            const password = document.getElementById("login-password").value;

            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) {
                alert("Грешка при вход: " + error.message);
            } else {
                currentUserEmail = email;
                loginForm.classList.add("hidden");
                adminDashboard.classList.remove("hidden");
                fetchAndRender();
                loadRestaurantName();
                loadBackgroundImage();
                loadModuleSettings();
                loadSalesStats();
                fetchAndRenderInventory();
                loadSuppliersIntoForm();
                loadMenuItemsIntoInventoryForm();
                fetchAndRenderStaff();
                fetchAndRenderSchedule();
                fetchAndRenderCashHistory();
                renderCashShiftStatus();
                loadLanguageSettings();
                fetchAndRenderReservations();
            }
        });
    }

    // Логика за статистиката на продажбите
    const statsRefreshBtn = document.getElementById("stats-refresh-btn");
    if (statsRefreshBtn) statsRefreshBtn.addEventListener("click", loadSalesStats);
    const statsPeriodSelect = document.getElementById("stats-period");
    if (statsPeriodSelect) statsPeriodSelect.addEventListener("change", loadSalesStats);

    // Логика за запазване на името на заведението
    const saveResNameBtn = document.getElementById("save-res-name-btn");
    if (saveResNameBtn) {
        saveResNameBtn.addEventListener("click", saveRestaurantName);
    }

    // Логика за фона на менюто
    const saveBgBtn = document.getElementById("save-bg-btn");
    if (saveBgBtn) saveBgBtn.addEventListener("click", saveBackgroundImage);
    const removeBgBtn = document.getElementById("remove-bg-btn");
    if (removeBgBtn) removeBgBtn.addEventListener("click", removeBackgroundImage);

    // Логика за добавяне/редактиране
    if (addForm) {
        addForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const submitBtn = document.getElementById("submit-form-btn");
            const originalLabel = submitBtn ? submitBtn.textContent : "";
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "⏳ Качване...";
            }

            const id = document.getElementById("item-id").value;
            const imageUrl = await uploadImageIfSelected();
            const availCheckbox = document.getElementById("item-available");
            const qtyInput = document.getElementById("item-quantity");
            const qtyRaw = qtyInput ? qtyInput.value.trim() : "";

            const data = {
                name: document.getElementById("item-name").value,
                category: document.getElementById("item-category").value,
                price: parseFloat(document.getElementById("item-price").value),
                description: document.getElementById("item-desc").value,
                image_url: imageUrl,
                is_available: availCheckbox ? availCheckbox.checked : true,
                quantity: qtyRaw === "" ? null : parseInt(qtyRaw, 10)
            };

            if (id) {
                await supabaseClient.from("menu_items").update(data).eq("id", id);
            } else {
                await supabaseClient.from("menu_items").insert([data]);
            }

            addForm.reset();
            document.getElementById("item-id").value = "";
            const preview = document.getElementById("item-image-preview");
            if (preview) preview.classList.add("hidden");
            document.getElementById("form-title").textContent = "Добавяне на нов артикул";
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "➕ Добави към менюто";
            }
            fetchAndRender();
        });
    }

    // Логика за склада
    const toggleReceiptBtn = document.getElementById("toggle-receipt-form-btn");
    const receiptFormWrapper = document.getElementById("receipt-form-wrapper");
    if (toggleReceiptBtn && receiptFormWrapper) {
        toggleReceiptBtn.addEventListener("click", () => {
            receiptFormWrapper.classList.toggle("hidden");
        });
    }

    const cancelReceiptBtn = document.getElementById("cancel-receipt-btn");
    if (cancelReceiptBtn && receiptFormWrapper) {
        cancelReceiptBtn.addEventListener("click", () => {
            receiptFormWrapper.classList.add("hidden");
        });
    }

    const addLineBtn = document.getElementById("add-receipt-line-btn");
    if (addLineBtn) addLineBtn.addEventListener("click", addReceiptLine);

    const saveReceiptBtn = document.getElementById("save-receipt-btn");
    if (saveReceiptBtn) saveReceiptBtn.addEventListener("click", submitReceipt);

    // Форма за нов доставчик
    const toggleSupplierBtn = document.getElementById("toggle-supplier-form-btn");
    const supplierFormWrapper = document.getElementById("supplier-form-wrapper");
    if (toggleSupplierBtn && supplierFormWrapper) {
        toggleSupplierBtn.addEventListener("click", () => {
            supplierFormWrapper.classList.toggle("hidden");
        });
    }
    const cancelSupplierBtn = document.getElementById("cancel-supplier-btn");
    if (cancelSupplierBtn && supplierFormWrapper) {
        cancelSupplierBtn.addEventListener("click", () => {
            supplierFormWrapper.classList.add("hidden");
        });
    }
    const saveSupplierBtn = document.getElementById("save-supplier-btn");
    if (saveSupplierBtn) saveSupplierBtn.addEventListener("click", submitNewSupplier);

    // Форма за нов складов артикул
    const toggleInventoryItemBtn = document.getElementById("toggle-inventory-item-form-btn");
    const inventoryItemFormWrapper = document.getElementById("inventory-item-form-wrapper");
    if (toggleInventoryItemBtn && inventoryItemFormWrapper) {
        toggleInventoryItemBtn.addEventListener("click", () => {
            const willShow = inventoryItemFormWrapper.classList.contains("hidden");
            if (willShow) resetInventoryItemForm();
            inventoryItemFormWrapper.classList.toggle("hidden");
        });
    }
    const cancelInventoryItemBtn = document.getElementById("cancel-inventory-item-btn");
    if (cancelInventoryItemBtn && inventoryItemFormWrapper) {
        cancelInventoryItemBtn.addEventListener("click", () => {
            resetInventoryItemForm();
            inventoryItemFormWrapper.classList.add("hidden");
        });
    }
    const saveInventoryItemBtn = document.getElementById("save-inventory-item-btn");
    if (saveInventoryItemBtn) saveInventoryItemBtn.addEventListener("click", submitNewInventoryItem);

    const usageInput = document.getElementById("new-item-usage");
    if (usageInput) usageInput.addEventListener("input", updateUsageHint);
    const unitSelectForHint = document.getElementById("new-item-unit");
    if (unitSelectForHint) unitSelectForHint.addEventListener("change", updateUsageHint);

    // Смени — табове
    document.querySelectorAll(".shifts-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => switchShiftsTab(btn.getAttribute("data-shifts-tab")));
    });

    // Смени — персонал
    const addStaffBtn = document.getElementById("add-staff-btn");
    if (addStaffBtn) addStaffBtn.addEventListener("click", addStaffMember);

    // Смени — график
    const addShiftBtn = document.getElementById("add-shift-btn");
    if (addShiftBtn) addShiftBtn.addEventListener("click", addShift);

    // Настройки на модулите
    const saveModulesBtn = document.getElementById("save-modules-btn");
    if (saveModulesBtn) saveModulesBtn.addEventListener("click", saveModuleSettings);

    // Езици / превод
    const saveLanguagesBtn = document.getElementById("save-languages-btn");
    if (saveLanguagesBtn) saveLanguagesBtn.addEventListener("click", saveLanguageSettings);
    const translateMenuBtn = document.getElementById("translate-menu-btn");
    if (translateMenuBtn) translateMenuBtn.addEventListener("click", translateMenu);
});
