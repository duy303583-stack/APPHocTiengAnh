// Nút "↩ Giao diện chuẩn" trên các giao diện phụ (ai-tutor.html, demo02.html).
// Bấm vào: lưu lựa chọn giao diện chuẩn và mở app chính đúng màn hình đang xem.
// Chọn giao diện khác trong app: Thành tích → Cài đặt → Giao diện.
(() => {
  // Đang nằm trong khung điện thoại của trang giới thiệu: báo đã tải xong để trang đó biết khung không bị trống.
  if (window.top !== window) { window.parent.postMessage({ engmate: 'ready' }, '*'); return; }

  // Màn hình tương ứng ở app chính
  const ROUTE = { home: '#/home', path: '#/path', ai: '#/chat', chat: '#/chat', writing: '#/ailab/write', review: '#/review', achievement: '#/profile' };
  const target = () => 'app.html' + (ROUTE[location.hash.replace(/^#\/?/, '').split('/')[0]] || '#/home');

  const css = document.createElement('style');
  css.textContent = `
    .dsw-btn { position: fixed; right: 12px; top: 12px; z-index: 9999; display: flex; align-items: center; gap: 6px;
      padding: 8px 12px; border-radius: 99px; text-decoration: none; color: #fff; font: 800 12px 'Nunito', system-ui, sans-serif;
      background: rgba(30, 27, 75, .78); backdrop-filter: blur(8px); box-shadow: 0 6px 16px rgba(15, 23, 42, .25); }
    .dsw-btn:hover { background: #6366f1; }
    .dsw-btn:focus-visible { outline: 3px solid #fde047; outline-offset: 2px; }
    @media (max-width: 520px) { .dsw-btn { top: auto; bottom: 96px; } }`;
  document.head.appendChild(css);

  const btn = document.createElement('a');
  btn.className = 'dsw-btn';
  btn.href = 'app.html';
  btn.innerHTML = '<span aria-hidden="true">↩</span>Giao diện chuẩn';
  btn.title = 'Quay lại giao diện chuẩn của app (đổi giao diện trong Cài đặt)';
  btn.addEventListener('click', e => {
    e.preventDefault();
    try { localStorage.setItem('engmate-ui', 'app'); } catch { /* bỏ qua */ }
    location.href = target();
  });

  const mount = () => document.body.append(btn);
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
