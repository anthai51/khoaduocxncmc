/* HỒ SƠ KHOA — dữ liệu lưu trực tiếp trong Firestore (hoso, hoso_admin), Admin sửa ngay trên web.
   Chỉ Admin và những người có tên trong hoso_meta/access được xem
   (Trưởng khoa, Phó Trưởng khoa, Trưởng/Phụ trách Bộ môn). Bảo mật do Firestore rules đảm nhiệm. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var fb = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.FIREBASE_CONFIG);
  var auth = fb.auth(), db = fb.firestore();
  var DOMAIN = window.LOGIN_DOMAIN || 'khoaduocxncmc.id.vn';

  var GROUPS = [
    ['Hồ sơ Khoa', 'folder', '#0b5fae'],
    ['Công văn', 'send', '#0f8f8a'],
    ['Kế hoạch', 'calendar', '#d9480f'],
    ['Đào tạo', 'cap', '#7048e8'],
    ['Sinh viên', 'users', '#c2255c'],
    ['Nhân sự', 'id', '#2b8a3e'],
    ['Quy chế - Quy trình', 'scale', '#5f3dc4'],
    ['Khác', 'layers', '#495057']
  ];
  var ICON = {
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
    cap: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    id: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 8h2M15 12h2M7 16h10"/>',
    scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1ZM2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    cols: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    below: '<path d="M12 5v14M5 12h14"/><path d="M4 21h16"/>',
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    ext: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
    arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>'
  };
  function ico(n, cls) { return '<svg class="' + (cls || 'hs-i') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICON[n] || ICON.layers) + '</svg>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
  function emailOf(u) { u = String(u || '').trim().toLowerCase(); return u.indexOf('@') >= 0 ? u : u + '@' + DOMAIN; }
  function grp(name) { for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i][0] === name) return GROUPS[i]; return GROUPS[GROUPS.length - 1]; }
  function show(id) { ['hsBoot', 'hsLogin', 'hsApp'].forEach(function (x) { $(x).hidden = x !== id; }); }

  /* ---------------- liên kết: biểu tượng theo loại ---------------- */
  function linkKind(u) {
    if (/\/folders\//.test(u) || /drive\.google\.com\/(drive|open)/.test(u) && !/file/.test(u)) return ['Thư mục', 'k-folder'];
    if (/spreadsheets/.test(u)) return ['Sheets', 'k-sheet'];
    if (/document\//.test(u)) return ['Docs', 'k-doc'];
    if (/presentation/.test(u)) return ['Slides', 'k-slide'];
    if (/forms\.gle|\/forms\//.test(u)) return ['Biểu mẫu', 'k-form'];
    if (/\.pdf(\?|$)|\/file\/d\//.test(u)) return ['Tệp', 'k-file'];
    if (/1drv\.ms|sharepoint|onedrive/.test(u)) return ['OneDrive', 'k-one'];
    return ['Liên kết', 'k-web'];
  }
  function linkBtn(c) {
    var k = linkKind(c.u), t = c.t;
    if (!t || /^https?:\/\//.test(t) || t.length > 60) t = 'Mở ' + k[0].toLowerCase();
    return '<a class="hs-link ' + k[1] + '" href="' + esc(c.u) + '" target="_blank" rel="noopener" title="' + esc(k[0]) + '">' + ico('ext') + '<span>' + esc(t) + '</span></a>';
  }
  function cellHtml(c) {
    if (!c) return '';
    if (c.u) return linkBtn(c);
    return esc(c.t).replace(/\n/g, '<br>');
  }

  /* ---------------- phân tích bảng tính ---------------- */
  var isNum = function (t) { return /^\d+([.,]\d+)?$/.test(String(t || '').trim()); };
  function filled(r) { return (r.c || []).filter(function (x) { return x && (x.t || x.u); }); }
  function parse(rows) {
    rows = (rows || []).map(function (r) { return { c: (r.c || []).map(function (x) { return x || { t: '' }; }) }; });
    var h = -1;
    for (var i = 0; i < Math.min(rows.length, 15) && h < 0; i++) {
      var c = rows[i].c;
      if ((c[0] && /^(stt|tt|s\.tt)$/i.test(c[0].t.trim())) || (c[1] && /^(stt|tt)$/i.test(c[1].t.trim()))) h = i;
    }
    if (h < 0) for (i = 0; i < Math.min(rows.length, 15) && h < 0; i++) if (filled(rows[i]).length >= 3) h = i;
    if (h < 0) h = 0;
    var title = rows.slice(0, h).map(function (r) { return filled(r).map(function (x) { return x.t; }).join(' · '); }).filter(Boolean);
    var hdr = [rows[h]], k = h + 1;
    while (k < rows.length && hdr.length < 3) {
      var c2 = rows[k].c, f = filled(rows[k]);
      if (!(c2[0] && c2[0].t) && !(c2[1] && c2[1].t) && f.length >= 2 && !f.some(function (x) { return x.u; })) { hdr.push(rows[k]); k++; } else break;
    }
    var W = 0; rows.forEach(function (r) { r.c.forEach(function (x, j) { if (x.t || x.u) W = Math.max(W, j + 1); }); });
    // nhãn cột: điền tiếp ô gộp của dòng tiêu đề trên sang các cột có tiêu đề con
    var labels = [];
    for (var j = 0; j < W; j++) labels[j] = [];
    hdr.forEach(function (r, ri) {
      var last = '';
      for (var j = 0; j < W; j++) {
        var t = (r.c[j] && r.c[j].t) || '';
        if (t) last = t;
        var lower = hdr.slice(ri + 1).some(function (rr) { return rr.c[j] && rr.c[j].t; });
        var use = t || (lower ? last : '');
        if (use) labels[j].push(use.replace(/\s*\n\s*/g, ' '));
      }
    });
    labels = labels.map(function (l) { return l.filter(function (v, i, a) { return a.indexOf(v) === i; }).join(' · '); });
    var body = rows.map(function (r, i) { r.i = i; return r; }).slice(k).filter(function (r) { return filled(r).length; });
    var used = labels.map(function (l, j) { return !!l || body.some(function (r) { return r.c[j] && (r.c[j].t || r.c[j].u); }); });
    var items = body.map(function (r) {
      var f = filled(r), c0 = r.c[0] || { t: '' };
      var isGroup = f.length <= 2 && c0.t && !isNum(c0.t) && !c0.u && f.slice(1).every(function (x) { return x.u; }) && c0.t.length < 120;
      return isGroup ? { g: c0.t, links: f.slice(1), i: r.i } : { r: r.c, i: r.i };
    });
    return { title: title, labels: labels, used: used, items: items, W: W, hdrEnd: k, hdrStart: h };
  }

  /* ---------------- trạng thái ---------------- */
  var me = null, isAdmin = false, docs = [], meta = {}, current = '', q = '';

  function counts(d) {
    if (d._n) return d._n;
    var p = d._p || (d._p = parse(d.rows)), n = 0, l = 0;
    p.items.forEach(function (it) {
      if (it.r) { n++; it.r.forEach(function (c) { if (c && c.u) l++; }); } else l += it.links.length;
    });
    return (d._n = { rows: n, links: l });
  }

  function renderSide() {
    var by = {};
    docs.forEach(function (d) { (by[d.nhom] = by[d.nhom] || []).push(d); });
    var h = '<button class="hs-nav ' + (current ? '' : 'is-on') + '" data-go="">' + ico('home') + '<span>Tổng quan</span></button>';
    GROUPS.forEach(function (g) {
      var list = by[g[0]]; if (!list) return;
      h += '<div class="hs-navg"><p class="hs-navg__t" style="--c:' + g[2] + '">' + ico(g[1]) + esc(g[0]) + '</p>';
      list.forEach(function (d) {
        if (d.lienKet) { h += '<a class="hs-nav" href="' + esc(d.lienKet) + '" style="--c:' + g[2] + '"><span class="hs-nav__dot"></span><span>' + esc(d.ten) + '</span>' + ico('ext', 'hs-i hs-i--sm') + '</a>'; return; }
        h += '<button class="hs-nav ' + (current === d.id ? 'is-on' : '') + '" data-go="' + d.id + '" style="--c:' + g[2] + '"><span class="hs-nav__dot"></span><span>' + esc(d.ten) + '</span>' +
          (d.riengTu ? ico('lock', 'hs-i hs-i--sm') : '<em>' + counts(d).rows + '</em>') + '</button>';
      });
      h += '</div>';
    });
    if (isAdmin) h += '<div class="hs-navg"><p class="hs-navg__t" style="--c:#868e96">' + ico('key') + 'Quản trị</p><button class="hs-nav ' + (current === '_quyen' ? 'is-on' : '') + '" data-go="_quyen"><span class="hs-nav__dot"></span><span>Phân quyền xem</span></button></div>';
    $('hsSide').innerHTML = h;
  }

  function renderOverview() {
    var by = {};
    docs.forEach(function (d) { (by[d.nhom] = by[d.nhom] || []).push(d); });
    var h = '<header class="hs-mh"><div><p class="hs-crumb">Tổng quan</p><h2>Chọn danh mục hồ sơ</h2></div>' + syncInfo() + '</header>';
    GROUPS.forEach(function (g) {
      var list = by[g[0]]; if (!list) return;
      h += '<h3 class="hs-gt" style="--c:' + g[2] + '">' + ico(g[1]) + esc(g[0]) + '</h3><div class="hs-cards">';
      list.forEach(function (d, i) {
        var n = counts(d);
        if (d.lienKet) { h += '<a class="hs-card" href="' + esc(d.lienKet) + '" style="--c:' + g[2] + ';--d:' + (i * 40) + 'ms"><span class="hs-card__ico">' + ico(g[1]) + '</span><span class="hs-card__t">' + esc(d.ten) + '</span><span class="hs-card__m">' + ico('ext', 'hs-i hs-i--sm') + 'Mở trang ' + esc(d.lienKetTen || '') + '</span><span class="hs-card__go">' + ico('arrow') + '</span></a>'; return; }
        h += '<button class="hs-card" data-go="' + d.id + '" style="--c:' + g[2] + ';--d:' + (i * 40) + 'ms">' +
          '<span class="hs-card__ico">' + ico(g[1]) + '</span><span class="hs-card__t">' + esc(d.ten) + '</span>' +
          '<span class="hs-card__m">' + (d.riengTu ? ico('lock', 'hs-i hs-i--sm') + 'Chỉ Admin · ' : '') + n.rows + ' mục · ' + n.links + ' liên kết</span>' +
          '<span class="hs-card__go">' + ico('arrow') + '</span></button>';
      });
      h += '</div>';
    });
    if (!docs.length) h += emptyState();
    $('hsMain').innerHTML = h;
  }

  function emptyState() {
    return '<div class="hs-empty"><div class="hs-empty__ico">' + ico('folder') + '</div><h3>Chưa có dữ liệu</h3>' +
      '<p>Admin bấm “Thêm danh mục” để tạo danh mục hồ sơ đầu tiên.</p></div>';
  }

  function fmtTime(t) { t = t && t.toDate ? t.toDate() : null; return t ? t.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' · ' + t.toLocaleDateString('vi-VN') : ''; }
  function syncInfo() {
    var last = null; docs.forEach(function (d) { if (d.capNhat && d.capNhat.toDate && (!last || d.capNhat.toDate() > last.toDate())) last = d.capNhat; });
    var s = last ? 'Cập nhật lần cuối ' + fmtTime(last) : '';
    var btn = isAdmin ? '<button class="hs-btn hs-btn--primary" id="hsNewDoc">' + ico('plus') + 'Thêm danh mục</button>' : '';
    return '<div class="hs-sync">' + (s ? '<span class="hs-live"></span>' + s : '') + btn + '</div>';
  }

  function tableHtml(p, d, hl) {
    var cols = []; for (var j = 0; j < p.W; j++) if (p.used[j]) cols.push(j);
    var ed = isAdmin && !hl;
    // cột có nội dung dài nhất (trung bình) được rộng; cột chỉ chứa mã/số ngắn thì gọn lại
    var avg = {}, wide = -1, best = 0;
    cols.forEach(function (j) {
      var n = 0, L = 0; p.items.forEach(function (it) { if (it.r && it.r[j] && it.r[j].t && !it.r[j].u) { n++; L += it.r[j].t.length; } });
      avg[j] = n ? L / n : 0; if (avg[j] > best) { best = avg[j]; wide = j; }
    });
    var cl = function (j) { return j === wide ? 'hs-wide' : (avg[j] && avg[j] <= 16 ? 'hs-num' : ''); };
    var act = function (i) { return ed ? '<td class="hs-act"><button data-mv="' + i + ':-1" title="Chuyển lên">' + ico('up') + '</button><button data-mv="' + i + ':1" title="Chuyển xuống">' + ico('down') + '</button><button data-ed="' + i + '" title="Sửa">' + ico('edit') + '</button><button data-ins="' + i + '" title="Chèn dòng phía dưới">' + ico('below') + '</button><button data-del="' + i + '" title="Xóa">' + ico('trash') + '</button></td>' : ''; };
    var h = '<div class="hs-tablewrap"><table class="hs-table"><thead><tr>' +
      cols.map(function (j) { var L = (p.labels[j] || '').split(' · '), last = L.pop(); return '<th class="' + cl(j) + '">' + (L.length ? '<small class="hs-thp">' + esc(L.join(' · ')) + '</small>' : '') + esc(last) + '</th>'; }).join('') + (ed ? '<th class="hs-act"></th>' : '') + '</tr></thead><tbody>';
    var any = false;
    p.items.forEach(function (it) {
      if (it.g) {
        if (hl) return;
        h += '<tr class="hs-grow"><td colspan="' + cols.length + '"><span class="hs-gchip">' + esc(it.g) + '</span>' + it.links.map(linkBtn).join('') + '</td>' + act(it.i) + '</tr>';
        return;
      }
      if (hl && !norm(it.r.map(function (c) { return c && c.t; }).join(' ')).includes(hl)) return;
      any = true;
      h += '<tr>' + cols.map(function (j) {
        var c = it.r[j], lab = p.labels[j] || '';
        var cls = (j === cols[0] && c && isNum(c.t)) ? ' class="hs-stt"' : (c && c.t && c.t.length > 160 ? ' class="hs-long ' + cl(j) + '"' : (cl(j) && !(cl(j) === 'hs-num' && c && c.t && c.t.length > 20) ? ' class="' + cl(j) + '"' : ''));
        return '<td' + cls + ' data-l="' + esc(lab) + '">' + cellHtml(c) + '</td>';
      }).join('') + act(it.i) + '</tr>';
    });
    h += '</tbody></table></div>';
    return hl && !any ? '' : h;
  }

  function renderDoc(d) {
    var g = grp(d.nhom), p = d._p || (d._p = parse(d.rows)), n = counts(d);
    var h = '<header class="hs-mh" style="--c:' + g[2] + '"><div><p class="hs-crumb"><button data-go="">Tổng quan</button> › ' + esc(d.nhom) + '</p>' +
      '<h2><span class="hs-mh__ico">' + ico(g[1]) + '</span>' + esc(d.ten) + '</h2>' +
      (p.title.length ? '<p class="hs-sub">' + esc(p.title.join(' — ')) + '</p>' : '') +
      '<p class="hs-meta"><b>' + n.rows + '</b> mục · <b>' + n.links + '</b> liên kết' + (d.capNhat ? ' · cập nhật ' + fmtTime(d.capNhat) : '') + (d.riengTu ? ' · ' + ico('lock', 'hs-i hs-i--sm') + 'Chỉ Admin xem' : '') + '</p></div>' +
      '<div class="hs-mh__r"><label class="hs-filter">' + '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
      '<input id="hsFilter" type="search" placeholder="Lọc trong mục này…"></label>' +
      (isAdmin ? '<button class="hs-btn hs-btn--primary" data-add="row">' + ico('plus') + 'Thêm dòng</button><button class="hs-btn hs-btn--ghost" data-add="group">' + ico('plus') + 'Thêm nhóm</button><button class="hs-btn hs-btn--ghost" data-add="cols">' + ico('cols') + 'Cột</button><button class="hs-btn hs-btn--ghost" data-add="doc">' + ico('edit') + 'Danh mục</button>' : '') +
      '</div></header>';
    h += '<div id="hsBody">' + (p.items.length || p.W ? tableHtml(p, d) + (p.items.length ? '' : '<p class="hs-muted hs-pad">Chưa có dòng nào' + (isAdmin ? ' – bấm “Thêm dòng” để nhập.' : '.') + '</p>') : '<p class="hs-muted">Danh mục này chưa có nội dung.</p>') + '</div>';
    $('hsMain').innerHTML = h;
    $('hsFilter').addEventListener('input', function () {
      var v = norm(this.value.trim());
      $('hsBody').innerHTML = v ? (tableHtml(p, d, v) || '<p class="hs-muted hs-pad">Không tìm thấy mục phù hợp.</p>') : tableHtml(p, d);
    });
  }

  function renderSearch() {
    var v = norm(q), h = '<header class="hs-mh"><div><p class="hs-crumb"><button data-go="">Tổng quan</button> › Tìm kiếm</p><h2>Kết quả cho “' + esc(q) + '”</h2></div></header>', found = 0;
    docs.forEach(function (d) {
      var p = d._p || (d._p = parse(d.rows));
      var t = tableHtml(p, d, v);
      if (t) {
        var g = grp(d.nhom);
        found++;
        h += '<h3 class="hs-gt hs-gt--link" style="--c:' + g[2] + '"><button data-go="' + d.id + '">' + ico(g[1]) + esc(d.ten) + ' <small>' + esc(d.nhom) + '</small></button></h3>' + t;
      }
    });
    if (!found) h += '<div class="hs-empty"><h3>Không tìm thấy</h3><p>Thử từ khóa ngắn hơn, ví dụ: “lịch thi”, “giáo án”, “01/KH”.</p></div>';
    $('hsMain').innerHTML = h;
  }

  /* ---------------- phân quyền (Admin) ---------------- */
  async function renderAccess() {
    $('hsMain').innerHTML = '<header class="hs-mh"><div><p class="hs-crumb"><button data-go="">Tổng quan</button> › Quản trị</p><h2>Phân quyền xem Hồ sơ Khoa</h2><p class="hs-sub">Đánh dấu những tài khoản được xem mục này (Trưởng khoa, Phó Trưởng khoa, Trưởng/Phụ trách Bộ môn…). Admin luôn xem được. Các trang tính có biểu tượng khóa chỉ Admin xem.</p></div></header><div class="hs-acc" id="hsAcc"><span class="hs-spin"></span></div>';
    var us = await db.collection('users').get(), acc = await db.doc('hoso_meta/access').get();
    var on = (acc.exists && acc.data().uids) || [];
    var list = us.docs.map(function (x) { return Object.assign({ id: x.id }, x.data()); }).filter(function (u) { return !u.disabled; })
      .sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'vi'); });
    $('hsAcc').innerHTML = list.map(function (u) {
      var adm = u.role === 'admin';
      return '<label class="hs-acc__row' + (adm ? ' is-admin' : '') + '"><input type="checkbox" value="' + u.id + '"' + (adm || on.indexOf(u.id) >= 0 ? ' checked' : '') + (adm ? ' disabled' : '') + '>' +
        '<span class="hs-acc__n">' + esc(u.name || u.username) + '</span><span class="hs-acc__u">' + esc(u.username || '') + '</span>' + (adm ? '<em>Admin</em>' : '') + '</label>';
    }).join('') + '<div class="hs-acc__bar"><button class="hs-btn hs-btn--primary" id="accSave">Lưu phân quyền</button><span id="accMsg" class="hs-muted"></span></div>';
    $('accSave').onclick = async function () {
      var uids = [].slice.call(document.querySelectorAll('#hsAcc input:checked:not(:disabled)')).map(function (x) { return x.value; });
      this.disabled = true; $('accMsg').textContent = 'Đang lưu…';
      try { await db.doc('hoso_meta/access').set({ uids: uids, capNhat: firebase.firestore.FieldValue.serverTimestamp(), boi: me.uid }); $('accMsg').textContent = 'Đã lưu: ' + uids.length + ' người được xem.'; }
      catch (e) { $('accMsg').textContent = 'Lỗi: ' + (e.code || e.message); }
      this.disabled = false;
    };
  }

  /* ---------------- chỉnh sửa (Admin) ---------------- */
  var curDoc = null;
  function modal(title, body, onSave, extra) {
    var m = document.createElement('div'); m.className = 'hs-modal';
    m.innerHTML = '<form class="hs-modal__box"><h3>' + esc(title) + '</h3><div class="hs-modal__body">' + body + '</div><p class="hs-err" id="mErr"></p>' +
      '<div class="hs-modal__bar">' + (extra || '') + '<span style="flex:1"></span><button type="button" class="hs-btn hs-btn--ghost" data-x>Hủy</button><button class="hs-btn hs-btn--primary">Lưu</button></div></form>';
    document.body.appendChild(m);
    var close = function () { m.remove(); };
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-x]')) close(); });
    m.querySelector('form').addEventListener('submit', async function (e) {
      e.preventDefault(); var b = this.querySelector('.hs-btn--primary'); b.disabled = true; b.textContent = 'Đang lưu…';
      try { await onSave(m); close(); } catch (err) { m.querySelector('#mErr').textContent = 'Lỗi: ' + (err.code || err.message); b.disabled = false; b.textContent = 'Lưu'; }
    });
    var f = m.querySelector('input,textarea'); if (f) f.focus();
    return m;
  }
  async function saveRows(d, rows) {
    rows = rows.map(function (r) { return { c: (r.c || []).map(function (c) { var o = { t: c.t || '' }; if (c.u) o.u = c.u; return o; }) }; });
    var ts = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection(d.riengTu ? 'hoso_admin' : 'hoso').doc(d.id).update({ rows: rows, capNhat: ts, boi: me.uid });
    d.rows = rows; d.capNhat = firebase.firestore.Timestamp.now(); d._p = null; d._n = null;
    renderSide(); renderDoc(d);
  }
  function rowEditor(d, idx, mode) {
    var p = d._p || (d._p = parse(d.rows));
    var cols = []; for (var j = 0; j < Math.max(p.W, 1); j++) if (p.used[j]) cols.push(j);
    if (!cols.length) cols = [0, 1, 2, 3];
    var src = mode === 'edit' ? d.rows[idx] : null;
    var isGroup = mode === 'group' || (src && p.items.some(function (it) { return it.i === idx && it.g; }));
    var body;
    if (isGroup) {
      var lk = src ? (src.c || []).slice(1).filter(function (c) { return c.u; })[0] || {} : {};
      body = '<label>Tên nhóm (VD: NĂM 2027, Năm học 2026 - 2027)<input name="g" value="' + esc(src ? src.c[0].t : '') + '" required></label>' +
        '<label>Liên kết thư mục của nhóm (không bắt buộc)<input name="gu" type="url" value="' + esc(lk.u || '') + '" placeholder="https://…"></label>';
    } else {
      body = cols.map(function (j) {
        var c = (src && src.c[j]) || {}, lab = p.labels[j] || ('Cột ' + (j + 1));
        var auto = mode !== 'edit' && j === cols[0] && /^(stt|tt)/i.test(lab) ? nextStt(d, idx) : '';
        var long = (c.t || '').length > 80;
        return '<fieldset><legend>' + esc(lab) + '</legend>' + (long ? '<textarea name="t' + j + '" rows="4">' + esc(c.t || '') + '</textarea>' : '<input name="t' + j + '" value="' + esc(c.t || auto) + '">') +
          (noLink(d, lab) ? '' : '<input name="u' + j + '" type="url" class="hs-in-url" value="' + esc(c.u || '') + '" placeholder="Đường link (nếu có)">') + '</fieldset>';
      }).join('');
    }
    modal(mode === 'edit' ? 'Sửa dòng' : isGroup ? 'Thêm nhóm' : 'Thêm dòng', body, async function (m) {
      var fd = new FormData(m.querySelector('form')), row;
      if (isGroup) { row = { c: [{ t: fd.get('g').trim() }] }; if (fd.get('gu')) row.c.push({ t: 'Link folder', u: fd.get('gu').trim() }); }
      else {
        var W = Math.max(p.W, cols[cols.length - 1] + 1), c = [];
        for (var j = 0; j < W; j++) c.push(cols.indexOf(j) >= 0 ? { t: String(fd.get('t' + j) || '').trim(), u: fd.has('u' + j) ? String(fd.get('u' + j) || '').trim() : ((src && src.c[j] && src.c[j].u) || '') } : ((src && src.c[j]) || { t: '' }));
        row = { c: c };
      }
      var rows = d.rows.slice();
      if (mode === 'edit') rows[idx] = row; else rows.splice(idx + 1, 0, row);
      await saveRows(d, rows);
    });
  }
  function noLink(d, lab) { return (d.noLink || []).indexOf(lab) >= 0; }
  function nextStt(d, idx) {
    for (var i = idx; i >= 0; i--) { var t = d.rows[i] && d.rows[i].c[0] && d.rows[i].c[0].t; if (/^\d+$/.test(t || '')) return String(+t + 1); }
    return '1';
  }
  /* Quản lý cột: đổi tên, thêm, xóa, đổi thứ tự. Tiêu đề nhiều tầng được gộp thành 1 dòng tiêu đề. */
  function colEditor(d) {
    var p = d._p || (d._p = parse(d.rows));
    var cols = []; for (var j = 0; j < p.W; j++) if (p.used[j]) cols.push({ j: j, name: p.labels[j] || '', link: !noLink(d, p.labels[j] || '') });
    if (!cols.length) cols = [{ j: -1, name: 'NỘI DUNG' }];
    var title = p.title.join('\n');
    function list() {
      return cols.map(function (c, k) {
        return '<div class="hs-colrow"><input data-k="' + k + '" value="' + esc(c.name) + '" placeholder="Tên cột">' +
          '<label class="hs-colrow__lk" title="Hiện ô nhập đường link khi sửa dòng"><input type="checkbox" data-lk="' + k + '"' + (c.link !== false ? ' checked' : '') + '>Link</label>' +
          '<button type="button" data-cu="' + k + '" title="Lên">' + ico('up') + '</button><button type="button" data-cd="' + k + '" title="Xuống">' + ico('down') + '</button>' +
          '<button type="button" data-cx="' + k + '" title="Xóa cột">' + ico('trash') + '</button></div>';
      }).join('');
    }
    var body = '<label>Tiêu đề phía trên bảng (không bắt buộc)<textarea name="title" rows="2">' + esc(title) + '</textarea></label>' +
      '<div><p class="hs-lbl">Các cột (theo thứ tự trái → phải)</p><div id="colList">' + list() + '</div>' +
      '<button type="button" class="hs-btn hs-btn--ghost" id="colAdd">' + ico('plus') + 'Thêm cột</button></div>' +
      '<p class="hs-muted hs-small">Xóa cột sẽ xóa luôn dữ liệu của cột đó ở mọi dòng.</p>';
    var m = modal('Quản lý cột – ' + d.ten, body, async function (m) {
      m.querySelectorAll('#colList input[data-k]').forEach(function (inp) { cols[+inp.getAttribute('data-k')].name = inp.value.trim(); });
      m.querySelectorAll('#colList input[data-lk]').forEach(function (inp) { cols[+inp.getAttribute('data-lk')].link = inp.checked; });
      var nl = cols.filter(function (c) { return c.link === false; }).map(function (c) { return c.name; });
      await db.collection(d.riengTu ? 'hoso_admin' : 'hoso').doc(d.id).update({ noLink: nl }); d.noLink = nl;
      var t = m.querySelector('[name=title]').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      var body = d.rows.slice(p.hdrEnd).map(function (r, ii) {
        var isG = p.items.some(function (it) { return it.i === p.hdrEnd + ii && it.g; });
        if (isG) return { c: r.c };
        return { c: cols.map(function (c) { return c.j >= 0 ? (r.c[c.j] || { t: '' }) : { t: '' }; }) };
      });
      var rows = t.map(function (x) { return { c: [{ t: x }] }; })
        .concat([{ c: cols.map(function (c) { return { t: c.name }; }) }]).concat(body);
      await saveRows(d, rows);
    });
    function redraw() {
      m.querySelectorAll('#colList input[data-k]').forEach(function (inp) { cols[+inp.getAttribute('data-k')].name = inp.value; });
      m.querySelectorAll('#colList input[data-lk]').forEach(function (inp) { cols[+inp.getAttribute('data-lk')].link = inp.checked; });
      m.querySelector('#colList').innerHTML = list();
    }
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cu],[data-cd],[data-cx],#colAdd'); if (!b) return;
      redraw();
      if (b.id === 'colAdd') cols.push({ j: -1, name: '' });
      else if (b.hasAttribute('data-cx')) { var k = +b.getAttribute('data-cx'); if (cols.length > 1 && confirm('Xóa cột "' + (cols[k].name || 'không tên') + '"?')) cols.splice(k, 1); }
      else { var k2 = +(b.getAttribute('data-cu') || b.getAttribute('data-cd')), dir = b.hasAttribute('data-cu') ? -1 : 1, t = cols[k2 + dir]; if (t) { cols[k2 + dir] = cols[k2]; cols[k2] = t; } }
      m.querySelector('#colList').innerHTML = list();
      if (b.id === 'colAdd') { var ins = m.querySelectorAll('#colList input[data-k]'); ins[ins.length - 1].focus(); }
    });
  }

  function docEditor(d) {
    var opts = GROUPS.map(function (g) { return '<option' + (d && d.nhom === g[0] ? ' selected' : '') + '>' + esc(g[0]) + '</option>'; }).join('');
    var body = '<label>Tên danh mục<input name="ten" value="' + esc(d ? d.ten : '') + '" required></label>' +
      '<label>Nhóm<select name="nhom">' + opts + '</select></label>' +
      (d ? '' : '<label class="hs-chk"><input type="checkbox" name="rieng"> Chỉ Admin xem (thông tin nhạy cảm)</label>') +
      (d ? '' : '<p class="hs-muted hs-small">Danh mục mới có sẵn 4 cột: STT · Nội dung · Đường link · Ghi chú.</p>');
    var del = d ? '<button type="button" class="hs-btn hs-btn--danger" id="mDel">' + ico('trash') + 'Xóa danh mục</button>' : '';
    var m = modal(d ? 'Sửa danh mục' : 'Thêm danh mục', body, async function (m) {
      var fd = new FormData(m.querySelector('form')), ten = fd.get('ten').trim(), nhom = fd.get('nhom');
      if (d) {
        await db.collection(d.riengTu ? 'hoso_admin' : 'hoso').doc(d.id).update({ ten: ten, nhom: nhom });
        d.ten = ten; d.nhom = nhom; renderSide(); renderDoc(d); return;
      }
      var rieng = !!fd.get('rieng'), id = norm(ten).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
      var nd = { ten: ten, nhom: nhom, riengTu: rieng, thuTu: docs.length + 1, rows: [{ c: [{ t: 'STT' }, { t: 'NỘI DUNG' }, { t: 'ĐƯỜNG LINK' }, { t: 'GHI CHÚ' }] }],
        capNhat: firebase.firestore.FieldValue.serverTimestamp(), boi: me.uid };
      await db.collection(rieng ? 'hoso_admin' : 'hoso').doc(id).set(nd);
      nd.id = id; nd.capNhat = firebase.firestore.Timestamp.now(); docs.push(nd); location.hash = id;
    }, del);
    if (d) m.querySelector('#mDel').onclick = async function () {
      if (!confirm('Xóa vĩnh viễn danh mục "' + d.ten + '" và toàn bộ ' + counts(d).rows + ' mục bên trong? Không thể hoàn tác.')) return;
      await db.collection(d.riengTu ? 'hoso_admin' : 'hoso').doc(d.id).delete();
      docs = docs.filter(function (x) { return x !== d; }); m.remove(); location.hash = '';
    };
  }
  document.addEventListener('click', async function (e) {
    if (!isAdmin) return;
    var d = curDoc, b;
    if (e.target.closest('#hsNewDoc')) return docEditor(null);
    if (!d) return;
    if ((b = e.target.closest('[data-add]'))) {
      var k = b.getAttribute('data-add');
      if (k === 'doc') return docEditor(d);
      if (k === 'cols') return colEditor(d);
      return rowEditor(d, d.rows.length - 1, k === 'group' ? 'group' : 'add');
    }
    if ((b = e.target.closest('[data-ed]'))) return rowEditor(d, +b.getAttribute('data-ed'), 'edit');
    if ((b = e.target.closest('[data-mv]'))) {
      var a = b.getAttribute('data-mv').split(':'), i0 = +a[0], dir = +a[1], pp = d._p || (d._p = parse(d.rows));
      var idxs = pp.items.map(function (it) { return it.i; }), pos = idxs.indexOf(i0), j0 = idxs[pos + dir];
      if (j0 == null) return;
      var rr = d.rows.slice(), A = { c: rr[i0].c.slice() }, B = { c: rr[j0].c.slice() };
      // giữ nguyên số thứ tự ở cột STT, chỉ đổi chỗ nội dung
      if (A.c[0] && B.c[0] && isNum(A.c[0].t) && isNum(B.c[0].t)) { var s0 = A.c[0]; A.c[0] = B.c[0]; B.c[0] = s0; }
      rr[i0] = B; rr[j0] = A;
      return saveRows(d, rr);
    }
    if ((b = e.target.closest('[data-ins]'))) return rowEditor(d, +b.getAttribute('data-ins'), 'add');
    if ((b = e.target.closest('[data-del]'))) {
      var i = +b.getAttribute('data-del'), txt = (d.rows[i].c || []).map(function (c) { return c.t; }).filter(Boolean).slice(0, 2).join(' – ');
      if (!confirm('Xóa dòng: "' + txt + '"?')) return;
      var rows = d.rows.slice(); rows.splice(i, 1); await saveRows(d, rows);
    }
  });

  function route() {
    var h = decodeURIComponent(location.hash.slice(1));
    current = h;
    renderSide();
    if (q) return renderSearch();
    if (h === '_quyen' && isAdmin) return renderAccess();
    var d = docs.filter(function (x) { return x.id === h; })[0];
    curDoc = d || null;
    if (d && d.lienKet) { location.href = d.lienKet; return; }
    if (d) renderDoc(d); else { current = ''; renderSide(); renderOverview(); }
    var m = $('hsMain'); if (m.getBoundingClientRect().top < 0) m.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-go]');
    if (!b) return;
    q = ''; $('hsSearch').value = '';
    var go = b.getAttribute('data-go');
    if (location.hash.slice(1) === go) route(); else location.hash = go;
  });
  window.addEventListener('hashchange', function () { q = ''; $('hsSearch').value = ''; route(); });
  var tmr;
  $('hsSearch').addEventListener('input', function () {
    clearTimeout(tmr); var v = this.value.trim();
    tmr = setTimeout(function () { q = v; route(); }, 160);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && !/input|textarea/i.test((document.activeElement || {}).tagName) && !$('hsSearchWrap').hidden) { e.preventDefault(); $('hsSearch').focus(); }
  });

  /* ---------------- đăng nhập & tải dữ liệu ---------------- */
  function authErr(e) {
    var c = (e && e.code) || '';
    if (/invalid-credential|wrong-password|user-not-found|invalid-email|invalid-login/.test(c)) return 'Sai tên đăng nhập hoặc mật khẩu.';
    if (c === 'auth/too-many-requests') return 'Nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút.';
    return 'Có lỗi xảy ra (' + (c || 'không rõ') + ').';
  }
  $('hsLogin').addEventListener('submit', async function (e) {
    e.preventDefault();
    var b = $('lgBtn'); b.disabled = true; b.textContent = 'Đang đăng nhập…'; $('lgErr').textContent = '';
    try { await auth.signInWithEmailAndPassword(emailOf($('lgUser').value), $('lgPass').value); $('lgPass').value = ''; }
    catch (err) { $('lgErr').textContent = authErr(err); }
    b.disabled = false; b.textContent = 'Đăng nhập';
  });

  function denied(msg) {
    show('hsApp');
    $('hsSide').innerHTML = '';
    $('hsMain').innerHTML = '<div class="hs-empty hs-empty--lock"><div class="hs-empty__ico">' + ico('lock') + '</div><h3>Bạn chưa có quyền xem mục này</h3><p>' + esc(msg) + '</p>' +
      '<button class="hs-btn hs-btn--ghost" id="hsOut">Đăng nhập tài khoản khác</button></div>';
    $('hsOut').onclick = function () { auth.signOut(); };
  }

  auth.onAuthStateChanged(async function (u) {
    me = u; isAdmin = false; docs = [];
    $('hsSearchWrap').hidden = true; $('hsStats').hidden = true;
    if (!u) { show('hsLogin'); setTimeout(function () { $('lgUser').focus(); }, 30); return; }
    show('hsBoot');
    try {
      var ud = await db.collection('users').doc(u.uid).get();
      if (!ud.exists || ud.data().disabled) return denied('Tài khoản chưa được kích hoạt.');
      isAdmin = ud.data().role === 'admin';
      var snap;
      try { snap = await db.collection('hoso').get(); }
      catch (e) { if (e.code === 'permission-denied') return denied('Hồ sơ Khoa chỉ dành cho Trưởng khoa, Phó Trưởng khoa, Trưởng và Phụ trách Bộ môn. Nếu bạn cần xem, vui lòng liên hệ quản trị viên.'); throw e; }
      docs = snap.docs.map(function (x) { return Object.assign({ id: x.id }, x.data()); });
      if (isAdmin) {
        var s2 = await db.collection('hoso_admin').get();
        docs = docs.concat(s2.docs.map(function (x) { return Object.assign({ id: x.id }, x.data()); }));
      }
      docs.sort(function (a, b) { return (a.thuTu || 99) - (b.thuTu || 99) || String(a.ten).localeCompare(String(b.ten), 'vi'); });
      var tr = 0, tl = 0; docs.forEach(function (d) { var n = counts(d); tr += n.rows; tl += n.links; });
      $('stSec').textContent = docs.length; $('stRow').textContent = tr; $('stLink').textContent = tl;
      $('hsStats').hidden = !docs.length; $('hsSearchWrap').hidden = !docs.length;
      show('hsApp'); route();
    } catch (e) {
      denied('Không tải được dữ liệu (' + (e.code || e.message) + ').');
    }
  });
})();
