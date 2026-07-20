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
            return `
                <tr>
                    <td class="p-3 font-bold">${item.name}</td>
                    <td class="p-3 text-center">${item.current_stock} ${item.unit || 'бр'}</td>
                    <td class="p-3">
                        <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${level.cls}">${level.label}</span>
                    </td>
                    <td class="p-3 text-right">${price}</td>
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

// Записва нов складов артикул
async function submitNewInventoryItem() {
    const errorEl = document.getElementById("inventory-item-error");
    const saveBtn = document.getElementById("save-inventory-item-btn");
    if (errorEl) errorEl.classList.add("hidden");

    const menuItemId = document.getElementById("new-item-menu-link").value || null;
    const name = document.getElementById("new-item-name").value.trim();
    const unit = document.getElementById("new-item-unit").value;
    const minStockRaw = document.getElementById("new-item-min-stock").value;
    const minStock = minStockRaw === "" ? 0 : parseFloat(minStockRaw);

    if (!name) {
        if (errorEl) {
            errorEl.textContent = "Въведи име на складовия артикул.";
            errorEl.classList.remove("hidden");
        }
        return;
    }

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "⏳ Запазване..."; }

    const { error } = await supabaseClient.from("inventory_items").insert({
        menu_item_id: menuItemId,
        name,
        unit,
        min_stock_alert: minStock,
        current_stock: 0
    });

    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "💾 Запази артикул"; }

    if (error) {
        if (errorEl) {
            errorEl.textContent = error.message;
            errorEl.classList.remove("hidden");
        }
        return;
    }

    document.getElementById("new-item-menu-link").value = "";
    document.getElementById("new-item-name").value = "";
    document.getElementById("new-item-min-stock").value = "";
    document.getElementById("inventory-item-form-wrapper").classList.add("hidden");
    fetchAndRenderInventory();
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
                loginForm.classList.add("hidden");
                adminDashboard.classList.remove("hidden");
                fetchAndRender();
                loadRestaurantName();
                loadBackgroundImage();
                loadSalesStats();
                fetchAndRenderInventory();
                loadSuppliersIntoForm();
                loadMenuItemsIntoInventoryForm();
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
            inventoryItemFormWrapper.classList.toggle("hidden");
        });
    }
    const cancelInventoryItemBtn = document.getElementById("cancel-inventory-item-btn");
    if (cancelInventoryItemBtn && inventoryItemFormWrapper) {
        cancelInventoryItemBtn.addEventListener("click", () => {
            inventoryItemFormWrapper.classList.add("hidden");
        });
    }
    const saveInventoryItemBtn = document.getElementById("save-inventory-item-btn");
    if (saveInventoryItemBtn) saveInventoryItemBtn.addEventListener("click", submitNewInventoryItem);
});
