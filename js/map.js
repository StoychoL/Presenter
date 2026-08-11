// Map page logic: plots every Call File store with a postcode as a colored pin on a UK map,
// colored by the same red/amber/green storeStatus() rule Call File uses (js/callfile-status.js).
// Postcodes are geocoded at runtime via the free postcodes.io bulk API and cached in a separate
// localStorage key (not the schema-versioned diageoPresenter blob — coordinates are derived
// reference data, not private per-rep state, so they don't need cloud sync).

const mapState = {
  leaflet: null,        // the L.Map instance, created exactly once (see ensureMap)
  markerLayer: null,    // L.layerGroup(), cleared+rebuilt on every plot pass
  hasFitBounds: false,  // true after the first auto-fit, so later re-renders (cloud hydration,
                         // live onSnapshot updates) don't yank the rep's current pan/zoom
  inFlightPostcodes: new Set(), // normalized postcodes currently being geocoded, to dedupe
                                 // concurrent render() calls firing overlapping requests
  statusColors: null     // resolved once from CSS custom properties (see resolveStatusColors)
};

const UK_CENTER = [54.5, -3.5];
const UK_DEFAULT_ZOOM = 6;
const GEOCODE_CACHE_KEY = "diageoGeocodeCache";
const GEOCODE_CACHE_VERSION = 1;
const POSTCODES_IO_BATCH_SIZE = 100; // hard limit per postcodes.io bulk request

function escAttr(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML.replace(/"/g, "&quot;");
}

function formatDateShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function normalizePostcode(pc) {
  return String(pc || "").trim().toUpperCase().replace(/\s+/g, "");
}

function loadGeocodeCache() {
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_KEY);
    if (!raw) return { v: GEOCODE_CACHE_VERSION, entries: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== GEOCODE_CACHE_VERSION || !parsed.entries) {
      return { v: GEOCODE_CACHE_VERSION, entries: {} };
    }
    return parsed;
  } catch (e) {
    return { v: GEOCODE_CACHE_VERSION, entries: {} };
  }
}

function saveGeocodeCache(cache) {
  try {
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    // localStorage full/unavailable — geocoding still works this session, just isn't cached.
  }
}

function collectStoreEntries(state) {
  const stores = state.callfile.stores;
  return Object.keys(stores)
    .map(function (key) { return { key: key, store: stores[key] }; })
    .filter(function (e) { return e.store.postcode && e.store.postcode.trim(); });
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function geocodeBatch(postcodes) {
  return fetch("https://api.postcodes.io/postcodes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postcodes: postcodes })
  })
    .then(function (res) {
      if (!res.ok) throw new Error("postcodes.io responded " + res.status);
      return res.json();
    })
    .then(function (json) {
      const out = {};
      (json.result || []).forEach(function (entry, i) {
        const pc = postcodes[i];
        out[pc] = entry.result
          ? { lat: entry.result.latitude, lng: entry.result.longitude }
          : { found: false };
      });
      return out;
    });
}

function geocodeMissing(postcodes) {
  const batches = chunk(postcodes, POSTCODES_IO_BATCH_SIZE);
  return Promise.all(batches.map(geocodeBatch)).then(function (results) {
    return Object.assign.apply(Object, [{}].concat(results));
  });
}

function resolveStatusColors() {
  const cs = getComputedStyle(document.documentElement);
  return {
    red: cs.getPropertyValue("--bad").trim(),
    amber: cs.getPropertyValue("--warn").trim(),
    green: cs.getPropertyValue("--good").trim()
  };
}

function ensureMap() {
  if (mapState.leaflet) return;
  mapState.statusColors = resolveStatusColors();
  const map = L.map("map-container", { zoomControl: true }).setView(UK_CENTER, UK_DEFAULT_ZOOM);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  mapState.markerLayer = L.layerGroup().addTo(map);
  mapState.leaflet = map;
}

