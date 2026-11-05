/*
 * Trek Card Maker service worker. Everything the app needs is kept in one cache so it opens
 * without a connection after the first visit:
 *   assets/   hashed bundles and fonts: served from the cache, fetched once
 *   frames/   catalog, frames and icons: served from the cache, refreshed behind the scenes
 *   the page, manifest and this file: network first, cache when offline
 * Cards themselves live in IndexedDB and never pass through here.
 */
const VERSION = 'v1';
const CACHE = `trek-card-maker-${VERSION}`;
const BASE = new URL(self.registration.scope).pathname;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([BASE, `${BASE}manifest.webmanifest`]).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('trek-card-maker-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Which rule a same-origin URL under the app's scope falls under; anything else is left to the network. */
function classify(url) {
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return 'bypass';
  const rel = url.pathname.slice(BASE.length);
  if (rel.startsWith('assets/')) return 'immutable';
  if (rel.startsWith('frames/')) return 'revalidate';
  return 'network-first';
}

async function handle(kind, request) {
  const cache = await caches.open(CACHE);
  if (kind === 'immutable') {
    const hit = await cache.match(request);
    if (hit) return hit;
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  }
  if (kind === 'revalidate') {
    const hit = await cache.match(request);
    const refresh = fetch(request)
      .then((res) => {
        if (res.ok) cache.put(request, res.clone());
        return res;
      })
      .catch(() => undefined);
    return hit || (await refresh) || Response.error();
  }
  // navigations and everything else under the scope: network first, stored copy when offline
  const key = kind === 'navigate' ? BASE : request;
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch {
    const hit = (await cache.match(key)) || (kind === 'navigate' ? await cache.match(`${BASE}index.html`) : undefined);
    return hit || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const kind = request.mode === 'navigate' ? 'navigate' : classify(new URL(request.url));
  if (kind === 'bypass') return;
  event.respondWith(handle(kind, request));
});
