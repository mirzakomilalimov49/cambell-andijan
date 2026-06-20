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

  toggler.addEventListener('click', () => {
    collapse.classList.toggle('show');
  });

  document.addEventListener('click', (e) => {
    if (!collapse.contains(e.target) && !toggler.contains(e.target)) {
      collapse.classList.remove('show');
    }
  });
}

function initDropdowns() {
  if (window.innerWidth >= 992) return;

  document.querySelectorAll('.nav-item.dropdown > .nav-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      if (window.innerWidth < 992) {
        e.preventDefault();
        const parent = link.parentElement;
        parent.classList.toggle('open');
      }
    });
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
