const CACHE_NAME = 'zovyra-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Radio streams - NEVER cache
  if (url.pathname.includes('/api/radio/proxy')) return;

  // Cover art - Cache first
  if (url.pathname.includes('/api/tracks/cover')) {
     event.respondWith(
        caches.match(event.request).then(res => {
           return res || fetch(event.request).then(response => {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
              return response;
           });
        })
     );
     return;
  }

  // API - Network first
  if (url.pathname.startsWith('/api')) {
     event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
     );
     return;
  }

  // App shell - Cache first
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
