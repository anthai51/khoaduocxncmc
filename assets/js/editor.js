/* =========================================================
   CHẾ ĐỘ CHỈNH SỬA TRỰC TIẾP – lưu thẳng lên GitHub
   Chỉ người có "mã truy cập GitHub" (token) của repo mới lưu được.
   ========================================================= */
(function () {
  const REPO = 'anthai51/khoaduocxncmc';
  const BRANCH = 'main';
  const API = 'https://api.github.com/repos/' + REPO + '/contents/';
  const BASE = document.body.dataset.base || '';
  const TOKEN_KEY = 'kdxn_gh_token';
  const EDITABLE = [
    'main .g-text', 'main .section__head h2', 'main .section__head p', '.hero h1', '.hero__lead', '.hero__eyebrow',
    '.page-hero h1', '.article__title', '.article__lead', '.article__body', '.article__source', '.article__meta',
    '.news h3', '.news p', '.org', '.stat', '.card h4', 'main .accordion summary', 'main .accordion__body',
    '.faq h3', '.qr-card p', '.carousel__slide figcaption'
  ].join(',');

  let token = localStorage.getItem(TOKEN_KEY) || '';
  let editing = false, dirty = false;

  /* ---------- tiện ích ---------- */
  const enc = s => { const b = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(bin); };
  const dec = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), c => c.charCodeAt(0)));
  const pagePath = () => { let p = decodeURIComponent(location.pathname).replace(/^\/+/, ''); if (!p || p.endsWith('/')) p += 'index.html'; return p; };
  const slugify = s => s.replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 70);
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function gh(path, opts = {}) {
    const r = await fetch(API + path.split('/').map(encodeURIComponent).join('/') + (opts.method ? '' : '?ref=' + BRANCH), {
      ...opts,
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', ...(opts.headers || {}) }
    });
    if (!r.ok) {
      let msg = r.status + '';
      try { msg += ' ' + (await r.json()).message; } catch (e) {}
      if (r.status === 401) msg = 'Mã truy cập không đúng hoặc đã hết hạn.';
      if (r.status === 403 || r.status === 404) msg = 'Mã truy cập không có quyền ghi vào repo ' + REPO + '.';
      throw new Error(msg);
    }
    return r.json();
  }
  async function getFile(path) { const j = await gh(path); return { sha: j.sha, text: dec(j.content) }; }
  async function putFile(path, contentB64, message, sha) {
    return gh(path, { method: 'PUT', body: JSON.stringify({ message, content: contentB64, branch: BRANCH, ...(sha ? { sha } : {}) }) });
  }

  /* ---------- giao diện ---------- */
  const css = `
  .ed-bar{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:200;background:#0a2546;color:#fff;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.35);padding:8px;display:flex;gap:4px;align-items:center;flex-wrap:wrap;max-width:96vw;font:500 14px "Be Vietnam Pro",Arial,sans-serif}
  .ed-bar button{background:transparent;border:0;color:#fff;padding:8px 11px;border-radius:8px;cursor:pointer;font:inherit;min-width:36px}
  .ed-bar button:hover{background:rgba(255,255,255,.12)}
  .ed-bar .ed-save{background:#f2c230;color:#0a2546;font-weight:700}
  .ed-bar .ed-save:hover{background:#ffd447}
  .ed-bar .ed-sep{width:1px;height:24px;background:rgba(255,255,255,.2);margin:0 4px}
  .ed-bar .ed-status{padding:0 10px;font-size:13px;color:#c6d3e3;max-width:260px}
  body.ed-on [contenteditable=true]{outline:2px dashed rgba(15,157,154,.55);outline-offset:4px;border-radius:4px;cursor:text}
  body.ed-on [contenteditable=true]:focus{outline:2px solid #0f9d9a;background:rgba(242,194,48,.06)}
  body.ed-on main img{cursor:pointer!important}
  body.ed-on main img:hover{outline:3px solid #f2c230;outline-offset:2px}
  .ed-del{position:absolute;top:8px;right:8px;z-index:5;background:#d0021b;color:#fff;border:0;border-radius:50%;width:30px;height:30px;font-size:18px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)}
  .ed-modal{position:fixed;inset:0;background:rgba(5,15,30,.6);z-index:300;display:flex;align-items:center;justify-content:center;padding:16px}
  .ed-box{background:#fff;border-radius:16px;max-width:520px;width:100%;padding:26px;box-shadow:0 20px 60px rgba(0,0,0,.3);font:15px/1.6 "Be Vietnam Pro",Arial,sans-serif;color:#1c2633;max-height:90vh;overflow:auto}
  .ed-box h3{font-size:20px;color:#08386f;margin-bottom:10px}
  .ed-box ol{padding-left:20px;margin:8px 0 14px;font-size:14px}
  .ed-box input{width:100%;padding:11px 12px;border:1px solid #c9d6e4;border-radius:10px;font:inherit;margin:6px 0 14px}
  .ed-box .ed-row{display:flex;gap:10px;justify-content:flex-end}
  .ed-box button{padding:10px 18px;border-radius:999px;border:0;font:600 14px inherit;cursor:pointer;background:#e8eef5;color:#08386f}
  .ed-box button.pri{background:#0b4f9c;color:#fff}
  .ed-box small{color:#5b6878}
  .ed-box a{color:#0b4f9c}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function modal(html) {
    const m = document.createElement('div'); m.className = 'ed-modal';
    m.innerHTML = '<div class="ed-box">' + html + '</div>';
    document.body.appendChild(m);
    return m;
  }
  function ask(title, label, value = '') {
    return new Promise(res => {
      const m = modal(`<h3>${title}</h3><label>${label}</label><input value="${esc(value)}"><div class="ed-row"><button data-x>Hủy</button><button class="pri" data-ok>Đồng ý</button></div>`);
      const inp = m.querySelector('input'); inp.focus(); inp.select();
      const done = v => { m.remove(); res(v); };
      m.querySelector('[data-x]').onclick = () => done(null);
      m.querySelector('[data-ok]').onclick = () => done(inp.value.trim());
      inp.onkeydown = e => { if (e.key === 'Enter') done(inp.value.trim()); if (e.key === 'Escape') done(null); };
    });
  }

  function login() {
    return new Promise(res => {
      const m = modal(`<h3>Đăng nhập chế độ chỉnh sửa</h3>
        <p>Dán <b>mã truy cập GitHub</b> (token) có quyền ghi vào repo <b>${REPO}</b>. Mã chỉ lưu trên trình duyệt của máy này.</p>
        <details><summary style="cursor:pointer;color:#0b4f9c;font-weight:600">Cách tạo mã truy cập (làm 1 lần)</summary>
        <ol>
          <li>Mở <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a> (đăng nhập tài khoản anthai51).</li>
          <li><b>Token name</b>: Website Khoa Dược. <b>Expiration</b>: chọn thời hạn (ví dụ 1 năm).</li>
          <li><b>Repository access</b>: chọn <i>Only select repositories</i> → chọn <b>khoaduocxncmc</b>.</li>
          <li><b>Permissions → Repository permissions → Contents</b>: chọn <b>Read and write</b>.</li>
          <li>Bấm <b>Generate token</b>, sao chép mã (bắt đầu bằng <code>github_pat_</code>) và dán vào ô dưới.</li>
        </ol></details>
        <input type="password" placeholder="github_pat_..." autocomplete="off">
        <div class="ed-row"><button data-x>Hủy</button><button class="pri" data-ok>Đăng nhập</button></div>
        <small class="ed-msg"></small>`);
      const inp = m.querySelector('input'), msg = m.querySelector('.ed-msg');
      inp.focus();
      m.querySelector('[data-x]').onclick = () => { m.remove(); res(false); };
      const go = async () => {
        token = inp.value.trim(); if (!token) return;
        msg.textContent = 'Đang kiểm tra…';
        try {
          const r = await fetch('https://api.github.com/repos/' + REPO, { headers: { Authorization: 'Bearer ' + token } });
          const j = await r.json();
          if (!r.ok) throw new Error('Mã truy cập không hợp lệ.');
          if (j.permissions && !j.permissions.push) throw new Error('Mã này chưa có quyền ghi (Contents: Read and write).');
          localStorage.setItem(TOKEN_KEY, token); m.remove(); res(true);
        } catch (e) { msg.textContent = e.message; msg.style.color = '#d0021b'; }
      };
      m.querySelector('[data-ok]').onclick = go;
      inp.onkeydown = e => { if (e.key === 'Enter') go(); };
    });
  }

  let bar, statusEl;
  function setStatus(t, color) { if (statusEl) { statusEl.textContent = t; statusEl.style.color = color || '#c6d3e3'; } }

  function buildBar() {
    bar = document.createElement('div'); bar.className = 'ed-bar';
    const isList = pagePath() === 'kien-thuc-doi-song.html';
    bar.innerHTML = `
      <button data-c="bold" title="In đậm"><b>B</b></button>
      <button data-c="italic" title="In nghiêng"><i>I</i></button>
      <button data-c="underline" title="Gạch chân"><u>U</u></button>
      <button data-c="h" title="Tiêu đề nhỏ">H</button>
      <button data-c="insertUnorderedList" title="Danh sách chấm">• —</button>
      <button data-c="insertOrderedList" title="Danh sách số">1.</button>
      <button data-c="link" title="Chèn / sửa liên kết">🔗</button>
      <button data-c="unlink" title="Bỏ liên kết">⛓️‍💥</button>
      <button data-c="img" title="Chèn ảnh vào vị trí con trỏ">🖼️</button>
      <span class="ed-sep"></span>
      ${isList ? '<button data-c="newpost" title="Thêm bài viết mới">＋ Bài viết</button><span class="ed-sep"></span>' : ''}
      <button class="ed-save" data-c="save">💾 Lưu</button>
      <button data-c="exit" title="Thoát chế độ chỉnh sửa">Thoát</button>
      <button data-c="logout" title="Xóa mã truy cập khỏi máy này">Đăng xuất</button>
      <span class="ed-status">Bấm vào chữ để sửa · bấm vào ảnh để thay</span>`;
    document.body.appendChild(bar);
    statusEl = bar.querySelector('.ed-status');
    bar.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
    bar.addEventListener('click', e => { const b = e.target.closest('button'); if (b) cmd(b.dataset.c); });
  }

  let savedRange = null;
  document.addEventListener('selectionchange', () => {
    const s = getSelection(); if (s.rangeCount && editing && s.anchorNode && s.anchorNode.parentElement?.closest('[contenteditable=true]')) savedRange = s.getRangeAt(0).cloneRange();
  });
  const restore = () => { if (savedRange) { const s = getSelection(); s.removeAllRanges(); s.addRange(savedRange); } };

  async function cmd(c) {
    if (c === 'save') return save();
    if (c === 'exit') return exitEdit();
    if (c === 'logout') { if (confirmLeave()) { localStorage.removeItem(TOKEN_KEY); token = ''; exitEdit(true); } return; }
    if (c === 'newpost') return newPost();
    if (c === 'link') {
      const sel = savedRange; const cur = sel && (sel.startContainer.parentElement?.closest('a'));
      const url = await ask('Liên kết', 'Dán địa chỉ (link Google Drive, trang web…):', cur ? cur.getAttribute('href') : 'https://');
      if (!url) return; restore();
      if (cur) { cur.href = url; } else { document.execCommand('createLink', false, url); }
      const a = getSelection().anchorNode?.parentElement?.closest('a');
      if (a && /^https?:/.test(url)) { a.target = '_blank'; a.rel = 'noopener'; }
      return markDirty();
    }
    if (c === 'img') { restore(); return pickImage(url => { restore(); document.execCommand('insertHTML', false, `<img src="${url}" alt="" style="max-width:100%;border-radius:10px">`); markDirty(); }); }
    if (c === 'h') { restore(); const blk = getSelection().anchorNode?.parentElement?.closest('h2,h3,h4,p'); document.execCommand('formatBlock', false, blk && /^H/.test(blk.tagName) ? 'p' : 'h3'); return markDirty(); }
    restore(); document.execCommand(c); markDirty();
  }

  function markDirty() { dirty = true; setStatus('Có thay đổi chưa lưu', '#f2c230'); }
  function confirmLeave() { return !dirty || confirm('Có thay đổi chưa lưu. Bỏ qua các thay đổi?'); }

  /* ---------- ảnh ---------- */
  function pickImage(cb) {
    const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*';
    f.onchange = async () => {
      const file = f.files[0]; if (!file) return;
      try {
        setStatus('Đang tải ảnh lên…');
        const bm = await createImageBitmap(file);
        const sc = Math.min(1, 1600 / Math.max(bm.width, bm.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(bm.width * sc); cv.height = Math.round(bm.height * sc);
        const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(bm, 0, 0, cv.width, cv.height);
        const b64 = cv.toDataURL('image/jpeg', 0.82).split(',')[1];
        const name = 'assets/img/uploads/' + Date.now() + '-' + (slugify(file.name.replace(/\.[^.]+$/, '')) || 'anh') + '.jpg';
        await putFile(name, b64, 'Tải ảnh lên: ' + name);
        // dùng ảnh ngay (bản tạm) trong lúc GitHub Pages cập nhật
        const local = 'data:image/jpeg;base64,' + b64;
        cb(BASE + name, local);
        setStatus('Đã tải ảnh lên – nhớ bấm Lưu', '#f2c230');
      } catch (e) { setStatus('Lỗi tải ảnh: ' + e.message, '#ff8a8a'); }
    };
    f.click();
  }
  function onImgClick(e) {
    if (!editing) return;
    const img = e.target.closest('main img'); if (!img || img.closest('.ed-bar')) return;
    e.preventDefault(); e.stopPropagation();
    pickImage((url, local) => { img.dataset.edSrc = url; img.src = local; img.removeAttribute('srcset'); markDirty(); });
  }
  function onLinkClick(e) {
    if (!editing) return;
    const a = e.target.closest('main a'); if (a && !e.target.closest('img')) e.preventDefault();
  }

  /* ---------- thêm / xóa bài viết ---------- */
  function addDeleteButtons() {
    document.querySelectorAll('.article-grid .news').forEach(n => {
      if (n.querySelector('.ed-del')) return;
      n.style.position = 'relative';
      const b = document.createElement('button'); b.className = 'ed-del'; b.title = 'Xóa bài này khỏi danh sách'; b.textContent = '×';
      b.onclick = ev => { ev.preventDefault(); if (confirm('Xóa bài viết này khỏi danh sách?')) { n.remove(); markDirty(); } };
      n.appendChild(b);
    });
  }
  async function newPost() {
    const title = await ask('Thêm bài viết mới', 'Tiêu đề bài viết:');
    if (!title) return;
    const slug = slugify(title) + '-' + Date.now().toString(36).slice(-4);
    const path = 'bai-viet/' + slug + '.html';
    try {
      setStatus('Đang tạo bài viết…');
      const tplLink = document.querySelector('.article-grid .news h3 a');
      const tpl = await getFile(decodeURIComponent(new URL(tplLink.href).pathname).replace(/^\/+/, ''));
      const doc = new DOMParser().parseFromString(tpl.text, 'text/html');
      doc.title = title + ' | Khoa Dược - Xét nghiệm';
      doc.querySelector('meta[name=description]')?.setAttribute('content', title);
      doc.querySelector('.article__title').textContent = title;
      const cur = doc.querySelector('.crumb-cur'); if (cur) cur.textContent = title;
      const cov = doc.querySelector('.article__cover');
      if (cov) cov.innerHTML = '<img src="../assets/img/hero.jpg" alt="">';
      doc.querySelector('.article__lead').innerHTML = '<p>Đoạn mở đầu (tóm tắt) của bài viết…</p>';
      doc.querySelector('.article__body').innerHTML = '<p>Nội dung bài viết…</p>';
      doc.querySelector('.article__gallery')?.remove();
      const src = doc.querySelector('.article__source'); if (src) src.innerHTML = 'Nguồn: …';
      const html = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
      await putFile(path, enc(html), 'Thêm bài viết: ' + title);
      const grid = document.querySelector('.article-grid');
      const card = document.createElement('article'); card.className = 'news';
      card.innerHTML = `<a class="news__thumb" href="${path}"><img src="assets/img/hero.jpg" alt="" loading="lazy"></a>
        <div class="news__body"><h3><a href="${path}">${esc(title)}</a></h3><p>Tóm tắt ngắn của bài viết…</p><a class="news__more" href="${path}">Xem thêm →</a></div>`;
      grid.prepend(card);
      card.querySelectorAll('h3, p').forEach(el => el.setAttribute('contenteditable', 'true'));
      addDeleteButtons(); markDirty();
      setStatus('Đã tạo bài. Sửa tóm tắt/ảnh rồi bấm Lưu; sau đó mở bài để viết nội dung.', '#f2c230');
    } catch (e) { setStatus('Lỗi: ' + e.message, '#ff8a8a'); }
  }

  /* ---------- lưu ---------- */
  function cleanMain() {
    const main = document.querySelector('main').cloneNode(true);
    main.querySelectorAll('[contenteditable]').forEach(el => { el.removeAttribute('contenteditable'); el.removeAttribute('spellcheck'); });
    main.querySelectorAll('.ed-del').forEach(el => el.remove());
    main.querySelectorAll('.reveal, .in').forEach(el => el.classList.remove('reveal', 'in'));
    main.querySelectorAll('[class=""]').forEach(el => el.removeAttribute('class'));
    main.querySelectorAll('.carousel__dots').forEach(el => (el.innerHTML = ''));
    main.querySelectorAll('.carousel__track').forEach(el => el.removeAttribute('style'));
    main.querySelectorAll('img[data-ed-src]').forEach(img => { img.setAttribute('src', img.dataset.edSrc); img.removeAttribute('data-ed-src'); });
    main.querySelectorAll('img[src^="data:"]').forEach(img => img.remove());
    main.querySelectorAll('.news').forEach(n => n.removeAttribute('style'));
    return main.outerHTML;
  }
  async function save() {
    try {
      setStatus('Đang lưu…');
      const path = pagePath();
      const f = await getFile(path);
      const a = f.text.indexOf('<main'), b = f.text.lastIndexOf('</main>');
      if (a < 0 || b < 0) throw new Error('Không tìm thấy phần nội dung trong file.');
      const out = f.text.slice(0, a) + cleanMain() + f.text.slice(b + 7);
      await putFile(path, enc(out), 'Chỉnh sửa nội dung: ' + document.title.split('|')[0].trim(), f.sha);
      dirty = false;
      setStatus('✔ Đã lưu! Trang công khai cập nhật sau khoảng 1 phút.', '#7ee2a8');
    } catch (e) { setStatus('Lỗi khi lưu: ' + e.message, '#ff8a8a'); }
  }

  /* ---------- bật / tắt ---------- */
  async function enterEdit() {
    if (!token && !(await login())) return;
    editing = true; document.body.classList.add('ed-on');
    document.querySelectorAll(EDITABLE).forEach(el => { if (!el.closest('[contenteditable=true]')) el.setAttribute('contenteditable', 'true'); });
    if (!bar) buildBar(); else bar.style.display = '';
    addDeleteButtons();
    document.querySelector('main').addEventListener('input', markDirty);
  }
  function exitEdit(force) {
    if (!force && !confirmLeave()) return;
    if (dirty && !force) { location.reload(); return; }
    editing = false; document.body.classList.remove('ed-on');
    document.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    document.querySelectorAll('.ed-del').forEach(el => el.remove());
    if (bar) bar.style.display = 'none';
    if (force && dirty) location.reload();
  }
  document.addEventListener('click', onImgClick, true);
  document.addEventListener('click', onLinkClick, true);
  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  window.KDXNEditor = { start: enterEdit };
  enterEdit();
})();
