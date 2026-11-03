// 🔐 Đăng nhập / Đăng ký → Trang chờ (bảng kiểm tra trực quan xanh/đỏ) → Kiểm tra đầu vào → Phân hệ học tập.
// Nhiều tài khoản trên cùng thiết bị: mật khẩu băm PBKDF2-SHA-256 có salt ngẫu nhiên, không lưu dạng chữ.
// Sai 5 lần thì khóa 60 giây. Phiên đăng nhập là mã ngẫu nhiên, chỉ lưu bản băm để đối chiếu.
// "Ghi nhớ đăng nhập" giữ phiên không hết hạn cho tới khi bấm Đăng xuất.
// Script thường, nạp trước js/app.js.

const AUTH_KEY = 'engmate-auth';
const SESSION_KEY = 'engmate-session';
const PBKDF2_ITER = 150000;
const MAX_FAILS = 5, LOCK_MS = 60 * 1000;
const SESSION_SHORT_MS = 12 * 3600 * 1000; // không ghi nhớ: phiên 12 giờ, đóng trình duyệt là phải đăng nhập lại
var authed = false; // var: để trang Demo 01 đọc được qua khung iframe

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const randHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async s => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
async function hashPassword(password, salt, iter = PBKDF2_ITER) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: iter }, key, 256);
  return hex(bits);
}
// So sánh không dừng sớm, tránh lộ thông tin qua thời gian so sánh.
const sameHex = (a, b) => a.length === b.length && [...a].reduce((d, c, i) => d | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;

// Kho tài khoản: { users: { "tên viết thường": { user, salt, iter, hash, role, session, ... } } }.
// Bản cũ chỉ có một tài khoản { user, ... } được chuyển sang dạng mới.
const userKey = name => name.trim().toLowerCase();
function loadUsers() {
  let db;
  try { db = JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { db = null; }
  if (db?.user && !db.users) db = { users: { [userKey(db.user)]: db } };
  return db?.users ? db : { users: {} };
}
const getUser = name => loadUsers().users[userKey(name)] || null;
const saveUser = rec => { const db = loadUsers(); db.users[userKey(rec.user)] = rec; localStorage.setItem(AUTH_KEY, JSON.stringify(db)); };
const removeUser = name => { const db = loadUsers(); delete db.users[userKey(name)]; localStorage.setItem(AUTH_KEY, JSON.stringify(db)); };
const readSession = () => {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY)); } catch { return null; }
};
const clearSession = () => { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); };
const authUser = () => readSession()?.user || '';

// Phiên hợp lệ khi: tài khoản còn, có phiên, chưa hết hạn (exp null = ghi nhớ, không hết hạn) và mã phiên khớp bản băm.
async function validateSession() {
  const s = readSession(), a = s && getUser(s.user);
  if (!a?.session || (a.session.exp !== null && Date.now() > a.session.exp)) return false;
  return sameHex(await sha256(s.token), a.session.tokenHash);
}

function logout() {
  const a = getUser(authUser());
  if (a) { delete a.session; saveUser(a); }
  clearSession();
  authed = false;
  location.hash = '#/home';
  router();
}

