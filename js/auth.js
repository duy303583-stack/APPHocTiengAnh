// 🔐 Đăng nhập → Trang chờ (kiểm tra) → Kiểm tra đầu vào → Phân hệ học tập.
// Tài khoản lưu trên chính thiết bị: mật khẩu băm PBKDF2-SHA-256 có salt ngẫu nhiên, không lưu dạng chữ.
// Sai 5 lần thì khóa 60 giây. Phiên đăng nhập là mã ngẫu nhiên, chỉ lưu bản băm để đối chiếu.
// Script thường, nạp trước js/app.js.

const AUTH_KEY = 'engmate-auth';
const SESSION_KEY = 'engmate-session';
const PBKDF2_ITER = 150000;
const MAX_FAILS = 5, LOCK_MS = 60 * 1000;
const SESSION_MS = { short: 12 * 3600 * 1000, remember: 30 * 86400 * 1000 };
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

const loadAuth = () => { try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; } catch { return null; } };
const saveAuth = a => localStorage.setItem(AUTH_KEY, JSON.stringify(a));
const readSession = () => {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY)); } catch { return null; }
};
const authUser = () => loadAuth()?.user || '';

// Phiên hợp lệ khi: có tài khoản, đúng người dùng, chưa hết hạn và mã phiên khớp bản băm đã lưu.
async function validateSession() {
  const a = loadAuth(), s = readSession();
  if (!a || !s || s.user !== a.user || !a.session || Date.now() > a.session.exp) return false;
  return sameHex(await sha256(s.token), a.session.tokenHash);
}

function logout() {
  const a = loadAuth();
  if (a) { delete a.session; saveAuth(a); }
  sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY);
  authed = false;
  location.hash = '#/home';
  router();
}

function viewLogin(msg = '') {
  document.body.classList.add('no-tabs');
  const a = loadAuth();
  const isNew = !a;
  if (!window.crypto?.subtle) {
    view.innerHTML = `<div class="card auth-card"><h1>🔐 Không thể đăng nhập</h1><p>Trình duyệt này không hỗ trợ mã hóa an toàn (Web Crypto). Hãy mở app qua <b>https://</b> hoặc <b>http://localhost</b> bằng Chrome/Edge.</p></div>`;
    return;
  }
  view.innerHTML = `<div class="auth-wrap">
    <div class="auth-logo">🦉</div>
    <h1 style="text-align:center;margin-bottom:4px">${isNew ? 'Tạo tài khoản EngMate' : 'Đăng nhập EngMate'}</h1>
    <p class="muted small" style="text-align:center;margin-top:0">${isNew ? 'Tài khoản dùng trên thiết bị này để bảo vệ tiến độ học của bạn.' : `Chào mừng trở lại, <b>${esc(a.user)}</b>!`}</p>
    <form class="card auth-card" id="au-form" autocomplete="on">
      <label for="au-user">Tên đăng nhập</label>
      <input id="au-user" name="username" autocomplete="username" required minlength="3" maxlength="32" value="${esc(a?.user || '')}" ${isNew ? '' : 'readonly'} placeholder="Ví dụ: minh2008">
      <label for="au-pass">Mật khẩu</label>
      <div class="auth-pass"><input id="au-pass" type="password" name="password" autocomplete="${isNew ? 'new-password' : 'current-password'}" required minlength="6" placeholder="Ít nhất 6 ký tự">
        <button type="button" class="icon-btn" id="au-eye" aria-label="Hiện mật khẩu">👁</button></div>
      ${isNew ? `<label for="au-pass2">Nhập lại mật khẩu</label><input id="au-pass2" type="password" autocomplete="new-password" required minlength="6">
        <div class="auth-meter"><div id="au-meter"></div></div><p class="muted small" id="au-strength" style="margin:4px 0 0">Độ mạnh mật khẩu</p>` : ''}
      <label class="row" style="font-weight:600;margin-top:12px"><input type="checkbox" id="au-remember" style="width:auto"> Ghi nhớ đăng nhập 30 ngày</label>
      <div class="feedback bad" id="au-err" ${msg ? '' : 'hidden'}>${esc(msg)}</div>
      <button class="btn block" style="margin-top:12px" id="au-go">${isNew ? '✨ Tạo tài khoản & vào học' : '🔓 Đăng nhập'}</button>
      ${isNew ? '' : '<button type="button" class="btn ghost sm block" style="margin-top:8px" id="au-forgot">Quên mật khẩu?</button>'}
    </form>
    <p class="muted small" style="text-align:center">🔒 Mật khẩu được băm PBKDF2-SHA-256 có salt ngay trên máy, không gửi đi đâu.</p></div>`;

  const err = m => { const e = $('#au-err'); e.hidden = !m; e.textContent = m; };
  $('#au-eye').onclick = () => { const p = $('#au-pass'); p.type = p.type === 'password' ? 'text' : 'password'; };
  if (isNew) $('#au-pass').oninput = e => {
    const v = e.target.value;
    const score = [v.length >= 8, /[a-z]/.test(v) && /[A-Z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v), v.length >= 12].filter(Boolean).length;
    $('#au-meter').style.width = `${score * 20}%`;
    $('#au-meter').style.background = score < 2 ? 'var(--bad)' : score < 4 ? 'var(--accent)' : 'var(--ok)';
    $('#au-strength').textContent = v ? ['Rất yếu', 'Yếu', 'Trung bình', 'Khá', 'Mạnh', 'Rất mạnh'][score] : 'Độ mạnh mật khẩu';
  };
  if (!isNew) $('#au-forgot').onclick = () => {
    if (!confirm('Mật khẩu chỉ lưu dạng băm trên máy này nên không thể khôi phục. Xóa tài khoản để tạo lại? (Tiến độ học vẫn được giữ.)')) return;
    localStorage.removeItem(AUTH_KEY); localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY);
    viewLogin();
  };

  $('#au-form').onsubmit = e => {
    e.preventDefault();
    const user = $('#au-user').value.trim(), pass = $('#au-pass').value;
    if (!/^[\p{L}\p{N}_.-]{3,32}$/u.test(user)) return err('Tên đăng nhập 3–32 ký tự, chỉ gồm chữ, số, dấu . _ -');
    if (pass.length < 6) return err('Mật khẩu cần ít nhất 6 ký tự.');
    if (isNew && pass !== $('#au-pass2').value) return err('Hai mật khẩu không khớp.');
    viewBoot({ user, pass, isNew, remember: $('#au-remember').checked });
  };
  setTimeout(() => (isNew ? $('#au-user') : $('#au-pass')).focus(), 50);
}

