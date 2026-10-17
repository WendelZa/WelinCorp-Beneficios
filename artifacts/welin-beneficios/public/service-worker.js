const CACHE_NAME = "welin-demo-v1";
const APP_FILES = [
  "/app-colaborador.html",
  "/manifest.webmanifest",
  "/welin-icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  const pathname = new URL(event.request.url).pathname;
  const isAppResource = pathname === "/app-colaborador.html" || pathname === "/manifest.webmanifest" || pathname === "/welin-icon.svg" || pathname.startsWith("/assets/");
  if (!isAppResource) return;
  event.respondWith(
    fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/app-colaborador.html")))
  );
});
