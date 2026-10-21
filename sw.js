// Service worker: la app funciona sin conexión. index.html lleva todo dentro (cifrado), así que basta con guardar
// esa página, el manifest y los iconos. Primero la red (con conexión llega siempre la versión nueva); si no responde
// en 4 s o no hay red, la copia guardada.
const CACHE = 'viaje';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(networkFirst(request));
});

// Las páginas se guardan sin el ?… para que index.html y ./ sean la misma.
const key = request => (request.mode === 'navigate' ? new URL('./', self.registration.scope).href : request.url);

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  // Una petición de navegación no se puede copiar con opciones (fetch lanzaría un error): se pide por su URL.
  const fromNet = fetch(request.mode === 'navigate' ? request.url : request, { cache: 'no-cache' }).then(response => {
    if (response.ok) cache.put(key(request), response.clone());
    return response;
  });
  const timeout = new Promise(resolve => setTimeout(resolve, 4000));
  try {
    const first = await Promise.race([fromNet, timeout]);
    if (first) return first;
  } catch {}
  const saved = await cache.match(key(request));
  return saved || fromNet;
}
