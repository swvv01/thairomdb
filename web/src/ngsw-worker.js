// Pass-through Service Worker: keeps PWA installability while clearing legacy
// Angular ngsw caches and bypassing SW caching for all network requests.
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (name) {
        return caches.delete(name);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function () {
  // Intentionally do not call event.respondWith() so every request goes directly to the network.
});
