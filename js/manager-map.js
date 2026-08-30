// Manager Map page logic: plots every rep's Call File stores (window.ManagerData.reps, populated
// by js/manager-cloud.js) together on one UK map, colored by the same storeStatus() rule Call File
// and the rep Map use, with a territory filter. Postcode geocoding, the geocode cache, co-located-
// marker offsetting, and status-color resolution are shared with js/map.js via js/map-geocode.js
// (window.MapGeocode) rather than duplicated here — see that file's header comment.
//
// Read-only: unlike js/map.js's popups (Log visit / Range / CB buttons that mutate the signed-in
// rep's own call file), a manager has no call file of their own to mutate, and firestore.rules
// only grants managers read access to other reps' users/{uid} docs — so popups here are
// informational only.

const mapState = {
  leaflet: null,
  markerLayer: null,
  hasFitBounds: false,
  statusColors: null,
  markersByKey: {}
};

const ALL_TERRITORIES = "__all__";

const UK_CENTER = [54.5, -3.5];
const UK_DEFAULT_ZOOM = 6;

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

function ensureMap() {
  if (mapState.leaflet) return;
  mapState.statusColors = window.MapGeocode.resolveStatusColors();
  const map = L.map("map-container", { zoomControl: true }).setView(UK_CENTER, UK_DEFAULT_ZOOM);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  mapState.markerLayer = L.layerGroup().addTo(map);
  mapState.leaflet = map;
}

// Every entry is tagged with which rep/territory it came from — necessary because two different
// reps' stores could otherwise collide at the same postcode with no way to tell them apart, and
// because the territory filter below needs it.
function collectAllEntries(reps) {
  const entries = [];
  reps.forEach(function (rep) {
    const stores = (rep.callfile && rep.callfile.stores) || {};
    Object.keys(stores).forEach(function (storeKey) {
      const store = stores[storeKey];
      if (!store.postcode || !store.postcode.trim()) return;
      entries.push({
        key: rep.uid + "::" + storeKey,
        store: store,
        uid: rep.uid,
        repEmail: rep.repEmail,
        repTerritory: rep.repTerritory
      });
    });
  });
  // Sorted by key so co-located markers (offsetForIndex grouping) always get the same relative
  // position on every render, rather than depending on reps/store iteration order.
  return entries.sort(function (a, b) { return a.key < b.key ? -1 : a.key > b.key ? 1 : 0; });
}

function filterByTerritory(entries, filter) {
  if (filter === ALL_TERRITORIES) return entries;
  return entries.filter(function (e) { return e.repTerritory === filter; });
}

// Only real, Call-File-assigned territory codes get their own dropdown entry — a rep with no code
// yet doesn't get a bucket (same "only assigned territories are shown" rule as the Dashboard's
// territory grid). "All territories" still includes their stores, just not separately selectable.
function populateTerritoryFilter(reps, selected) {
  const select = document.getElementById("territory-filter");
  const codes = Array.from(new Set(
    reps.map(function (r) { return r.repTerritory; }).filter(Boolean)
  )).sort();

  const options = ['<option value="' + ALL_TERRITORIES + '">All territories</option>']
    .concat(codes.map(function (c) { return '<option value="' + escAttr(c) + '">' + escAttr(c) + "</option>"; }));

  select.innerHTML = options.join("");
  select.value = codes.indexOf(selected) !== -1 || selected === ALL_TERRITORIES ? selected : ALL_TERRITORIES;
}

function popupHtml(entry) {
  const status = storeStatus(entry.store);
  return (
    '<div class="map-popup">' +
      '<div class="map-popup-name">' + escAttr(entry.store.name) + "</div>" +
      '<div class="map-popup-row">' + escAttr(entry.store.grade) + " &middot; " +
        '<span class="status-pill status-' + status + '-pill">' + statusLabel(status) + "</span></div>" +
      '<div class="map-popup-row">' + escAttr(entry.store.postcode) + "</div>" +
      '<div class="map-popup-row">Last visit: ' + formatDateShort(entry.store.lastVisitDate) + "</div>" +
      '<div class="map-popup-row">Next visit: ' + formatDateShort(entry.store.nextVisitDate) + "</div>" +
      '<div class="map-popup-row">Rep: ' + escAttr(window.ManagerData.displayName(entry)) + "</div>" +
      '<div class="map-popup-row">Territory: ' + escAttr(entry.repTerritory || "Unassigned") + "</div>" +
    "</div>"
  );
}

