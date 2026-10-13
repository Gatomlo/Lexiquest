'use strict';
/* Service worker : application utilisable hors-ligne, notifications. __VERSION__ est remplacé par le serveur. */
const CACHE = 'lexiquest-__VERSION__';
const SHELL = ['./', 'parent', 'css/fonts.css', 'css/app.css', 'js/common.js', 'js/judge.js', 'js/art.js', 'js/offline.js', 'js/student.js', 'js/parent.js',
  'manifest.webmanifest', 'manifest-parent.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/lilita-one-latin-400-normal.woff2', 'fonts/nunito-latin-500-normal.woff2', 'fonts/nunito-latin-600-normal.woff2', 'fonts/nunito-latin-700-normal.woff2',
  'fonts/nunito-latin-800-normal.woff2', 'fonts/plus-jakarta-sans-latin-wght-normal.woff2'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('lexiquest-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

/* réseau d'abord (les mises à jour arrivent tout de suite), cache en secours ; l'API n'est jamais mise en cache ici */
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/') || url.pathname.endsWith('/sw.js')) { return; }
  const isFont = url.pathname.includes('/fonts/');
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (isFont) { const hit = await cache.match(req); if (hit) { return hit; } }
    try {
      const res = await fetch(req);
      if (res.ok) { cache.put(req, res.clone()); }
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) { return hit; }
      if (req.mode === 'navigate') { const page = await cache.match(url.pathname.endsWith('parent') ? 'parent' : './'); if (page) { return page; } }
      throw err;
    }
  })());
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Lexiquest', {
    body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: d.tag || 'lexiquest', data: { url: d.url || './' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (c.url.startsWith(self.registration.scope) && 'focus' in c) { return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});
