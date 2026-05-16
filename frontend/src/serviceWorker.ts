const CACHE_NAME = 'zovyra-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event: Event) => {
  const extendableEvent = event as ExtendableEvent;
  extendableEvent.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event: Event) => {
  const fetchEvent = event as FetchEvent;
  // Cache-first for audio files, network-first for API
  const url = new URL(fetchEvent.request.url);

  if (url.pathname.startsWith('/api/')) {
    fetchEvent.respondWith(
      fetch(fetchEvent.request).catch(() => caches.match(fetchEvent.request) as Promise<Response>)
    );
  } else {
    fetchEvent.respondWith(
      caches.match(fetchEvent.request).then((response) => {
        return response || fetch(fetchEvent.request);
      })
    );
  }
});
