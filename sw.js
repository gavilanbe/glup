// GLUP service worker: the whole game installs for offline play. Network first,
// cached copy as fallback. Bump CACHE whenever the shipped files change.
const CACHE = 'glup-29';
const SHELL = ['./', './index.html', './manifest.webmanifest', './style.css', './art.js', './mundo.js', './audio.js', './levels.js',
  './niveles/01-embarcadero.js', './niveles/02-juncos.js', './niveles/03-raices.js', './niveles/04-molino.js', './niveles/05-muelle.js', './niveles/06-turbera.js', './niveles/07-cueva.js', './niveles/08-rio.js', './niveles/09-nido.js',
  './cine.js', './titulo.js', './mapa.js', './hud.js', './aprende.js', './letra.js', './maestros.js', './barca.js', './victoria.js', './garza.js', './game.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/icon-180.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(fetch(e.request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return response;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
});
