// Service Worker for Co-do PWA
// Uses network-first strategy with cache fallback for offline support
// Update detection is handled by version.json checking in main.ts
const CACHE_NAME = 'co-do-cache';
const BASE_PATH = '/Co-do/';

// Install event - skip waiting to activate immediately
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Activate event - take control and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - network-first with cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache version.json - always fetch from network
  if (url.pathname.endsWith('version.json')) {
    event.respondWith(fetch(request));
    return;
  }

  // Don't cache API requests to AI providers
  if (
    url.hostname === 'api.anthropic.com' ||
    url.hostname === 'api.openai.com' ||
    url.hostname === 'generativelanguage.googleapis.com'
  ) {
    event.respondWith(
      fetch(request).catch((error) => {
        console.error('[Service Worker] AI API fetch failed:', error);
        throw error;
      })
    );
    return;
  }

  // For same-origin requests, use network-first with cache fallback
  if (url.origin === location.origin) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, responseToCache))
              .catch((error) => {
                console.error('[Service Worker] Failed to cache response:', error);
              });
          }
          return response;
        })
        .catch((error) => {
          console.log('[Service Worker] Network fetch failed, trying cache:', error);
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // For navigation requests, try the app shell
            if (request.mode === 'navigate') {
              return caches.match(`${BASE_PATH}index.html`);
            }
            throw error;
          });
        })
    );
    return;
  }

  // For cross-origin requests, just fetch
  event.respondWith(
    fetch(request).catch((error) => {
      console.error('[Service Worker] Cross-origin fetch failed:', error);
      return new Response('Network error while fetching resource.', {
        status: 504,
        statusText: 'Gateway Timeout',
      });
    })
  );
});
