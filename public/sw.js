// Service Worker for Co-do PWA
// Update version to force cache refresh on new deployments
const CACHE_VERSION = '1.0.3'; // Increment this on each deployment
const CACHE_NAME = `co-do-v${CACHE_VERSION}`;
const BASE_PATH = '/Co-do/';

// Assets to cache on install
const STATIC_ASSETS = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  // Note: Vite generates hashed filenames in production
  // These will be added dynamically during the first navigation
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Don't skip waiting automatically - wait for user confirmation
  // This prevents forced reloads when user cancels the update prompt
});

// Activate event - clean up old caches
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
  // Take control immediately
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Don't cache API requests to AI providers
  if (
    url.hostname === 'api.anthropic.com' ||
    url.hostname === 'api.openai.com' ||
    url.hostname === 'generativelanguage.googleapis.com'
  ) {
    // Network only for API requests with error handling
    event.respondWith(
      fetch(request).catch((error) => {
        console.error('[Service Worker] AI API fetch failed:', error);
        // Re-throw to let the application handle the error
        throw error;
      })
    );
    return;
  }

  // For same-origin requests, use stale-while-revalidate strategy
  // This provides fast loads while ensuring background updates
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        // Fetch from network in background to update cache
        const fetchPromise = fetch(request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Update cache in background
            caches
              .open(CACHE_NAME)
              .then((cache) => {
                return cache.put(request, responseToCache);
              })
              .catch((error) => {
                // Log cache failures (e.g., storage quota exceeded)
                console.error('[Service Worker] Failed to cache response:', error);
              });

            return response;
          })
          .catch((error) => {
            // On network failure, log but don't throw if we have cache
            console.log('[Service Worker] Network fetch failed:', error);

            // For navigation requests without cache, serve the app shell
            if (!cachedResponse && request.mode === 'navigate') {
              return caches.match(`${BASE_PATH}index.html`);
            }

            // If no cached response, throw the error
            if (!cachedResponse) {
              throw error;
            }

            return cachedResponse;
          });

        // Return cached response immediately if available, otherwise wait for network
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // For cross-origin requests, just fetch with error handling
  event.respondWith(
    fetch(request).catch((error) => {
      // Log the error for debugging purposes and provide a fallback response
      console.error('[Service Worker] Cross-origin fetch failed:', error);
      return new Response('Network error while fetching resource.', {
        status: 504,
        statusText: 'Gateway Timeout',
      });
    })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
