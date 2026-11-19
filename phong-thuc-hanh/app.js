"use strict";
/* =========================================================
   QUẢN LÝ PHÒNG THỰC HÀNH – KHOA DƯỢC - XÉT NGHIỆM
   Đăng nhập bằng tên đăng nhập + mật khẩu (Firebase Authentication),
   dữ liệu lưu trên Cloud Firestore.
   ========================================================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d');
const deaccent = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D');
const fileSafe = s => deaccent(s).replace(/[\\/:*?"<>|]+/g,'').replace(/\s+/g,' ').trim();
const fmtNum = n => Number(n || 0).toLocaleString('vi-VN', {maximumFractionDigits: 3});
const TYPES = {equipment:'Thiết bị', furniture:'Trang bị', supply:'Vật tư', chemical:'Hóa chất', drug:'Thuốc, Dược chất', herbal:'Dược liệu, Đông dược'};
const EXPIRING_TYPES = ['chemical','drug','herbal'];
const YEARS = ['2025-2026', '2026-2027', '2027-2028'];
const DEPTS = {dl:'Bộ môn Dược lý - Dược lâm sàng', dlkn:'Bộ môn Dược liệu - Kiểm nghiệm', bcql:'Bộ môn Bào chế - Quản lý dược', xn:'Bộ môn Xét nghiệm'};
const HAZ = {flam:'Dễ cháy', corr:'Ăn mòn', tox:'Độc cấp tính', ox:'Oxy hóa', irr:'Kích ứng', health:'Nguy hại sức khỏe', env:'Nguy hại môi trường', expl:'Dễ nổ'};
const EQ = {ok:'Hoạt động', maint:'Đang bảo trì', broken:'Hỏng', retired:'Ngừng sử dụng'};
const EQ_PILL = {ok:'ok', maint:'s1', broken:'s2', retired:''};
const ROLES = {admin:'Quản trị viên', manager:'Giảng viên phụ trách'};

const S = {labs:[], items:[], logs:{}, loans:[], contacts:{}, users:{}, view:'overview', tab:'equipment', q:'', filter:'all', year:'all',
  loaded:{labs:false, items:false, logs:false}, skel:'', canWrite:false, err:null,
  me:{id:null, name:'', isAdmin:false, username:''}};
let db = null, auth = null, unsubs = [];
const CFG = window.FIREBASE_CONFIG || {};
const DOMAIN = window.LOGIN_DOMAIN || 'khoaduocxncmc.id.vn';
const emailOf = u => String(u).trim().toLowerCase() + '@' + DOMAIN;
const validUsername = u => /^[a-z0-9][a-z0-9._-]{2,29}$/.test(u);

/* ---------- dates & alerts ---------- */
function daysTo(s){
  if(!s) return null;
  const [y,m,d] = s.split('-').map(Number), t = new Date();
  return Math.round((new Date(y,m-1,d) - new Date(t.getFullYear(),t.getMonth(),t.getDate())) / 86400000);
}
function fmtDate(s){ if(!s) return '—'; const [y,m,d] = s.split('-'); return `${d}/${m}/${y}`; }
function toDMY(iso){ if(!iso) return ''; const [y,m,d] = String(iso).split('-'); return (y&&m&&d) ? `${d}/${m}/${y}` : ''; }
function toISO(dmy){
  const s = String(dmy ?? '').trim(); if(!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if(!m) return 'invalid';
  const d = +m[1], mo = +m[2], y = +m[3];
  if(mo < 1 || mo > 12 || d < 1 || d > 31) return 'invalid';
  return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function fmtTime(ts){ const d = new Date(ts); const p = n => String(n).padStart(2,'0'); return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; }
function todayStr(){ const d = new Date(), p = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; }

function alertsOf(it){
  const a = [];
  if(EXPIRING_TYPES.includes(it.type) && it.expiry){
    const d = daysTo(it.expiry);
    if(d < 0) a.push({sev:2, text:`Hết hạn ${-d} ngày trước`});
    else if(d <= 90) a.push({sev:1, text:`Còn ${d} ngày đến hạn`});
  }
  if(!['equipment','furniture'].includes(it.type) && it.minQty != null && it.minQty !== '' && Number(it.minQty) > 0 && Number(it.qty) <= Number(it.minQty)){
    a.push(Number(it.qty) <= 0 ? {sev:2, text:'Hết hàng'} : {sev:1, text:'Dưới mức tối thiểu'});
  }
  if(['equipment','furniture'].includes(it.type) && it.status !== 'retired'){
    if(it.status === 'broken') a.push({sev:2, text:'Đang hỏng'});
    else if(it.status === 'maint') a.push({sev:1, text:'Đang bảo trì'});
    const d = daysTo(it.nextCheck);
    if(d != null){
      if(d < 0) a.push({sev:2, text:`Quá hạn hiệu chuẩn ${-d} ngày`});
      else if(d <= 30) a.push({sev:1, text:`Hiệu chuẩn sau ${d} ngày`});
    }
  }
  return a;
}
const maxSev = arr => arr.reduce((m,x) => Math.max(m, x.sev), 0);
const itemsOf = (labId, type) => S.items.filter(i => i.labId === labId && (!type || i.type === type));
const activeLoansOf = labId => S.loans.filter(l => l.labId === labId && l.remaining > 0);
function availableQty(item){
  const out = S.loans.filter(l => l.itemId === item.id && l.remaining > 0).reduce((s,l) => s + Number(l.remaining || 0), 0);
  return Math.max(0, Number(item.qty || 0) - out);
}
function loanAlert(loan){
  if(!loan.dueDate || loan.remaining <= 0) return null;
  const d = daysTo(loan.dueDate);
  if(d < 0) return {sev:2, text:`Quá hạn trả ${-d} ngày`};
  if(d <= 2) return {sev:1, text: d === 0 ? 'Hạn trả hôm nay' : `Hạn trả sau ${d} ngày`};
  return null;
}
function labAlertStats(labId){
  let s2 = 0, s1 = 0;
  for(const it of itemsOf(labId)){ const m = maxSev(alertsOf(it)); if(m === 2) s2++; else if(m === 1) s1++; }
  for(const ln of activeLoansOf(labId)){ const a = loanAlert(ln); if(a && a.sev === 2) s2++; else if(a && a.sev === 1) s1++; }
  return {s2, s1};
}
function sortLabs(list){
  return [...list].sort((a,b) => (Number(a.order ?? 1e15) - Number(b.order ?? 1e15)) || String(a.code||a.name).localeCompare(String(b.code||b.name),'vi'));
}

/* ---------- people & permissions ---------- */
const myLab = () => S.me.id ? S.labs.find(l => l.managerId === S.me.id) : null;
const isMgr = lab => !!S.me.id && lab.managerId === S.me.id;
const canEditLab = lab => S.canWrite && (isMgr(lab) || S.me.isAdmin);
const canCreateLab = () => S.canWrite && S.me.isAdmin;
function nameOf(uid){
  if(!uid) return '';
  const p = S.users[uid];
  if(p && p.name) return p.name;
  if(uid === S.me.id) return S.me.name || 'Bạn';
  return p === undefined && /^u_/.test(uid) ? 'Người dùng (hệ thống cũ)' : 'Giảng viên';
}
const initials = n => String(n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
const avatarImg = (uid, cls = 'sm') => uid ? `<span class="av ${cls}">${esc(initials(nameOf(uid)))}</span>` : '';
const managerLabel = lab => lab.managerId ? nameOf(lab.managerId) : (lab.managerName || '');
const managerAvatarHtml = lab => lab.managerId ? avatarImg(lab.managerId) : '';
function roleLabel(){
  if(S.me.isAdmin) return 'Quản trị viên';
  const l = myLab(); return l ? `Phụ trách ${l.name}` : 'Chưa được giao phòng';
}

/* ---------- write helpers ---------- */
let chain = Promise.resolve();
function enqueue(fn){
  chain = chain.then(fn).catch(e => {
    console.error(e);
    const msg = e && e.code === 'permission-denied' ? 'Không lưu được: tài khoản của bạn không có quyền thực hiện thao tác này.'
      : e && e.code === 'unavailable' ? 'Mất kết nối mạng, thay đổi sẽ được lưu khi có mạng.' : 'Không lưu được, vui lòng thử lại.';
    toast(msg);
  });
  return chain;
}
async function addLog(labId, entry){
  const cur = S.logs[labId] || [];
  const next = [Object.assign({at:Date.now(), uid:S.me.id}, entry), ...cur].slice(0, 200);
  await db.doc('logs/' + labId).set({entries: next});
}
let toastT;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 4500); }

/* ---------- rendering: sidebar ---------- */
function renderSide(){
  const labs = sortLabs(S.labs);
  const totals = labs.reduce((t,l) => { const s = labAlertStats(l.id); return {s2:t.s2+s.s2, s1:t.s1+s.s1}; }, {s2:0,s1:0});
  const badge = s => s.s2 ? `<span class="badge b2" title="${s.s2} mục khẩn">${s.s2 + s.s1}</span>` : s.s1 ? `<span class="badge b1">${s.s1}</span>` : '';
  const canReorder = S.canWrite && S.me.isAdmin;
  $('#side').innerHTML = `
    <div class="brand"><b>Kho Thực Hành</b><span>Khoa Dược - Xét nghiệm</span><a href="../index.html">← Về trang chủ Khoa</a></div>
    <nav class="nav" aria-label="Các phòng">
      <div class="nav-label">Phòng thực hành${canReorder ? ' <span class="hint" style="text-transform:none;font-weight:400;letter-spacing:0">· kéo để sắp xếp</span>' : ''}</div>
      <button data-go="overview" aria-current="${S.view==='overview'}"><span class="n1">Tổng quan</span>${badge(totals)}<span class="n2">${labs.length} phòng</span></button>
      ${labs.map(l => `<button data-go="${esc(l.id)}" aria-current="${S.view===l.id}" ${canReorder ? `draggable="true" data-drag-id="${esc(l.id)}"` : ''}>
        <span class="n1">${esc(l.name)}</span>${badge(labAlertStats(l.id))}
        <span class="n2">${managerLabel(l) ? esc(managerLabel(l)) : (l.code ? esc(l.code) : 'chưa có người phụ trách')}</span></button>`).join('')}
    </nav>
    ${canCreateLab() ? `<button class="btn" data-act="newlab">+ Thêm phòng</button>` : ''}
    ${S.me.isAdmin ? `<nav class="nav" aria-label="Quản trị"><div class="nav-label">Quản trị</div>
      <button data-go="accounts" aria-current="${S.view==='accounts'}"><span class="n1">Quản lý tài khoản</span><span class="n2">${Object.keys(S.users).length} tài khoản</span></button></nav>` : ''}
    <div class="nav-label">Tài khoản</div>
    <button class="viewer" type="button" data-act="account"><span class="av">${esc(initials(S.me.name))}</span><div><b>${esc(S.me.name || S.me.username)}</b><span>${esc(roleLabel())} · Hồ sơ</span></div></button>
    <button class="btn" data-act="logout">Đăng xuất</button>`;
}

/* ---------- rendering: overview ---------- */
function overviewHtml(){
  const labs = sortLabs(S.labs);
  const labById = Object.fromEntries(labs.map(l => [l.id, l]));
  const entries = [];
  S.items.filter(i => labById[i.labId]).forEach(i => {
    const al = alertsOf(i); if(!al.length) return; const l = labById[i.labId];
    entries.push({sev: maxSev(al), code: l.name, html: `<button data-act="open" data-lab="${esc(l.id)}" data-tab="${esc(i.type)}">
        <span class="pill s${maxSev(al)}">${maxSev(al)===2?'Khẩn':'Chú ý'}</span>
        <span><span class="t">${esc(i.name)}</span><br><span class="m">${TYPES[i.type]} · ${esc(al.map(a=>a.text).join(' · '))}</span></span>
        <span class="lab">${esc(l.name)}</span></button>`});
  });
  S.loans.filter(ln => labById[ln.labId]).forEach(ln => {
    const a = loanAlert(ln); if(!a) return; const l = labById[ln.labId];
    entries.push({sev: a.sev, code: l.name, html: `<button data-act="open" data-lab="${esc(l.id)}" data-tab="loans">
        <span class="pill s${a.sev}">${a.sev===2?'Khẩn':'Chú ý'}</span>
        <span><span class="t">${esc(ln.itemName)} — ${esc(ln.borrower)}</span><br><span class="m">Mượn/Trả · ${esc(a.text)}</span></span>
        <span class="lab">${esc(l.name)}</span></button>`});
  });
  entries.sort((a,b) => b.sev - a.sev || a.code.localeCompare(b.code,'vi'));
  const alertBlock = entries.length ? `<div class="alist">${entries.slice(0,40).map(e => e.html).join('')}</div>
      ${entries.length > 40 ? `<p class="hint" style="margin-top:8px">Còn ${entries.length-40} mục khác, xem trong từng phòng.</p>` : ''}`
    : `<div class="ok-note">${S.items.length || S.loans.length ? 'Không có mục nào cần xử lý.' : 'Chưa có dữ liệu để kiểm tra.'}</div>`;
  const cardHtml = l => { const st = labAlertStats(l.id);
    return `<button class="card" data-go="${esc(l.id)}">
      <div><h3>${esc(l.name)}</h3><span class="code">${esc(l.code||'')}${l.location ? ' · ' + esc(l.location) : ''}</span></div>
      <div class="counts"><span><b>${itemsOf(l.id,'equipment').length}</b> thiết bị</span><span><b>${itemsOf(l.id,'furniture').length}</b> trang bị</span><span><b>${itemsOf(l.id,'supply').length}</b> vật tư</span><span><b>${itemsOf(l.id,'chemical').length}</b> hóa chất</span><span><b>${itemsOf(l.id,'drug').length}</b> thuốc</span><span><b>${itemsOf(l.id,'herbal').length}</b> dược liệu</span></div>
      <div class="row">${managerLabel(l) ? `<span class="mgr">${managerAvatarHtml(l)}${esc(managerLabel(l))}${!l.managerId ? ' <span class="hint">(chưa có tài khoản)</span>' : ''}</span>` : `<span class="pill">Chưa có người phụ trách</span>`}
        ${st.s2 ? `<span class="pill s2">${st.s2} khẩn</span>` : ''}${st.s1 ? `<span class="pill s1">${st.s1} chú ý</span>` : ''}</div></button>`; };
  const deptOrder = [...Object.keys(DEPTS), ''];
  const grouped = deptOrder.map(k => ({k, list: labs.filter(l => (l.dept||'') === k)})).filter(g => g.list.length);
  const cards = grouped.length <= 1 ? `<div class="cards">${labs.map(cardHtml).join('')}</div>`
    : grouped.map(g => `<div style="margin-bottom:18px"><h3 style="font-size:13px;font-weight:700;color:var(--ink2);margin-bottom:8px">${g.k ? esc(DEPTS[g.k]) : 'Chưa phân bộ môn'}</h3><div class="cards">${g.list.map(cardHtml).join('')}</div></div>`).join('');
  return `
    ${S.err ? `<div class="banner">Không đọc được dữ liệu (${esc(S.err)}). Tải lại trang để thử lại.</div>` : ''}
    <div class="pagehead"><div><h1>Tổng quan các phòng</h1>
      <p class="sub">Mỗi phòng do một giảng viên phụ trách. Bạn xem được mọi phòng, chỉ sửa được phòng của mình.</p></div>
      <div class="actions">${canCreateLab() ? `<button class="btn primary" data-act="newlab">+ Thêm phòng</button>` : ''}</div></div>
    ${labs.length ? `<section class="section"><h2>Cần xử lý</h2>${alertBlock}</section>
    <section class="section"><h2>Các phòng</h2>${cards}</section>`
    : `<div class="empty">Chưa có phòng nào. ${canCreateLab() ? 'Bấm “Thêm phòng” để tạo phòng đầu tiên.' : 'Quản trị viên cần tạo phòng trước.'}</div>`}`;
}

/* ---------- rendering: lab view ---------- */
function labHeadHtml(lab){
  const can = canEditLab(lab), st = labAlertStats(lab.id);
  const claim = S.canWrite && !lab.managerId && S.me.id && !myLab() && !S.me.isAdmin;
  const ct = lab.managerId && S.contacts[lab.managerId];
  return `${S.err ? `<div class="banner">Không đọc được dữ liệu (${esc(S.err)}).</div>` : ''}
    <div class="pagehead"><div><h1>${esc(lab.name)}</h1>
      <div class="sub">${lab.code ? `<span class="code">${esc(lab.code)}</span>` : ''}${lab.dept ? `<span class="pill">${esc(DEPTS[lab.dept]||lab.dept)}</span>` : ''}${lab.location ? `<span>${esc(lab.location)}</span>` : ''}
        ${managerLabel(lab) ?`<span class="mgr">${managerAvatarHtml(lab)}Phụ trách: <b>${esc(managerLabel(lab))}</b>${isMgr(lab) ? ' (bạn)' : ''}${!lab.managerId ? ' <span class="hint">(chưa có tài khoản)</span>' : ''}</span>` : `<span class="pill">Chưa có người phụ trách</span>`}
        ${ct && (ct.phone || ct.email) ? `<span class="hint">${[ct.phone, ct.email].filter(Boolean).map(esc).join(' · ')}</span>` : ''}
        ${lab.decisionNo || lab.decisionDate ? `<span class="hint">Theo QĐ${lab.decisionNo ? ' số ' + esc(lab.decisionNo) : ''}${lab.decisionDate ? ' ngày ' + fmtDate(lab.decisionDate) : ''}</span>` : ''}
        ${can ? `<span class="pill role">${isMgr(lab) ? 'Bạn quản lý phòng này' : 'Quyền quản trị'}</span>` : `<span class="pill">Chỉ xem</span>`}
        ${st.s2 ? `<span class="pill s2">${st.s2} khẩn</span>` : ''}${st.s1 ? `<span class="pill s1">${st.s1} chú ý</span>` : ''}</div></div>
      <div class="actions">
        ${claim ? `<button class="btn primary" data-act="claim" data-id="${esc(lab.id)}">Nhận phụ trách phòng này</button>` : ''}
        ${S.me.isAdmin ? `<button class="btn" data-act="assign" data-id="${esc(lab.id)}">Đổi người phụ trách</button>` : ''}
        ${can ? `<button class="btn" data-act="editlab" data-id="${esc(lab.id)}">Sửa thông tin</button>` : ''}
      </div></div>`;
}
const incomingLoans = labId => S.loans.filter(l => l.borrowerLabId === labId && l.remaining > 0);
function tabsHtml(lab){
  const tabs = [['equipment','Thiết bị'],['furniture','Trang bị'],['supply','Vật tư'],['chemical','Hóa chất'],['drug','Thuốc, Dược chất'],['herbal','Dược liệu, Đông dược'],['loans','Mượn/Trả'],['log','Nhật ký']];
  const countOf = k => k === 'log' ? null : k === 'loans' ? activeLoansOf(lab.id).length + incomingLoans(lab.id).length : itemsOf(lab.id,k).length;
  return `<div class="tabs" role="tablist">${tabs.map(([k,l]) => { const c = countOf(k);
    return `<button role="tab" data-tab="${k}" aria-selected="${S.tab===k}">${l}${c!=null ? `<span>${c}</span>` : ''}</button>`; }).join('')}</div>`;
}
function toolHtml(lab){
  if(S.tab === 'log') return '';
  const can = canEditLab(lab);
  if(S.tab === 'loans') return `<div class="tool">${can ? `<button class="btn primary" data-act="loanNew">+ Cho mượn</button>` : ''}</div>`;
  return `<div class="tool"><input class="search" id="q" type="search" placeholder="Tìm theo tên, mã, vị trí…" value="${esc(S.q)}" aria-label="Tìm kiếm">
    <select id="flt" aria-label="Lọc"><option value="all">Tất cả</option><option value="alert" ${S.filter==='alert'?'selected':''}>Cần xử lý</option></select>
    <select id="fyr" aria-label="Lọc theo năm học"><option value="all">Tất cả năm học</option>${YEARS.map(y => `<option value="${y}" ${S.year===y?'selected':''}>Năm học ${y}</option>`).join('')}</select>
    <button class="btn" data-act="export">Xuất Excel</button>
    ${can ? `<button class="btn primary" data-act="add">+ Thêm ${TYPES[S.tab].toLowerCase()}</button>` : ''}</div>`;
}
function visibleItems(lab){
  let list = itemsOf(lab.id, S.tab);
  const q = norm(S.q);
  if(q) list = list.filter(i => norm([i.name,i.code,i.formula,i.cas,i.location,i.serial,i.lot,i.origin].join(' ')).includes(q));
  if(S.filter === 'alert') list = list.filter(i => alertsOf(i).length);
  if(S.year !== 'all') list = list.filter(i => i.year === S.year);
  return list.sort((a,b) => String(a.name).localeCompare(String(b.name),'vi'));
}
function stockCell(i){
  const al = alertsOf(i).filter(a => /hàng|tối thiểu/.test(a.text)), sev = maxSev(al);
  const min = Number(i.minQty) || 0, pct = min ? Math.min(100, Number(i.qty) / (min * 3) * 100) : 100;
  return `<b>${fmtNum(i.qty)}</b> ${esc(i.unit||'')}${min ? `<div class="meter s${sev}" title="Mức tối thiểu: ${fmtNum(min)} ${esc(i.unit||'')}"><b style="width:${pct}%"></b></div>` : ''}`;
}
function actCell(i, can, stock){
  if(!can) return '';
  return `<td><div class="act">${stock ? `<button class="btn sm" data-act="adj" data-id="${esc(i.id)}">Nhập/Xuất</button>` : ''}
    <button class="btn sm" data-act="edit" data-id="${esc(i.id)}">Sửa</button>
    <button class="btn sm danger" data-act="del" data-id="${esc(i.id)}">Xóa</button></div></td>`;
}
function loanRows(lab){
  return S.loans.filter(l => l.labId === lab.id).slice().sort((a,b) => {
    const aA = a.remaining > 0, bA = b.remaining > 0;
    if(aA !== bA) return aA ? -1 : 1;
    if(aA) return (a.dueDate||'9999-99-99').localeCompare(b.dueDate||'9999-99-99');
    return (b.returnedAt||0) - (a.returnedAt||0);
  });
}
function loanRowHtml(l, can){
  const active = l.remaining > 0, a = loanAlert(l);
  const borrowerCell = l.borrowerLabId
    ? `<button type="button" class="btn sm" data-act="open" data-lab="${esc(l.borrowerLabId)}" data-tab="loans">${esc(l.borrower || 'Phòng khác')}</button>`
    : esc(l.borrower);
  return `<tr><td><div class="nm">${esc(l.itemName)}</div><span class="cd">${esc(TYPES[l.itemType]||'')}</span></td>
    <td>${borrowerCell}</td>
    <td class="num">${fmtNum(l.remaining)}${Number(l.remaining) !== Number(l.qty) ? ' / ' + fmtNum(l.qty) : ''} ${esc(l.unit||'')}</td>
    <td>${fmtDate(l.borrowedDate)}</td>
    <td>${l.dueDate ? `<span class="pill ${a?'s'+a.sev:''}">${fmtDate(l.dueDate)}</span>` : '<span class="muted">—</span>'}</td>
    <td>${active ? `<span class="pill ${a?'s'+a.sev:''}">${a && a.sev===2 ? 'Quá hạn' : 'Đang mượn'}</span>` : `<span class="pill ok">Đã trả</span>`}</td>
    ${can ? `<td><div class="act">${active ? `<button class="btn sm" data-act="loanReturn" data-id="${esc(l.id)}">Trả</button>` : ''}
      <button class="btn sm danger" data-act="loanDel" data-id="${esc(l.id)}">Xóa</button></div></td>` : ''}</tr>`;
}
function listHtml(lab){
  if(S.tab === 'log'){
    const ent = S.logs[lab.id] || [];
    const acts = {add:'Thêm mới', edit:'Chỉnh sửa', del:'Xóa', in:'Nhập kho', out:'Xuất kho', loan:'Cho mượn thiết bị', return:'Trả thiết bị'};
    return ent.length ? `<div class="log">${ent.map(e => `<div><time>${fmtTime(e.at)}</time><span><b>${esc(e.byName || nameOf(e.uid))}</b> · ${acts[e.act]||''} <b>${esc(e.name||'')}</b>${e.qty ? ` (${e.act==='out'?'−':e.act==='loan'||e.act==='return'?'':'+'}${fmtNum(e.qty)} ${esc(e.unit||'')})` : ''}${e.note ? ` <span class="muted">— ${esc(e.note)}</span>` : ''}</span></div>`).join('')}</div>`
      : `<div class="empty">Chưa có thao tác nào được ghi lại.</div>`;
  }
  if(S.tab === 'loans'){
    const can = canEditLab(lab), rows = loanRows(lab), incoming = incomingLoans(lab.id);
    const th = t => `<th>${t}</th>`;
    const incomingHtml = incoming.length ? `<div class="section" style="margin-bottom:16px"><h2>Đang mượn từ phòng khác</h2>
      <div class="tw"><table><thead><tr>${th('Mục mượn')}${th('Từ phòng')}${th('Số lượng')}${th('Ngày mượn')}${th('Hạn trả')}${th('Trạng thái')}</tr></thead>
      <tbody>${incoming.map(l => { const lender = S.labs.find(x => x.id === l.labId), a = loanAlert(l);
        return `<tr><td><div class="nm">${esc(l.itemName)}</div><span class="cd">${esc(TYPES[l.itemType]||'')}</span></td>
        <td><button type="button" class="btn sm" data-act="open" data-lab="${esc(l.labId)}" data-tab="loans">${esc(lender ? lender.name : 'Phòng khác')}</button></td>
        <td class="num">${fmtNum(l.remaining)}${Number(l.remaining) !== Number(l.qty) ? ' / ' + fmtNum(l.qty) : ''} ${esc(l.unit||'')}</td>
        <td>${fmtDate(l.borrowedDate)}</td>
        <td>${l.dueDate ? `<span class="pill ${a?'s'+a.sev:''}">${fmtDate(l.dueDate)}</span>` : '<span class="muted">—</span>'}</td>
        <td><span class="pill ${a?'s'+a.sev:''}">${a && a.sev===2 ? 'Quá hạn' : 'Đang mượn'}</span></td></tr>`; }).join('')}</tbody></table></div>
      <p class="hint" style="margin-top:6px">Việc trả hoặc chỉnh sửa lượt mượn này thực hiện ở phòng cho mượn.</p></div>` : '';
    if(!rows.length) return incomingHtml || `<div class="empty">Phòng này chưa có lượt mượn nào.</div>`;
    return incomingHtml + `<div class="tw"><table><thead><tr>${th('Mục mượn')}${th('Người mượn')}${th('Số lượng')}${th('Ngày mượn')}${th('Hạn trả')}${th('Trạng thái')}${can?th(''):''}</tr></thead>
      <tbody>${rows.map(l => loanRowHtml(l,can)).join('')}</tbody></table></div>`;
  }
  const can = canEditLab(lab), list = visibleItems(lab);
  if(!list.length) return `<div class="empty">${itemsOf(lab.id,S.tab).length ? 'Không có mục nào khớp bộ lọc.' : `Phòng này chưa có ${TYPES[S.tab].toLowerCase()} nào.`}</div>`;
  const th = (t, c) => `<th class="${c||''}">${t}</th>`;
  const yearCell = i => `<td>${i.year ? `<span class="pill">${esc(i.year)}</span>` : '<span class="muted">—</span>'}</td>`;
  const expCell = i => { const d = daysTo(i.expiry), sev = d == null ? 0 : d < 0 ? 2 : d <= 90 ? 1 : 0;
    return `<td>${i.expiry ? `<span class="pill ${sev?'s'+sev:''}">${fmtDate(i.expiry)}</span>${i.lot ? `<div class="cd">Lô ${esc(i.lot)}</div>` : ''}` : '<span class="muted">—</span>'}</td>`; };
  let head, rows;
  if(S.tab === 'equipment'){
    head = th('Thiết bị') + th('SL','num') + th('Trạng thái') + th('Hiệu chuẩn tiếp theo') + th('Vị trí') + th('Nhập trong năm học') + (can ? th('') : '');
    rows = list.map(i => { const d = daysTo(i.nextCheck), sev = d == null ? 0 : d < 0 ? 2 : d <= 30 ? 1 : 0;
      return `<tr><td><div class="nm">${esc(i.name)}</div><span class="cd">${esc(i.code||'')}</span>${i.serial ? `<span class="cd">S/N ${esc(i.serial)}</span>` : ''}${i.note ? `<div class="hint">${esc(i.note)}</div>` : ''}</td>
      <td class="num">${fmtNum(i.qty)} ${esc(i.unit||'')}</td><td><span class="pill ${EQ_PILL[i.status||'ok']}">${EQ[i.status||'ok']}</span></td>
      <td>${i.nextCheck ? `<span class="pill ${sev?'s'+sev:''}">${fmtDate(i.nextCheck)}</span>` : '<span class="muted">—</span>'}</td>
      <td>${esc(i.location||'—')}</td>${yearCell(i)}${actCell(i,can,false)}</tr>`; }).join('');
  } else if(S.tab === 'furniture'){
    head = th('Trang bị') + th('SL','num') + th('Trạng thái') + th('Vị trí') + th('Nhập trong năm học') + (can ? th('') : '');
    rows = list.map(i => `<tr><td><div class="nm">${esc(i.name)}</div><span class="cd">${esc(i.code||'')}</span></td>
      <td class="num">${fmtNum(i.qty)} ${esc(i.unit||'')}</td><td><span class="pill ${EQ_PILL[i.status||'ok']}">${EQ[i.status||'ok']}</span></td>
      <td>${esc(i.location||'—')}</td>${yearCell(i)}${actCell(i,can,false)}</tr>`).join('');
  } else if(S.tab === 'supply'){
    head = th('Vật tư') + th('Tồn kho') + th('Tối thiểu','num') + th('Vị trí') + th('Nhập trong năm học') + (can ? th('') : '');
    rows = list.map(i => `<tr><td><div class="nm">${esc(i.name)}</div><span class="cd">${esc(i.code||'')}</span></td>
      <td class="num">${stockCell(i)}</td><td class="num">${i.minQty!=null && i.minQty!=='' ? fmtNum(i.minQty)+' '+esc(i.unit||'') : '—'}</td>
      <td>${esc(i.location||'—')}</td>${yearCell(i)}${actCell(i,can,true)}</tr>`).join('');
  } else if(S.tab === 'chemical'){
    head = th('Hóa chất') + th('Nguy hại') + th('Tồn kho') + th('Hạn dùng') + th('Vị trí') + th('Nhập trong năm học') + (can ? th('') : '');
    rows = list.map(i => `<tr><td><div class="nm">${esc(i.name)}</div><span class="cd">${esc(i.formula||'')}</span>${i.cas ? `<span class="cd">CAS ${esc(i.cas)}</span>` : ''}${i.conc ? `<div class="hint">${esc(i.conc)}</div>` : ''}</td>
      <td>${(i.hazards||[]).map(h => `<span class="hz"><i></i>${esc(HAZ[h]||h)}</span>`).join('') || '<span class="muted">—</span>'}</td>
      <td class="num">${stockCell(i)}</td>${expCell(i)}
      <td>${esc(i.location||'—')}</td>${yearCell(i)}${actCell(i,can,true)}</tr>`).join('');
  } else if(S.tab === 'drug'){
    head = th('Thuốc, dược chất') + th('Tồn kho') + th('Hạn dùng') + th('Vị trí') + th('Nhập trong năm học') + (can ? th('') : '');
    rows = list.map(i => `<tr><td><div class="nm">${esc(i.name)}</div>${i.code ? `<span class="cd">${esc(i.code)}</span>` : ''}${i.conc ? `<div class="hint">${esc(i.conc)}</div>` : ''}</td>
      <td class="num">${stockCell(i)}</td>${expCell(i)}
      <td>${esc(i.location||'—')}</td>${yearCell(i)}${actCell(i,can,true)}</tr>`).join('');
  } else {
    head = th('Dược liệu, đông dược') + th('Tồn kho') + th('Hạn dùng') + th('Vị trí') + th('Nhập trong năm học') + (can ? th('') : '');
    rows = list.map(i => `<tr><td><div class="nm">${esc(i.name)}</div>${i.code ? `<span class="cd">${esc(i.code)}</span>` : ''}${i.origin ? `<div class="hint">Xuất xứ: ${esc(i.origin)}</div>` : ''}</td>
      <td class="num">${stockCell(i)}</td>${expCell(i)}
      <td>${esc(i.location||'—')}</td>${yearCell(i)}${actCell(i,can,true)}</tr>`).join('');
  }
  return `<div class="tw"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

/* ---------- rendering: quản lý tài khoản (admin) ---------- */
function accountsAdminHtml(){
  const users = Object.entries(S.users).map(([id,u]) => Object.assign({id}, u)).sort((a,b) => (a.role === 'admin' ? -1 : 1) - (b.role === 'admin' ? -1 : 1) || String(a.name).localeCompare(String(b.name),'vi'));
  const labsOf = uid => S.labs.filter(l => l.managerId === uid).map(l => l.name);
  const urows = users.map(u => `<tr><td><div class="mgr"><span class="av sm">${esc(initials(u.name))}</span><div><div class="nm">${esc(u.name||'')}</div><span class="cd">${esc(u.username||'')}</span></div></div></td>
    <td><span class="pill ${u.role==='admin'?'role':''}">${esc(ROLES[u.role]||u.role)}</span></td>
    <td>${labsOf(u.id).map(esc).join('<br>') || '<span class="muted">—</span>'}</td>
    <td>${u.disabled ? '<span class="pill s2">Đã khóa</span>' : '<span class="pill ok">Đang hoạt động</span>'}</td>
    <td><div class="act">${u.id !== S.me.id ? `<button class="btn sm" data-act="userEdit" data-id="${esc(u.id)}">Sửa</button>` : '<span class="hint">(bạn)</span>'}</div></td></tr>`).join('');
  const labs = sortLabs(S.labs);
  const lrows = labs.map(l => `<tr><td><div class="nm">${esc(l.name)}</div>${l.code ? `<span class="cd">${esc(l.code)}</span>` : ''}</td>
    <td>${l.dept ? esc(DEPTS[l.dept]||l.dept) : '<span class="muted">—</span>'}</td>
    <td>${managerLabel(l) ? `<span class="mgr">${managerAvatarHtml(l)}${esc(managerLabel(l))}</span> ${l.managerId ? '' : '<span class="pill s1">Chưa có tài khoản</span>'}` : '<span class="pill">Chưa có người phụ trách</span>'}</td>
    <td><div class="act"><button class="btn sm" data-act="assign" data-id="${esc(l.id)}">Thiết lập</button></div></td></tr>`).join('');
  return `<div class="pagehead"><div><h1>Quản lý tài khoản</h1>
      <p class="sub">Tạo tài khoản (tên đăng nhập + mật khẩu) cho giảng viên và giao phòng thực hành cho từng người.</p></div>
      <div class="actions"><button class="btn primary" data-act="userNew">+ Tạo tài khoản</button></div></div>
    <section class="section"><h2>Tài khoản</h2>
      <div class="tw"><table><thead><tr><th>Họ tên / tên đăng nhập</th><th>Vai trò</th><th>Phòng phụ trách</th><th>Trạng thái</th><th></th></tr></thead><tbody>${urows}</tbody></table></div></section>
    <section class="section"><h2>Phân công phòng</h2>
      <div class="tw"><table><thead><tr><th>Phòng</th><th>Bộ môn</th><th>Phụ trách</th><th></th></tr></thead><tbody>${lrows}</tbody></table></div></section>
    <p class="hint">Quên mật khẩu: người dùng không tự lấy lại được. Quản trị viên khóa tài khoản cũ và tạo tài khoản mới (tên đăng nhập khác), rồi giao lại phòng.</p>`;
}

function renderMain(){
  const main = $('#main');
  if(!S.loaded.labs || !S.loaded.items){ main.innerHTML = '<div class="loading">Đang tải dữ liệu…</div>'; S.skel = ''; return; }
  if(S.view === 'accounts' && !S.me.isAdmin) S.view = 'overview';
  if(S.view === 'accounts'){ S.skel = ''; main.innerHTML = accountsAdminHtml(); return; }
  if(S.view !== 'overview' && !S.labs.find(l => l.id === S.view)) S.view = 'overview';
  if(S.view === 'overview'){ S.skel = ''; main.innerHTML = overviewHtml(); return; }
  const lab = S.labs.find(l => l.id === S.view), key = S.view + '|' + S.tab;
  if(S.skel !== key){
    main.innerHTML = '<div id="head"></div><div id="tabs"></div><div class="tool-wrap" id="tool"></div><div id="list"></div>';
    $('#tool').innerHTML = toolHtml(lab);
    S.skel = key;
  }
  $('#head').innerHTML = labHeadHtml(lab);
  $('#tabs').innerHTML = tabsHtml(lab);
  $('#list').innerHTML = listHtml(lab);
}
function renderList(){ const lab = S.labs.find(l => l.id === S.view); if(lab && $('#list')) $('#list').innerHTML = listHtml(lab); }
function renderAll(){ if(!S.me.id) return; renderSide(); renderMain(); }

/* ---------- reordering ---------- */
let dragId = null;
function reorderLabs(fromId, toId, before){
  if(fromId === toId) return;
  const list = sortLabs(S.labs);
  const fromIdx = list.findIndex(l => l.id === fromId); if(fromIdx < 0) return;
  const [moved] = list.splice(fromIdx, 1);
  let toIdx = list.findIndex(l => l.id === toId); if(toIdx < 0) return;
  if(!before) toIdx += 1;
  list.splice(toIdx, 0, moved);
  const changes = [];
  list.forEach((l, i) => { const order = (i + 1) * 10; if(Number(l.order) !== order) changes.push({id:l.id, order}); });
  if(!changes.length) return;
  const byId = Object.fromEntries(changes.map(c => [c.id, c.order]));
  S.labs = S.labs.map(l => byId[l.id] != null ? Object.assign({}, l, {order: byId[l.id]}) : l);
  renderAll();
  if(!S.me.isAdmin) return;
  enqueue(async () => { const b = db.batch(); changes.forEach(c => b.update(db.doc('labs/' + c.id), {order: c.order})); await b.commit(); });
}

/* ---------- navigation ---------- */
function go(view, tab){
  S.view = view; if(tab) S.tab = tab; else if(view !== 'overview' && view !== 'accounts' && !['equipment','furniture','supply','chemical','drug','herbal','loans','log'].includes(S.tab)) S.tab = 'equipment';
  S.q = ''; S.filter = 'all'; S.year = 'all'; S.skel = '';
  renderAll(); window.scrollTo(0,0);
}

/* ---------- modal ---------- */
function modal(title, body){
  const m = $('#modal'); m.hidden = false;
  m.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><button class="x" type="button" data-act="close" aria-label="Đóng">×</button></header><div class="dlgb">${body}</div></div>`;
  setTimeout(() => { const f = m.querySelector('input:not([type=checkbox]),select,textarea'); if(f) f.focus(); }, 0);
}
function closeModal(){ const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
const fld = (id, label, val, extra = '', wide = false) => `<label class="fld${wide?' wide':''}"><span>${label}</span><input id="${id}" value="${esc(val ?? '')}" ${extra}></label>`;
const dfld = (id, label, isoVal, wide = false) => `<label class="fld${wide?' wide':''}"><span>${label}</span><input id="${id}" class="datein" type="text" inputmode="numeric" maxlength="10" placeholder="dd/mm/yyyy" value="${esc(toDMY(isoVal))}"></label>`;
const labOptions = (selected, forUid) => `<option value="">— Không giao phòng —</option>${sortLabs(S.labs).map(l => {
  const other = l.managerId && l.managerId !== forUid ? ` (đang: ${nameOf(l.managerId)})` : '';
  return `<option value="${esc(l.id)}" ${selected===l.id?'selected':''}>${esc(l.name)}${esc(other)}</option>`; }).join('')}`;

function labForm(lab){
  modal(lab ? 'Sửa thông tin phòng' : 'Thêm phòng thực hành', `<form id="fLab" data-id="${esc(lab?.id||'')}" class="dlgb" style="padding:0">
    <div class="grid2">${fld('l_name','Tên phòng',lab?.name,'required')}${fld('l_code','Mã phòng / ghi chú',lab?.code,'placeholder="VD: P.HH-101"')}
    <label class="fld"><span>Bộ môn</span><select id="l_dept"><option value="">— Chưa phân bộ môn —</option>${Object.entries(DEPTS).map(([k,l]) => `<option value="${k}" ${lab?.dept===k?'selected':''}>${l}</option>`).join('')}</select></label>
    ${fld('l_loc','Vị trí',lab?.location,'placeholder="VD: Nhà A2, tầng 1"')}
    ${fld('l_decno','Số quyết định phân công phụ trách',lab?.decisionNo,'placeholder="VD: 123/QĐ-CĐYTCT"')}
    ${dfld('l_decdate','Ngày quyết định',lab?.decisionDate)}</div>
    <div class="foot">${lab && S.me.isAdmin ? `<button class="btn danger" type="button" data-act="dellab" data-id="${esc(lab.id)}" style="margin-right:auto">Xóa phòng</button>` : ''}
    <button class="btn" type="button" data-act="close">Hủy</button><button class="btn primary" type="submit">Lưu</button></div></form>`);
}
function accountForm(){
  const c = S.contacts[S.me.id] || {};
  modal('Hồ sơ tài khoản', `<div class="row" style="gap:10px"><span class="av">${esc(initials(S.me.name))}</span>
      <div><b>${esc(S.me.name)}</b><div class="hint">Tên đăng nhập: <b>${esc(S.me.username)}</b> · ${esc(roleLabel())}</div></div></div>
    <form id="fAccount" class="dlgb" style="padding:0">
      <div class="grid2">${fld('ac_name','Họ và tên', S.me.name, 'required', true)}
      ${fld('ac_phone','Số điện thoại liên hệ', c.phone, 'placeholder="VD: 0901 234 567"')}${fld('ac_email','Email liên hệ', c.email, 'type="email" placeholder="ten@vidu.edu.vn"')}
      ${fld('ac_title','Chức danh (tùy chọn)', c.title, 'placeholder="VD: Giảng viên"', true)}</div>
      <div class="foot"><button class="btn" type="button" data-act="close">Đóng</button><button class="btn primary" type="submit">Lưu</button></div></form>
    <form id="fPw" class="dlgb" style="padding:0;border-top:1px solid var(--line);padding-top:14px">
      <b>Đổi mật khẩu</b>
      <div class="grid2">${fld('pw_old','Mật khẩu hiện tại','','type="password" autocomplete="current-password" required', true)}
      ${fld('pw_new','Mật khẩu mới (ít nhất 6 ký tự)','','type="password" autocomplete="new-password" minlength="6" required')}
      ${fld('pw_new2','Nhập lại mật khẩu mới','','type="password" autocomplete="new-password" minlength="6" required')}</div>
      <div class="foot"><button class="btn primary" type="submit">Đổi mật khẩu</button></div></form>`);
}
function userNewForm(){
  modal('Tạo tài khoản', `<form id="fUser" class="dlgb" style="padding:0">
    <div class="grid2">${fld('u_name','Họ và tên','','required placeholder="VD: Nguyễn Văn A"', true)}
    ${fld('u_user','Tên đăng nhập','','required autocomplete="off" placeholder="VD: nguyenvana"')}
    ${fld('u_pass','Mật khẩu (ít nhất 6 ký tự)','','required minlength="6" autocomplete="new-password"')}
    <label class="fld"><span>Vai trò</span><select id="u_role"><option value="manager">Giảng viên phụ trách</option><option value="admin">Quản trị viên</option></select></label>
    <label class="fld"><span>Giao phòng thực hành</span><select id="u_lab">${labOptions('', null)}</select></label></div>
    <p class="hint">Tên đăng nhập: chữ thường không dấu, số, dấu chấm/gạch (3–30 ký tự). Gửi tên đăng nhập và mật khẩu cho giảng viên; họ có thể tự đổi mật khẩu sau khi đăng nhập.</p>
    <div class="foot"><button class="btn" type="button" data-act="close">Hủy</button><button class="btn primary" type="submit">Tạo tài khoản</button></div></form>`);
}
function userEditForm(uid){
  const u = S.users[uid]; if(!u) return;
  const cur = S.labs.find(l => l.managerId === uid);
  modal('Sửa tài khoản: ' + (u.name || u.username), `<form id="fUserEdit" data-id="${esc(uid)}" class="dlgb" style="padding:0">
    <p class="hint">Tên đăng nhập: <b>${esc(u.username)}</b></p>
    <div class="grid2">${fld('ue_name','Họ và tên',u.name,'required', true)}
    <label class="fld"><span>Vai trò</span><select id="ue_role"><option value="manager" ${u.role!=='admin'?'selected':''}>Giảng viên phụ trách</option><option value="admin" ${u.role==='admin'?'selected':''}>Quản trị viên</option></select></label>
    <label class="fld"><span>Phòng phụ trách</span><select id="ue_lab">${labOptions(cur ? cur.id : '', uid)}</select></label>
    <label class="fld wide" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" id="ue_dis" style="width:auto" ${u.disabled?'checked':''}><span style="font-size:13px;color:var(--ink)">Khóa tài khoản (không đăng nhập được)</span></label></div>
    <div class="foot"><button class="btn" type="button" data-act="close">Hủy</button><button class="btn primary" type="submit">Lưu</button></div></form>`);
}
function loanForm(lab){
  const groups = ['equipment','furniture','supply','chemical','drug','herbal'].map(t => ({t, list: itemsOf(lab.id, t)})).filter(g => g.list.length);
  if(!groups.length) return toast('Phòng này chưa có thiết bị, vật tư hoặc hóa chất nào để cho mượn.');
  const otherLabs = sortLabs(S.labs.filter(l => l.id !== lab.id));
  modal('Cho mượn', `<form id="fLoan" class="dlgb" style="padding:0">
    <div class="grid2">
      <label class="fld wide"><span>Thiết bị / Vật tư / Hóa chất</span><select id="ln_item">${groups.map(g => `<optgroup label="${TYPES[g.t]}">${g.list.map(i => { const av = availableQty(i);
        return `<option value="${esc(i.id)}" ${av<=0?'disabled':''}>${esc(i.name)} — còn ${fmtNum(av)} ${esc(i.unit||'')}</option>`; }).join('')}</optgroup>`).join('')}</select></label>
      ${fld('ln_qty','Số lượng mượn',1,'type="number" min="0.000001" step="any" required')}
      <label class="fld wide"><span>Cho mượn tới</span><select id="ln_target">
        <option value="">— Chọn phòng hoặc lớp/cá nhân khác —</option>
        ${otherLabs.length ? `<optgroup label="Phòng thực hành khác">${otherLabs.map(ol => `<option value="lab:${esc(ol.id)}">${esc(ol.name)}</option>`).join('')}</optgroup>` : ''}
        <option value="other">Khác (lớp học / cá nhân)</option>
      </select></label>
      <label class="fld wide" id="ln_other_wrap" hidden><span>Tên lớp / người mượn</span><input id="ln_borrower" placeholder="VD: Lớp DA20A — Nguyễn Văn A"></label>
      ${dfld('ln_date','Ngày mượn',todayStr())}
      ${dfld('ln_due','Hạn trả (tùy chọn)','')}
      <label class="fld wide"><span>Ghi chú</span><textarea id="ln_note"></textarea></label>
    </div>
    <div class="foot"><button class="btn" type="button" data-act="close">Hủy</button><button class="btn primary" type="submit">Ghi nhận cho mượn</button></div></form>`);
}
function returnForm(ln){
  modal('Trả thiết bị: ' + ln.itemName, `<form id="fReturn" data-id="${esc(ln.id)}" class="dlgb" style="padding:0">
    <p class="hint">Đang giữ: <b>${fmtNum(ln.remaining)} ${esc(ln.unit||'')}</b> — mượn bởi ${esc(ln.borrower)}</p>
    <div class="grid2">${fld('rt_qty','Số lượng trả', ln.remaining, `type="number" min="0.000001" max="${ln.remaining}" step="any" required`)}
    ${fld('rt_note','Ghi chú (tình trạng thiết bị…)','','',true)}</div>
    <div class="foot"><button class="btn" type="button" data-act="close">Hủy</button><button class="btn primary" type="submit">Xác nhận đã trả</button></div></form>`);
}
function itemForm(type, it){
  const v = k => it?.[k] ?? '';
  let extra = '';
  const statusSel = `<label class="fld"><span>Trạng thái</span><select id="f_status">${Object.entries(EQ).map(([k,l]) => `<option value="${k}" ${(it?.status||'ok')===k?'selected':''}>${l}</option>`).join('')}</select></label>`;
  if(type === 'equipment') extra = `${statusSel}${fld('f_serial','Số seri',v('serial'))}${dfld('f_nextCheck','Hiệu chuẩn / bảo trì tiếp theo',v('nextCheck'))}`;
  if(type === 'furniture') extra = statusSel;
  if(type === 'supply') extra = fld('f_min','Mức tối thiểu (cảnh báo khi tồn ≤ mức này)',v('minQty'),'type="number" min="0" step="any"');
  if(type === 'chemical') extra = `
    ${fld('f_formula','Công thức',v('formula'),'placeholder="VD: H₂SO₄"')}${fld('f_cas','Số CAS',v('cas'),'placeholder="VD: 7664-93-9"')}
    ${fld('f_conc','Nồng độ / độ tinh khiết',v('conc'),'placeholder="VD: 98%, 0,1 M"')}${fld('f_lot','Số lô',v('lot'))}
    ${dfld('f_expiry','Hạn dùng',v('expiry'))}
    ${fld('f_min','Mức tối thiểu',v('minQty'),'type="number" min="0" step="any"')}
    <div class="fld wide"><span>Nhóm nguy hại (GHS)</span><div class="checks">${Object.entries(HAZ).map(([k,l]) => `<label><input type="checkbox" name="haz" value="${k}" ${(it?.hazards||[]).includes(k)?'checked':''}>${l}</label>`).join('')}</div></div>`;
  if(type === 'drug') extra = `
    ${fld('f_conc','Hàm lượng / nồng độ',v('conc'),'placeholder="VD: 500mg, 5%"')}${fld('f_lot','Số lô',v('lot'))}
    ${dfld('f_expiry','Hạn dùng',v('expiry'))}
    ${fld('f_min','Mức tối thiểu',v('minQty'),'type="number" min="0" step="any"')}`;
  if(type === 'herbal') extra = `
    ${fld('f_origin','Xuất xứ / nguồn gốc',v('origin'),'placeholder="VD: Lạng Sơn, nhập khẩu…"')}${fld('f_lot','Số lô',v('lot'))}
    ${dfld('f_expiry','Hạn dùng',v('expiry'))}
    ${fld('f_min','Mức tối thiểu',v('minQty'),'type="number" min="0" step="any"')}`;
  const units = {equipment:['cái','bộ','máy'], furniture:['cái','bộ','chiếc'], supply:['cái','hộp','gói','cuộn','bộ'], chemical:['g','kg','mL','L','chai'],
    drug:['viên','vỉ','hộp','chai','ống','tuýp'], herbal:['kg','g','gói','thang','bó']}[type];
  modal(`${it ? 'Sửa' : 'Thêm'} ${TYPES[type].toLowerCase()}`, `<form id="fItem" data-type="${type}" data-id="${esc(it?.id||'')}" class="dlgb" style="padding:0">
    <div class="grid2">${fld('f_name','Tên',v('name'),'required',true)}${fld('f_code','Mã',v('code'))}${fld('f_location','Vị trí (tủ, kệ)',v('location'))}
    ${fld('f_qty',['equipment','furniture'].includes(type)?'Số lượng':'Tồn kho',it ? v('qty') : 1,'type="number" min="0" step="any" required')}
    ${fld('f_unit','Đơn vị',v('unit') || units[0],'list="units"')}<datalist id="units">${units.map(u => `<option value="${u}">`).join('')}</datalist>
    <label class="fld"><span>Nhập trong năm học</span><select id="f_year"><option value="">— Không áp dụng —</option>${YEARS.map(y => `<option value="${y}" ${v('year')===y?'selected':''}>${y}</option>`).join('')}</select></label>
    ${extra}
    <label class="fld wide"><span>Ghi chú</span><textarea id="f_note">${esc(v('note'))}</textarea></label></div>
    <div class="foot"><button class="btn" type="button" data-act="close">Hủy</button><button class="btn primary" type="submit">Lưu</button></div></form>`);
}
function readItem(type){
  const o = {};
  const g = id => (document.getElementById(id)?.value ?? '').trim();
  const gDate = id => { const r = toISO(g(id)); if(r === 'invalid'){ o._dateError = true; return null; } return r; };
  Object.assign(o, {name:g('f_name'), code:g('f_code'), location:g('f_location'), qty:Number(g('f_qty') || 0), unit:g('f_unit'), note:g('f_note'), year:g('f_year') || null});
  if(type === 'equipment'){ o.status = g('f_status') || 'ok'; o.serial = g('f_serial'); o.nextCheck = gDate('f_nextCheck'); }
  if(type === 'furniture'){ o.status = g('f_status') || 'ok'; }
  if(type === 'supply'){ o.minQty = g('f_min') === '' ? null : Number(g('f_min')); }
  if(type === 'chemical'){
    Object.assign(o, {formula:g('f_formula'), cas:g('f_cas'), conc:g('f_conc'), lot:g('f_lot'), expiry:gDate('f_expiry'), minQty:g('f_min') === '' ? null : Number(g('f_min'))});
    o.hazards = [...document.querySelectorAll('input[name=haz]:checked')].map(x => x.value);
  }
  if(type === 'drug') Object.assign(o, {conc:g('f_conc'), lot:g('f_lot'), expiry:gDate('f_expiry'), minQty:g('f_min') === '' ? null : Number(g('f_min'))});
  if(type === 'herbal') Object.assign(o, {origin:g('f_origin'), lot:g('f_lot'), expiry:gDate('f_expiry'), minQty:g('f_min') === '' ? null : Number(g('f_min'))});
  return o;
}

/* ---------- tài khoản: tạo / sửa (admin) ---------- */
async function createAccount(username, password){
  // Dùng một phiên Firebase phụ để tạo tài khoản mà quản trị viên không bị đăng xuất.
  const sec = firebase.apps.find(a => a.name === 'secondary') || firebase.initializeApp(CFG, 'secondary');
  try {
    const cred = await sec.auth().createUserWithEmailAndPassword(emailOf(username), password);
    return cred.user.uid;
  } finally { await sec.auth().signOut().catch(() => {}); }
}
function authErr(e){
  const c = e && e.code || '';
  if(/email-already-in-use/.test(c)) return 'Tên đăng nhập này đã tồn tại.';
  if(/weak-password/.test(c)) return 'Mật khẩu quá yếu (cần ít nhất 6 ký tự).';
  if(/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return 'Sai tên đăng nhập hoặc mật khẩu.';
  if(/too-many-requests/.test(c)) return 'Đăng nhập sai quá nhiều lần, vui lòng thử lại sau ít phút.';
  if(/network/.test(c)) return 'Không có kết nối mạng.';
  if(/operation-not-allowed/.test(c)) return 'Firebase chưa bật đăng nhập bằng Email/Password.';
  if(/permission-denied/.test(c)) return 'Không có quyền thực hiện thao tác này.';
  return 'Có lỗi xảy ra (' + (c || e.message || 'không rõ') + ').';
}
async function assignLab(uid, labId){
  const b = db.batch();
  S.labs.filter(l => l.managerId === uid && l.id !== labId).forEach(l => b.update(db.doc('labs/' + l.id), {managerId: null}));
  if(labId) b.update(db.doc('labs/' + labId), {managerId: uid, managerName: null});
  await b.commit();
}

/* ---------- actions ---------- */
const curLab = () => S.labs.find(l => l.id === S.view);
const guard = lab => { if(!canEditLab(lab)){ toast('Bạn không có quyền sửa phòng này.'); return false; } return true; };
const itemById = id => S.items.find(i => i.id === id);

const actions = {
  close: closeModal,
  open: d => go(d.lab, d.tab),
  account: () => accountForm(),
  logout: () => { auth.signOut(); },
  userNew: () => { if(S.me.isAdmin) userNewForm(); },
  userEdit: d => { if(S.me.isAdmin) userEditForm(d.id); },
  newlab: () => { if(canCreateLab()) labForm(null); },
  editlab: d => { const l = S.labs.find(x => x.id === d.id); if(l && guard(l)) labForm(l); },
  dellab: d => { const l = S.labs.find(x => x.id === d.id); if(!l || !S.me.isAdmin) return;
    const n = itemsOf(l.id).length;
    modal('Xóa phòng?', `<p>Xóa phòng <b>${esc(l.name)}</b> cùng ${n} mục thiết bị, vật tư, hóa chất và nhật ký của phòng. Không thể hoàn tác.</p>
      <div class="foot"><button class="btn" type="button" data-act="close">Hủy</button><button class="btn danger" type="button" data-act="dellab2" data-id="${esc(l.id)}">Xóa phòng</button></div>`); },
  dellab2: d => { closeModal(); enqueue(async () => { for(const it of itemsOf(d.id)) await db.doc('items/' + it.id).delete();
    await db.doc('logs/' + d.id).delete(); await db.doc('labs/' + d.id).delete(); }); go('overview'); toast('Đã xóa phòng.'); },
  claim: d => { const l = S.labs.find(x => x.id === d.id);
    if(!l || l.managerId) return; if(myLab()) return toast('Bạn đang phụ trách một phòng khác.');
    enqueue(() => db.doc('labs/' + d.id).update({managerId: S.me.id})); toast('Bạn đã nhận phụ trách phòng này.'); },
  assign: d => { if(!S.me.isAdmin) return; const lab = S.labs.find(x => x.id === d.id); if(!lab) return;
    const people = Object.entries(S.users).filter(([,u]) => !u.disabled);
    modal('Chọn giảng viên phụ trách', `<input id="ps" type="search" placeholder="Tìm theo tên…" autocomplete="off" data-lab="${esc(d.id)}"><div class="plist" id="pres"></div>
      ${people.length < 2 ? `<p class="hint">Chưa có tài khoản giảng viên nào. Vào <b>Quản lý tài khoản</b> để tạo.</p>` : ''}
      <div class="fld wide"><span>Hoặc ghi tên tạm (giảng viên chưa có tài khoản)</span>
        <div style="display:flex;gap:8px"><input id="mname" placeholder="VD: Nguyễn Thị Tuyền" value="${esc(lab.managerName||'')}">
        <button class="btn" type="button" data-act="setname" data-lab="${esc(d.id)}">Lưu</button></div></div>
      <div class="foot"><button class="btn danger" type="button" data-act="pick" data-lab="${esc(d.id)}" data-uid="" style="margin-right:auto">Bỏ người phụ trách</button><button class="btn" type="button" data-act="close">Đóng</button></div>`);
    searchPeople('', d.id); },
  setname: d => { const name = ($('#mname').value || '').trim(); if(!name) return;
    closeModal(); enqueue(() => db.doc('labs/' + d.lab).update({managerId: null, managerName: name})); toast('Đã lưu tên người phụ trách.'); },
  pick: d => { const other = d.uid && S.labs.find(l => l.managerId === d.uid && l.id !== d.lab);
    if(other) return toast(`Người này đang phụ trách ${other.name}. Đổi trong Quản lý tài khoản nếu muốn chuyển phòng.`);
    closeModal(); enqueue(() => db.doc('labs/' + d.lab).update({managerId: d.uid || null, managerName: null})); toast(d.uid ? 'Đã đổi người phụ trách.' : 'Đã bỏ người phụ trách.'); },
  add: () => { const l = curLab(); if(l && guard(l)) itemForm(S.tab, null); },
  loanNew: () => { const l = curLab(); if(l && guard(l)) loanForm(l); },
  loanReturn: d => { const l = curLab(), ln = S.loans.find(x => x.id === d.id); if(!l || !ln || !guard(l)) return; returnForm(ln); },
  loanDel: d => { const l = curLab(), ln = S.loans.find(x => x.id === d.id); if(!l || !ln || !guard(l)) return;
    modal('Xóa lượt mượn?', `<p>Xóa bản ghi mượn <b>${esc(ln.itemName)}</b> (${esc(ln.borrower)})? Không thể hoàn tác.</p>
      <div class="foot"><button class="btn" type="button" data-act="close">Hủy</button><button class="btn danger" type="button" data-act="loanDel2" data-id="${esc(ln.id)}">Xóa</button></div>`); },
  loanDel2: d => { closeModal(); enqueue(() => db.doc('loans/' + d.id).delete()); },
  edit: d => { const l = curLab(), it = itemById(d.id); if(l && it && guard(l)) itemForm(it.type, it); },
  del: d => { const l = curLab(), it = itemById(d.id); if(!l || !it || !guard(l)) return;
    modal('Xóa mục này?', `<p>Xóa <b>${esc(it.name)}</b> khỏi ${esc(l.name)}?</p><div class="foot"><button class="btn" type="button" data-act="close">Hủy</button><button class="btn danger" type="button" data-act="del2" data-id="${esc(it.id)}">Xóa</button></div>`); },
  del2: d => { const l = curLab(), it = itemById(d.id); if(!l || !it || !guard(l)) return; closeModal();
    enqueue(async () => { await db.doc('items/' + it.id).delete(); await addLog(l.id, {act:'del', name:it.name}); }); },
  adj: d => { const l = curLab(), it = itemById(d.id); if(!l || !it || !guard(l)) return;
    modal(`Nhập/Xuất: ${it.name}`, `<form id="fAdj" data-id="${esc(it.id)}" class="dlgb" style="padding:0"><p class="hint">Tồn hiện tại: <b>${fmtNum(it.qty)} ${esc(it.unit||'')}</b></p>
      <div class="grid2"><label class="fld"><span>Thao tác</span><select id="a_act"><option value="in">Nhập kho (+)</option><option value="out">Xuất kho (−)</option></select></label>
      ${fld('a_qty',`Số lượng (${esc(it.unit||'')})`,'','type="number" min="0" step="any" required')}${fld('a_note','Ghi chú (mục đích, lớp, người nhận)','','',true)}</div>
      <div class="foot"><button class="btn" type="button" data-act="close">Hủy</button><button class="btn primary" type="submit">Ghi nhận</button></div></form>`); },
  export: async () => { const l = curLab(); if(!l) return;
    if(typeof ExcelJS === 'undefined') return toast('Chưa tải được thư viện xuất Excel, vui lòng thử lại.');
    const list = visibleItems(l);
    const cols = S.tab === 'equipment' ? [['Tên','name'],['Mã','code'],['Số seri','serial'],['Số lượng','qty'],['Đơn vị','unit'],['Trạng thái',i=>EQ[i.status||'ok']],['Hiệu chuẩn tiếp theo',i=>fmtDate(i.nextCheck)],['Vị trí','location'],['Nhập trong năm học','year'],['Ghi chú','note']]
      : S.tab === 'furniture' ? [['Tên','name'],['Mã','code'],['Số lượng','qty'],['Đơn vị','unit'],['Trạng thái',i=>EQ[i.status||'ok']],['Vị trí','location'],['Nhập trong năm học','year'],['Ghi chú','note']]
      : S.tab === 'supply' ? [['Tên','name'],['Mã','code'],['Tồn kho','qty'],['Đơn vị','unit'],['Tối thiểu','minQty'],['Vị trí','location'],['Nhập trong năm học','year'],['Ghi chú','note']]
      : S.tab === 'chemical' ? [['Tên','name'],['Mã','code'],['Công thức','formula'],['CAS','cas'],['Nồng độ','conc'],['Nguy hại',i=>(i.hazards||[]).map(h=>HAZ[h]).join('; ')],['Tồn kho','qty'],['Đơn vị','unit'],['Tối thiểu','minQty'],['Số lô','lot'],['Hạn dùng',i=>fmtDate(i.expiry)],['Vị trí','location'],['Nhập trong năm học','year'],['Ghi chú','note']]
      : S.tab === 'drug' ? [['Tên','name'],['Mã','code'],['Hàm lượng/nồng độ','conc'],['Tồn kho','qty'],['Đơn vị','unit'],['Tối thiểu','minQty'],['Số lô','lot'],['Hạn dùng',i=>fmtDate(i.expiry)],['Vị trí','location'],['Nhập trong năm học','year'],['Ghi chú','note']]
      : [['Tên','name'],['Mã','code'],['Xuất xứ','origin'],['Tồn kho','qty'],['Đơn vị','unit'],['Tối thiểu','minQty'],['Số lô','lot'],['Hạn dùng',i=>fmtDate(i.expiry)],['Vị trí','location'],['Nhập trong năm học','year'],['Ghi chú','note']];
    cols.unshift(['STT', (i, idx) => idx + 1]);
    const n = cols.length, mid = Math.max(1, Math.ceil(n / 2));
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet((TYPES[S.tab] || 'Danh mục').slice(0, 28));
    ws.columns = cols.map(c => ({width: c[0] === 'STT' ? 6 : Math.max(14, String(c[0]).length + 4)}));
    const thin = {style:'thin'}, allBorders = {top:thin, left:thin, bottom:thin, right:thin};
    const setRow = (rowNum, left, right) => {
      const row = ws.getRow(rowNum);
      row.getCell(1).value = left; ws.mergeCells(rowNum, 1, rowNum, mid);
      row.getCell(mid + 1).value = right; if(mid + 1 <= n) ws.mergeCells(rowNum, mid + 1, rowNum, n);
      row.eachCell({includeEmpty:true}, c => { c.font = {bold:true, size:12}; c.alignment = {horizontal:'center', vertical:'middle', wrapText:true}; });
      return row;
    };
    setRow(1, 'TRƯỜNG CĐYT CẦN THƠ', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM');
    const row2 = setRow(2, 'KHOA DƯỢC - XÉT NGHIỆM', 'Độc lập - Tự do - Hạnh phúc');
    row2.getCell(mid + 1).font = {bold:true, size:12, underline:true};
    ws.mergeCells(4, 1, 4, n);
    const titleCell = ws.getCell(4, 1);
    titleCell.value = `DANH MỤC ${TYPES[S.tab].toUpperCase()} — ${String(l.name||'').toUpperCase()}`;
    titleCell.font = {bold:true, size:14}; titleCell.alignment = {horizontal:'center', vertical:'middle'};
    ws.mergeCells(5, 1, 5, n);
    const mgrCell = ws.getCell(5, 1);
    mgrCell.value = `GIẢNG VIÊN QUẢN LÝ: ${managerLabel(l) || '—'}`;
    mgrCell.font = {bold:true, size:12}; mgrCell.alignment = {horizontal:'center', vertical:'middle'};
    const headerRow = ws.getRow(7);
    cols.forEach((c, idx) => { const cell = headerRow.getCell(idx + 1); cell.value = c[0];
      cell.font = {bold:true}; cell.alignment = {horizontal:'center', vertical:'middle', wrapText:true};
      cell.border = allBorders; cell.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FFE8EDF3'}}; });
    list.forEach((i, r) => { const row = ws.getRow(8 + r);
      cols.forEach((c, idx) => { const cell = row.getCell(idx + 1);
        cell.value = typeof c[1] === 'function' ? c[1](i, r) : (i[c[1]] ?? '');
        cell.border = allBorders; cell.alignment = {vertical: 'middle', horizontal: c[0]==='STT' ? 'center' : undefined, wrapText:true}; }); });
    const buf = await wb.xlsx.writeBuffer();
    const fname = `${fileSafe(TYPES[S.tab])}_${fileSafe(l.name || l.code || 'Phong thuc hanh')}.xlsx`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    a.download = fname; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
};
function searchPeople(q, labId){
  const nq = norm(q);
  const r = Object.entries(S.users).filter(([,u]) => !u.disabled && (!nq || norm(u.name + ' ' + u.username).includes(nq)))
    .sort((a,b) => String(a[1].name).localeCompare(String(b[1].name),'vi')).slice(0, 50);
  const box = $('#pres'); if(!box) return;
  box.innerHTML = r.length ? r.map(([id,p]) => { const other = S.labs.find(l => l.managerId === id && l.id !== labId);
    return `<button type="button" class="${other?'off':''}" data-act="pick" data-lab="${esc(labId)}" data-uid="${esc(id)}"><span class="av sm">${esc(initials(p.name))}</span><span>${esc(p.name)} <span class="hint">${esc(p.username)}</span>${other ? ` <span class="hint">(đang phụ trách ${esc(other.name)})</span>` : ''}</span></button>`; }).join('')
    : `<div class="hint" style="padding:12px">Không tìm thấy tài khoản nào.</div>`;
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  if(e.target.id === 'modal'){ closeModal(); return; }
  const t = e.target.closest('[data-act],[data-go],[data-tab]'); if(!t) return;
  if(t.closest('#auth')) return;
  if(t.dataset.go){ go(t.dataset.go); return; }
  if(t.dataset.act){ const f = actions[t.dataset.act]; if(f) f(t.dataset); return; }
  if(t.dataset.tab){ S.tab = t.dataset.tab; S.q = ''; S.filter = 'all'; S.year = 'all'; S.skel = ''; renderMain(); }
});
document.addEventListener('keydown', e => { if(e.key === 'Escape' && !$('#modal').hidden) closeModal(); });
document.addEventListener('dragstart', e => {
  const t = e.target.closest && e.target.closest('[data-drag-id]'); if(!t) return;
  dragId = t.dataset.dragId; t.classList.add('dragging');
  if(e.dataTransfer){ e.dataTransfer.effectAllowed = 'move'; try{ e.dataTransfer.setData('text/plain', dragId); }catch(_){} }
});
document.addEventListener('dragend', e => {
  const t = e.target.closest && e.target.closest('[data-drag-id]'); if(t) t.classList.remove('dragging');
  document.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(x => x.classList.remove('drag-over-top','drag-over-bottom'));
  dragId = null;
});
document.addEventListener('dragover', e => {
  if(!dragId) return;
  const t = e.target.closest && e.target.closest('[data-drag-id]'); if(!t || t.dataset.dragId === dragId) return;
  e.preventDefault();
  document.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(x => { if(x !== t) x.classList.remove('drag-over-top','drag-over-bottom'); });
  const r = t.getBoundingClientRect(), before = (e.clientY - r.top) < r.height / 2;
  t.classList.toggle('drag-over-top', before); t.classList.toggle('drag-over-bottom', !before);
});
document.addEventListener('drop', e => {
  if(!dragId) return;
  const t = e.target.closest && e.target.closest('[data-drag-id]'); if(!t || t.dataset.dragId === dragId) return;
  e.preventDefault();
  const before = t.classList.contains('drag-over-top');
  t.classList.remove('drag-over-top','drag-over-bottom');
  reorderLabs(dragId, t.dataset.dragId, before);
});
document.addEventListener('input', e => {
  if(e.target.id === 'q'){ S.q = e.target.value; renderList(); }
  if(e.target.id === 'ps') searchPeople(e.target.value, e.target.dataset.lab);
  if(e.target.id === 'u_user' || e.target.id === 'li_user' || e.target.id === 'su_user') e.target.value = deaccent(e.target.value).toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if(e.target.classList.contains('datein')){
    const digits = e.target.value.replace(/\D/g,'').slice(0,8);
    let out = digits;
    if(digits.length > 4) out = digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4);
    else if(digits.length > 2) out = digits.slice(0,2) + '/' + digits.slice(2);
    e.target.value = out;
  }
});
document.addEventListener('change', e => { if(e.target.id === 'flt'){ S.filter = e.target.value; renderList(); } if(e.target.id === 'fyr'){ S.year = e.target.value; renderList(); }
  if(e.target.id === 'ln_target'){ const wrap = $('#ln_other_wrap'); if(wrap) wrap.hidden = e.target.value !== 'other'; } });
document.addEventListener('submit', async e => {
  const f = e.target;
  if(f.closest('#auth')) return;
  e.preventDefault();
  if(f.id === 'fLab'){
    const name = $('#l_name').value.trim(); if(!name) return;
    const decisionDate = toISO($('#l_decdate').value);
    if(decisionDate === 'invalid') return toast('Ngày quyết định không hợp lệ, vui lòng nhập theo định dạng dd/mm/yyyy.');
    const vals = {name, code:$('#l_code').value.trim(), location:$('#l_loc').value.trim(), dept:$('#l_dept').value || null,
      decisionNo:$('#l_decno').value.trim(), decisionDate};
    if(f.dataset.id){ const l = S.labs.find(x => x.id === f.dataset.id); if(!l || !guard(l)) return; closeModal(); enqueue(() => db.doc('labs/' + l.id).update(vals)); }
    else { if(!canCreateLab()) return; closeModal();
      const ref = db.collection('labs').doc(); enqueue(() => ref.set(Object.assign(vals, {managerId: null, managerName: null, order: (S.labs.length + 1) * 10, createdAt: Date.now()}))).then(() => go(ref.id)); }
  }
  if(f.id === 'fItem'){
    const lab = curLab(); if(!lab || !guard(lab)) return;
    const type = f.dataset.type, vals = readItem(type);
    if(!vals.name || !(vals.qty >= 0)) return toast('Cần nhập tên và số lượng hợp lệ.');
    if(vals._dateError) return toast('Ngày không hợp lệ, vui lòng nhập theo định dạng dd/mm/yyyy.');
    delete vals._dateError;
    closeModal();
    if(f.dataset.id){ const it = itemById(f.dataset.id); if(!it) return;
      enqueue(async () => { await db.doc('items/' + it.id).update(vals); await addLog(lab.id, {act:'edit', name:vals.name}); }); }
    else enqueue(async () => { await db.collection('items').doc().set(Object.assign({labId:lab.id, type, createdAt:Date.now()}, vals)); await addLog(lab.id, {act:'add', name:vals.name, qty:vals.qty, unit:vals.unit}); });
  }
  if(f.id === 'fAdj'){
    const lab = curLab(), it = itemById(f.dataset.id); if(!lab || !it || !guard(lab)) return;
    const act = $('#a_act').value, n = Number($('#a_qty').value);
    if(!(n > 0)) return toast('Nhập số lượng lớn hơn 0.');
    const next = act === 'in' ? Number(it.qty) + n : Number(it.qty) - n;
    if(next < 0) return toast(`Không đủ tồn kho (còn ${fmtNum(it.qty)} ${it.unit||''}).`);
    const note = $('#a_note').value.trim();
    closeModal();
    enqueue(async () => { await db.doc('items/' + it.id).update({qty: Math.round(next * 1e6) / 1e6});
      await addLog(lab.id, {act, name:it.name, qty:n, unit:it.unit, note}); });
  }
  if(f.id === 'fLoan'){
    const lab = curLab(); if(!lab || !guard(lab)) return;
    const item = itemById($('#ln_item').value), qty = Number($('#ln_qty').value);
    const target = $('#ln_target').value;
    let borrowerLabId = null, borrower = '';
    if(target.startsWith('lab:')){ borrowerLabId = target.slice(4); const bl = S.labs.find(x => x.id === borrowerLabId); borrower = bl ? bl.name : ''; }
    else if(target === 'other') borrower = $('#ln_borrower').value.trim();
    const dateIso = toISO($('#ln_date').value), dueIso = toISO($('#ln_due').value);
    if(dateIso === 'invalid' || dueIso === 'invalid') return toast('Ngày không hợp lệ, vui lòng nhập theo định dạng dd/mm/yyyy.');
    const date = dateIso || todayStr(), due = dueIso || null, note = $('#ln_note').value.trim();
    if(!item || !(qty > 0) || !target || !borrower) return toast('Cần chọn thiết bị, số lượng và nơi mượn hợp lệ.');
    const avail = availableQty(item);
    if(qty > avail) return toast(`Chỉ còn ${fmtNum(avail)} ${item.unit||''} có thể cho mượn.`);
    closeModal();
    enqueue(async () => {
      await db.collection('loans').add({labId:lab.id, itemId:item.id, itemName:item.name, itemType:item.type, unit:item.unit||'', qty, remaining:qty,
        borrower, borrowerLabId, borrowedDate:date, dueDate:due, note, returnedAt:null, createdAt:Date.now(), byUid:S.me.id});
      await addLog(lab.id, {act:'loan', name:item.name, qty, unit:item.unit, note:`cho ${borrowerLabId ? 'phòng ' : ''}${borrower} mượn${due ? `, hạn trả ${fmtDate(due)}` : ''}`});
    });
  }
  if(f.id === 'fReturn'){
    const lab = curLab(), ln = S.loans.find(x => x.id === f.dataset.id); if(!lab || !ln || !guard(lab)) return;
    const qty = Number($('#rt_qty').value), note = $('#rt_note').value.trim();
    if(!(qty > 0) || qty > ln.remaining + 1e-9) return toast('Số lượng trả không hợp lệ.');
    const remaining = Math.max(0, Math.round((ln.remaining - qty) * 1e6) / 1e6);
    closeModal();
    enqueue(async () => {
      await db.doc('loans/' + ln.id).update({remaining, returnedAt:Date.now()});
      await addLog(lab.id, {act:'return', name:ln.itemName, qty, unit:ln.unit, note:`${ln.borrower}${note ? ' — ' + note : ''}${remaining>0?` (còn giữ ${fmtNum(remaining)} ${ln.unit||''})`:''}`});
    });
  }
  if(f.id === 'fAccount'){
    const name = $('#ac_name').value.trim(); if(!name) return;
    const vals = {phone:$('#ac_phone').value.trim(), email:$('#ac_email').value.trim(), title:$('#ac_title').value.trim(), updatedAt:Date.now()};
    closeModal();
    enqueue(async () => { if(name !== S.me.name) await db.doc('users/' + S.me.id).update({name}); await db.doc('contacts/' + S.me.id).set(vals); });
    toast('Đã lưu hồ sơ.');
  }
  if(f.id === 'fPw'){
    const o = $('#pw_old').value, n1 = $('#pw_new').value, n2 = $('#pw_new2').value;
    if(n1 !== n2) return toast('Hai lần nhập mật khẩu mới không khớp.');
    if(n1.length < 6) return toast('Mật khẩu mới cần ít nhất 6 ký tự.');
    try {
      const u = auth.currentUser;
      await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, o));
      await u.updatePassword(n1);
      closeModal(); toast('Đã đổi mật khẩu.');
    } catch(err){ toast(/invalid-credential|wrong-password/.test(err.code) ? 'Mật khẩu hiện tại không đúng.' : authErr(err)); }
  }
  if(f.id === 'fUser'){
    if(!S.me.isAdmin) return;
    const name = $('#u_name').value.trim(), username = $('#u_user').value.trim(), pass = $('#u_pass').value, role = $('#u_role').value, labId = $('#u_lab').value;
    if(!name || !validUsername(username)) return toast('Tên đăng nhập 3–30 ký tự: chữ thường không dấu, số, dấu chấm/gạch.');
    if(pass.length < 6) return toast('Mật khẩu cần ít nhất 6 ký tự.');
    const btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Đang tạo…';
    try {
      const uid = await createAccount(username, pass);
      await db.doc('users/' + uid).set({name, username, role, disabled:false, createdAt:Date.now(), createdBy:S.me.id});
      if(labId) await assignLab(uid, labId);
      closeModal();
      modal('Đã tạo tài khoản', `<p>Gửi thông tin đăng nhập cho <b>${esc(name)}</b>:</p>
        <div class="tw" style="padding:12px 14px;font-family:var(--mono)">Trang: ${esc(location.href.split('#')[0])}<br>Tên đăng nhập: ${esc(username)}<br>Mật khẩu: ${esc(pass)}</div>
        <p class="hint">Mật khẩu chỉ hiện một lần. Người dùng nên tự đổi mật khẩu sau khi đăng nhập (mục Hồ sơ).</p>
        <div class="foot"><button class="btn primary" type="button" data-act="close">Xong</button></div>`);
    } catch(err){ btn.disabled = false; btn.textContent = 'Tạo tài khoản'; toast(authErr(err)); }
  }
  if(f.id === 'fUserEdit'){
    if(!S.me.isAdmin) return;
    const uid = f.dataset.id, name = $('#ue_name').value.trim(), role = $('#ue_role').value, labId = $('#ue_lab').value, disabled = $('#ue_dis').checked;
    if(!name) return;
    closeModal();
    enqueue(async () => {
      await db.doc('users/' + uid).update({name, role, disabled});
      await assignLab(uid, disabled ? '' : labId);
    });
    toast('Đã lưu tài khoản.');
  }
});

/* ---------- đăng nhập ---------- */
function authCard(inner){
  $('#boot').hidden = true; $('#app').hidden = true;
  const a = $('#auth'); a.hidden = false;
  a.innerHTML = `<div class="auth-card"><div class="logo"><img src="../assets/img/logo.png" alt=""><div><span>Trường Cao đẳng Y tế Cần Thơ</span><b>Khoa Dược - Xét nghiệm</b></div></div>${inner}
    <p class="back"><a href="../index.html">← Về trang chủ Khoa</a></p></div>`;
}
const pwField = (id, label, ac) => `<label class="fld"><span>${label}</span><div class="pwwrap"><input id="${id}" type="password" required autocomplete="${ac}"><button type="button" data-pw="${id}">Hiện</button></div></label>`;
function showLogin(msg){
  authCard(`<h1>Đăng nhập quản lý phòng thực hành</h1>
    <form id="fLogin" class="dlgb" style="padding:0">
      <label class="fld"><span>Tên đăng nhập</span><input id="li_user" required autocomplete="username" autocapitalize="none" spellcheck="false"></label>
      ${pwField('li_pass','Mật khẩu','current-password')}
      <div class="err" id="li_err">${esc(msg||'')}</div>
      <button class="btn primary" type="submit">Đăng nhập</button>
    </form>
    <p class="hint">Chưa có tài khoản hoặc quên mật khẩu? Liên hệ quản trị viên của Khoa.</p>`);
  $('#li_user').focus();
}
function showSetup(){
  authCard(`<h1>Thiết lập lần đầu</h1>
    <p class="hint">Hệ thống chưa có quản trị viên. Tạo tài khoản quản trị viên đầu tiên (chỉ làm một lần).</p>
    <form id="fSetup" class="dlgb" style="padding:0">
      <label class="fld"><span>Họ và tên</span><input id="su_name" required></label>
      <label class="fld"><span>Tên đăng nhập</span><input id="su_user" required autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="VD: admin"></label>
      ${pwField('su_pass','Mật khẩu (ít nhất 6 ký tự)','new-password')}
      <div class="err" id="su_err"></div>
      <button class="btn primary" type="submit">Tạo quản trị viên</button>
    </form>`);
}
function showConfigMissing(){
  authCard(`<h1>Chưa kết nối cơ sở dữ liệu</h1>
    <p class="hint">Trang quản lý phòng thực hành cần được kết nối với Firebase. Quản trị viên điền thông tin vào file <code>phong-thuc-hanh/firebase-config.js</code>.</p>`);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-pw]'); if(!b) return;
  const i = document.getElementById(b.dataset.pw); i.type = i.type === 'password' ? 'text' : 'password'; b.textContent = i.type === 'password' ? 'Hiện' : 'Ẩn';
});
document.addEventListener('submit', async e => {
  const f = e.target;
  if(f.id === 'fLogin'){
    e.preventDefault();
    const u = $('#li_user').value.trim(), p = $('#li_pass').value, err = $('#li_err'), btn = f.querySelector('[type=submit]');
    if(!validUsername(u)) { err.textContent = 'Tên đăng nhập không hợp lệ.'; return; }
    btn.disabled = true; btn.textContent = 'Đang đăng nhập…'; err.textContent = '';
    try { await auth.signInWithEmailAndPassword(emailOf(u), p); }
    catch(ex){ err.textContent = authErr(ex); btn.disabled = false; btn.textContent = 'Đăng nhập'; }
  }
  if(f.id === 'fSetup'){
    e.preventDefault();
    const name = $('#su_name').value.trim(), u = $('#su_user').value.trim(), p = $('#su_pass').value, err = $('#su_err'), btn = f.querySelector('[type=submit]');
    if(!name || !validUsername(u)) { err.textContent = 'Tên đăng nhập 3–30 ký tự: chữ thường không dấu, số, dấu chấm/gạch.'; return; }
    if(p.length < 6){ err.textContent = 'Mật khẩu cần ít nhất 6 ký tự.'; return; }
    btn.disabled = true; btn.textContent = 'Đang tạo…'; err.textContent = '';
    try {
      settingUp = true;
      const cred = await auth.createUserWithEmailAndPassword(emailOf(u), p);
      const b = db.batch();
      b.set(db.doc('users/' + cred.user.uid), {name, username:u, role:'admin', disabled:false, createdAt:Date.now()});
      b.set(db.doc('meta/admin'), {uid: cred.user.uid, createdAt: Date.now()});
      await b.commit();
      settingUp = false;
      startSession(cred.user);
    } catch(ex){ settingUp = false; err.textContent = authErr(ex); btn.disabled = false; btn.textContent = 'Tạo quản trị viên'; }
  }
});

/* ---------- phiên làm việc ---------- */
let settingUp = false;
function stopListeners(){ unsubs.forEach(u => { try{ u(); }catch(_){} }); unsubs = []; }
async function startSession(fbUser){
  let prof;
  try { prof = await db.doc('users/' + fbUser.uid).get(); }
  catch(e){ await auth.signOut(); return showLogin('Không đọc được hồ sơ tài khoản (' + (e.code || e.message) + ').'); }
  if(!prof.exists){ await auth.signOut(); return showLogin('Tài khoản chưa được cấp quyền. Liên hệ quản trị viên.'); }
  const p = prof.data();
  if(p.disabled){ await auth.signOut(); return showLogin('Tài khoản đã bị khóa. Liên hệ quản trị viên.'); }
  S.me = {id: fbUser.uid, name: p.name || p.username, username: p.username, isAdmin: p.role === 'admin'};
  S.canWrite = true; S.view = 'overview';
  $('#auth').hidden = true; $('#boot').hidden = true; $('#app').hidden = false;
  renderAll();
  const onErr = e => { S.err = (e && e.code) || 'lỗi'; renderAll(); };
  stopListeners();
  unsubs.push(db.collection('labs').onSnapshot(s => { S.labs = s.docs.map(d => Object.assign({id:d.id}, d.data())); S.loaded.labs = true; renderAll(); }, onErr));
  unsubs.push(db.collection('items').onSnapshot(s => { S.items = s.docs.map(d => Object.assign({id:d.id}, d.data())); S.loaded.items = true; renderAll(); }, onErr));
  unsubs.push(db.collection('logs').onSnapshot(s => { S.logs = {}; s.docs.forEach(d => S.logs[d.id] = d.data().entries || []); S.loaded.logs = true; if(S.tab === 'log' && S.view !== 'overview') renderAll(); }, onErr));
  unsubs.push(db.collection('contacts').onSnapshot(s => { S.contacts = {}; s.docs.forEach(d => S.contacts[d.id] = d.data()); renderAll(); }, () => {}));
  unsubs.push(db.collection('loans').onSnapshot(s => { S.loans = s.docs.map(d => Object.assign({id:d.id}, d.data())); renderAll(); }, () => {}));
  unsubs.push(db.collection('users').onSnapshot(s => {
    S.users = {}; s.docs.forEach(d => S.users[d.id] = d.data());
    const mine = S.users[S.me.id];
    if(mine && mine.disabled){ auth.signOut(); return; }
    if(mine){ S.me.name = mine.name || S.me.name; S.me.isAdmin = mine.role === 'admin'; }
    renderAll();
  }, () => {}));
}
async function init(){
  if(!CFG.apiKey || !CFG.projectId){ $('#boot').hidden = true; return showConfigMissing(); }
  firebase.initializeApp(CFG);
  auth = firebase.auth(); db = firebase.firestore();
  try { db.enablePersistence({synchronizeTabs:true}).catch(() => {}); } catch(_){}
  auth.onAuthStateChanged(async u => {
    if(settingUp) return;
    if(u) return startSession(u);
    stopListeners();
    S.me = {id:null, name:'', isAdmin:false, username:''}; S.loaded = {labs:false, items:false, logs:false};
    try {
      const m = await db.doc('meta/admin').get();
      if(!m.exists) return showSetup();
    } catch(_){}
    showLogin();
  });
}
init();
