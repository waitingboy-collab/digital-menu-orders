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

            tbody.innerHTML += `
                <tr class="border-b">
                    <td class="p-3">${thumb}</td>
                    <td class="p-3">${item.name || ''}</td>
                    <td class="p-3">${item.category || ''}</td>
                    <td class="p-3 font-bold">€${item.price || '0'}</td>
                    <td class="p-3 text-center">
                        <button onclick="toggleAvailability('${item.id}', ${available})"
                            class="px-2 py-1 rounded-full text-xs font-semibold ${available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                            ${available ? 'Наличен' : 'Изчерпан'}
                        </button>
                    </td>
                    <td class="p-3 text-right">
                        <button onclick="editItem('${item.id}', '${item.name || ''}', '${item.category || ''}', ${item.price || 0}, '${item.description || ''}', '${item.image_url || ''}', ${available})" class="text-blue-600 mr-4">Редактирай</button>
                        <button onclick="deleteItem('${item.id}')" class="text-red-600">Изтрий</button>
                    </td>
                </tr>`;
        });
    }
}

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
window.editItem = (id, name, cat, price, desc, img, available) => {
    document.getElementById("item-id").value = id;
    document.getElementById("item-name").value = name;
    document.getElementById("item-category").value = cat;
    document.getElementById("item-price").value = price;
    document.getElementById("item-desc").value = desc;
    document.getElementById("item-image").value = img;

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
            }
        });
    }

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

            const data = {
                name: document.getElementById("item-name").value,
                category: document.getElementById("item-category").value,
                price: parseFloat(document.getElementById("item-price").value),
                description: document.getElementById("item-desc").value,
                image_url: imageUrl,
                is_available: availCheckbox ? availCheckbox.checked : true
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
});
