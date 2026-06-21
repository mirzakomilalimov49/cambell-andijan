/**
 * Cambell Andijan — i18n (MetInfo-style site)
 */
const I18n = (function () {
  const STORAGE_KEY = 'cambell_lang';
  const DEFAULT_LANG = 'uz';
  const SUPPORTED_LANGS = ['en', 'ru', 'uz'];
  let currentLang = DEFAULT_LANG;
  let translations = {};

  function getNestedValue(obj, path) {
    return path.split('.').reduce((acc, key) => acc && acc[key], obj);
  }

  async function loadLanguage(lang) {
    try {
      const response = await fetch(`assets/lang/${lang}.json`);
      if (!response.ok) throw new Error(`Failed to load ${lang}.json`);
      translations = await response.json();
      currentLang = lang;
      localStorage.setItem(STORAGE_KEY, lang);
      return translations;
    } catch (e) {
      if (lang !== DEFAULT_LANG) return loadLanguage(DEFAULT_LANG);
      return null;
    }
  }

  function translatePage() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const value = getNestedValue(translations, key);
      if (value === undefined) return;
      const attr = el.getAttribute('data-i18n-attr');
      if (attr) {
        el.setAttribute(attr, value);
      } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        if (el.hasAttribute('placeholder') || el.getAttribute('data-i18n-attr') === 'placeholder') {
          el.placeholder = value;
        }
      } else {
        el.textContent = value;
      }
    });
    document.documentElement.lang = currentLang;
    document.title = getPageTitle();
    document.querySelectorAll('.lang-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === currentLang);
    });
  }

  function getPageTitle() {
    const page = document.body.getAttribute('data-page') || 'home';
    const site = getNestedValue(translations, 'meta.siteName') || 'Cambell Andijan';
    const titles = {
      home: site,
      about: getNestedValue(translations, 'pages.companyProfile'),
      patents: getNestedValue(translations, 'pages.companyPatents'),
      feedback: getNestedValue(translations, 'pages.feedback'),
      contact: getNestedValue(translations, 'pages.contact'),
      product: getNestedValue(translations, 'pages.products'),
      'product-detail': getNestedValue(translations, 'pages.products'),
      news: getNestedValue(translations, 'pages.news'),
      'news-detail': getNestedValue(translations, 'pages.news'),
      join: getNestedValue(translations, 'pages.joinUs')
    };
    return page === 'home' ? `${site}` : `${titles[page] || page} - ${site}`;
  }

  async function setLanguage(lang) {
    if (!SUPPORTED_LANGS.includes(lang) || lang === currentLang) return;
    await loadLanguage(lang);
    translatePage();
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: currentLang } }));
  }

  async function init() {
    const stored = localStorage.getItem(STORAGE_KEY);
    currentLang = SUPPORTED_LANGS.includes(stored) ? stored : DEFAULT_LANG;
    await loadLanguage(currentLang);
    translatePage();
    document.addEventListener('layoutReady', translatePage);
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.lang-btn');
      if (!btn) return;
      e.preventDefault();
      const lang = btn.getAttribute('data-lang');
      if (lang) setLanguage(lang);
    });
  }

  return { init, setLanguage, translatePage, t: (k) => getNestedValue(translations, k) || k };
})();

document.addEventListener('DOMContentLoaded', () => I18n.init());
