const CACHE_NAME = 'zovyra-cache-v1';
const ASSETS_TO_CACHE = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)));
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept cross-origin requests (e.g. API server on a different port)
  if (url.origin !== self.location.origin) return;

  // Never intercept WebSocket upgrade or socket.io polling
  if (url.pathname.startsWith('/socket.io/')) return;

  if (url.pathname.startsWith('/api/covers/')) {
    event.respondWith(
      caches.open('zovyra-covers').then((cache) => {
        return cache.match(event.request).then((response) => {
          return (
            response ||
            fetch(event.request).then((fetchRes) => {
              cache.put(event.request, fetchRes.clone());
              return fetchRes;
            })
          );
        });
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }),
  );
});
