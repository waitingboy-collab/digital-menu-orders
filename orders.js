const SUPABASE_URL = "https://rhqirgmxfaeqsihuvqym.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJocWlyZ214ZmFlcXNpaHV2cXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5OTUwOTQsImV4cCI6MjA5ODU3MTA5NH0.ua9LKCdXgTP9cp48t_DGmHyixBqk4F0dJf424B20vec";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let activeOrders = [];
let clockInterval = null;

// Извлича активните поръчки (нови или в процес), най-старите първо
async function fetchOrders() {
    const { data, error } = await supabaseClient
        .from("orders")
        .select("*")
        .in("status", ["new", "in_progress"])
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Грешка при зареждане на поръчките:", error.message);
        return;
    }

    activeOrders = data || [];
    renderOrders();
}

function timeAgoLabel(createdAt) {
    const seconds = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes < 1) return "току-що";
    if (minutes === 1) return "преди 1 мин";
    return `преди ${minutes} мин`;
}

function renderOrders() {
    const grid = document.getElementById("orders-grid");
    const empty = document.getElementById("empty-orders");
    const countEl = document.getElementById("orders-count");

    if (countEl) countEl.textContent = `${activeOrders.length} активни`;

    if (!grid) return;

    if (activeOrders.length === 0) {
        grid.innerHTML = "";
        if (empty) empty.classList.remove("hidden");
        return;
    }
    if (empty) empty.classList.add("hidden");

    grid.innerHTML = activeOrders.map(order => {
        const minutesAgo = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
        const isUrgent = minutesAgo >= 10;
        const items = Array.isArray(order.items) ? order.items : [];

        const itemsHtml = items.map(it => `
            <li class="flex justify-between text-sm">
                <span>${it.qty}× ${it.name || 'Без име'}</span>
                <span class="text-gray-400">${(parseFloat(it.price) * it.qty).toFixed(2)} €</span>
            </li>
        `).join('');

        return `
            <div class="bg-white rounded-2xl shadow-sm border-2 ${isUrgent ? 'border-red-300' : 'border-gray-100'} p-4 flex flex-col gap-3" data-order-id="${order.id}">
                <div class="flex items-center justify-between">
                    <span class="text-lg font-black text-slate-800">Маса ${order.table_number}</span>
                    <span class="text-xs font-bold ${isUrgent ? 'text-red-600' : 'text-gray-400'}" data-time-label>${timeAgoLabel(order.created_at)}</span>
                </div>
                <ul class="space-y-1 border-t border-b border-gray-50 py-2">${itemsHtml}</ul>
                <div class="flex items-center justify-between">
                    <span class="font-bold text-amber-600">${parseFloat(order.total).toFixed(2)} €</span>
                    <button data-complete-order="${order.id}" class="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer">
                        ✅ Готова
                    </button>
                </div>
            </div>
        `;
    }).join('');

    grid.querySelectorAll("[data-complete-order]").forEach(btn => {
        btn.addEventListener("click", () => completeOrder(btn.getAttribute("data-complete-order")));
    });
}

// Обновява само времевите етикети всяка секунда, без да пренарежда цялата решетка
function refreshTimeLabels() {
    document.querySelectorAll("[data-order-id]").forEach(card => {
        const orderId = card.getAttribute("data-order-id");
        const order = activeOrders.find(o => String(o.id) === String(orderId));
        if (!order) return;
        const label = card.querySelector("[data-time-label]");
        if (label) label.textContent = timeAgoLabel(order.created_at);
    });
}

async function completeOrder(orderId) {
    const { error } = await supabaseClient
        .from("orders")
        .update({ status: "done" })
        .eq("id", orderId);

    if (error) {
        alert("Грешка при отбелязване на поръчката: " + error.message);
        return;
    }
    // Realtime подписката ще обнови списъка автоматично; премахваме и локално за мигновен ефект
    activeOrders = activeOrders.filter(o => String(o.id) !== String(orderId));
    renderOrders();
}

// ============================================================
// НОТИФИКАЦИИ ЗА НОВИ ПОРЪЧКИ
// ============================================================

