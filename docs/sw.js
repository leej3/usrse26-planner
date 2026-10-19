/* Bump this version when changing the offline application shell. */
const CACHE = 'usrse26-offline-v5';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'offline.js', 'planner-data.js', 'planner-storage.js', 'calendar.js', 'notes.js', 'notes.css', 'program-update.js', 'program.json', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
const absolute = path => new URL(path, self.registration.scope).href;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL.map(path => new Request(absolute(path), {cache:'reload'})))));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('usrse26-offline-') && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  // Only cache public application assets. Notes and plans remain in localStorage.
  if (request.mode !== 'navigate' && !SHELL.some(path => new URL(absolute(path)).pathname === url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok) {
        const key = request.mode === 'navigate' ? absolute('index.html') : url.origin + url.pathname;
        await cache.put(key, response.clone());
        return response;
      }
      const cached = await cache.match(request.mode === 'navigate' ? absolute('index.html') : request, { ignoreSearch: true });
      return cached || response;
    } catch (error) {
      const cached = await cache.match(request.mode === 'navigate' ? absolute('index.html') : request, { ignoreSearch: true });
      if (cached) return cached;
      throw error;
    }
  })());
});
