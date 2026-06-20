/**
 * Cambell Andijan — avtomatik tarjima (MyMemory API + cache)
 */
const CambellTranslate = (function () {
  const CACHE_KEY = 'cambell_auto_translations';
  const API = 'https://api.mymemory.translated.net/get';
  let cache = {};
  let queue = Promise.resolve();

  function loadCache() {
    try {
      cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    } catch {
      cache = {};
    }
  }

  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      /* storage full — ignore */
    }
  }

  function contentHash(en) {
    const s = `${en?.title || ''}|${en?.summary || ''}|${(en?.body || []).join('|')}`;
    let h = 0;
    for (let i = 0; i < s.length; i += 1) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return String(h);
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function enqueue(task) {
    const run = queue.then(task);
    queue = run.catch(() => {});
    return run;
  }

  async function translateText(text, from, to) {
    if (!text || !text.trim() || from === to) return text;

    const key = `${from}|${to}|${text}`;
    if (cache[key]) return cache[key];

    const chunks = [];
    const words = text.split(' ');
    let buf = [];
    words.forEach((w) => {
      buf.push(w);
      if (buf.join(' ').length > 400) {
        chunks.push(buf.join(' '));
        buf = [];
      }
    });
    if (buf.length) chunks.push(buf.join(' '));

    const parts = [];
    for (const chunk of chunks) {
      const url = `${API}?q=${encodeURIComponent(chunk)}&langpair=${from}|${to}`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        parts.push(data?.responseData?.translatedText || chunk);
      } catch {
        parts.push(chunk);
      }
      await sleep(320);
    }

    const translated = parts.join(' ');
    cache[key] = translated;
    saveCache();
    return translated;
  }

  async function translateArticle(enContent, targetLang) {
    if (!enContent || targetLang === 'en') return enContent;

    const hash = contentHash(enContent);
    const articleKey = `article_${hash}_${targetLang}`;
    if (cache[articleKey]) return cache[articleKey];

    const result = {
      title: await translateText(enContent.title || '', 'en', targetLang),
      summary: await translateText(enContent.summary || '', 'en', targetLang),
      body: [],
    };

    for (const p of enContent.body || []) {
      result.body.push(await translateText(p, 'en', targetLang));
    }

    if (!result.summary && result.body[0]) {
      result.summary = result.body[0].slice(0, 220) + (result.body[0].length > 220 ? '...' : '');
    }

    cache[articleKey] = result;
    saveCache();
    return result;
  }

  function needsTranslation(article, targetLang) {
    if (targetLang === 'en' || !article?.en?.title) return false;

    const loc = article[targetLang] || {};
    const en = article.en;

    if (!loc.title) return true;
    if (!loc.summary && en.summary) return true;
    if ((loc.body?.length || 0) < (en.body?.length || 0)) return true;

    const hash = contentHash(en);
    const cached = cache[`article_${hash}_${targetLang}`];
    if (cached && loc.title === en.title) return true;

    if (loc.title === en.title && en.title.length > 15) return true;
    if (loc.summary === en.summary && en.summary?.length > 30) return true;

    return false;
  }

  async function ensureArticle(article, targetLang) {
    if (!needsTranslation(article, targetLang)) return false;
    return enqueue(async () => {
      if (!needsTranslation(article, targetLang)) return false;
      const translated = await translateArticle(article.en, targetLang);
      article[targetLang] = translated;
      return true;
    });
  }

  loadCache();

  return {
    translateText,
    translateArticle,
    needsTranslation,
    ensureArticle,
    contentHash,
  };
})();
