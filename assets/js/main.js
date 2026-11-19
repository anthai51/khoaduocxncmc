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
const onScroll = () => toTop && toTop.classList.toggle('show', window.scrollY > 500);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Hiệu ứng xuất hiện khi cuộn
const io = new IntersectionObserver(entries => entries.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: 0.1 });
document.querySelectorAll('.section__head, .sub, .video, .stat, .person, .card, .major, .news, .feedback, .block')
  .forEach(el => { el.classList.add('reveal'); io.observe(el); });

// Bộ đếm lượt truy cập (dịch vụ miễn phí counterapi.dev; chỉ đếm ở trang chủ, các trang khác chỉ hiển thị)
const counterEl = document.getElementById('visit-count');
if (counterEl) {
  const page = location.pathname.split('/').pop() || 'index.html';
  const url = 'https://api.counterapi.dev/v1/khoaduocxncmc/visits' + (page === 'index.html' ? '/up' : '');
  fetch(url).then(r => r.json())
    .then(d => { if (d && d.count != null) counterEl.textContent = d.count.toLocaleString('vi-VN'); })
    .catch(() => {});
}
