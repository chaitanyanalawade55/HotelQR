// MenuQR service worker — cache-first for static assets, network-first for pages
const CACHE_VER = 'v1';
const STATIC_CACHE = `menuqr-static-${CACHE_VER}`;
const PAGE_CACHE   = `menuqr-pages-${CACHE_VER}`;

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

// ── Activate: delete stale caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE)
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

  // Skip cross-origin requests (Supabase, fonts, etc.) — let browser handle them
  if (url.origin !== self.location.origin) return;

  // Cache-first: Next.js hashed static chunks (content-addressed, safe to cache forever)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Cache-first: icons + manifest (rarely change, but SW will update them on next activate)
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json') {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Network-first with offline fallback for HTML navigation
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstHtml(request));
    return;
  }
  // Everything else: network-first (API, JSON, etc.)
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

async function networkFirstHtml(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match('/offline.html');
    return (
      offline ??
      new Response('<h1>You are offline</h1>', {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    );
  }
}

async function networkOrCache(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match(request)) ?? new Response('', { status: 503 });
  }
}
