/* Tài khoản & Hồ sơ giảng viên — dùng chung tài khoản Firebase với
   Quản lý phòng thực hành (phong-thuc-hanh/) và Theo dõi tiến độ CV (tien-do/). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var fb = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.FIREBASE_CONFIG);
  var auth = fb.auth(), db = fb.firestore();
  var DOMAIN = window.LOGIN_DOMAIN || 'khoaduocxncmc.id.vn';

  var FIELDS = [
    ['hoTen', 'Họ và tên'], ['gioiTinh', 'Giới tính'], ['ngaySinh', 'Ngày sinh'],
    ['chucVu', 'Chức vụ'], ['chucDanh', 'Chức danh nghề nghiệp'], ['bangCap', 'Bằng cấp, chuyên ngành'],
    ['soCCHN', 'Số chứng chỉ hành nghề'], ['batDauLamViec', 'Thời gian bắt đầu làm việc'], ['ngayVaoDang', 'Ngày vào Đảng'],
    ['ngoaiNgu', 'Ngoại ngữ'], ['tinHoc', 'Tin học'], ['chinhTri', 'Lý luận chính trị'], ['qlnn', 'Quản lý nhà nước'],
    ['maNgach', 'Mã ngạch'], ['heSoLuong', 'Bậc lương / Hệ số'], ['phuCapThamNien', 'Phụ cấp thâm niên'],
    ['sdt', 'Số điện thoại'], ['email', 'Email']
  ];
  var GROUPS = [
    ['Thông tin cá nhân', ['hoTen', 'gioiTinh', 'ngaySinh', 'sdt', 'email']],
    ['Công tác', ['chucVu', 'chucDanh', 'batDauLamViec', 'ngayVaoDang']],
    ['Trình độ', ['bangCap', 'soCCHN', 'ngoaiNgu', 'tinHoc', 'chinhTri', 'qlnn']],
    ['Lương', ['maNgach', 'heSoLuong', 'phuCapThamNien']]
  ];
  var LABEL = {}; FIELDS.forEach(function (f) { LABEL[f[0]] = f[1]; });

  var me = null, isAdmin = false, all = [], editing = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function emailOf(u) { u = String(u || '').trim().toLowerCase(); return u.indexOf('@') >= 0 ? u : u + '@' + DOMAIN; }
  function authErr(e) {
    var c = (e && e.code) || '';
    if (/invalid-credential|wrong-password|user-not-found|invalid-email|invalid-login/.test(c)) return 'Sai tên đăng nhập hoặc mật khẩu.';
    if (c === 'auth/too-many-requests') return 'Nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút.';
    if (c === 'auth/network-request-failed') return 'Không có kết nối mạng.';
    if (c === 'auth/weak-password') return 'Mật khẩu mới quá yếu (ít nhất 6 ký tự).';
    return 'Có lỗi xảy ra (' + (c || (e && e.message) || 'không rõ') + ').';
  }
  function show(id) { ['tkBoot', 'tkLogin', 'tkApp'].forEach(function (x) { $(x).hidden = x !== id; }); }

  /* ---------- đăng nhập ---------- */
  $('tkLogin').addEventListener('submit', async function (e) {
    e.preventDefault();
    var b = $('lgBtn'); b.disabled = true; b.textContent = 'Đang đăng nhập…'; $('lgErr').textContent = '';
    try { await auth.signInWithEmailAndPassword(emailOf($('lgUser').value), $('lgPass').value); $('lgPass').value = ''; }
    catch (err) { $('lgErr').textContent = authErr(err); }
    b.disabled = false; b.textContent = 'Đăng nhập';
  });
  $('logoutBtn').addEventListener('click', function () { auth.signOut(); });

  function showLogin(msg) {
    $('pageTitle').textContent = 'Đăng nhập';
    show('tkLogin'); $('lgErr').textContent = msg || '';
    setTimeout(function () { $('lgUser').focus(); }, 30);
  }

  auth.onAuthStateChanged(async function (u) {
    me = null; isAdmin = false; all = [];
    if (!u) return showLogin();
    var snap;
    try { snap = await db.collection('users').doc(u.uid).get(); }
    catch (e) { await auth.signOut(); return showLogin('Không đọc được thông tin tài khoản.'); }
    if (!snap.exists) { await auth.signOut(); return showLogin('Tài khoản chưa được cấp quyền. Liên hệ quản trị viên.'); }
    var p = snap.data() || {};
    if (p.disabled) { await auth.signOut(); return showLogin('Tài khoản đã bị khóa. Liên hệ quản trị viên.'); }
    me = { id: u.uid, name: p.name || p.username || '', username: p.username || '' };
    isAdmin = p.role === 'admin';
    $('pageTitle').textContent = 'Tài khoản của tôi';
    $('meName').textContent = me.name;
    $('meRole').textContent = (isAdmin ? 'Quản trị viên' : 'Giảng viên') + ' · Tên đăng nhập: ' + me.username;
    $('tabGv').hidden = !isAdmin;
    show('tkApp'); setTab('hoso');
    loadMine();
    if (isAdmin) loadAll();
  });

  /* ---------- tab ---------- */
  function setTab(t) {
    document.querySelectorAll('.tk-tab').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === t)); });
    ['hoso', 'matkhau', 'gv'].forEach(function (x) { $('pane-' + x).hidden = x !== t; });
  }
  document.querySelectorAll('.tk-tab').forEach(function (b) { b.addEventListener('click', function () { setTab(b.dataset.tab); }); });

  /* ---------- hồ sơ của tôi ---------- */
  function profileHtml(d) {
    return GROUPS.map(function (g) {
      return '<div class="tk-card"><h2>' + g[0] + '</h2><dl class="tk-dl">' + g[1].map(function (k) {
        var v = d[k];
        return '<div><dt>' + LABEL[k] + '</dt><dd>' + (v ? esc(v) : '<span class="tk-muted">—</span>') + '</dd></div>';
      }).join('') + '</dl></div>';
    }).join('');
  }
  async function loadMine() {
    var pane = $('pane-hoso'); pane.innerHTML = '<p class="tk-muted">Đang tải hồ sơ…</p>';
    try {
      var s = await db.collection('profiles').doc(me.id).get();
      pane.innerHTML = s.exists
        ? '<div class="tk-cards">' + profileHtml(s.data()) + '</div><p class="tk-muted tk-small">Thông tin chưa đúng? Báo quản trị viên của Khoa để cập nhật.</p>'
        : '<div class="tk-card"><p>Chưa có hồ sơ cho tài khoản này.' + (isAdmin ? ' Bạn có thể nhập ở tab “Hồ sơ giảng viên”.' : ' Liên hệ quản trị viên của Khoa.') + '</p></div>';
    } catch (e) { pane.innerHTML = '<div class="tk-card"><p class="tk-err">Không tải được hồ sơ (' + esc(e.code || e.message) + ').</p></div>'; }
  }

  /* ---------- đổi mật khẩu ---------- */
  $('pwForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var msg = $('pwMsg'); msg.className = 'tk-err'; msg.textContent = '';
    var a = $('pwNew').value, b2 = $('pwNew2').value;
    if (a !== b2) { msg.textContent = 'Hai lần nhập mật khẩu mới không khớp.'; return; }
    if (a.length < 6) { msg.textContent = 'Mật khẩu mới cần ít nhất 6 ký tự.'; return; }
    try {
      var u = auth.currentUser;
      await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, $('pwOld').value));
      await u.updatePassword(a);
      $('pwForm').reset(); msg.className = 'tk-ok'; msg.textContent = 'Đã đổi mật khẩu. Lần sau đăng nhập bằng mật khẩu mới.';
    } catch (err) { msg.textContent = /wrong-password|invalid-credential/.test(err.code || '') ? 'Mật khẩu hiện tại không đúng.' : authErr(err); }
  });

  /* ---------- quản trị: danh sách hồ sơ ---------- */
  async function loadAll() {
    try {
      var us = await db.collection('users').get(), ps = await db.collection('profiles').get();
      var prof = {}; ps.forEach(function (d) { prof[d.id] = d.data(); });
      all = us.docs.map(function (d) { var u = d.data(); return { id: d.id, user: u, p: prof[d.id] || null }; })
        .sort(function (a, b) { return ((a.p && a.p.stt) || 999) - ((b.p && b.p.stt) || 999) || String(a.user.name).localeCompare(String(b.user.name), 'vi'); });
      renderAll();
    } catch (e) { $('gvTable').innerHTML = '<tr><td class="tk-err">Không tải được danh sách (' + esc(e.code || e.message) + ').</td></tr>'; }
  }
  function renderAll() {
    var q = $('gvSearch').value.trim().toLowerCase();
    var rows = all.filter(function (r) {
      if (!q) return true;
      var p = r.p || {};
      return [r.user.name, r.user.username, p.chucVu, p.sdt, p.email, p.bangCap].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    $('gvTable').innerHTML = '<thead><tr><th>#</th><th>Họ và tên</th><th>Chức vụ</th><th>Ngày sinh</th><th>Bằng cấp</th><th>SĐT</th><th>Tên đăng nhập</th><th></th></tr></thead><tbody>' +
      rows.map(function (r) {
        var p = r.p || {};
        return '<tr><td>' + esc(p.stt || '') + '</td><td><b>' + esc(p.hoTen || r.user.name) + '</b>' + (r.user.disabled ? ' <span class="tk-tag">Đã khóa</span>' : '') + '</td><td>' + esc(p.chucVu || '') + '</td><td>' + esc(p.ngaySinh || '') + '</td><td>' + esc(p.bangCap || '') + '</td><td>' + esc(p.sdt || '') + '</td><td class="tk-mono">' + esc(r.user.username || '') + '</td><td><button class="btn btn--quiet tk-sm" type="button" data-edit="' + esc(r.id) + '">' + (r.p ? 'Xem / sửa' : 'Nhập hồ sơ') + '</button></td></tr>';
      }).join('') + '</tbody>';
  }
  $('gvSearch').addEventListener('input', renderAll);
  $('gvTable').addEventListener('click', function (e) {
    var b = e.target.closest('[data-edit]'); if (!b) return;
    var r = all.filter(function (x) { return x.id === b.dataset.edit; })[0]; if (!r) return;
    editing = r; var p = r.p || { hoTen: r.user.name };
    $('editTitle').textContent = 'Hồ sơ: ' + (p.hoTen || r.user.name);
    $('editFields').innerHTML = FIELDS.map(function (f) {
      return '<label>' + f[1] + '<input class="tk-in" name="' + f[0] + '" value="' + esc(p[f[0]] || '') + '"></label>';
    }).join('');
    $('editMsg').textContent = ''; $('tkModal').hidden = false;
    $('editFields').querySelector('input').focus();
  });
  function closeEdit() { $('tkModal').hidden = true; editing = null; }
  $('editClose').addEventListener('click', closeEdit);
  $('tkModal').addEventListener('click', function (e) { if (e.target === $('tkModal')) closeEdit(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('tkModal').hidden) closeEdit(); });
  $('editForm').addEventListener('submit', async function (e) {
    e.preventDefault(); if (!editing) return;
    var data = { stt: (editing.p && editing.p.stt) || null, updatedAt: Date.now(), updatedBy: me.id };
    $('editFields').querySelectorAll('input').forEach(function (i) { data[i.name] = i.value.trim(); });
    try {
      await db.collection('profiles').doc(editing.id).set(data, { merge: true });
      editing.p = Object.assign({}, editing.p || {}, data);
      closeEdit(); renderAll(); if (editing === null && me) loadMine();
    } catch (err) { $('editMsg').textContent = 'Không lưu được (' + (err.code || err.message) + ').'; }
  });
})();
