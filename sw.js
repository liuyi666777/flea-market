// Service Worker - 校园跳蚤市场
const CACHE_NAME = 'flea-market-v2';
const ASSETS = [
  '/flea-market/',
  '/flea-market/index.html',
  '/flea-market/css/style.css',
  '/flea-market/js/supabase.min.js',
  '/flea-market/js/supabase-config.js',
  '/flea-market/js/app-supabase.js',
  '/flea-market/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // API calls and Supabase bypass cache
  const url = event.request.url;
  if (url.includes('supabase.co')) return;

  // HTML: network-first to always get latest version
  if (event.request.mode === 'navigate' || url.endsWith('.html') || url.endsWith('/')) {
    event.respondWith(
      fetch(event.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return res;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Other assets: cache-first, update in background
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
      return cached || fetchPromise;
    })
  );
});
