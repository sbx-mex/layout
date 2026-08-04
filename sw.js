"use strict";

const CACHE = "starbucks-layouts-v14-collapsible-catalog-swipe";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./vendor/jspdf.umd.min.js",
  "./manifest.json",
  "./data/layouts.json",
  "./assets/juntemonos-mas.png",
  "./assets/maxmin/referencia-maxmin.png",
  "./assets/maxmin/layout_ejemplo.jpeg",
  "./assets/maxmin/limpieza_back.jpeg",
  "./assets/maxmin/limpieza_ejemplo_1.jpeg",
  "./assets/maxmin/limpieza_ejemplo_2.jpeg",
  "./assets/maxmin/limpieza_ejemplo_3.jpeg",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  const requestUrl = new URL(event.request.url);
  const isAppCode = event.request.mode === "navigate" || /\/(?:index\.html|app\.js|styles\.css|sw\.js)$/.test(requestUrl.pathname);
  if (isAppCode) {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html"))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  })));
});
