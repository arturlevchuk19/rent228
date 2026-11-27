/* global CACHE, FILES */
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('rentmaster-shell-') && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html')) {
    event.respondWith((async () => {
      const cached = await caches.open(CACHE).then(cache => cache.match('/index.html'));
      try {
        const response = await fetch(request, { signal: AbortSignal.timeout(5000) });
        if (response.status < 500) return response;
      } catch {
        // Fall back to the application shell when the network is unavailable.
      }
      return cached || Response.error();
    })());
  } else if (FILES.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.pathname)) || fetch(request)));
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window' });
    const app = windows.find(client => {
      const path = new URL(client.url).pathname;
      return path === '/' || path === '/index.html';
    });
    if (app) await app.focus();
    else await self.clients.openWindow('/');
  })());
});
