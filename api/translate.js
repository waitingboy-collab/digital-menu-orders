// api/translate.js
// Vercel serverless функция — превежда текстове през DeepL API.
// API ключът се пази само тук (environment variable), никога в клиентския код.
//
// НАСТРОЙКА (задължителна преди да проработи):
// 1. Регистрирай безплатен акаунт в https://www.deepl.com/pro-api
//    (Free tier: 500 000 знака/месец безплатно — напълно достатъчно за меню)
// 2. Копирай своя API ключ (завършва на ":fx" за free акаунт)
// 3. Vercel Dashboard → твоя проект → Settings → Environment Variables
//    → добави DEEPL_API_KEY = твоя ключ → Redeploy проекта

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Позволен е само POST" });
  }

  const { texts, targetLang } = req.body;

  if (!Array.isArray(texts) || texts.length === 0 || !targetLang) {
    return res.status(400).json({ error: "Липсват texts (масив) или targetLang" });
  }

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "DEEPL_API_KEY не е зададен в Vercel environment variables" });
  }

  // Free акаунтите ползват друг адрес (api-free.deepl.com) от Pro (api.deepl.com)
  const apiUrl = apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: texts,
        target_lang: targetLang.toUpperCase(),
        source_lang: "BG",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `DeepL грешка: ${errText}` });
    }

    const data = await response.json();
    const translations = data.translations.map(t => t.text);

    return res.status(200).json({ translations });
  } catch (e) {
    return res.status(500).json({ error: "Грешка при връзка с DeepL: " + e.message });
  }
}
