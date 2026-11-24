/* HỒ SƠ KHOA — dữ liệu đồng bộ từ Google Sheet "QUẢN LÝ HỒ SƠ KHOA" bằng Apps Script
   (xem thư mục apps-script/). Chỉ Admin và những người có tên trong hoso_meta/access được xem
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
    var body = rows.slice(k).filter(function (r) { return filled(r).length; });
    var used = labels.map(function (l, j) { return !!l || body.some(function (r) { return r.c[j] && (r.c[j].t || r.c[j].u); }); });
    var items = body.map(function (r) {
      var f = filled(r), c0 = r.c[0] || { t: '' };
      var isGroup = f.length <= 2 && c0.t && !isNum(c0.t) && !c0.u && f.slice(1).every(function (x) { return x.u; }) && c0.t.length < 120;
      return isGroup ? { g: c0.t, links: f.slice(1) } : { r: r.c };
    });
    return { title: title, labels: labels, used: used, items: items, W: W };
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
      '<p>Dữ liệu sẽ xuất hiện sau khi Admin cài Apps Script đồng bộ trong Google Sheet "QUẢN LÝ HỒ SƠ KHOA" và chạy lần đầu.</p></div>';
  }

  function syncInfo() {
    var t = meta.dongBoLuc && meta.dongBoLuc.toDate ? meta.dongBoLuc.toDate() : null;
    var s = t ? 'Đồng bộ lúc ' + t.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' · ' + t.toLocaleDateString('vi-VN') : 'Chưa đồng bộ';
    var btn = isAdmin && meta.sheetUrl ? '<a class="hs-btn hs-btn--ghost" href="' + esc(meta.sheetUrl) + '" target="_blank" rel="noopener">' + ico('ext') + 'Mở Google Sheet gốc</a>' : '';
    return '<div class="hs-sync"><span class="hs-live"></span>' + s + btn + '</div>';
  }

  function tableHtml(p, d, hl) {
    var cols = []; for (var j = 0; j < p.W; j++) if (p.used[j]) cols.push(j);
    var h = '<div class="hs-tablewrap"><table class="hs-table"><thead><tr>' +
      cols.map(function (j) { return '<th>' + esc(p.labels[j] || '') + '</th>'; }).join('') + '</tr></thead><tbody>';
    var any = false;
    p.items.forEach(function (it) {
      if (it.g) {
        if (hl) return;
        h += '<tr class="hs-grow"><td colspan="' + cols.length + '"><span class="hs-gchip">' + esc(it.g) + '</span>' + it.links.map(linkBtn).join('') + '</td></tr>';
        return;
      }
      if (hl && !norm(it.r.map(function (c) { return c && c.t; }).join(' ')).includes(hl)) return;
      any = true;
      h += '<tr>' + cols.map(function (j) {
        var c = it.r[j], lab = p.labels[j] || '';
        var cls = (j === cols[0] && c && isNum(c.t)) ? ' class="hs-stt"' : (c && c.t && c.t.length > 160 ? ' class="hs-long"' : '');
        return '<td' + cls + ' data-l="' + esc(lab) + '">' + cellHtml(c) + '</td>';
      }).join('') + '</tr>';
    });
    h += '</tbody></table></div>';
    return hl && !any ? '' : h;
  }

  function renderDoc(d) {
    var g = grp(d.nhom), p = d._p || (d._p = parse(d.rows)), n = counts(d);
    var h = '<header class="hs-mh" style="--c:' + g[2] + '"><div><p class="hs-crumb"><button data-go="">Tổng quan</button> › ' + esc(d.nhom) + '</p>' +
      '<h2><span class="hs-mh__ico">' + ico(g[1]) + '</span>' + esc(d.ten) + '</h2>' +
      (p.title.length ? '<p class="hs-sub">' + esc(p.title.join(' — ')) + '</p>' : '') +
      '<p class="hs-meta"><b>' + n.rows + '</b> mục · <b>' + n.links + '</b> liên kết' + (d.riengTu ? ' · ' + ico('lock', 'hs-i hs-i--sm') + 'Chỉ Admin xem' : '') + '</p></div>' +
      '<div class="hs-mh__r"><label class="hs-filter">' + '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
      '<input id="hsFilter" type="search" placeholder="Lọc trong mục này…"></label>' +
      (isAdmin && meta.sheetUrl && d.gid != null ? '<a class="hs-btn hs-btn--ghost" href="' + esc(meta.sheetUrl.replace(/#.*$/, '').replace(/\/edit.*$/, '') + '/edit#gid=' + d.gid) + '" target="_blank" rel="noopener">' + ico('ext') + 'Sửa trong Sheet</a>' : '') +
      '</div></header>';
    h += '<div id="hsBody">' + (p.items.length ? tableHtml(p, d) : '<p class="hs-muted">Trang tính này chưa có nội dung.</p>') + '</div>';
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

  function route() {
    var h = decodeURIComponent(location.hash.slice(1));
    current = h;
    renderSide();
    if (q) return renderSearch();
    if (h === '_quyen' && isAdmin) return renderAccess();
    var d = docs.filter(function (x) { return x.id === h; })[0];
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
      try { var m = await db.doc('hoso_meta/info').get(); meta = m.exists ? m.data() : {}; } catch (e) { meta = {}; }
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