function popupHtml(store, status) {
  return (
    '<div class="map-popup">' +
      '<div class="map-popup-name">' + escAttr(store.name) + "</div>" +
      '<div class="map-popup-row">' + escAttr(store.grade) + " &middot; " +
        '<span class="status-pill status-' + status + '-pill">' + statusLabel(status) + "</span></div>" +
      '<div class="map-popup-row">' + escAttr(store.postcode) + "</div>" +
      '<div class="map-popup-row">Last visit: ' + formatDateShort(store.lastVisitDate) + "</div>" +
      '<div class="map-popup-row">Next visit: ' + formatDateShort(store.nextVisitDate) + "</div>" +
    "</div>"
  );
}

function plotMarkers(entries, cache) {
  mapState.markerLayer.clearLayers();
  const bounds = [];
  let unplaced = 0;

  entries.forEach(function (e) {
    const pc = normalizePostcode(e.store.postcode);
    const geo = cache.entries[pc];
    if (!geo || geo.found === false || geo.lat == null) { unplaced++; return; }

    const status = storeStatus(e.store);
    const marker = L.circleMarker([geo.lat, geo.lng], {
      radius: 9,
      weight: 2,
      color: "#fff",
      fillColor: mapState.statusColors[status],
      fillOpacity: 0.95
    }).bindPopup(popupHtml(e.store, status));

    marker.addTo(mapState.markerLayer);
    bounds.push([geo.lat, geo.lng]);
  });

  updateNotice(unplaced);

  if (bounds.length && !mapState.hasFitBounds) {
    mapState.leaflet.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 });
    mapState.hasFitBounds = true;
  }
}

function showEmpty(msg) {
  const el = document.getElementById("map-empty");
  el.textContent = msg;
  el.classList.remove("hidden");
}

function hideEmpty() {
  document.getElementById("map-empty").classList.add("hidden");
}

function updateNotice(unplacedCount) {
  const el = document.getElementById("map-notice");
  if (!unplacedCount) { el.classList.add("hidden"); return; }
  el.textContent = unplacedCount + " store" + (unplacedCount === 1 ? "" : "s") +
    " couldn't be placed on the map (postcode not recognized).";
  el.classList.remove("hidden");
}

function showFetchErrorNotice() {
  const el = document.getElementById("map-notice");
  el.textContent = "Couldn't reach the postcode lookup service — some stores may be missing from the map. Check your connection and reopen this tab to retry.";
  el.classList.remove("hidden");
}

function render() {
  const state = Storage.loadState();
  const entries = collectStoreEntries(state);
  const totalStores = Object.keys(state.callfile.stores).length;

  document.getElementById("map-meta").textContent = totalStores
    ? entries.length + " of " + totalStores + " stores have a postcode"
    : "";

  ensureMap();

  if (!totalStores) {
    showEmpty("Upload a call file (on the Call File tab) to see stores on the map.");
    mapState.markerLayer.clearLayers();
    updateNotice(0);
    return;
  }
  if (!entries.length) {
    showEmpty("None of your uploaded stores have a postcode to place on the map.");
    mapState.markerLayer.clearLayers();
    updateNotice(0);
    return;
  }
  hideEmpty();

  const cache = loadGeocodeCache();
  const missing = [];
  const seen = new Set();
  entries.forEach(function (e) {
    const pc = normalizePostcode(e.store.postcode);
    if (cache.entries[pc] || seen.has(pc) || mapState.inFlightPostcodes.has(pc)) return;
    seen.add(pc);
    missing.push(pc);
  });

  plotMarkers(entries, cache); // paint whatever's already cached immediately, don't block on network

  if (missing.length) {
    missing.forEach(function (pc) { mapState.inFlightPostcodes.add(pc); });
    geocodeMissing(missing)
      .then(function (results) {
        Object.assign(cache.entries, results);
        saveGeocodeCache(cache);
        missing.forEach(function (pc) { mapState.inFlightPostcodes.delete(pc); });
        plotMarkers(entries, cache); // re-plot now that more coordinates are known
      })
      .catch(function (err) {
        missing.forEach(function (pc) { mapState.inFlightPostcodes.delete(pc); });
        console.error("Postcode lookup failed:", err);
        showFetchErrorNotice();
      });
  }
}

document.addEventListener("DOMContentLoaded", render);
