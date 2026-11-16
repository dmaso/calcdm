// Stale-while-revalidate service worker: serves from cache instantly (works offline),
// refreshes the cache in the background so the next launch picks up updates.
const CACHE = 'calc-v18';   // bump on every deploy, so phones pick up the new version
const ASSETS = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest', './calc-icon.png'];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache, so a new version caches the new files.
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const network = fetch(e.request)
        .then((res) => {
          if (res && res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => null);
      return cached || (await network) || Response.error();
    })
  );
});
