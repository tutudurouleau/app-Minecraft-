/* ============================================================
   BlocNav : service worker (mode hors-ligne)
   ------------------------------------------------------------
   - Fichiers de l'app : réseau d'abord (pour avoir les mises à
     jour), sinon la copie gardée en cache.
   - Morceaux de carte (tuiles) : cache d'abord, nombre plafonné
     (TILE_CACHE_MAX dans config.js), les plus anciens partent.
   - Recherche et itinéraires : jamais mis en cache.
   ============================================================ */

importScripts('./config.js');

const C = self.CONFIG;
const APP_CACHE = 'blocnav-app-v1';
const TILE_CACHE = 'blocnav-tiles';
const DATA_CACHE = 'blocnav-data';
const CORE = ['./', './index.html', './style.css', './app.js', './config.js', './manifest.webmanifest', './lib/maplibre-gl.js', './lib/maplibre-gl.css'];

const tileHost = new URL(C.TILES_URL).host;
const glyphHost = new URL(C.GLYPHS_URL.replace('{fontstack}', 'f').replace('{range}', 'r')).host;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(CORE)).catch(() => null));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = [APP_CACHE, TILE_CACHE, DATA_CACHE];
    for (const key of await caches.keys()) {
      if (key.startsWith('blocnav-') && !keep.includes(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

// La page envoie la liste des fichiers qu'elle a chargés : on les garde.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'cache-app-files') return;
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    for (const url of event.data.urls || []) {
      if (new URL(url).origin !== self.location.origin) continue;
      if (await cache.match(url)) continue;
      try {
        const res = await fetch(url);
        if (res.ok) await cache.put(url, res);
      } catch { /* hors-ligne : tant pis */ }
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req, APP_CACHE));
  } else if (url.host === tileHost && url.pathname.endsWith('.pbf') && !url.pathname.includes('/fonts/')) {
    event.respondWith(tileCacheFirst(req));
  } else if (url.host === glyphHost && url.pathname.includes('/fonts/')) {
    event.respondWith(cacheFirst(req, DATA_CACHE));
  } else if (url.href === C.TILES_URL || (url.host === tileHost && !url.pathname.endsWith('.pbf'))) {
    event.respondWith(networkFirst(req, DATA_CACHE));
  }
  // Le reste (Photon, OSRM, météo…) passe directement par le réseau.
});

/** Réseau d'abord ; si le réseau traîne (4 s) ou échoue, la copie en cache. */
async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const navigate = req.mode === 'navigate';
  const network = fetch(req, navigate ? undefined : { cache: 'no-cache' }).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  network.catch(() => null); // évite une erreur non gérée si on répond avec le cache
  try {
    return await Promise.race([
      network,
      new Promise((_, reject) => setTimeout(() => reject(new Error('lent')), 4000)),
    ]);
  } catch {
    const cached = await cache.match(req, { ignoreSearch: navigate })
      || (navigate ? await cache.match('./index.html') : null);
    return cached || network; // rien en cache : on attend quand même le réseau
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

let putsSinceTrim = 0;
async function tileCacheFirst(req) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) {
    await cache.put(req, res.clone());
    if (++putsSinceTrim >= 40) {
      putsSinceTrim = 0;
      trimTiles(cache);
    }
  }
  return res;
}

/** Garde au plus TILE_CACHE_MAX tuiles : supprime les plus anciennes. */
async function trimTiles(cache) {
  const keys = await cache.keys();
  const extra = keys.length - (C.TILE_CACHE_MAX || 1500);
  for (let i = 0; i < extra; i++) await cache.delete(keys[i]);
}
