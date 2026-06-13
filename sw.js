/* sw.js — minimal service worker: makes the game installable as a PWA
 * (modern Chrome requires a registered SW with a fetch handler) and adds
 * offline play, without fighting the version-bump cache-busting system.
 *
 * Strategy:
 *  - Navigations / index.html → network-first: online always loads the newest
 *    build (with the latest ?v= asset refs); the last cached copy is the
 *    offline fallback.
 *  - Everything else is version-query-stamped (foo.js?v=X.Y.Z), so cache-first
 *    is safe — a version bump changes the URL, which misses the cache and
 *    fetches fresh. Old versions just sit unused (cleared by the refresh button).
 *  - Cross-origin requests (signaling relay, STUN) pass straight through.
 */
const CACHE = 'perils-runtime-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return; // let relay/STUN/etc. through

  const isNav = req.mode === 'navigate' ||
    url.pathname.endsWith('/') || url.pathname.endsWith('index.html');

  if (isNav) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
    )
  );
});
