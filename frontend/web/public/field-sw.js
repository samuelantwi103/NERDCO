// NERDCO Field Service Worker
// Caches the field routes for offline resilience

const CACHE = 'nerdco-field-v1';
const PRECACHE = [
  '/field',
  '/field/incident',
  '/login',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests within /field scope
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith('/field') && url.pathname !== '/login') return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // Cache successful navigation responses
        if (res.ok && (url.pathname.startsWith('/field') || url.pathname === '/login')) {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
