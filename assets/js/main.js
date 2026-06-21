/**
 * Cambell Andijan — MetInfo-style interactions
 */
document.addEventListener('DOMContentLoaded', () => {
  initCarousel();
  initContactForm();
});

function initMobileNav() {
  const toggler = document.querySelector('.navbar-toggler');
  const collapse = document.getElementById('met-nav-collapse');
  if (!toggler || !collapse) return;

  toggler.addEventListener('click', (e) => {
    e.stopPropagation();
    collapse.classList.toggle('show');
    toggler.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!collapse.contains(e.target) && !toggler.contains(e.target)) {
      collapse.classList.remove('show');
      toggler.classList.remove('active');
    }
  });

  collapse.querySelectorAll('a').forEach((link) => {
    if (link.classList.contains('dropdown-toggle')) return;
    link.addEventListener('click', () => {
      if (window.innerWidth < 992) {
        collapse.classList.remove('show');
        toggler.classList.remove('active');
        document.querySelectorAll('.nav-item.dropdown.open, .dropdown-submenu.open').forEach((el) => {
          el.classList.remove('open');
        });
      }
    });
  });
}

function initDropdowns() {
  document.addEventListener('click', (e) => {
    if (window.innerWidth >= 992) return;

    const subToggle = e.target.closest('.dropdown-submenu > .dropdown-item');
    if (subToggle) {
      e.preventDefault();
      const parent = subToggle.parentElement;
      parent.classList.toggle('open');
      return;
    }

    const dropToggle = e.target.closest('.nav-item.dropdown > .nav-link.dropdown-toggle');
    if (dropToggle) {
      e.preventDefault();
      const parent = dropToggle.parentElement;
      const siblings = parent.parentElement.querySelectorAll('.nav-item.dropdown.open');
      siblings.forEach((el) => {
        if (el !== parent) el.classList.remove('open');
      });
      parent.classList.toggle('open');
    }
  });
}

function initCarousel() {
  const carousel = document.getElementById('exampleCarouselDefault');
  if (!carousel) return;

  const items = carousel.querySelectorAll('.carousel-item');
  const indicators = carousel.querySelectorAll('.carousel-indicators li');
  const prevBtn = carousel.querySelector('.carousel-control.left');
  const nextBtn = carousel.querySelector('.carousel-control.right');
  let current = 0;
  let timer;

  function goTo(index) {
    items[current].classList.remove('active');
    if (indicators[current]) indicators[current].classList.remove('active');
    current = (index + items.length) % items.length;
    items[current].classList.add('active');
    if (indicators[current]) indicators[current].classList.add('active');
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  if (prevBtn) prevBtn.addEventListener('click', (e) => { e.preventDefault(); prev(); resetTimer(); });
  if (nextBtn) nextBtn.addEventListener('click', (e) => { e.preventDefault(); next(); resetTimer(); });

  indicators.forEach((ind, i) => {
    ind.addEventListener('click', () => { goTo(i); resetTimer(); });
  });

  function resetTimer() {
    clearInterval(timer);
    timer = setInterval(next, 5000);
  }

  if (items.length > 1) resetTimer();
}

function initContactForm() {
  const form = document.getElementById('feedbackForm');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const success = document.querySelector('.form-success');
    if (success) {
      success.classList.add('show');
      form.reset();
      setTimeout(() => success.classList.remove('show'), 5000);
    }
  });
}
