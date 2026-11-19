// Menu di động
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.nav');
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', open);
});
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  nav.classList.remove('open');
  toggle.classList.remove('open');
  toggle.setAttribute('aria-expanded', false);
}));

// Tô sáng mục menu theo vị trí cuộn
const links = [...nav.querySelectorAll('a[href^="#"]')];
const sections = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
const toTop = document.querySelector('.to-top');
function onScroll() {
  const y = window.scrollY + 120;
  let current = sections[0];
  sections.forEach(s => { if (s.offsetTop <= y) current = s; });
  links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + current.id));
  toTop.classList.toggle('show', window.scrollY > 500);
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Hiệu ứng xuất hiện khi cuộn
const io = new IntersectionObserver(entries => entries.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: 0.12 });
document.querySelectorAll('.section__head, .sub, .video, .stat, .person, .card, .major, .news, .feedback')
  .forEach(el => { el.classList.add('reveal'); io.observe(el); });

// Năm hiện tại
document.getElementById('year').textContent = new Date().getFullYear();

// Bộ đếm lượt truy cập (dịch vụ miễn phí counterapi.dev; nếu lỗi sẽ hiện "—")
fetch('https://api.counterapi.dev/v1/khoaduocxncmc/visits/up')
  .then(r => r.json())
  .then(d => { if (d && d.count != null) document.getElementById('visit-count').textContent = d.count.toLocaleString('vi-VN'); })
  .catch(() => {});
