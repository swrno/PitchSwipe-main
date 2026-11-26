/* PitchSwipe service worker. Only the offline page and immutable static assets are cached.
   Never caches HTML pages, /api/*, non-GET, cross-origin or Authorization requests. */
importScripts("/sw-routes.js");

// Bump when cached static assets change in place (v2: new brand icons). Activating a new VERSION deletes the old caches.
var VERSION = "v2";
var STATIC_CACHE = "pitchswipe-static-" + VERSION;
var OFFLINE_CACHE = "pitchswipe-offline-" + VERSION;
var OFFLINE_URL = "/offline.html";

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then(function (c) { return c.add(new Request(OFFLINE_URL, { cache: "reload" })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k.indexOf("pitchswipe-") === 0 && k !== STATIC_CACHE && k !== OFFLINE_CACHE;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var kind = self.SWRoutes.decide(event.request, self.location.origin);
  if (kind === "bypass") return; // browser handles it normally

  if (kind === "navigate") {
    event.respondWith(
      fetch(event.request).catch(function () {
        return caches.open(OFFLINE_CACHE).then(function (c) { return c.match(OFFLINE_URL); })
          .then(function (r) { return r || Response.error(); });
      })
    );
    return;
  }

  // static: cache-first
  event.respondWith(
    caches.open(STATIC_CACHE).then(function (cache) {
      return cache.match(event.request).then(function (hit) {
        if (hit) return hit;
        return fetch(event.request).then(function (res) {
          if (res.ok && res.type === "basic") cache.put(event.request, res.clone());
          return res;
        });
      });
    })
  );
});