// Trang chờ: chạy lần lượt các bước kiểm tra, bước nào lỗi thì dừng và quay lại màn đăng nhập.
async function viewBoot({ user, pass, isNew, remember }) {
  document.body.classList.add('no-tabs');
  const steps = [
    ['🔑', 'Băm mật khẩu bằng PBKDF2-SHA-256'],
    ['👤', 'Kiểm tra tài khoản (bị khóa? mật khẩu khớp?)'],
    ['🎫', 'Tạo & xác thực phiên đăng nhập'],
    ['🧩', 'Kiểm tra toàn vẹn dữ liệu học tập'],
    ['🗣️', 'Tải trước bài học, giọng đọc & từ vựng'],
    ['🎓', 'Kiểm tra quyền vào Phân hệ Học tập'],
  ];
  view.innerHTML = `<div class="auth-wrap"><div class="auth-logo spin">🦉</div>
    <h1 style="text-align:center;margin-bottom:4px">Đang khởi động...</h1><p class="muted small" style="text-align:center;margin-top:0" id="bt-now">Chuẩn bị</p>
    <div class="progress" style="margin:12px 0"><div id="bt-bar" style="width:0%"></div></div>
    <div class="card">${steps.map(([i, t], k) => `<div class="boot-step" id="bt-${k}"><span class="bs-ico">${i}</span><span class="grow">${t}</span><span class="bs-st">⏳</span></div>`).join('')}</div></div>`;
  const pause = ms => new Promise(r => setTimeout(r, ms));
  const mark = (k, ok, note) => {
    const el = $(`#bt-${k}`);
    if (!el) return;
    el.classList.add(ok ? 'ok' : 'fail');
    $('.bs-st', el).textContent = ok ? '✅' : '❌';
    if (note) $('.grow', el).insertAdjacentHTML('beforeend', `<div class="small muted">${esc(note)}</div>`);
    $('#bt-bar').style.width = `${Math.round(100 * (k + 1) / steps.length)}%`;
  };
  const run = async (k, fn) => {
    $('#bt-now').textContent = steps[k][1] + '...';
    $(`#bt-${k}`)?.classList.add('doing');
    const t0 = performance.now();
    let res;
    try { res = await fn(); } catch (e) { res = { ok: false, note: e.message }; }
    await pause(Math.max(0, 380 - (performance.now() - t0))); // để kịp nhìn thấy từng bước
    mark(k, res.ok, res.note);
    if (!res.ok) throw new Error(res.msg || res.note);
  };

  let a = loadAuth(), hash;
  try {
    await run(0, async () => {
      const salt = isNew ? randHex(16) : a.salt;
      hash = await hashPassword(pass, salt, isNew ? PBKDF2_ITER : a.iter);
      if (isNew) a = { user, salt, iter: PBKDF2_ITER, hash, role: 'learner', created: Date.now(), fails: 0, lockedUntil: 0 };
      return { ok: true, note: `${(isNew ? PBKDF2_ITER : a.iter).toLocaleString('vi-VN')} vòng băm` };
    });
    await run(1, async () => {
      if (!isNew && Date.now() < (a.lockedUntil || 0)) {
        const s = Math.ceil((a.lockedUntil - Date.now()) / 1000);
        return { ok: false, note: `Tài khoản tạm khóa, thử lại sau ${s} giây.` };
      }
      if (!isNew && !sameHex(hash, a.hash)) {
        a.fails = (a.fails || 0) + 1;
        if (a.fails >= MAX_FAILS) { a.lockedUntil = Date.now() + LOCK_MS; a.fails = 0; }
        saveAuth(a);
        const left = a.lockedUntil > Date.now() ? 0 : MAX_FAILS - a.fails;
        return { ok: false, note: left ? `Sai mật khẩu, còn ${left} lần thử.` : 'Sai quá 5 lần: tài khoản bị khóa 60 giây.' };
      }
      a.fails = 0; a.lockedUntil = 0; a.lastLogin = Date.now();
      return { ok: true, note: isNew ? 'Đã tạo tài khoản mới' : 'Mật khẩu khớp' };
    });
    await run(2, async () => {
      const token = randHex(32), exp = Date.now() + (remember ? SESSION_MS.remember : SESSION_MS.short);
      a.session = { tokenHash: await sha256(token), exp };
      saveAuth(a);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user: a.user, token }));
      if (remember) localStorage.setItem(SESSION_KEY, JSON.stringify({ user: a.user, token })); else localStorage.removeItem(SESSION_KEY);
      const ok = await validateSession();
      return { ok, note: ok ? `Hết hạn ${new Date(exp).toLocaleString('vi-VN')}` : 'Phiên không hợp lệ' };
    });
    await run(3, async () => {
      const raw = localStorage.getItem(STORE);
      if (raw) JSON.parse(raw); // ném lỗi nếu dữ liệu hỏng
      const n = Object.keys(state.srs).length;
      return { ok: true, note: raw ? `${Object.keys(state.completed).length} bài đã học · ${n} thẻ từ` : 'Bắt đầu dữ liệu mới' };
    });
    await run(4, async () => {
      if ('speechSynthesis' in window) speechSynthesis.getVoices();
      const words = new Set(LESSONS.flatMap(l => l.vocab.map(v => v.en))).size;
      detectServer();
      return { ok: LESSONS.length > 0, note: `${LESSONS.length} bài học · ${words} từ vựng` };
    });
    await run(5, async () => ({ ok: a.role === 'learner', note: a.role === 'learner' ? 'Được phép học' : 'Tài khoản không có quyền học' }));
  } catch (e) {
    await pause(700);
    return viewLogin(e.message);
  }
  authed = true;
  if (!state.profile.name) { state.profile.name = a.user; save(); }
  $('#bt-now').textContent = state.profile.onboarded ? 'Vào Phân hệ Học tập 🎓' : 'Tiếp theo: Kiểm tra đầu vào 📝';
  await pause(500);
  // Người mới: màn chào mừng (tên, lứa tuổi) → Kiểm tra đầu vào; người cũ: vào thẳng trang học.
  if (location.hash === '#/home') router(); else location.hash = '#/home';
}