// mode: 'login' (đăng nhập) hoặc 'register' (đăng ký tài khoản mới).
function viewLogin(msg = '', mode, prefill = '') {
  document.body.classList.add('no-tabs');
  const users = Object.values(loadUsers().users);
  mode = mode || (users.length ? 'login' : 'register');
  const isNew = mode === 'register';
  if (!window.crypto?.subtle) {
    view.innerHTML = `<div class="card auth-card"><h1>🔐 Không thể đăng nhập</h1><p>Trình duyệt này không hỗ trợ mã hóa an toàn (Web Crypto). Hãy mở app qua <b>https://</b> hoặc <b>http://localhost</b> bằng Chrome/Edge.</p></div>`;
    return;
  }
  const last = prefill || (!isNew && users.sort((x, y) => (y.lastLogin || 0) - (x.lastLogin || 0))[0]?.user) || '';
  view.innerHTML = `<div class="auth-wrap">
    <div class="auth-logo">🦉</div>
    <h1 style="text-align:center;margin-bottom:4px">${isNew ? 'Đăng ký tài khoản EngMate' : 'Đăng nhập EngMate'}</h1>
    <p class="muted small" style="text-align:center;margin-top:0">${isNew ? 'Tạo tài khoản để lưu và bảo vệ tiến độ học của bạn.' : `Có ${users.length} tài khoản trên thiết bị này.`}</p>
    <div class="auth-tabs" role="tablist">
      <button type="button" role="tab" class="${isNew ? '' : 'on'}" aria-selected="${!isNew}" id="au-tab-login">🔓 Đăng nhập</button>
      <button type="button" role="tab" class="${isNew ? 'on' : ''}" aria-selected="${isNew}" id="au-tab-reg">✨ Đăng ký tài khoản</button></div>
    <form class="card auth-card" id="au-form" autocomplete="on">
      <label for="au-user">Tên đăng nhập</label>
      <input id="au-user" name="username" autocomplete="username" required minlength="3" maxlength="32" value="${esc(last)}" placeholder="Ví dụ: minh2008" ${isNew ? '' : 'list="au-users"'}>
      ${isNew ? '' : `<datalist id="au-users">${users.map(u => `<option value="${esc(u.user)}">`).join('')}</datalist>`}
      <label for="au-pass">Mật khẩu</label>
      <div class="auth-pass"><input id="au-pass" type="password" name="password" autocomplete="${isNew ? 'new-password' : 'current-password'}" required minlength="6" placeholder="Ít nhất 6 ký tự">
        <button type="button" class="icon-btn" id="au-eye" aria-label="Hiện mật khẩu">👁</button></div>
      ${isNew ? `<label for="au-pass2">Nhập lại mật khẩu</label><input id="au-pass2" type="password" autocomplete="new-password" required minlength="6">
        <div class="auth-meter"><div id="au-meter"></div></div><p class="muted small" id="au-strength" style="margin:4px 0 0">Độ mạnh mật khẩu</p>` : ''}
      <label class="row" style="font-weight:600;margin-top:12px"><input type="checkbox" id="au-remember" style="width:auto" checked> Ghi nhớ đăng nhập (không hết hạn)</label>
      <p class="muted small" style="margin:2px 0 0">Bỏ chọn trên máy dùng chung: đóng trình duyệt là phải đăng nhập lại.</p>
      <div class="feedback bad" id="au-err" ${msg ? '' : 'hidden'}>${esc(msg)}</div>
      <button class="btn block" style="margin-top:12px" id="au-go">${isNew ? '✨ Đăng ký & vào học' : '🔓 Đăng nhập'}</button>
      ${isNew ? '' : '<button type="button" class="btn ghost sm block" style="margin-top:8px" id="au-forgot">Quên mật khẩu?</button>'}
    </form>
    <p class="muted small" style="text-align:center">${isNew ? 'Đã có tài khoản? <a href="#" id="au-switch">Đăng nhập</a>' : 'Chưa có tài khoản? <a href="#" id="au-switch">Đăng ký ngay</a>'}</p>
    <p class="muted small" style="text-align:center">🔒 Mật khẩu được băm PBKDF2-SHA-256 có salt ngay trên máy, không gửi đi đâu.</p></div>`;

  const err = m => { const e = $('#au-err'); e.hidden = !m; e.textContent = m; };
  const go = m => viewLogin('', m, m === 'register' ? '' : $('#au-user').value.trim());
  $('#au-tab-login').onclick = () => go('login');
  $('#au-tab-reg').onclick = () => go('register');
  $('#au-switch').onclick = e => { e.preventDefault(); go(isNew ? 'login' : 'register'); };
  $('#au-eye').onclick = () => { const p = $('#au-pass'); p.type = p.type === 'password' ? 'text' : 'password'; };
  if (isNew) $('#au-pass').oninput = e => {
    const v = e.target.value;
    const score = [v.length >= 8, /[a-z]/.test(v) && /[A-Z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v), v.length >= 12].filter(Boolean).length;
    $('#au-meter').style.width = `${score * 20}%`;
    $('#au-meter').style.background = score < 2 ? 'var(--bad)' : score < 4 ? 'var(--accent)' : 'var(--ok)';
    $('#au-strength').textContent = v ? ['Rất yếu', 'Yếu', 'Trung bình', 'Khá', 'Mạnh', 'Rất mạnh'][score] : 'Độ mạnh mật khẩu';
  };
  if (!isNew) $('#au-forgot').onclick = () => resetAccount($('#au-user').value.trim());

  $('#au-form').onsubmit = e => {
    e.preventDefault();
    const user = $('#au-user').value.trim(), pass = $('#au-pass').value;
    if (!/^[\p{L}\p{N}_.-]{3,32}$/u.test(user)) return err('Tên đăng nhập 3–32 ký tự, chỉ gồm chữ, số, dấu . _ -');
    if (pass.length < 6) return err('Mật khẩu cần ít nhất 6 ký tự.');
    if (isNew && pass !== $('#au-pass2').value) return err('Hai mật khẩu không khớp.');
    viewBoot({ user, pass, isNew, remember: $('#au-remember').checked });
  };
  setTimeout(() => (last ? $('#au-pass') : $('#au-user')).focus(), 50);
}