// Показва изскачаща карта за нова поръчка
function showOrderNotification(order) {
    const container = document.getElementById("order-notifications");
    if (!container) return;

    const card = document.createElement("div");
    card.className = "order-notification-card bg-white border border-gray-200 rounded-2xl shadow-lg p-4 flex items-start gap-3";

    const time = new Date(order.created_at || Date.now()).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });
    const total = Number(order.total || 0).toFixed(2);

    card.innerHTML = `
        <div class="w-9 h-9 rounded-full bg-amber-600 flex items-center justify-center flex-shrink-0 text-white font-bold">🔔</div>
        <div class="flex-1">
            <p class="text-sm font-bold text-slate-800">Нова поръчка — маса ${order.table_number || '?'}</p>
            <p class="text-xs text-gray-500 mt-0.5">${total} € · ${time}</p>
        </div>
        <button class="dismiss-notification-btn text-gray-300 hover:text-gray-600 font-bold cursor-pointer">✕</button>
    `;

    container.appendChild(card);
    card.querySelector(".dismiss-notification-btn").addEventListener("click", () => card.remove());

    // Автоматично изчезва след 15 секунди, ако не е затворена ръчно
    setTimeout(() => {
        if (card.parentElement) card.remove();
    }, 15000);
}

// Пуска кратък генериран звуков сигнал (без нужда от .mp3 файл)
function playNewOrderSound() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContextClass();

        // Два кратки "бийп" тона един след друг
        [880, 1046.5].forEach((freq, i) => {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.type = "sine";
            oscillator.frequency.value = freq;

            const startTime = ctx.currentTime + i * 0.15;
            gainNode.gain.setValueAtTime(0.3, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.start(startTime);
            oscillator.stop(startTime + 0.15);
        });
    } catch (e) {
        console.warn("Звукът не можа да се пусне:", e);
    }
}

// Показва браузърно системно известие (работи дори при минимизиран/друг таб)
function showBrowserNotification(order) {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    const total = Number(order.total || 0).toFixed(2);
    new Notification(`Нова поръчка — маса ${order.table_number || '?'}`, {
        body: `Сума: ${total} €`,
    });
}

// Живо следене на нови поръчки и промени в статуса
// (разширено с notification логика само за INSERT събития)
function subscribeToOrders() {
    supabaseClient
        .channel("orders-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
            if (payload.eventType === "INSERT") {
                showOrderNotification(payload.new);
                playNewOrderSound();
                showBrowserNotification(payload.new);
            }
            fetchOrders();
        })
        .subscribe();
}

document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = document.getElementById("login-btn");
    const loginForm = document.getElementById("login-card");
    const dashboard = document.getElementById("orders-dashboard");
    const logoutBtn = document.getElementById("logout-btn");
    const enableNotificationsBtn = document.getElementById("enable-notifications-btn");

    if (loginBtn) {
        loginBtn.addEventListener("click", async () => {
            const email = document.getElementById("login-email").value;
            const password = document.getElementById("login-password").value;
            const errorEl = document.getElementById("login-error");

            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) {
                if (errorEl) {
                    errorEl.textContent = "Грешка при вход: " + error.message;
                    errorEl.classList.remove("hidden");
                }
            } else {
                loginForm.classList.add("hidden");
                dashboard.classList.remove("hidden");
                if (logoutBtn) logoutBtn.classList.remove("hidden");
                fetchOrders();
                subscribeToOrders();
                clockInterval = setInterval(refreshTimeLabels, 1000);

                // Предлага разрешаване на системни известия, ако все още не са зададени
                if (enableNotificationsBtn && typeof Notification !== "undefined" && Notification.permission === "default") {
                    enableNotificationsBtn.classList.remove("hidden");
                }
            }
        });
    }

    if (enableNotificationsBtn) {
        enableNotificationsBtn.addEventListener("click", () => {
            Notification.requestPermission().then(() => {
                enableNotificationsBtn.classList.add("hidden");
            });
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            await supabaseClient.auth.signOut();
            window.location.reload();
        });
    }
});
