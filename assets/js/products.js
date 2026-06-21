/**
 * Cambell Andijan — mahsulotlar ro'yxati va batafsil sahifa
 */
const CambellProducts = (function () {
  let productsData = null;
  let lang = 'uz';

  function getLang() {
    const stored = localStorage.getItem('cambell_lang');
    return ['uz', 'ru', 'en'].includes(stored) ? stored : 'uz';
  }

  function getProductContent(product) {
    const localized = product[lang] || product.en || {};
    return {
      title: localized.title || product.en?.title || '',
      summary: localized.summary || product.en?.summary || '',
      description: localized.description || product.en?.description || [],
      specs: localized.specs || product.en?.specs || [],
    };
  }

  function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  function productUrl(id) {
    return `product-detail.html?id=${encodeURIComponent(id)}`;
  }

  function renderCard(product) {
    const c = getProductContent(product);
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="card">
        <figure class="card-header cover">
          <a href="${productUrl(product.id)}"><img class="cover-image" src="${escapeHtml(product.image)}" alt="${escapeHtml(c.title)}" loading="lazy"></a>
        </figure>
        <a href="${productUrl(product.id)}"><h4 class="card-title">${escapeHtml(c.title)}</h4></a>
      </div>`;
    return li;
  }

  function renderList(container, items) {
    if (!items?.length) {
      container.innerHTML = '<p class="product-loading" data-i18n="productsPage.loading">Mahsulotlar yuklanmoqda...</p>';
      if (typeof I18n !== 'undefined') I18n.translatePage();
      return;
    }
    const ul = document.createElement('ul');
    ul.className = 'index-product-list';
    items.forEach((p) => ul.appendChild(renderCard(p)));
    container.innerHTML = '';
    container.appendChild(ul);
  }

  function renderProductList() {
    const container = document.getElementById('productList');
    if (!container) return;
    renderList(container, productsData?.products || []);
  }

  function renderHomeProducts() {
    const container = document.getElementById('homeProducts');
    if (!container) return;
    const featured = (productsData?.products || []).filter((p) => p.featured);
    const items = featured.length ? featured.slice(0, 4) : (productsData?.products || []).slice(0, 4);
    renderList(container, items);
  }

  function renderDetail() {
    const container = document.getElementById('productDetail');
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const product = productsData?.products?.find((p) => p.id === id);

    if (!product) {
      container.innerHTML = `
        <div class="product-not-found">
          <p data-i18n="productsPage.notFound">Mahsulot topilmadi.</p>
          <a href="product.html" class="product-back-link" data-i18n="productsPage.backToList">Mahsulotlar ro'yxatiga qaytish</a>
        </div>`;
      if (typeof I18n !== 'undefined') I18n.translatePage();
      return;
    }

    const c = getProductContent(product);
    const titleEl = document.getElementById('productDetailTitle');
    const breadcrumbEl = document.getElementById('productDetailBreadcrumb');
    if (titleEl) titleEl.textContent = c.title;
    if (breadcrumbEl) breadcrumbEl.textContent = c.title;
    document.title = `${c.title} - Cambell Andijan`;

    const descHtml = c.description.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
    const specsLabel = typeof I18n !== 'undefined' ? (I18n.t('productsPage.specs') || 'Texnik xususiyatlar') : 'Texnik xususiyatlar';
    const specsHtml = c.specs.length
      ? `<table class="product-specs-table">
          <caption>${escapeHtml(specsLabel)}</caption>
          <tbody>${c.specs.map((s) => `<tr><th>${escapeHtml(s.label)}</th><td>${escapeHtml(s.value)}</td></tr>`).join('')}</tbody>
        </table>`
      : '';

    container.innerHTML = `
      <article class="product-article met-editor">
        <div class="product-detail-layout">
          <div class="product-detail-image">
            <img src="${escapeHtml(product.image)}" alt="${escapeHtml(c.title)}">
          </div>
          <div class="product-detail-info">
            <p class="product-summary">${escapeHtml(c.summary)}</p>
            ${descHtml}
            ${specsHtml}
            <div class="product-contact-cta">
              <p data-i18n="productsPage.contact">Narx va yetkazib berish haqida ma'lumot olish uchun biz bilan bog'laning.</p>
              <a href="contact.html" class="btn-primary product-contact-btn" data-i18n="productsPage.contactBtn">Bog'lanish</a>
            </div>
            <a href="product.html" class="product-back-link" data-i18n="productsPage.backToList"><i class="fa fa-arrow-left"></i> Mahsulotlar ro'yxatiga qaytish</a>
          </div>
        </div>
      </article>`;

    if (typeof I18n !== 'undefined') I18n.translatePage();
  }

  async function loadProducts() {
    try {
      const res = await fetch(`assets/data/products.json?t=${Date.now()}`);
      if (!res.ok) throw new Error('products.json load failed');
      productsData = await res.json();
    } catch (e) {
      console.warn('Products load failed', e);
      productsData = { products: [] };
    }
  }

  function refresh() {
    lang = getLang();
    renderProductList();
    renderHomeProducts();
    if (document.getElementById('productDetail')) renderDetail();
  }

  async function init() {
    lang = getLang();
    await loadProducts();
    refresh();

    document.addEventListener('languageChanged', (e) => {
      lang = e.detail?.lang || getLang();
      refresh();
    });

    document.addEventListener('layoutReady', refresh);
  }

  return { init, loadProducts, refresh };
})();

document.addEventListener('DOMContentLoaded', () => CambellProducts.init());
