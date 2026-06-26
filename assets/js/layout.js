/**
 * Load shared header/footer partials
 */
async function loadLayout() {
  const headerSlot = document.getElementById('site-header');
  const footerSlot = document.getElementById('site-footer');
  const page = document.body.getAttribute('data-page');

  try {
    if (headerSlot) {
      const res = await fetch('assets/partials/header.html');
      if (!res.ok) throw new Error('header fetch failed');
      headerSlot.innerHTML = await res.text();
      setActiveNav(page);
    }
    if (footerSlot) {
      const res = await fetch('assets/partials/footer.html');
      if (!res.ok) throw new Error('footer fetch failed');
      footerSlot.innerHTML = await res.text();
    }
  } catch (e) {
    console.error('Layout load failed:', e);
    const slot = document.getElementById('site-header');
    if (slot && !slot.innerHTML.trim()) {
      slot.innerHTML = '<div class="layout-error">Saytni to\'liq ko\'rish uchun lokal server orqali oching: <code>python -m http.server 8765</code></div>';
    }
  }
}

function setActiveNav(page) {
  const map = {
    home: 'home',
    about: 'contact',
    patents: 'contact',
    feedback: 'contact',
    contact: 'contact',
    product: 'product',
    'product-detail': 'product',
    news: 'news',
    'news-detail': 'news',
    join: 'join',
    monitoring: 'monitoring'
  };
  const active = map[page] || page;
  document.querySelectorAll('[data-nav]').forEach((el) => {
    if (el.getAttribute('data-nav') === active) el.classList.add('active');
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadLayout();
  initMobileNav();
  initDropdowns();
  document.dispatchEvent(new CustomEvent('layoutReady'));
});
