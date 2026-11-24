/**
 * ĐỒNG BỘ "QUẢN LÝ HỒ SƠ KHOA" (Google Sheet)  →  WEBSITE khoaduocxncmc.id.vn (mục Hồ sơ Khoa)
 * ------------------------------------------------------------------------------------------
 * Cách cài (chỉ làm 1 lần, xem hướng dẫn chi tiết trong README.md cùng thư mục):
 *  1. Mở Google Sheet → Tiện ích mở rộng → Apps Script.
 *  2. Dán toàn bộ file này vào Code.gs; bật "Hiển thị tệp kê khai appsscript.json" và dán appsscript.json.
 *  3. Chạy hàm  caiDat()  một lần, bấm "Cho phép" khi Google hỏi quyền.
 * Sau đó: mỗi lần sửa Sheet, website tự cập nhật sau khoảng 1–2 phút; ngoài ra có menu
 * "🌐 Website" → "Đồng bộ ngay" và tự đồng bộ lại mỗi đêm.
 *
 * Tài khoản Google chạy script phải có quyền trong dự án Firebase "khoadxn-phong-thuc-hanh"
 * (chủ dự án là khoaduocxn2021@gmail.com). Không cần nhập mật khẩu hay khóa bí mật nào.
 */

var PROJECT_ID = 'khoadxn-phong-thuc-hanh';

/* Cấu hình từng trang tính: id (tên tài liệu trên web), nhóm (menu bên trái), riengTu = chỉ Admin xem.
   Trang tính mới không có trong danh sách vẫn được đồng bộ vào nhóm "Khác". */
var CAU_HINH = {
  'HS Khoa':                  { id: 'hs-khoa',            nhom: 'Hồ sơ Khoa',         thuTu: 1 },
  'Theo dõi CV':              { id: 'theo-doi-cv',        nhom: 'Hồ sơ Khoa',         thuTu: 2 },
  'Số đi':                    { id: 'so-di',              nhom: 'Công văn',           thuTu: 3 },
  'KH Dược':                  { id: 'kh-duoc',            nhom: 'Kế hoạch',           thuTu: 4 },
  'KH Xét nghiệm':            { id: 'kh-xet-nghiem',      nhom: 'Kế hoạch',           thuTu: 5 },
  'Khảo sát':                 { id: 'khao-sat',           nhom: 'Kế hoạch',           thuTu: 6 },
  'Thẩm định GT':             { id: 'tham-dinh-gt',       nhom: 'Đào tạo',            thuTu: 7 },
  'TT GVCN, BCS':             { id: 'gvcn-bcs',           nhom: 'Sinh viên',          thuTu: 8 },
  'DS Hoạt động SV':          { id: 'hoat-dong-sv',       nhom: 'Sinh viên',          thuTu: 9 },
  'PCNV khác':                { id: 'pcnv-khac',          nhom: 'Nhân sự',            thuTu: 10 },
  'GV Cơ Hữu':                { id: 'gv-co-huu',          nhom: 'Nhân sự',            thuTu: 11, riengTu: true },
  'GV Thỉnh giảng':           { id: 'gv-thinh-giang',     nhom: 'Nhân sự',            thuTu: 12, riengTu: true },
  'Thi đua':                  { id: 'thi-dua',            nhom: 'Nhân sự',            thuTu: 13, riengTu: true },
  'Quy chế, quy trình chung': { id: 'quy-che-chung',      nhom: 'Quy chế - Quy trình', thuTu: 14 },
  'P. TCCB':                  { id: 'p-tccb',             nhom: 'Quy chế - Quy trình', thuTu: 15 },
  'P. Đào tạo':               { id: 'p-dao-tao',          nhom: 'Quy chế - Quy trình', thuTu: 16 },
  'P. KĐ-BĐCL':               { id: 'p-kd-bdcl',          nhom: 'Quy chế - Quy trình', thuTu: 17 },
  'P. QLHSSV':                { id: 'p-qlhssv',           nhom: 'Quy chế - Quy trình', thuTu: 18 },
  'P. HC-QT':                 { id: 'p-hc-qt',            nhom: 'Quy chế - Quy trình', thuTu: 19 },
  'P. KT-TC':                 { id: 'p-kt-tc',            nhom: 'Quy chế - Quy trình', thuTu: 20 },
  'P. NCKH':                  { id: 'p-nckh',             nhom: 'Quy chế - Quy trình', thuTu: 21 }
};

