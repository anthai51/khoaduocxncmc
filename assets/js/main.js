// Menu di động
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.nav');
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', open);
});

// Mở / đóng menu con (dùng trên điện thoại và bàn phím)
document.querySelectorAll('.sub-toggle').forEach(btn => btn.addEventListener('click', e => {
  e.stopPropagation();
  const li = btn.closest('.has-sub');
  const open = li.classList.toggle('sub-open');
  btn.setAttribute('aria-expanded', open);
}));

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
