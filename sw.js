/* Recomp Tracker service worker.
 *
 * GENERATED into sw.js by build/build.js — do not deploy this template, and do
 * not hand-edit sw.js (it is overwritten on every build). Edit this file.
 *
 * How updates are guaranteed to reach the phone:
 *   - VERSION below is a fingerprint of the built app, stamped in at build time.
 *     A new build => new fingerprint => sw.js is different bytes => the browser
 *     treats it as a changed worker and reinstalls it. Nobody has to remember to
 *     bump a number.
 *   - The page registers this file with { updateViaCache: 'none' }, so the phone
 *     re-checks sw.js against the server on every launch, bypassing HTTP caching.
 *   - On activate we delete every cache that is not the current VERSION, then
 *     claim the page, so a new version wipes the old one and takes over at once.
 *   - Navigations (the app HTML) are network-first with a short timeout, so a
 *     fresh deploy shows the moment there is any connectivity, and airplane mode
 *     still falls back to the cached copy.
 */
const VERSION = "4fdefb2af56c";
const CACHE = "recomp-" + VERSION;
const PRECACHE = ["./","./index.html","./manifest.json","./icon-192.png","./icon-512.png","./icon-180.png"];
const NAV_TIMEOUT_MS = 2500;

self.addEventListener("install", (event) => {
  // Take over as soon as we are ready rather than waiting for every tab to
  // close — a home-screen PWA is never really "closed".
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Tapping a rest-timer notification jumps back into the app (focus an open
// window if there is one, otherwise open a fresh one) rather than a blank tab.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) { if ("focus" in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow("./");
  })());
});

// Network-first with a timeout, falling back to cache. Even when the timeout
// fires first and we serve the cached page, the network response (if it arrives)
// still refreshes the cache for next launch.
function networkFirst(request) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (r) => { if (!settled) { settled = true; resolve(r); } };

    const timer = setTimeout(async () => {
      const cached = await caches.match(request, { ignoreSearch: true })
        || await caches.match("./")
        || await caches.match("./index.html");
      if (cached) finish(cached);
    }, NAV_TIMEOUT_MS);

    fetch(request).then((resp) => {
      clearTimeout(timer);
      const copy = resp.clone();
      caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
      finish(resp);
    }).catch(async () => {
      clearTimeout(timer);
      const cached = await caches.match(request, { ignoreSearch: true })
        || await caches.match("./")
        || await caches.match("./index.html");
      finish(cached || Response.error());
    });
  });
}

function cacheFirst(request) {
  return caches.match(request).then((cached) => cached || fetch(request).then((resp) => {
    const copy = resp.clone();
    caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
    return resp;
  }).catch(() => cached));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // The app HTML — always try for the freshest copy first.
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
    return;
  }

  // Static assets (icons, manifest) and cross-origin extras (fonts): serve from
  // cache when we have it, otherwise fetch and remember it. These are versioned
  // by the cache purge on activate, so cache-first is safe.
  event.respondWith(cacheFirst(req));
});