/* Che mật khẩu ghi trong ô (ví dụ "MK: abc123") trước khi đưa lên web cho giảng viên. */
var MAU_MAT_KHAU = /(m[ậa]t\s*kh[ẩa]u|\bmk|\bpass(word)?)\s*[:：]\s*\S+/gi;

/* ======================= MENU & TRIGGER ======================= */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🌐 Website')
    .addItem('Đồng bộ ngay', 'dongBoTatCa')
    .addItem('Cài đặt tự động đồng bộ', 'caiDat')
    .addToUi();
}

/** Chạy 1 lần: tạo trigger khi sửa + mỗi đêm, rồi đồng bộ toàn bộ. */
function caiDat() {
  var ss = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('khiSua').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('khiSua').forSpreadsheet(ss).onChange().create();
  ScriptApp.newTrigger('dongBoTatCa').timeBased().everyDays(1).atHour(1).create();
  ScriptApp.newTrigger('xuLyHangCho').timeBased().everyMinutes(1).create();
  dongBoTatCa();
  try { SpreadsheetApp.getUi().alert('Đã cài đặt xong. Từ nay sửa Sheet là website tự cập nhật (sau khoảng 1–2 phút).'); } catch (e) {}
}

/** Khi sửa: chỉ ghi nhận trang tính cần đồng bộ (gộp nhiều lần sửa liên tiếp). */
function khiSua(e) {
  var props = PropertiesService.getDocumentProperties();
  var ten = '';
  try { ten = e && e.range ? e.range.getSheet().getName() : SpreadsheetApp.getActiveSheet().getName(); } catch (x) {}
  var ds = JSON.parse(props.getProperty('HANG_CHO') || '[]');
  if (e && e.changeType && e.changeType !== 'EDIT') ten = '*';      // thêm/xóa/đổi tên trang tính → đồng bộ hết
  if (ds.indexOf(ten || '*') < 0) ds.push(ten || '*');
  props.setProperty('HANG_CHO', JSON.stringify(ds));
}

/** Chạy mỗi phút: đồng bộ các trang tính vừa sửa. */
function xuLyHangCho() {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) return;
  try {
    var props = PropertiesService.getDocumentProperties();
    var ds = JSON.parse(props.getProperty('HANG_CHO') || '[]');
    if (!ds.length) return;
    props.deleteProperty('HANG_CHO');
    if (ds.indexOf('*') >= 0) return dongBoTatCa_();
    var ss = SpreadsheetApp.getActive();
    ds.forEach(function (ten) { var sh = ss.getSheetByName(ten); if (sh) dongBoTrang_(sh); });
    ghiThongTin_(ss);
  } finally { lock.releaseLock(); }
}

function dongBoTatCa() {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try { dongBoTatCa_(); } finally { lock.releaseLock(); }
}

/* ======================= ĐỌC SHEET ======================= */
function dongBoTatCa_() {
  var ss = SpreadsheetApp.getActive();
  var idDaCo = {};
  ss.getSheets().forEach(function (sh) {
    if (sh.isSheetHidden()) return;
    var r = dongBoTrang_(sh); idDaCo[r.coll + '/' + r.id] = true;
  });
  // xóa tài liệu của trang tính đã bị xóa/đổi tên
  ['hoso', 'hoso_admin'].forEach(function (coll) {
    lietKe_(coll).forEach(function (id) { if (!idDaCo[coll + '/' + id]) xoa_(coll + '/' + id); });
  });
  ghiThongTin_(ss);
}

function cauHinh_(ten) {
  var c = CAU_HINH[ten];
  if (c) return c;
  var id = ten.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'trang';
  return { id: id, nhom: 'Khác', thuTu: 99 };
}

