/* ==========================================================
   TIN TỨC KHOA DƯỢC - XÉT NGHIỆM
   Thêm bài mới: chép một khối { ... } và đặt LÊN ĐẦU danh sách.
   - tieuDe : tiêu đề bài
   - ngay   : "dd/mm/yyyy" (để "" nếu không muốn hiện ngày)
   - tomTat : 1-3 câu tóm tắt
   - anh    : đường dẫn ảnh (tính từ thư mục gốc website)
   - link   : trang bài viết (trong website) hoặc link ngoài (https://...)
   Bài đầu tiên là bài nổi bật (ảnh lớn bên trái trang chủ).
   ========================================================== */
window.TIN_TUC = [
  {
    tieuDe: "Thầy thuốc Ưu tú, TS.BS Nguyễn Quang Thông vinh dự đón nhận Huân chương Lao động hạng Ba của Chủ tịch nước",
    ngay: "20/11/2026",
    tomTat: "Tại buổi họp mặt kỷ niệm 44 năm Ngày Nhà giáo Việt Nam, Hiệu trưởng Trường Cao đẳng Y tế Cần Thơ vinh dự đón nhận Huân chương Lao động hạng Ba; Khoa Dược - Xét nghiệm được công nhận Tập thể Lao động xuất sắc. (Nguồn: Tạp chí điện tử Việt - Đức)",
    anh: "assets/img/tin-tuc/huan-chuong-lao-dong-hang-ba.jpg",
    link: "bai-viet/huan-chuong-lao-dong-hang-ba-hieu-truong.html"
  },
  {
    tieuDe: "Họp mặt kỷ niệm 44 năm Ngày Nhà giáo Việt Nam (20/11/1982 - 20/11/2026)",
    ngay: "20/11/2026",
    tomTat: "Ngày 20/11/2026, Trường Cao đẳng Y tế Cần Thơ tổ chức buổi Họp mặt kỷ niệm 44 năm Ngày Nhà giáo Việt Nam. Tập thể giảng viên Khoa Dược - Xét nghiệm cùng tham dự buổi họp mặt trong không khí trang trọng, ấm áp.",
    anh: "assets/img/tin-tuc/hop-mat-44-nam-ngay-nha-giao.jpg",
    link: "bai-viet/hop-mat-44-nam-ngay-nha-giao-viet-nam.html"
  },
  {
    tieuDe: "Hoạt động Chi bộ Khoa Dược - Xét nghiệm",
    ngay: "",
    tomTat: "Chi bộ Dược - Xét nghiệm luôn bảo đảm vai trò lãnh đạo, chỉ đạo tập trung, thống nhất của Đảng; huy động sức mạnh tổng hợp của tập thể trong các hoạt động của Khoa.",
    anh: "assets/img/s/6a9acabb54.jpg",
    link: "bai-viet/hoat-dong-chi-bo.html"
  },
  {
    tieuDe: "Giới thiệu Tổ Công đoàn Khoa Dược - Xét nghiệm",
    ngay: "",
    tomTat: "Tổ Công đoàn Khoa Dược - Xét nghiệm là tổ chức vững mạnh, luôn phát huy tốt vai trò chăm lo, bảo vệ quyền và lợi ích hợp pháp của công đoàn viên.",
    anh: "assets/img/s/0469803925.jpg",
    link: "bai-viet/gioi-thieu-to-cong-doan-khoa-duoc-xet-nghiem.html"
  }
];

(function () {
  var B = (document.body.getAttribute('data-base') || '');
  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function url(u) { return /^https?:\/\//.test(u) ? u : B + u; }
  function ext(u) { return /^https?:\/\//.test(u) ? ' target="_blank" rel="noopener"' : ''; }
  var CAL = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
  function date(n) { return n.ngay ? '<p class="tt__date">' + CAL + '<time>' + esc(n.ngay) + '</time></p>' : ''; }
  function item(n, cls) {
    return '<article class="tt__item ' + cls + '"><a class="tt__img" href="' + url(n.link) + '"' + ext(n.link) + '><img src="' + url(n.anh) + '" alt="' + esc(n.tieuDe) + '" loading="lazy"></a>' +
      '<div class="tt__body"><h3 class="tt__title"><a href="' + url(n.link) + '"' + ext(n.link) + '>' + esc(n.tieuDe) + '</a></h3>' + date(n) +
      '<p class="tt__sum">' + esc(n.tomTat) + '</p></div></article>';
  }
  var list = window.TIN_TUC || [];
  var home = document.getElementById('news-home');
  if (home && list.length) {
    var side = list.slice(1, 3).map(function (n) { return item(n, 'tt__item--side'); }).join('');
    home.innerHTML = '<div class="tt__grid"><div class="tt__main">' + item(list[0], 'tt__item--main') + '</div>' +
      '<div class="tt__side"><a class="tt__banner" href="' + B + 'tin-tuc.html"><span class="tt__banner-a">ĐIỂM TIN</span><span class="tt__banner-b">DƯỢC - XÉT NGHIỆM</span></a>' +
      side + '<div class="tt__more"><a class="tt__btn" href="' + B + 'tin-tuc.html">Xem thêm</a></div></div></div>';
  }
  var all = document.getElementById('news-list');
  if (all) all.innerHTML = list.map(function (n) { return item(n, 'tt__item--side'); }).join('') || '<p>Chưa có tin tức.</p>';
})();
