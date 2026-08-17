// Hybrid service worker: network-first (with a short timeout fallback) for the app's own
// HTML/CSS/JS, so a normal reload always picks up the latest push instead of needing a manual
// cache clear; cache-first for images/vendored libraries/manifest/icons, which is what keeps the
// presenter usable on patchy in-store wifi.
// Bump CACHE_NAME whenever app files change to force clients to pick up the new version.

const CACHE_NAME = "diageo-presenter-v53";

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./products.html",
  "./partnership.html",
  "./callfile.html",
  "./map.html",
  "./deck.html",
  "./pp-deck.html",
  "./login.html",
  "./css/styles.css",
  "./js/storage.js",
  "./js/home.js",
  "./js/nav.js",
  "./js/deck.js",
  "./js/pp-deck.js",
  "./js/vendor/pdfjs/pdf.min.js",
  "./js/vendor/pdfjs/pdf.worker.min.js",
  "./js/products.js",
  "./js/partnership.js",
  "./js/callfile.js",
  "./js/callfile-status.js",
  "./js/map.js",
  "./js/catalog.js",
  "./js/layout-products.js",
  "./js/layout-pp.js",
  "./js/layout-callfile.js",
  "./js/vendor/xlsx.full.min.js",
  "./js/vendor/leaflet/leaflet.js",
  "./js/vendor/leaflet/leaflet.css",
  "./js/firebase-config.js",
  "./js/cloud-sync.js",
  "./js/auth.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./images/favicon.png",
  "./images/Hero.png",
  "./images/Sales%20Presenter%20Deck%20V19%20with%20No%20PMP%20%20(1).pdf",
  "./images/PP/tier-1.png",
  "./images/PP/tier-2.png",
  "./images/PP/tier-3.png",
  "./images/pp-deck-hero.jpg",
  "./images/Products/Single/Baileys70Cl.png",
  "./images/Products/Single/BlackLabel70cl.png",
  "./images/Products/Single/CaptianMorgan70cl.png",
  "./images/Products/Single/Casamigo70cl.png",
  "./images/Products/Single/CirocBlue70cl.png",
  "./images/Products/Single/CirocRed70cl.png",
  "./images/Products/Single/GordonsOriginal70cl.png",
  "./images/Products/Single/GordonsPink70cl.png",
  "./images/Products/Single/MangoAndPF70cl.png",
  "./images/Products/Single/MiamiPeach70cl.png",
  "./images/Products/Single/RaspberryCrush70cl.png",
  "./images/Products/Single/RedLabel70cl.png",
  "./images/Products/Single/Smirnoff70Cl.png",
  "./images/Products/Single/SmirnoffIce70cl.png",
  "./images/Products/Single/Tanqueray70cl.png",
  "./images/Products/Single/BlackLabel35cl.png",
  "./images/Products/Single/CaptianMorgan35cl.png",
  "./images/Products/Single/GordonsOriginal35cl.png",
  "./images/Products/Single/GordonsPink35cl.png",
  "./images/Products/Single/MangoAndPF35cl.png",
  "./images/Products/Single/MiamiPeach35cl.png",
  "./images/Products/Single/RaspberryCrush35cl.png",
  "./images/Products/Single/RedLabel35cl.png",
  "./images/Products/Single/Smirnoff35cl.png",
  "./images/Products/Single/CaptianMorgan20cl.png",
  "./images/Products/Single/Gordons20cl.png",
  "./images/Products/Single/Smirnoff20cl.png",
  "./images/Products/Single/CrushBP.png",
  "./images/Products/Single/CrushLL.png",
  "./images/Products/Single/CrushMP.png",
  "./images/Products/Single/Guinness0.png",
  "./images/Products/Single/GuinnessDraugh.png",
  "./images/Products/Single/RTDCM.png",
  "./images/Products/Single/RTDCRanberry.png",
  "./images/Products/Single/RTDGD.png",
  "./images/Products/Single/RTDGO.png",
  "./images/Products/Single/RTDGP.png",
  "./images/Products/Single/RTDJWL.png",
  "./images/Products/Single/RTDMP.png",
  "./images/Products/Single/RTDPimms.png",
  "./images/Products/Single/RTDRCrush.png",
  "./images/Products/Single/RTDSice.png",
  "./images/Products/Single/RTDVColla.png",
  "./images/Products/Single/SmirnoffIce4pack.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(PRECACHE_URLS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  const url = new URL(event.request.url);
  const isVendorAsset = url.pathname.indexOf("/js/vendor/") !== -1;
  const isAppShell = !isVendorAsset &&
    (event.request.mode === "navigate" || /\.(html|css|js)$/.test(url.pathname));

  if (isAppShell) {
    // Network-first, but racing a short timeout against the fetch — a fully dead connection
    // fails fast and falls back to cache almost instantly, but a slow/flaky in-store connection
    // could otherwise hang the page waiting on the network instead of falling back promptly.
    // This keeps the "still usable on patchy wifi" guarantee this service worker exists for,
    // while still picking up a fresh deploy whenever the connection is actually good enough.
    event.respondWith(
      Promise.race([
        fetch(event.request),
        new Promise(function (_, reject) { setTimeout(function () { reject(new Error("timeout")); }, 2500); })
      ]).then(function (response) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, clone); });
        return response;
      }).catch(function () {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Cache-first for images/vendored libraries/manifest/icons — large and rarely-changing, and
  // this is what keeps the app usable on patchy in-store wifi.
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, clone); });
        return response;
      }).catch(function () { return cached; });
    })
  );
});
