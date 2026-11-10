import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'offline-shell',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = ['/', '/index.html', '/favicon.svg', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest',
        ...Object.keys(bundle).filter(name => /\.(js|css|woff2?|ttf)$/.test(name)).map(name => `/${name}`)];
      const version = Object.keys(bundle).join('|');
      let hash = 0;
      for (const char of version) hash = (hash * 31 + char.charCodeAt(0)) | 0;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const CACHE = 'rentmaster-shell-${hash}';
const FILES = ${JSON.stringify(files)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('rentmaster-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then(cache => cache.match('/index.html'))));
  } else if (FILES.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request)) || fetch(request)));
  }
});
` });
    },
  }],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
