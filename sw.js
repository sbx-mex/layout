"use strict";

const CACHE = "starbucks-layouts-v16-premium-export";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./vendor/jspdf.umd.min.js",
  "./manifest.json",
  "./data/layouts.json",
  "./assets/juntemonos-mas.png",
  "./assets/ui/Damos_Seguimiento.webp",
  "./assets/ui/Un_placer_haber_Ayudado.webp",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, fallback) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || (fallback ? await caches.match(fallback) : Response.error());
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const fresh = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached || Response.error());
  return cached || fresh;
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const isNavigation = event.request.mode === "navigate";
  const isAppCode = /\/(?:index\.html|app\.js|styles\.css|sw\.js|manifest\.json|data\/layouts\.json)$/.test(requestUrl.pathname);
  const isVisualAsset = /\.(?:png|jpe?g|webp|svg)$/i.test(requestUrl.pathname);

  if (isNavigation || isAppCode) {
    event.respondWith(networkFirst(event.request, isNavigation ? "./index.html" : null));
    return;
  }

  if (isVisualAsset) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});
