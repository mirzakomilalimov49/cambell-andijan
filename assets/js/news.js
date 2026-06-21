/**
 * Cambell Andijan — dynamic news with auto-translation (UZ/RU/EN)
 */
const CambellNews = (function () {
  let newsData = null;
  let lang = 'uz';
  let translating = false;

  function getLang() {
    const stored = localStorage.getItem('cambell_lang');
    return ['uz', 'ru', 'en'].includes(stored) ? stored : 'uz';
  }

  function getArticleContent(article) {
    const localized = article[lang] || article.en || {};
    return {
      title: localized.title || article.en?.title || '',
      summary: localized.summary || article.en?.summary || '',
      body: localized.body?.length ? localized.body : (article.en?.body || []),
    };
  }

  function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  function articleUrl(id) {
    return `news-detail.html?id=${encodeURIComponent(id)}`;
  }

  function renderListItem(article) {
    const c = getArticleContent(article);
    const li = document.createElement('li');
    li.innerHTML = `
      <a class="media" href="${articleUrl(article.id)}">
        <div class="media-left">
          <img class="media-object" src="${escapeHtml(article.image)}" alt="${escapeHtml(c.title)}" loading="lazy">
        </div>
        <div class="media-body">
          <h4 class="media-heading">${escapeHtml(c.title)}</h4>
          <p class="des">${escapeHtml(c.summary)}</p>
          <p class="info">
            <span>${escapeHtml(article.date)}</span>
            <span class="m-l-10">${escapeHtml(article.author)}</span>
            <span class="m-l-10"><i class="fa fa-eye"></i> ${escapeHtml(article.views)}</span>
          </p>
        </div>
      </a>`;
    return li;
  }

  function renderList(container) {
    if (!newsData?.articles?.length) {
      container.innerHTML = '<p class="news-empty" data-i18n="news.loading">Yangiliklar yuklanmoqda...</p>';
      if (typeof I18n !== 'undefined') I18n.translatePage();
      return;
    }
    const ul = document.createElement('ul');
    ul.className = 'list-group';
    newsData.articles.forEach((a) => ul.appendChild(renderListItem(a)));
    container.innerHTML = '';
    container.appendChild(ul);
    if (translating) {
      const note = document.createElement('p');
      note.className = 'news-translating-note';
      note.setAttribute('data-i18n', 'news.translating');
      note.textContent = 'Tarjima qilinmoqda...';
      container.appendChild(note);
      if (typeof I18n !== 'undefined') I18n.translatePage();
    }
  }

  function renderDetail() {
    const container = document.getElementById('newsDetail');
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const article = newsData?.articles?.find((a) => a.id === id);

    if (!article) {
      container.innerHTML = `
        <div class="news-not-found">
          <p data-i18n="news.notFound">Yangilik topilmadi.</p>
          <a href="news.html" class="news-back-link" data-i18n="news.backToList">Yangiliklar ro'yxatiga qaytish</a>
        </div>`;
      if (typeof I18n !== 'undefined') I18n.translatePage();
      return;
    }

    const c = getArticleContent(article);
    const titleEl = document.getElementById('newsDetailTitle');
    const breadcrumbEl = document.getElementById('newsDetailBreadcrumb');
    if (titleEl) titleEl.textContent = c.title;
    if (breadcrumbEl) breadcrumbEl.textContent = c.title;

    document.title = `${c.title} - Cambell Andijan`;

    const bodyHtml = c.body.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
    const translatingNote = translating
      ? `<p class="news-translating-note" data-i18n="news.translating"><i class="fa fa-spinner fa-spin"></i> Tarjima qilinmoqda...</p>`
      : '';

    container.innerHTML = `
      <article class="news-article met-editor">
        <div class="news-article-meta">
          <span><i class="fa fa-calendar"></i> ${escapeHtml(article.date)}</span>
          <span class="m-l-10"><i class="fa fa-user"></i> ${escapeHtml(article.author)}</span>
          <span class="m-l-10"><i class="fa fa-eye"></i> ${escapeHtml(article.views)}</span>
        </div>
        ${translatingNote}
        ${article.image ? `<p class="news-article-image"><img src="${escapeHtml(article.image)}" alt="${escapeHtml(c.title)}"></p>` : ''}
        ${bodyHtml || `<p>${escapeHtml(c.summary)}</p>`}
        <p class="news-source">
          <a href="${escapeHtml(article.sourceUrl)}" target="_blank" rel="noopener" data-i18n="news.sourceLink">Rasmiy manba</a>
        </p>
        <a href="news.html" class="news-back-link" data-i18n="news.backToList"><i class="fa fa-arrow-left"></i> Yangiliklar ro'yxatiga qaytish</a>
      </article>`;

    if (typeof I18n !== 'undefined') I18n.translatePage();
  }

  async function loadNews() {
    try {
      const res = await fetch(`assets/data/news.json?t=${Date.now()}`);
      if (!res.ok) throw new Error('news.json load failed');
      newsData = await res.json();
    } catch (e) {
      console.warn('News load failed', e);
      newsData = { articles: [] };
    }
  }

  function renderHomeNews() {
    const container = document.getElementById('homeNews');
    if (!container) return;

    if (!newsData?.articles?.length) {
      container.innerHTML = '<p class="news-empty" data-i18n="news.loading">Yangiliklar yuklanmoqda...</p>';
      if (typeof I18n !== 'undefined') I18n.translatePage();
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'list-group';
    newsData.articles.slice(0, 4).forEach((a) => ul.appendChild(renderListItem(a)));
    container.innerHTML = '';
    container.appendChild(ul);
  }

  function refresh() {
    lang = getLang();
    const listEl = document.getElementById('newsList');
    if (listEl) renderList(listEl);
    renderHomeNews();
    if (document.getElementById('newsDetail')) renderDetail();
  }

  async function autoTranslateArticles(targetLangs) {
    if (!newsData?.articles?.length || typeof CambellTranslate === 'undefined') return;

    const langs = targetLangs || ['uz', 'ru'];
    let changed = false;
    translating = true;
    refresh();

    for (const article of newsData.articles) {
      for (const tl of langs) {
        const updated = await CambellTranslate.ensureArticle(article, tl);
        if (updated) {
          changed = true;
          refresh();
        }
      }
    }

    translating = false;
    if (changed) refresh();
  }

  async function autoTranslateCurrent() {
    if (lang === 'en' || typeof CambellTranslate === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const article = id ? newsData?.articles?.find((a) => a.id === id) : null;

    if (article && CambellTranslate.needsTranslation(article, lang)) {
      translating = true;
      refresh();
      await CambellTranslate.ensureArticle(article, lang);
      translating = false;
      refresh();
      return;
    }

    const needsAny = newsData?.articles?.some((a) => CambellTranslate.needsTranslation(a, lang));
    if (needsAny) await autoTranslateArticles([lang]);
  }

  async function init() {
    lang = getLang();
    await loadNews();
    refresh();

    const needsAuto = (newsData?.articles || []).some(
      (a) => CambellTranslate.needsTranslation(a, 'uz') || CambellTranslate.needsTranslation(a, 'ru')
    );
    if (needsAuto) autoTranslateArticles(['uz', 'ru']);

    document.addEventListener('languageChanged', async (e) => {
      lang = e.detail?.lang || getLang();
      refresh();
      await autoTranslateCurrent();
    });

    document.addEventListener('layoutReady', refresh);

    if (document.getElementById('newsList') || document.getElementById('newsDetail') || document.getElementById('homeNews')) {
      setInterval(async () => {
        const prev = newsData?.updatedAt;
        await loadNews();
        if (newsData?.updatedAt && newsData.updatedAt !== prev) {
          refresh();
          autoTranslateArticles(['uz', 'ru']);
        }
      }, 600000);
    }
  }

  return { init, loadNews, refresh, autoTranslateArticles };
})();

document.addEventListener('DOMContentLoaded', () => CambellNews.init());
