// MenuQR service worker — cache-first for static assets, network-only for navigations
//
// WHY v2:
//   v1 intercepted navigation requests (mode === 'navigate') and cached the
//   responses.  Next.js middleware performs auth redirects (302) on those
//   navigations.  fetch() follows the redirect silently, so the SW cached the
//   *final destination* HTML (e.g. /dashboard) under the *original* key
//   (e.g. /login).  On the next visit the SW served the wrong HTML, JS chunks
//   404'd, and the browser surfaced "This site can't be reached."
//   Bumping CACHE_VER forces all existing clients to re-install and wipe the
//   broken PAGE_CACHE entries.
const CACHE_VER    = 'v2';
const STATIC_CACHE = `menuqr-static-${CACHE_VER}`;
// PAGE_CACHE is intentionally unused — navigations are NEVER cached.

const PRECACHE_URLS = [
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon.svg',
];

// ── Install: precache shell assets ───────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE_URLS))
  );
});

// ── Activate: wipe ALL previous caches (including broken v1 PAGE_CACHE) ──────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip cross-origin requests (Supabase, fonts, analytics…)
  if (url.origin !== self.location.origin) return;

  // ── NAVIGATIONS — never cache, never intercept the redirect chain ──────────
  //
  // Next.js middleware runs on every navigation and issues auth redirects
  // (e.g. /login → /dashboard for signed-in users).  If the SW intercepts
  // these and caches them, two things break:
  //
  //   1. fetch() follows the redirect, so the SW stores /dashboard HTML under
  //      the /login cache key — stale HTML with wrong JS chunk paths → "can't
  //      be reached" or blank page.
  //
  //   2. Safari / Firefox return an opaqueredirect response type for SW-
  //      intercepted navigations that came through a redirect chain.  Passing
  //      that to event.respondWith() is invalid and the browser surfaced
  //      "This site can't be reached" in those browsers.
  //
  // Fix: pass navigations straight to the network.  Only fall back to
  // /offline.html when the device truly has no connectivity.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match('/offline.html');
        return (
          offline ??
          new Response('<h1>You are offline</h1>', {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        );
      })
    );
    return;
  }

  // ── Hashed static chunks — content-addressed, safe to cache forever ────────
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── Icons + manifest — cache-first (rarely change) ────────────────────────
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json') {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── Everything else (API routes, JSON, data fetches…) ─────────────────────
  event.respondWith(networkOrCache(request));
});

// ── Strategies ────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Unavailable offline', { status: 503 });
  }
}

async function networkOrCache(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match(request)) ?? new Response('', { status: 503 });
  }
}