// Trang chờ kiểm tra trực quan: mỗi bước xám (chờ) → vàng (đang kiểm tra) → xanh ✔ (đạt) hoặc đỏ ✖ (lỗi),
// kèm giải thích bên dưới. Chỉ khi mọi bước xanh mới mở Phân hệ Học tập; có bước đỏ thì giữ màn hình để đọc lỗi.
function resetAccount(name) {
  if (!name || !getUser(name)) return viewLogin('Nhập đúng tên đăng nhập cần khôi phục trước.', 'login', name);
  if (!confirm(`Mật khẩu chỉ lưu dạng băm trên máy này nên không thể khôi phục. Xóa tài khoản “${name}” để đăng ký lại? (Tiến độ học vẫn được giữ.)`)) return;
  removeUser(name);
  if (userKey(authUser()) === userKey(name)) clearSession();
  viewLogin('', 'register', name);
}

async function viewBoot({ user, pass, isNew, remember }) {
  document.body.classList.add('no-tabs');
  let a = isNew ? null : getUser(user), hash;
  // Mỗi bước: [biểu tượng, tên, câu khi đang chạy, hàm kiểm tra → { ok, note, fix? }]. fix: 'reset' hiện nút khôi phục tài khoản.
  const steps = [
    ['💾', 'Bộ nhớ thiết bị', 'Đang thử ghi và đọc dữ liệu trên máy...', async () => {
      const k = 'engmate-probe', v = randHex(8);
      localStorage.setItem(k, v);
      const ok = localStorage.getItem(k) === v;
      localStorage.removeItem(k);
      return ok ? { ok, note: 'Ghi/đọc dữ liệu trên máy thành công.' }
        : { ok, note: 'Lỗi: trình duyệt không lưu được dữ liệu. Hãy tắt chế độ ẩn danh hoặc cho phép lưu trữ.' };
    }],
    ['🔑', 'Băm mật khẩu (PBKDF2-SHA-256)', `Đang băm mật khẩu ${PBKDF2_ITER.toLocaleString('vi-VN')} vòng...`, async () => {
      const salt = a?.salt || randHex(16), iter = a?.iter || PBKDF2_ITER;
      hash = await hashPassword(pass, salt, iter);
      if (isNew && !getUser(user)) a = { user, salt, iter, hash, role: 'learner', created: Date.now(), fails: 0, lockedUntil: 0 };
      return { ok: true, note: `Đã băm ${iter.toLocaleString('vi-VN')} vòng kèm salt ngẫu nhiên. Mật khẩu không được lưu dạng chữ.` };
    }],
    ['👤', 'Xác thực tài khoản', 'Đang đối chiếu với tài khoản đã lưu...', async () => {
      if (isNew && !a) return { ok: false, fix: 'login', note: `Lỗi: tên đăng nhập “${user}” đã có người dùng. Hãy chọn tên khác hoặc đăng nhập.` };
      if (!isNew && !a) return { ok: false, fix: 'register', note: `Lỗi: không tìm thấy tài khoản “${user}” trên thiết bị này. Kiểm tra lại tên hoặc đăng ký tài khoản mới.` };
      if (!isNew && Date.now() < (a.lockedUntil || 0)) {
        const s = Math.ceil((a.lockedUntil - Date.now()) / 1000);
        return { ok: false, note: `Lỗi: tài khoản đang tạm khóa do nhập sai nhiều lần. Thử lại sau ${s} giây.`, fix: 'reset' };
      }
      if (!isNew && !sameHex(hash, a.hash)) {
        a.fails = (a.fails || 0) + 1;
        if (a.fails >= MAX_FAILS) { a.lockedUntil = Date.now() + LOCK_MS; a.fails = 0; }
        saveUser(a);
        const left = a.lockedUntil > Date.now() ? 0 : MAX_FAILS - a.fails;
        return { ok: false, fix: 'reset', note: left ? `Lỗi: mật khẩu không khớp. Còn ${left} lần thử trước khi tài khoản bị khóa 60 giây.` : 'Lỗi: sai mật khẩu 5 lần, tài khoản bị khóa 60 giây.' };
      }
      a.fails = 0; a.lockedUntil = 0; a.lastLogin = Date.now();
      return { ok: true, note: isNew ? `Đã tạo tài khoản “${a.user}”.` : 'Mật khẩu khớp với tài khoản đã lưu.' };
    }],
    ['🎫', 'Phiên đăng nhập', 'Đang tạo mã phiên và xác thực...', async () => {
      const token = randHex(32), exp = remember ? null : Date.now() + SESSION_SHORT_MS;
      a.session = { tokenHash: await sha256(token), exp };
      saveUser(a);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user: a.user, token }));
      if (remember) localStorage.setItem(SESSION_KEY, JSON.stringify({ user: a.user, token })); else localStorage.removeItem(SESSION_KEY);
      const ok = await validateSession();
      return ok ? { ok, note: exp === null ? 'Mã phiên hợp lệ, ghi nhớ đăng nhập (không hết hạn, đến khi bấm Đăng xuất).' : `Mã phiên hợp lệ, hết hạn ${new Date(exp).toLocaleString('vi-VN')} hoặc khi đóng trình duyệt.` }
        : { ok, note: 'Lỗi: mã phiên không khớp sau khi tạo. Hãy thử đăng nhập lại.' };
    }],
    ['🌐', 'Kết nối mạng', 'Đang kiểm tra kết nối...', async () => {
      await detectServer();
      if (!navigator.onLine) return { ok: true, note: 'Đang offline: bài học, ôn tập vẫn dùng được; tính năng AI sẽ chờ có mạng.' };
      return { ok: true, note: server.online ? `Đã kết nối máy chủ EngMate${server.ai ? ' (có gia sư AI)' : ''}.` : 'Đã có mạng. Đang chạy bản web (không cần máy chủ riêng).' };
    }],
    ['🧩', 'Toàn vẹn dữ liệu học tập', 'Đang đọc và kiểm tra dữ liệu học...', async () => {
      const raw = localStorage.getItem(STORE);
      try { if (raw) JSON.parse(raw); } catch {
        return { ok: false, note: 'Lỗi: dữ liệu học trên máy bị hỏng. Hãy khôi phục từ bản sao lưu (Cài đặt → Khôi phục).' };
      }
      return { ok: true, note: raw ? `${Object.keys(state.completed).length} bài đã học · ${Object.keys(state.srs).length} thẻ từ vựng.` : 'Chưa có dữ liệu cũ, bắt đầu hồ sơ mới.' };
    }],
    ['🗣️', 'Tải trước bài học & giọng đọc', 'Đang nạp bài học, từ vựng và giọng đọc...', async () => {
      if ('speechSynthesis' in window) speechSynthesis.getVoices();
      const words = new Set(LESSONS.flatMap(l => l.vocab.map(v => v.en))).size;
      return LESSONS.length ? { ok: true, note: `${LESSONS.length} bài học · ${words} từ vựng sẵn sàng.` }
        : { ok: false, note: 'Lỗi: không tải được nội dung bài học. Hãy tải lại trang.' };
    }],
    ['🎓', 'Quyền vào Phân hệ Học tập', 'Đang kiểm tra quyền truy cập...', async () =>
      a.role === 'learner' ? { ok: true, note: 'Tài khoản học viên được phép vào học.' }
        : { ok: false, note: 'Lỗi: tài khoản này không có quyền vào Phân hệ Học tập.' }],
  ];

  view.innerHTML = `<div class="auth-wrap"><div class="auth-logo spin" id="bt-logo">🦉</div>
    <h1 style="text-align:center;margin-bottom:4px" id="bt-title">Đang kiểm tra đầu vào...</h1>
    <p class="muted small" style="text-align:center;margin-top:0" id="bt-now">Chuẩn bị</p>
    <div class="progress" style="margin:12px 0"><div id="bt-bar" style="width:0%"></div></div>
    <div class="card" role="list" aria-label="Các bước kiểm tra">${steps.map(([i, t], k) => `<div class="boot-step pending" role="listitem" id="bt-${k}">
      <span class="bs-st" aria-hidden="true">${i}</span>
      <div class="grow"><b>${t}</b><div class="bs-note small">Đang chờ</div></div></div>`).join('')}</div>
    <div class="feedback" id="bt-sum" hidden></div>
    <button class="btn block" id="bt-go" disabled style="margin-top:10px">🔒 Tiếp tục vào App Học tập</button>
    <div class="row" id="bt-fix" hidden style="margin-top:8px"></div></div>`;
  const pause = ms => new Promise(r => setTimeout(r, ms));
  const setRow = (k, cls, note) => {
    const el = $(`#bt-${k}`);
    el.className = `boot-step ${cls}`;
    $('.bs-st', el).textContent = { doing: '', ok: '✔', fail: '✖', skip: '–' }[cls] ?? steps[k][0];
    $('.bs-note', el).textContent = note;
  };

  let failed = null;
  for (let k = 0; k < steps.length; k++) {
    const [, title, running, fn] = steps[k];
    if (failed) { setRow(k, 'skip', 'Bỏ qua vì bước trước bị lỗi.'); continue; }
    setRow(k, 'doing', running);
    $('#bt-now').textContent = title + '...';
    const t0 = performance.now();
    let res;
    try { res = await fn(); } catch (e) { res = { ok: false, note: `Lỗi: ${e.message || 'không rõ nguyên nhân'}.` }; }
    await pause(Math.max(0, 420 - (performance.now() - t0))); // để kịp nhìn thấy từng bước
    setRow(k, res.ok ? 'ok' : 'fail', res.note);
    $('#bt-bar').style.width = `${Math.round(100 * (k + 1) / steps.length)}%`;
    if (!res.ok) failed = { k, ...res };
  }
  $('#bt-logo').classList.remove('spin');
  const sum = $('#bt-sum'), go = $('#bt-go'), fix = $('#bt-fix');
  sum.hidden = false;

  if (failed) {
    $('#bt-bar').style.background = 'var(--bad)';
    $('#bt-title').textContent = 'Chưa thể vào học';
    $('#bt-now').textContent = 'Có bước kiểm tra bị lỗi, xem giải thích màu đỏ bên trên.';
    sum.className = 'feedback bad';
    sum.textContent = `✖ ${steps[failed.k][1]}: ${failed.note.replace(/^Lỗi: /, '')}`;
    fix.hidden = false;
    fix.innerHTML = `<button class="btn sm" id="bt-retry">🔄 Thử lại</button>${{
      reset: '<button class="btn sm ghost" id="bt-reset">🔑 Khôi phục tài khoản</button>',
      register: '<button class="btn sm ghost" id="bt-reg">✨ Đăng ký tài khoản</button>',
      login: '<button class="btn sm ghost" id="bt-login">🔓 Đăng nhập</button>' }[failed.fix] || ''}`;
    $('#bt-retry').onclick = () => viewLogin('', isNew ? 'register' : 'login', user);
    if ($('#bt-reset')) $('#bt-reset').onclick = () => resetAccount(user);
    if ($('#bt-reg')) $('#bt-reg').onclick = () => viewLogin('', 'register', user);
    if ($('#bt-login')) $('#bt-login').onclick = () => viewLogin('', 'login', user);
    $(`#bt-${failed.k}`).scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }

  authed = true;
  if (!state.profile.name) { state.profile.name = a.user; save(); }
  $('#bt-title').textContent = 'Kiểm tra hoàn tất ✔';
  sum.className = 'feedback ok';
  sum.textContent = `✔ Cả ${steps.length}/${steps.length} bước đều đạt. ${state.profile.onboarded ? 'Sẵn sàng vào Phân hệ Học tập.' : 'Tiếp theo: làm quen và kiểm tra trình độ đầu vào.'}`;
  go.disabled = false;
  go.textContent = '🎓 Tiếp tục vào App Học tập';
  const enter = () => {
    clearInterval(timer);
    // Người mới: màn chào mừng (tên, lứa tuổi) → Kiểm tra đầu vào; người cũ: vào thẳng trang học.
    if (location.hash === '#/home') router(); else location.hash = '#/home';
  };
  let left = 3;
  $('#bt-now').textContent = `Tự vào học sau ${left} giây...`;
  const timer = setInterval(() => { if (--left <= 0) enter(); else if ($('#bt-now')) $('#bt-now').textContent = `Tự vào học sau ${left} giây...`; }, 1000);
  go.onclick = enter;
  window.addEventListener('hashchange', () => clearInterval(timer), { once: true });
}
