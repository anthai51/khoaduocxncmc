// Menu di động
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.nav');
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', open);
});

// Mở / đóng menu con khi bấm (điện thoại, màn hình cảm ứng, bàn phím)
document.querySelectorAll('.sub-toggle, .more-btn').forEach(btn => btn.addEventListener('click', e => {
  e.stopPropagation();
  const li = btn.closest('.has-sub');
  const open = !li.classList.contains('sub-open');
  document.querySelectorAll('.has-sub.sub-open').forEach(o => { if (o !== li && !o.contains(li)) o.classList.remove('sub-open'); });
  li.classList.toggle('sub-open', open);
  btn.setAttribute('aria-expanded', open);
}));
document.addEventListener('click', e => {
  if (!e.target.closest('.nav')) document.querySelectorAll('.has-sub.sub-open').forEach(o => o.classList.remove('sub-open'));
});

// Menu ngang kiểu Google Sites: mục nào không đủ chỗ thì dồn vào "Thêm"
const menu = document.querySelector('.menu');
const more = menu.querySelector('.more');
const moreList = more.querySelector('.submenu');
const items = [...menu.children].filter(li => li !== more);
const MOBILE = 860;
function fitMenu() {
  // Đưa tất cả mục về lại thanh ngang
  items.forEach(li => menu.insertBefore(li, more));
  more.hidden = true;
  more.classList.remove('sub-open');
  if (window.innerWidth <= MOBILE) return;
  const avail = () => nav.clientWidth;
  if (menu.scrollWidth <= avail()) return;
  more.hidden = false;
  // Dồn dần từ mục cuối vào "Thêm" cho đến khi vừa
  for (let i = items.length - 1; i > 0 && menu.scrollWidth > avail(); i--) {
    moreList.insertBefore(items[i], moreList.firstChild);
  }
  more.querySelector('.more-btn').classList.toggle('active', !!moreList.querySelector('a.active'));
}
fitMenu();
let fitTimer;
window.addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitMenu, 80); });
if (document.fonts) document.fonts.ready.then(fitMenu);

// Nút lên đầu trang
const toTop = document.querySelector('.to-top');
const headerEl = document.querySelector('.header');
const onScroll = () => {
  if (toTop) toTop.classList.toggle('show', window.scrollY > 500);
  if (headerEl) headerEl.classList.toggle('is-scrolled', window.scrollY > 8);
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Hiệu ứng xuất hiện khi cuộn
const io = new IntersectionObserver(entries => entries.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: 0.1 });
document.querySelectorAll('main > section:first-child .hero__content')
  .forEach(el => { el.classList.add('reveal'); io.observe(el); });

// Băng chuyền ảnh (carousel)
document.querySelectorAll('[data-carousel]').forEach(car => {
  const track = car.querySelector('.carousel__track');
  const slides = [...track.children];
  const dots = car.querySelector('.carousel__dots');
  let i = 0, timer;
  if (slides.length < 2) { car.querySelectorAll('.carousel__btn').forEach(b => b.remove()); }
  slides.forEach((_, k) => {
    const d = document.createElement('button');
    d.setAttribute('aria-label', 'Ảnh ' + (k + 1));
    d.addEventListener('click', () => go(k, true));
    dots.appendChild(d);
  });
  function go(k, user) {
    i = (k + slides.length) % slides.length;
    track.style.transform = `translateX(-${i * 100}%)`;
    [...dots.children].forEach((d, n) => d.classList.toggle('on', n === i));
    if (user) restart();
  }
  function restart() { clearInterval(timer); timer = setInterval(() => go(i + 1), 4500); }
  car.querySelector('.carousel__btn--prev')?.addEventListener('click', () => go(i - 1, true));
  car.querySelector('.carousel__btn--next')?.addEventListener('click', () => go(i + 1, true));
  let x0 = null;
  car.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  car.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1), true); x0 = null; });
  go(0); if (slides.length > 1) restart();
});

// Bấm vào ảnh để xem lớn
const lb = document.createElement('div');
lb.className = 'lightbox';
lb.innerHTML = '<img alt=""><button aria-label="Đóng">×</button>';
document.body.appendChild(lb);
lb.addEventListener('click', () => lb.classList.remove('open'));
document.addEventListener('click', e => {
  const img = e.target.closest('.g-img img, .carousel__slide img, .article__gallery img, .article__cover img');
  if (!img || img.closest('a')) return;
  lb.querySelector('img').src = img.src;
  lb.classList.add('open');
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') lb.classList.remove('open'); });

// Số liệu đầu trang đếm lên một lần khi tải
(function () {
  const nums = document.querySelectorAll('[data-count]');
  if (!nums.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ease = t => 1 - Math.pow(1 - t, 3);
  nums.forEach(el => { el.textContent = '0'; });
  setTimeout(() => {
    const start = performance.now(), dur = 1100;
    const tick = now => {
      const t = Math.min(1, (now - start) / dur);
      nums.forEach(el => { el.textContent = Math.round(ease(t) * +el.dataset.count); });
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, 400);
})();