function dongBoTrang_(sh) {
  var ten = sh.getName(), c = cauHinh_(ten);
  var coll = c.riengTu ? 'hoso_admin' : 'hoso';
  var rows = docTrang_(sh, !c.riengTu);
  ghi_(coll + '/' + c.id, {
    ten: ten, nhom: c.nhom, thuTu: c.thuTu, riengTu: !!c.riengTu, gid: sh.getSheetId(),
    rows: rows, capNhat: new Date()
  });
  return { coll: coll, id: c.id };
}

/** Trả về mảng dòng: [{c:[{t:'chữ', u:'link'}...]}], bỏ dòng/cột trống ở cuối. */
function docTrang_(sh, cheMatKhau) {
  var nR = sh.getLastRow(), nC = sh.getLastColumn();
  if (!nR || !nC) return [];
  nR = Math.min(nR, 3000); nC = Math.min(nC, 60);
  var rg = sh.getRange(1, 1, nR, nC);
  var vals = rg.getDisplayValues(), rich = rg.getRichTextValues(), fx = rg.getFormulas();
  var out = [], maxC = 0;
  for (var i = 0; i < nR; i++) {
    var cells = [], any = false;
    for (var j = 0; j < nC; j++) {
      var t = String(vals[i][j] || '').trim(), u = '';
      var rt = rich[i][j];
      if (rt) {
        u = rt.getLinkUrl() || '';
        if (!u) { var runs = rt.getRuns(); for (var k = 0; k < runs.length && !u; k++) u = runs[k].getLinkUrl() || ''; }
      }
      if (!u && fx[i][j]) { var m = /HYPERLINK\(\s*"([^"]+)"/i.exec(fx[i][j]); if (m) u = m[1]; }
      if (!u && /^https?:\/\/\S+$/.test(t)) u = t;
      if (cheMatKhau) t = t.replace(MAU_MAT_KHAU, '$1: ••••••');
      if (t.length > 3000) t = t.slice(0, 3000) + '…';
      var cell = { t: t }; if (u) cell.u = u;
      cells.push(cell);
      if (t || u) { any = true; if (j + 1 > maxC) maxC = j + 1; }
    }
    out.push({ c: cells, _any: any });
  }
  while (out.length && !out[out.length - 1]._any) out.pop();
  return out.map(function (r) { return { c: r.c.slice(0, maxC) }; });
}

function ghiThongTin_(ss) {
  ghi_('hoso_meta/info', { sheetUrl: ss.getUrl(), dongBoLuc: new Date(), boi: Session.getEffectiveUser().getEmail() });
}

/* ======================= FIRESTORE REST ======================= */
function base_() { return 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/'; }
function goi_(method, path, body) {
  var res = UrlFetchApp.fetch(base_() + path, {
    method: method, contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Goog-User-Project': PROJECT_ID },
    payload: body ? JSON.stringify(body) : undefined
  });
  var code = res.getResponseCode();
  if (code >= 300 && !(method === 'delete' && code === 404)) {
    throw new Error('Firestore ' + code + ': ' + res.getContentText().slice(0, 400) +
      (code === 403 ? '\n→ Tài khoản Google đang chạy script chưa có quyền trong dự án Firebase. Hãy chạy bằng tài khoản chủ dự án (khoaduocxn2021@gmail.com) hoặc thêm tài khoản này vào Firebase Console → Project settings → Users and permissions.' : ''));
  }
  return code === 204 || method === 'delete' ? null : JSON.parse(res.getContentText() || '{}');
}
function ghi_(path, obj) { goi_('patch', path, { fields: toFields_(obj) }); }
function xoa_(path) { goi_('delete', path); }
function lietKe_(coll) {
  var ids = [], token = '';
  do {
    var r = goi_('get', coll + '?pageSize=300&mask.fieldPaths=ten' + (token ? '&pageToken=' + token : ''));
    (r.documents || []).forEach(function (d) { ids.push(d.name.split('/').pop()); });
    token = r.nextPageToken || '';
  } while (token);
  return ids;
}
function toVal_(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toVal_) } };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'object') return { mapValue: { fields: toFields_(v) } };
  return { stringValue: String(v) };
}
function toFields_(o) { var f = {}; Object.keys(o).forEach(function (k) { f[k] = toVal_(o[k]); }); return f; }