function plotMarkers(entries, cache) {
  mapState.markerLayer.clearLayers();
  mapState.markersByKey = {};
  const bounds = [];
  const unplacedEntries = [];
  const placeable = [];
  const groups = new Map();

  entries.forEach(function (e) {
    const pc = window.MapGeocode.normalizePostcode(e.store.postcode);
    const geo = cache.entries[pc];
    if (!geo || geo.found === false || geo.lat == null) { unplacedEntries.push(e); return; }
    const item = { e: e, geo: geo };
    placeable.push(item);
    const groupKey = geo.lat.toFixed(5) + "," + geo.lng.toFixed(5);
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(item);
  });

  groups.forEach(function (group) {
    group.forEach(function (item, i) {
      const offset = window.MapGeocode.offsetForIndex(i, group.length, item.geo.lat);
      item.plotLat = item.geo.lat + offset.dLat;
      item.plotLng = item.geo.lng + offset.dLng;
    });
  });

  placeable.forEach(function (item) {
    const e = item.e;
    const status = storeStatus(e.store);
    const isPlatinum = e.store.grade === "Platinum";
    const marker = L.circleMarker([item.plotLat, item.plotLng], {
      radius: 9,
      weight: isPlatinum ? 3 : 2,
      color: isPlatinum ? "#1a1a1a" : "#fff",
      fillColor: mapState.statusColors[status],
      fillOpacity: 0.95
    }).bindPopup(popupHtml(e));
    marker.addTo(mapState.markerLayer);
    mapState.markersByKey[e.key] = marker;
    bounds.push([item.plotLat, item.plotLng]);
  });

  updateNotice(unplacedEntries);

  // Only auto-fit once per filter selection (see the "territory-filter" change handler resetting
  // hasFitBounds below) — a later replot from geocoding finishing in the background shouldn't yank
  // a manager's pan/zoom away from what they were just looking at.
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

function updateNotice(unplacedEntries) {
  const el = document.getElementById("map-notice");
  if (!unplacedEntries.length) { el.classList.add("hidden"); el.innerHTML = ""; return; }
  const count = unplacedEntries.length;
  el.textContent = count + " store" + (count === 1 ? "" : "s") + " couldn't be placed on the map (postcode not recognized).";
  el.classList.remove("hidden");
}

// Preselects the filter from ?territory=<code> if the manager arrived here via the Dashboard's
// "View on Map" link (js/manager-home.js) — falls back to "All territories" otherwise.
// populateTerritoryFilter() below already falls back safely if the value isn't a real code.
let currentFilter = new URLSearchParams(window.location.search).get("territory") || ALL_TERRITORIES;

function render() {
  const reps = window.ManagerData.reps;
  ensureMap();

  if (reps === null) {
    showEmpty("Loading…");
    mapState.markerLayer.clearLayers();
    updateNotice([]);
    return;
  }

  populateTerritoryFilter(reps, currentFilter);
  currentFilter = document.getElementById("territory-filter").value;

  const allEntries = collectAllEntries(reps);
  const entries = filterByTerritory(allEntries, currentFilter);

  document.getElementById("map-meta").textContent = allEntries.length
    ? entries.length + " of " + allEntries.length + " stores shown"
    : "";

  if (!allEntries.length) {
    showEmpty("No reps have an uploaded call file with postcodes yet.");
    mapState.markerLayer.clearLayers();
    updateNotice([]);
    return;
  }
  if (!entries.length) {
    showEmpty("No stores in this territory have a postcode to place on the map.");
    mapState.markerLayer.clearLayers();
    updateNotice([]);
    return;
  }
  hideEmpty();

  const cache = window.MapGeocode.loadGeocodeCache();
  const missing = [];
  const seen = new Set();
  entries.forEach(function (e) {
    const pc = window.MapGeocode.normalizePostcode(e.store.postcode);
    if (cache.entries[pc] || seen.has(pc)) return;
    seen.add(pc);
    missing.push(pc);
  });

  plotMarkers(entries, cache); // paint whatever's already cached immediately, don't block on network

  if (missing.length) {
    window.MapGeocode.geocodeMissing(missing).then(function (results) {
      // Re-read the cache fresh right before merging, not the closured `cache` above — see
      // js/map.js's identical comment for why (concurrent render() cycles can otherwise clobber
      // each other's newly-geocoded postcodes).
      const latestCache = window.MapGeocode.loadGeocodeCache();
      Object.assign(latestCache.entries, results);
      window.MapGeocode.saveGeocodeCache(latestCache);
      plotMarkers(filterByTerritory(collectAllEntries(window.ManagerData.reps || []), currentFilter), latestCache);
    }).catch(function (err) {
      console.error("Postcode lookup failed:", err);
    });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  render();

  document.getElementById("territory-filter").addEventListener("change", function (e) {
    currentFilter = e.target.value;
    mapState.hasFitBounds = false;
    render();
  });
});
