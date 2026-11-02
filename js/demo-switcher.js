// Nút chuyển qua lại giữa các bản giao diện (index, app, ai-tutor, demo02).
// Giữ đúng màn hình đang xem khi chuyển; dữ liệu học dùng chung qua localStorage nên không mất tiến độ.
(() => {
  if (window.top !== window) return; // không hiện trong khung điện thoại của trang giới thiệu

  // Màn hình tương ứng giữa các trang: home | path | chat | writing | review | profile
  const PAGES = [
    { file: 'index.html', icon: '🏠', name: 'Trang giới thiệu', desc: 'Showcase trên máy tính', route: {} },
    { file: 'app.html', icon: '📱', name: 'App chính', desc: 'Đầy đủ tính năng',
      route: { home: '#/home', path: '#/path', chat: '#/chat', writing: '#/ailab/write', review: '#/review', profile: '#/profile' } },
    { file: 'ai-tutor.html', icon: '🤖', name: 'Gia sư AI', desc: 'Giao diện 5 tab',
      route: { home: '#home', path: '#path', chat: '#ai', writing: '#ai', review: '#review', profile: '#achievement' } },
    { file: 'demo02.html', icon: '✨', name: 'Demo 02', desc: 'Giao diện chuyển màu',
      route: { home: '#home', chat: '#chat', writing: '#writing' } },
  ];

  const here = location.pathname.split('/').pop() || 'index.html';
  const section = () => {
    const h = location.hash;
    if (/^#\/?(chat|ai)\b/.test(h)) return 'chat';
    if (/^#(\/ailab\/write|writing)\b/.test(h)) return 'writing';
    if (/^#\/?path\b/.test(h)) return 'path';
    if (/^#\/?review\b/.test(h)) return 'review';
    if (/^#(\/profile|achievement)\b/.test(h)) return 'profile';
    return 'home';
  };

  const css = document.createElement('style');
  css.textContent = `
    .dsw-btn { position: fixed; right: 12px; top: 50%; transform: translateY(-50%); z-index: 9999; height: 44px; padding: 0 14px 0 10px;
      display: flex; align-items: center; gap: 6px; border: none; border-radius: 99px; cursor: pointer; color: #fff;
      font: 800 13px 'Nunito', system-ui, sans-serif;
      background: linear-gradient(135deg, #6366f1, #8b5cf6); box-shadow: 0 8px 20px rgba(99, 102, 241, .45); transition: transform .2s; }
    .dsw-btn:hover { transform: translateY(-50%) scale(1.08); }
    .dsw-btn:focus-visible { outline: 3px solid #fde047; outline-offset: 2px; }
    .dsw-menu { position: fixed; right: 64px; top: 50%; transform: translateY(-50%); z-index: 9999; width: 250px; padding: 8px;
      border-radius: 18px; background: #fff; color: #1e293b; box-shadow: 0 20px 50px rgba(15, 23, 42, .3);
      font: 600 13px/1.4 'Nunito', system-ui, sans-serif; }
    .dsw-menu[hidden] { display: none; }
    .dsw-menu b.dsw-title { display: block; padding: 6px 10px 8px; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: .05em; }
    .dsw-menu a { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 12px; text-decoration: none; color: inherit; }
    .dsw-menu a:hover, .dsw-menu a:focus-visible { background: #eef2ff; outline: none; }
    .dsw-menu a[aria-current] { background: #6366f1; color: #fff; }
    .dsw-menu a span { font-size: 20px; }
    .dsw-menu a small { display: block; font-size: 11px; opacity: .75; }
    .dsw-menu p { margin: 6px 10px 2px; font-size: 11px; color: #64748b; }
    @media (prefers-color-scheme: dark) {
      .dsw-menu { background: #1e1b3a; color: #eef0ff; }
      .dsw-menu a:hover, .dsw-menu a:focus-visible { background: #2e2a5c; }
    }
    @media (max-width: 520px) { .dsw-btn { top: auto; bottom: 96px; transform: none; } .dsw-btn:hover { transform: scale(1.08); }
      .dsw-menu { top: auto; bottom: 150px; right: 12px; transform: none; } .dsw-btn { height: 40px; } }`;
  document.head.appendChild(css);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dsw-btn';
  btn.innerHTML = '<span style="font-size:18px" aria-hidden="true">🔀</span>Giao diện';
  btn.title = 'Chuyển giao diện';
  btn.setAttribute('aria-label', 'Chuyển giao diện');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'dsw-menu');

  const menu = document.createElement('nav');
  menu.className = 'dsw-menu';
  menu.id = 'dsw-menu';
  menu.hidden = true;
  menu.setAttribute('aria-label', 'Các bản giao diện');

  const render = () => {
    const s = section();
    menu.innerHTML = '<b class="dsw-title">Chuyển giao diện</b>' + PAGES.map(p =>
      `<a href="${p.file}${p.route[s] || ''}" ${p.file === here ? 'aria-current="page"' : ''}>
        <span aria-hidden="true">${p.icon}</span><div>${p.name}<small>${p.desc}</small></div></a>`).join('') +
      '<p>Tiến độ, XP và API key dùng chung giữa các bản.</p>';
  };
  const toggle = open => {
    if (open) render();
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) menu.querySelector('a')?.focus();
  };

  btn.addEventListener('click', () => toggle(menu.hidden));
  document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target) && e.target !== btn) toggle(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { toggle(false); btn.focus(); } });

  const mount = () => document.body.append(btn, menu);
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
