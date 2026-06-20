/**
 * Cambell Andijan — sayt serveri + AI chatbot API
 * Ishga tushirish: npm start
 * API kaliti: .env faylida GEMINI_API_KEY
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 5500;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_FALLBACKS = [
  GEMINI_MODEL,
  'gemini-2.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash',
].filter((m, i, a) => m && a.indexOf(m) === i);

const app = express();
app.use(express.json({ limit: '32kb' }));
app.use(express.static(ROOT));

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8'));
}

function buildContext(lang) {
  const knowledge = readJson('assets/data/chatbot-knowledge.json');
  const news = readJson('assets/data/news.json');
  const uz = readJson('assets/lang/uz.json');

  const entries = knowledge.entries[lang] || knowledge.entries.uz || [];
  const qaLines = entries.slice(0, 12).map((e) => `- ${e.answer.replace(/\n/g, ' ').slice(0, 200)}`);

  const newsLines = (news.articles || []).slice(0, 5).map((a) => {
    const t = a[lang]?.title || a.uz?.title || a.en?.title || '';
    return `- ${a.date}: ${t}`;
  });

  return `
KOMPANIYA: Cambell Andijan — Lanzhou Guangtong Andijon filiali
Telefon: +998 99 530 44 35 | Email: mirzakomilalimov02@gmail.com | Manzil: Andijon, O'zbekiston
Mahsulotlar: yangi energiya avtobuslari (8.5m–12m), elektr shahar avtobusi, koster, logistika V5, batareya va quvvatlash.
YANGILIKLAR: ${newsLines.join('; ')}
ASOSIY MA'LUMOTLAR: ${qaLines.join(' ')}
`.trim();
}

function detectMessageLang(text, siteLang = 'uz') {
  const t = String(text || '').trim();
  if (!t) return siteLang;
  if (/[а-яёА-ЯЁ]/.test(t)) return 'ru';
  if (/\b(salom|rahmat|avtobus|qancha|kerak|menga|haqida|yordam|qayer|narx|aloqa|qanday|kim|qayerda)\b/i.test(t)) return 'uz';
  if (/o[''`]|\bg[''`]|oʻ|gʻ/i.test(t)) return 'uz';
  if (/\b(the|is|are|was|want|buy|bus|hello|hi|how|what|where|price|contact|need|can|you|please|thanks|help|about)\b/i.test(t)) return 'en';
  if (/^[a-zA-Z0-9\s.,!?'+\-()]+$/u.test(t) && t.length > 2) return 'en';
  return siteLang;
}

function langInstruction(replyLang, siteLang) {
  const names = { uz: "o'zbek", ru: 'rus', en: 'ingliz' };
  return `MUHIM QOIDA: Javobni foydalanuvchi savolidagi tilga mos yozing.
- Inglizcha savol → inglizcha javob
- O'zbekcha savol → o'zbekcha javob
- Ruscha savol → ruscha javob
Agar savol tili noaniq bo'lsa, ${names[siteLang] || "o'zbek"} tilida javob bering.
Hozirgi savol tili: ${names[replyLang] || replyLang}.`;
}

function toGeminiHistory(history) {
  return (history || [])
    .slice(-10)
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '').slice(0, 2000) }],
    }))
    .filter((m) => m.parts[0].text);
}

async function callGeminiOnce(model, message, replyLang, siteLang, history) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    systemInstruction: {
      parts: [{
        text: `Siz Cambell Andijan kompaniyasining rasmiy AI yordamchisisiz (Lanzhou Guangtong Andijon filiali).
Faqat berilgan kompaniya ma'lumotlariga asoslanib javob bering.
Agar javobni bilmaysiz, +998 99 530 44 35 yoki mirzakomilalimov02@gmail.com ga murojaat qilishni ayting.
Qisqa, muloyim va professional bo'ling. Markdown ishlatmang.
${langInstruction(replyLang, siteLang)}

${buildContext(replyLang)}`,
      }],
    },
    contents: [
      ...toGeminiHistory(history),
      { role: 'user', parts: [{ text: message }] },
    ],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 800,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data?.error?.message || `API xatosi (${res.status})`);
    err.status = res.status;
    err.retryable = [429, 503, 500, 502].includes(res.status);
    throw err;
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  if (!text.trim()) throw new Error('Bo\'sh javob qaytdi');
  return text.trim();
}

async function callGemini(message, replyLang, siteLang, history) {
  let lastError = null;
  for (const model of MODEL_FALLBACKS) {
    try {
      return await callGeminiOnce(model, message, replyLang, siteLang, history);
    } catch (e) {
      lastError = e;
      if (e.status === 404 || e.retryable) {
        console.warn(`Model ${model} ishlamadi, keyingisiga o'tilmoqda...`);
        continue;
      }
      throw e;
    }
  }
  throw lastError || new Error('AI javob bera olmadi');
}

async function probeGemini() {
  if (!GEMINI_API_KEY) return { ready: false, model: null };
  for (const model of MODEL_FALLBACKS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'hi' }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      });
      const data = await res.json();
      if (res.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        return { ready: true, model };
      }
      if ([404, 429, 503].includes(res.status)) continue;
    } catch {
      continue;
    }
  }
  return { ready: false, model: null };
}

app.get('/api/health', async (_req, res) => {
  if (!GEMINI_API_KEY) {
    return res.json({ ok: true, ready: false, ai: false });
  }
  const probe = await probeGemini();
  res.json({
    ok: true,
    ready: probe.ready,
    ai: probe.ready,
    model: probe.model || GEMINI_MODEL,
  });
});

app.post('/api/chat', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY sozlanmagan. .env fayliga kalit qo\'ying.',
      fallback: true,
    });
  }

  const message = String(req.body?.message || '').trim();
  const siteLang = ['uz', 'ru', 'en'].includes(req.body?.lang) ? req.body.lang : 'uz';
  const replyLang = ['uz', 'ru', 'en'].includes(req.body?.messageLang)
    ? req.body.messageLang
    : detectMessageLang(message, siteLang);
  const history = Array.isArray(req.body?.history) ? req.body.history : [];

  if (!message) {
    return res.status(400).json({ error: 'Xabar bo\'sh bo\'lmasligi kerak' });
  }

  if (message.length > 2000) {
    return res.status(400).json({ error: 'Xabar juda uzun' });
  }

  try {
    const reply = await callGemini(message, replyLang, siteLang, history);
    res.json({ reply, source: 'ai', lang: replyLang });
  } catch (e) {
    console.error('AI error:', e.message);
    res.status(502).json({ error: e.message, fallback: true });
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log('  Cambell Andijan sayti ishga tushdi');
  console.log(`  Sayt:    http://localhost:${PORT}`);
  console.log(`  Chatbot: AI (${GEMINI_MODEL})`);
  if (!GEMINI_API_KEY) {
    console.log('');
    console.log('  ⚠ API kaliti topilmadi!');
    console.log('  1. .env.example faylini .env deb nusxalang');
    console.log('  2. https://aistudio.google.com/apikey dan kalit oling');
    console.log('  3. .env ichiga GEMINI_API_KEY=... yozing');
    console.log('  4. Serverni qayta ishga tushiring');
  } else {
    probeGemini().then((p) => {
      if (p.ready) console.log(`  ✓ AI chatbot tayyor (${p.model})`);
      else console.log('  ⚠ AI hozir ishlamayapti — model kvotasi yoki tarmoq muammosi');
    });
  }
  console.log('');
});
