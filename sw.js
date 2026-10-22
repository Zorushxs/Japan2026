// Service worker: la app funciona sin conexión y gasta los mínimos datos. index.html lleva todo dentro (cifrado), así
// que basta con guardar esa página, el manifest y los iconos.
// - Con conexión se pregunta al servidor si hay versión nueva enviando la marca de la copia guardada (ETag /
//   Last-Modified). Si no ha cambiado, responde «304» (menos de 1 KB) y se usa la copia: solo se descarga entero
//   cuando se publica una versión nueva.
// - Sin conexión, o si el servidor no responde en 4 s, la copia guardada.
const CACHE = 'viaje';

// Al instalarse, guarda ya la página (reutilizando la que el navegador acaba de descargar, sin volver a pedirla).
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const raiz = new URL('./', self.registration.scope).href;
      const response = await fetch(raiz, { cache: 'force-cache' });
      if (response.ok) await (await caches.open(CACHE)).put(raiz, response);
    } catch {}
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(conCopia(request));
});

// Las páginas se guardan sin el ?… para que index.html y ./ sean la misma.
const key = request => (request.mode === 'navigate' ? new URL('./', self.registration.scope).href : request.url);

async function conCopia(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(key(request));
  // Petición condicional: «dámelo solo si ha cambiado desde esta versión».
  const headers = {};
  if (saved) {
    const etag = saved.headers.get('ETag');
    const fecha = saved.headers.get('Last-Modified');
    if (etag) headers['If-None-Match'] = etag;
    if (fecha) headers['If-Modified-Since'] = fecha;
  }
  // Una petición de navegación no se puede copiar con opciones (fetch lanzaría un error): se pide por su URL.
  const fromNet = fetch(request.mode === 'navigate' ? request.url : request.url, { headers, cache: 'no-store' })
    .then(response => {
      if (response.status === 304 && saved) return saved;
      if (response.ok) cache.put(key(request), response.clone());
      return response;
    });
  const timeout = new Promise(resolve => setTimeout(resolve, 4000));
  try {
    const first = await Promise.race([fromNet, timeout]);
    if (first) return first;
  } catch {}
  return saved || fromNet;
}
