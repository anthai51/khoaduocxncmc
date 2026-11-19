/* =========================================================
   MENU & CHÂN TRANG DÙNG CHUNG CHO MỌI TRANG
   Muốn thêm / đổi tên / xóa mục menu: chỉ sửa mảng MENU dưới đây.
   ========================================================= */
const MENU = [
  { title: 'Trang chủ', href: 'index.html' },
  { title: 'Cơ cấu tổ chức', href: 'co-cau-to-chuc.html', children: [
    { title: 'Bộ môn Dược lý - Dược lâm sàng', href: 'bo-mon-duoc-ly.html' },
    { title: 'Bộ môn Dược liệu - Kiểm nghiệm', href: 'bo-mon-duoc-lieu.html' },
    { title: 'Bộ môn Bào chế - Quản lý dược', href: 'bo-mon-bao-che.html' },
    { title: 'Bộ môn Xét nghiệm', href: 'bo-mon-xet-nghiem.html' },
  ]},
  { title: 'Đảng - Đoàn thể', href: 'dang-doan-the.html', children: [
    { title: 'Đảng', href: 'dang.html' },
    { title: 'Công đoàn', href: 'cong-doan.html' },
    { title: 'Đoàn khoa', href: 'doan-khoa.html' },
  ]},
  { title: 'Kế hoạch', href: 'ke-hoach.html' },
  { title: 'Văn bản', href: 'van-ban.html' },
  { title: 'Tài liệu chuyên ngành', href: 'tai-lieu-chuyen-nganh.html' },
  { title: 'Thành tích', href: 'thanh-tich.html' },
  { title: 'Kiến thức đời sống', href: 'kien-thuc-doi-song.html' },
];

const CHEVRON = '<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

(function () {
  const BASE = document.body.dataset.base || '';
  const current = document.body.dataset.parent || (location.pathname.split('/').pop() || 'index.html');
  const isActive = item => item.href === current || (item.children || []).some(c => c.href === current);

  /* ---------- Đầu trang ---------- */
  const navHtml = MENU.map(item => {
    if (!item.children) {
      return `<li><a href="${BASE}${item.href}" class="${isActive(item) ? 'active' : ''}">${item.title}</a></li>`;
    }
    const sub = item.children.map(c =>
      `<li><a href="${BASE}${c.href}" class="${c.href === current ? 'active' : ''}">${c.title}</a></li>`).join('');
    return `<li class="has-sub">
      <a href="${BASE}${item.href}" class="${isActive(item) ? 'active' : ''}">${item.title}</a>
      <button class="sub-toggle" aria-label="Mở mục con của ${item.title}" aria-expanded="false">${CHEVRON}</button>
      <ul class="submenu">${sub}</ul>
    </li>`;
  }).join('');

  const header = document.getElementById('site-header');
  if (header) header.outerHTML = `
  <div class="topbar">
    <div class="container topbar__inner">
      <span>📞 (84-0292) 3 899 017</span>
      <span>✉️ khoaduoccdytct@gmail.com</span>
      <a href="http://cmc.edu.vn" target="_blank" rel="noopener">🌐 cmc.edu.vn</a>
    </div>
  </div>
  <header class="header" id="top">
    <div class="container header__inner">
      <a href="${BASE}index.html" class="brand">
        <img src="${BASE}assets/img/logo.png" alt="Logo Trường Cao đẳng Y tế Cần Thơ">
        <span class="brand__text"><small>Trường Cao đẳng Y tế Cần Thơ</small><strong>Khoa Dược - Xét nghiệm</strong></span>
      </a>
      <button class="nav-toggle" aria-label="Mở menu" aria-expanded="false"><span></span><span></span><span></span></button>
      <nav class="nav" aria-label="Menu chính"><ul class="menu">${navHtml}
        <li class="has-sub more" hidden>
          <button class="more-btn" aria-expanded="false">Thêm ${CHEVRON}</button>
          <ul class="submenu submenu--right"></ul>
        </li></ul></nav>
    </div>
  </header>`;

  /* ---------- Chân trang ---------- */
  const footer = document.getElementById('site-footer');
  if (footer) footer.outerHTML = `
  <footer class="footer" id="lien-he">
    <div class="container footer__grid">
      <div>
        <div class="brand brand--light">
          <img src="${BASE}assets/img/logo.png" alt="">
          <span class="brand__text"><small>Trường Cao đẳng Y tế Cần Thơ</small><strong>Khoa Dược - Xét nghiệm</strong></span>
        </div>
        <ul class="footer__info">
          <li><b>Địa chỉ:</b> Văn phòng Khoa Dược - Xét nghiệm tầng 5, số 340 Nguyễn Văn Cừ, P. An Hòa, Q. Ninh Kiều, TP. Cần Thơ</li>
          <li><b>Điện thoại:</b> (84-0292) 3 899 017</li>
          <li><b>Email:</b> <a href="mailto:khoaduoccdytct@gmail.com">khoaduoccdytct@gmail.com</a></li>
          <li><b>Website:</b> <a href="http://cmc.edu.vn" target="_blank" rel="noopener">cmc.edu.vn</a></li>
        </ul>
      </div>
      <div>
        <h4>Liên kết nhanh</h4>
        <ul class="footer__links">
          ${MENU.filter(m => m.href !== 'index.html').map(m => `<li><a href="${BASE}${m.href}">${m.title}</a></li>`).join('')}
        </ul>
        <h4>Số lượt truy cập</h4>
        <p class="counter"><a href="https://www.hitwebcounter.com" target="_blank" rel="noopener"><img src="https://hitwebcounter.com/counter/counter.php?page=18152559&style=0010&nbdigits=6&type=page&initCount=0" alt="Bộ đếm lượt truy cập" title="Số lượt truy cập"></a></p>
      </div>
      <div class="footer__map">
        <iframe src="https://maps.google.com/maps?hl=vi&q=10.044144,105.765365&z=17&output=embed" title="Bản đồ Trường Cao đẳng Y tế Cần Thơ" loading="lazy"></iframe>
      </div>
    </div>
    <div class="footer__bottom">© ${new Date().getFullYear()} Khoa Dược - Xét nghiệm · Trường Cao đẳng Y tế Cần Thơ</div>
  </footer>
  <a href="#top" class="to-top" aria-label="Lên đầu trang">↑</a>`;
})();
