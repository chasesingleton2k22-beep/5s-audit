const CACHE_NAME = 'tag-time-study-v61';

const CORE_ASSETS = ['./', './index.html', './logo.png'];
const CDN_SHEETJS = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(CORE_ASSETS);
      try { await cache.add(CDN_SHEETJS); } catch (_) { /* cached on first online load */ }
    })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const isHTML = url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/');
  const isCDN  = url.origin !== self.location.origin;

  if (isHTML) {
    // Network-first for HTML: always try to fetch fresh, fall back to cache.
    // cache:'no-store' forces this past the browser's own HTTP cache — without it,
    // "network-first" can still silently hand back a stale cached response instead
    // of actually reaching the server, which is exactly why updates can appear to
    // not exist even right after a fresh push.
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  if (isCDN) {
    // Cache-first for CDN assets (SheetJS) — versioned and stable
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return response;
        });
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache-first for everything else (sw.js, manifest, icon)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
    }).catch(() => caches.match('./index.html'))
  );
});

// Page posts SKIP_WAITING when user taps "Check for Update" and a new SW is waiting.
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
