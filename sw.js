// Lưu giao diện để học offline. Tăng VERSION mỗi khi sửa file giao diện.
const VERSION = 'engmate-v17';
const SHELL = ['./', 'index.html', 'gioi-thieu.html', 'app.html', 'ai-tutor.html', 'demo01.html', 'demo02.html', 'demo03.html', 'styles.css', 'manifest.json', 'icon.svg', 'js/app.js', 'js/data.js', 'js/ai.js', 'js/listen.js', 'js/interpret.js', 'js/auth.js', 'js/prompts.js', 'js/demo-switcher.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Ưu tiên mạng (luôn có bản mới), mất mạng thì dùng bản đã lưu. Không đụng tới /api và tên miền khác.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        if (res.ok) caches.open(VERSION).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('app.html')))
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list =>
    list.length ? list[0].focus() : self.clients.openWindow('app.html')));
});
