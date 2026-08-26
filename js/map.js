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
  plottedKeys: new Set(), // store keys ever included in a bounds fit/extend this page load — lets
                           // plotMarkers() notice markers appearing for the first time (e.g. a
                           // secondary upload's postcodes finishing geocoding after the initial
                           // fit already locked) and grow the view to include them, without
                           // re-fitting around stores the rep has already seen and may have
                           // panned away from
  inFlightPostcodes: new Set(), // normalized postcodes currently being geocoded, to dedupe
                                 // concurrent render() calls firing overlapping requests
  statusColors: null,    // resolved once from CSS custom properties (see resolveStatusColors)
  userLocationLayer: null, // L.layerGroup for the "you are here" dot + accuracy halo
  watchId: null,           // navigator.geolocation.watchPosition id, guards against double-starting
  lastUserLatLng: null,    // {lat, lng} from the most recent geolocation fix, for the locate button
  markersByKey: {},        // store key -> its current L.circleMarker, rebuilt each plotMarkers() call
  openPopupKey: null,       // store key whose popup was last opened, so it can be reopened after a
                             // logVisit-triggered marker rebuild (see reopenPopupIfNeeded)
  ccMarkerLayer: null       // separate L.layerGroup() for permanent Cash & Carry pins — kept out of
                             // markerLayer entirely, since that layer is cleared+rebuilt on every
                             // plotMarkers() call (visits, cycle brief, range saves, geocoding...),
                             // which would otherwise wipe C&C pins constantly. C&C geocoding shares
                             // inFlightPostcodes above with store postcodes — it's just a Set of
                             // normalized postcode strings, no coupling to store shape.
};

// Session-only UI state (not persisted): which store's "Log a visit" date-picker modal is open,
// and which store's saved-range review modal is open (rangeIndex picks which of the up to 2 saved
// snapshots is shown). rangeEditing/rangeEditChecked/rangeNewTier back the range modal's edit
// mode, same meaning as callfileUi's fields. Mirrors callfileUi in js/callfile.js.
const mapUi = {
  logKey: null, rangeKey: null, rangeIndex: 0,
  rangeEditing: false, rangeEditChecked: null, rangeNewTier: null,
  cbKey: null, cbCounts: null
};

const USER_LOCATION_COLOR = "#1a73e8"; // distinct from the red/amber/green status palette
const PLATINUM_RING_COLOR = "#1a1a1a";
const CC_LOCATION_COLOR = "#0b3d91"; // fixed dark blue for permanent Cash & Carry pins — not a
                                      // status color, so not resolved from CSS custom properties
                                      // like mapState.statusColors is

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

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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

// Mirrors whichever grade tab was last active on Call File (state.callfileSession.activeGrade,
// shared device-local session state) so the two pages can't drift out of sync without any new
// persisted state of Map's own — "All" (the default) shows every grade, same as before this filter
// existed.
function collectStoreEntries(state) {
  const stores = state.callfile.stores;
  const activeGrade = state.callfileSession.activeGrade;
  return Storage.liveStoreKeys(stores)
    .map(function (key) { return { key: key, store: stores[key] }; })
    .filter(function (e) { return e.store.postcode && e.store.postcode.trim(); })
    .filter(function (e) { return activeGrade === "All" || e.store.grade === activeGrade; })
    // Sorted by key so co-located markers (see plotMarkers' offset grouping) always get assigned
    // the same relative position on every render, rather than whatever order Object.keys() happens
    // to return — which isn't guaranteed to survive a Firestore round-trip.
    .sort(function (a, b) { return a.key < b.key ? -1 : a.key > b.key ? 1 : 0; });
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

// A large upload (e.g. a secondary-territory call file) can span several batches. Promise.all
// would reject the whole call the moment any one batch fails (a single flaky response over
// patchy in-store wifi), discarding the other batches' perfectly good results too — silently
// dropping stores from the map that never should have been affected. Promise.allSettled keeps
// whatever succeeded; postcodes whose batch failed simply stay uncached and get retried on the
// next render(), same as this app already does for any other not-yet-geocoded postcode.
function geocodeMissing(postcodes) {
  const batches = chunk(postcodes, POSTCODES_IO_BATCH_SIZE);
  return Promise.allSettled(batches.map(geocodeBatch)).then(function (settled) {
    const merged = {};
    settled.forEach(function (result) {
      if (result.status === "fulfilled") {
        Object.assign(merged, result.value);
      } else {
        console.error("Postcode batch lookup failed:", result.reason);
      }
    });
    return merged;
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
  mapState.userLocationLayer = L.layerGroup().addTo(map);
  mapState.ccMarkerLayer = L.layerGroup().addTo(map);
  mapState.leaflet = map;
  initLiveLocation();
}

function onLocationUpdate(pos) {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  mapState.lastUserLatLng = { lat: lat, lng: lng };
  mapState.userLocationLayer.clearLayers();
  L.circle([lat, lng], {
    radius: pos.coords.accuracy || 0,
    weight: 1,
    color: USER_LOCATION_COLOR,
    fillColor: USER_LOCATION_COLOR,
    fillOpacity: 0.12
  }).addTo(mapState.userLocationLayer);
  L.circleMarker([lat, lng], {
    radius: 7,
    weight: 2,
    color: "#fff",
    fillColor: USER_LOCATION_COLOR,
    fillOpacity: 1
  }).bindPopup("You are here").addTo(mapState.userLocationLayer);
}

function onLocationError(err) {
  console.error("Geolocation failed:", err);
}

function initLiveLocation() {
  if (mapState.watchId != null || !navigator.geolocation) return;
  mapState.watchId = navigator.geolocation.watchPosition(onLocationUpdate, onLocationError, {
    enableHighAccuracy: true,
    maximumAge: 10000,
    timeout: 20000
  });
}

// "Locate me" button: pans/zooms to the last known fix from the background watchPosition above.
// If that hasn't resolved yet (fresh page load, slow GPS fix), falls back to a one-off
// getCurrentPosition() rather than introducing a second geolocation code path.
function locateMe() {
  if (mapState.lastUserLatLng) {
    mapState.leaflet.setView([mapState.lastUserLatLng.lat, mapState.lastUserLatLng.lng], 15);
    return;
  }
  if (!navigator.geolocation) {
    alert("Location isn't available on this device/browser.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      onLocationUpdate(pos);
      mapState.leaflet.setView([pos.coords.latitude, pos.coords.longitude], 15);
    },
    function (err) {
      alert("Couldn't get your location: " + (err && err.message ? err.message : "permission denied or unavailable."));
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function popupHtml(store, status, key) {
  const rangeBtn = '<button class="btn small secondary" data-action="range" data-key="' + escAttr(key) + '">Range</button>';
  const cbBtn = '<button class="btn small secondary" data-action="cb" data-key="' + escAttr(key) + '">CB</button>';
  return (
    '<div class="map-popup">' +
      '<div class="map-popup-name">' + escAttr(store.name) + "</div>" +
      '<div class="map-popup-row">' + escAttr(store.grade) + " &middot; " +
        '<span class="status-pill status-' + status + '-pill">' + statusLabel(status) + "</span>" +
        (store.secondary ? ' <span class="secondary-badge">Secondary</span>' : "") + "</div>" +
      '<div class="map-popup-row">' + escAttr(store.postcode) + "</div>" +
      '<div class="map-popup-row">Last visit: ' + formatDateShort(store.lastVisitDate) + "</div>" +
      '<div class="map-popup-row">Next visit: ' + formatDateShort(store.nextVisitDate) + "</div>" +
      '<div class="map-popup-actions">' +
        rangeBtn +
        cbBtn +
        '<button class="btn small" data-action="log" data-key="' + escAttr(key) + '">Log visit</button>' +
      "</div>" +
    "</div>"
  );
}

// Label-only, unlike popupHtml()'s store popup — no buttons, so no popupopen dispatch wiring
// needed for these markers.
function ccPopupHtml(loc) {
  return (
    '<div class="map-popup">' +
      '<div class="map-popup-name">' + escAttr(loc.name) + "</div>" +
      '<div class="map-popup-row">' + escAttr(loc.postcode) + "</div>" +
    "</div>"
  );
}

function openVisitModal(key) {
  mapUi.logKey = key;
  renderVisitModal(Storage.loadState());
  const dateInput = document.getElementById("visit-date-input");
  dateInput.max = todayISO();
  dateInput.value = todayISO();
}

function closeVisitModal() {
  mapUi.logKey = null;
  renderVisitModal(Storage.loadState());
}

function renderVisitModal(state) {
  const modal = document.getElementById("visit-modal");
  const store = mapUi.logKey ? Storage.getLiveStore(state.callfile.stores, mapUi.logKey) : null;
  if (!store) {
    modal.classList.add("hidden");
    return;
  }
  document.getElementById("visit-modal-store").textContent =
    store.name + (store.postcode ? " · " + store.postcode : "");
  modal.classList.remove("hidden");
}

const CB_CATEGORIES = ["direct", "influence", "pos"];

function openCbModal(key) {
  mapUi.cbKey = key;
  mapUi.cbCounts = { direct: 0, influence: 0, pos: 0 };
  renderCbModal(Storage.loadState());
}

function closeCbModal() {
  mapUi.cbKey = null;
  mapUi.cbCounts = null;
  renderCbModal(Storage.loadState());
}

function cbInc(cat) {
  mapUi.cbCounts[cat]++;
  renderCbModal(Storage.loadState());
}

function cbDec(cat) {
  mapUi.cbCounts[cat] = Math.max(0, mapUi.cbCounts[cat] - 1);
  renderCbModal(Storage.loadState());
}

function renderCbModal(state) {
  const modal = document.getElementById("cb-modal");
  const store = mapUi.cbKey ? Storage.getLiveStore(state.callfile.stores, mapUi.cbKey) : null;
  if (!store) {
    modal.classList.add("hidden");
    return;
  }
  document.getElementById("cb-modal-store").textContent =
    store.name + (store.postcode ? " · " + store.postcode : "");
  CB_CATEGORIES.forEach(function (cat) {
    document.getElementById("cb-qty-" + cat).textContent = mapUi.cbCounts[cat];
  });
  modal.classList.remove("hidden");
}

function openRangeModal(key) {
  mapUi.rangeKey = key;
  mapUi.rangeIndex = 0;
  mapUi.rangeEditing = false;
  mapUi.rangeEditChecked = null;
  mapUi.rangeNewTier = null;
  renderRangeModal(Storage.loadState());
}

function closeRangeModal() {
  mapUi.rangeKey = null;
  mapUi.rangeEditing = false;
  mapUi.rangeEditChecked = null;
  mapUi.rangeNewTier = null;
  renderRangeModal(Storage.loadState());
}

function selectRangeTab(index) {
  mapUi.rangeIndex = index;
  mapUi.rangeEditing = false;
  mapUi.rangeEditChecked = null;
  renderRangeModal(Storage.loadState());
}

function startRangeEditExisting(snapshot) {
  mapUi.rangeEditing = true;
  mapUi.rangeEditChecked = new Set(snapshot.checkedIds);
  renderRangeModal(Storage.loadState());
}

function startRangeNewTier(tierKey) {
  mapUi.rangeNewTier = tierKey;
  mapUi.rangeEditing = true;
  mapUi.rangeEditChecked = new Set();
  renderRangeModal(Storage.loadState());
}

function toggleRangeChecked(id) {
  if (mapUi.rangeEditChecked.has(id)) mapUi.rangeEditChecked.delete(id);
  else mapUi.rangeEditChecked.add(id);
  renderRangeModal(Storage.loadState());
}

// historyLen lets Cancel know whether to fall back to the tier picker (from-scratch flow, no
// snapshot to return to) or the read-only view of the snapshot that was being edited.
function cancelRangeEdit(historyLen) {
  mapUi.rangeEditing = false;
  mapUi.rangeEditChecked = null;
  if (historyLen === 0) mapUi.rangeNewTier = null;
  renderRangeModal(Storage.loadState());
}

function saveRangeEdit(store, history) {
  const state = Storage.loadState();
  if (history.length === 0) {
    const tierKey = mapUi.rangeNewTier;
    const target = state.targetCounts[tierKey] || 1;
    const snapshot = window.PPStats.buildSnapshot(tierKey, Array.from(mapUi.rangeEditChecked), target, todayISO());
    Storage.savePPSnapshot(mapUi.rangeKey, snapshot);
    mapUi.rangeIndex = 0;
    mapUi.rangeNewTier = null;
  } else {
    const snapshot = history[mapUi.rangeIndex];
    const target = state.targetCounts[snapshot.tierKey] || 1;
    // Date is deliberately preserved (same date, same index) — this overwrites the existing
    // snapshot in place rather than creating a new dated entry.
    const updated = window.PPStats.buildSnapshot(snapshot.tierKey, Array.from(mapUi.rangeEditChecked), target, snapshot.date);
    Storage.updatePPSnapshot(mapUi.rangeKey, mapUi.rangeIndex, updated);
  }
  mapUi.rangeEditing = false;
  mapUi.rangeEditChecked = null;
  renderRangeModal(Storage.loadState());
}

function renderRangeModal(state) {
  const modal = document.getElementById("range-modal");
  const store = mapUi.rangeKey ? Storage.getLiveStore(state.callfile.stores, mapUi.rangeKey) : null;
  if (!store) {
    modal.classList.add("hidden");
    return;
  }
  const history = store.ppHistory || [];
  document.getElementById("range-modal-store").textContent = store.name;
  const detail = document.getElementById("range-snapshot-detail");

  if (history.length === 0) {
    document.getElementById("range-snapshot-tabs").innerHTML = "";
    if (!mapUi.rangeEditing) {
      detail.innerHTML =
        '<p class="range-snapshot-summary">No saved range yet for this store — pick a tier to start one.</p>' +
        '<div class="tier-tabs range-tier-picker">' +
          Object.keys(window.PP_LAYOUT).map(function (tierKey) {
            return '<button type="button" data-action="range-new-tier" data-tier="' + tierKey + '">' +
              escAttr(window.PP_LAYOUT[tierKey].label) + "</button>";
          }).join("") +
        "</div>";
    } else {
      const tierKey = mapUi.rangeNewTier;
      const tier = window.PP_LAYOUT[tierKey];
      const target = state.targetCounts[tierKey] || 1;
      const stats = window.PPStats.tierStats(tier, target, mapUi.rangeEditChecked);
      const unlockedTag = stats.unlocked ? ' <span class="core-status complete">Unlocked</span>' : "";
      detail.innerHTML =
        '<p class="range-snapshot-summary">' + escAttr(tier.label) + " &middot; " +
          stats.checkedCount + "/" + stats.target + " (" + stats.pct + "%)" + unlockedTag + "</p>" +
        '<div class="range-modal-actions">' +
          '<button type="button" class="btn secondary small" data-action="range-cancel">Cancel</button>' +
          '<button type="button" class="btn small" data-action="range-save">Save</button>' +
        "</div>" +
        window.PPSnapshot.sectionsHtml(tierKey, Array.from(mapUi.rangeEditChecked), { editable: true });
    }
    modal.classList.remove("hidden");
    return;
  }

  const index = Math.min(mapUi.rangeIndex, history.length - 1);
  const snapshot = history[index];
  const tier = window.PP_LAYOUT[snapshot.tierKey];

  document.getElementById("range-snapshot-tabs").innerHTML = history.map(function (snap, i) {
    return '<button type="button" class="' + (i === index ? "active" : "") + '" data-action="range-tab" data-index="' + i + '">' +
      formatDateShort(snap.date) + "</button>";
  }).join("");

  if (mapUi.rangeEditing) {
    const target = state.targetCounts[snapshot.tierKey] || 1;
    const stats = window.PPStats.tierStats(tier, target, mapUi.rangeEditChecked);
    const unlockedTag = stats.unlocked ? ' <span class="core-status complete">Unlocked</span>' : "";
    detail.innerHTML =
      '<p class="range-snapshot-summary">' + escAttr(tier.label) + " &middot; " +
        stats.checkedCount + "/" + stats.target + " (" + stats.pct + "%)" + unlockedTag + "</p>" +
      '<div class="range-modal-actions">' +
        '<button type="button" class="btn secondary small" data-action="range-cancel">Cancel</button>' +
        '<button type="button" class="btn small" data-action="range-save">Save</button>' +
      "</div>" +
      window.PPSnapshot.sectionsHtml(snapshot.tierKey, Array.from(mapUi.rangeEditChecked), { editable: true });
  } else {
    const unlockedTag = snapshot.unlocked ? ' <span class="core-status complete">Unlocked</span>' : "";
    detail.innerHTML =
      '<p class="range-snapshot-summary">' + escAttr(tier.label) + " &middot; " + formatDate(snapshot.date) + " &middot; " +
        snapshot.checkedCount + "/" + snapshot.target + " (" + snapshot.pct + "%)" + unlockedTag + "</p>" +
      '<div class="range-modal-actions"><button type="button" class="btn secondary small" data-action="range-edit">Edit</button></div>' +
      window.PPSnapshot.sectionsHtml(snapshot.tierKey, snapshot.checkedIds, { editable: false });
  }
  modal.classList.remove("hidden");
}

// Reopens the popup for the store the rep was just looking at, after a logVisit-triggered
// render() has cleared+rebuilt every marker (see plotMarkers). Deliberately only called from that
// one flow, not from render() itself, so an unrelated background render() (cloud hydration,
// onSnapshot, geocode resolution) never uninvitedly pops a popup back open.
function reopenPopupIfNeeded() {
  const marker = mapState.openPopupKey ? mapState.markersByKey[mapState.openPopupKey] : null;
  if (marker) marker.openPopup();
}

// postcodes.io geocodes to a postcode's centroid, not an exact address — so stores that share a
// postcode (a shopping parade, e.g.) land on the exact same coordinate. Left alone, Leaflet just
// stacks one circleMarker on top of another: only the one drawn last is visible or clickable, the
// rest are perfectly hidden underneath (not missing data, just visually/interactively unreachable
// — and since it's whichever one happened to be drawn last, which store "wins" can look like it
// changes across reloads). offsetForIndex spreads a group's members around a small fixed-radius
// circle centered on the true point, so every store gets its own distinguishable, tappable pin.
function offsetForIndex(index, total, baseLat) {
  if (total <= 1) return { dLat: 0, dLng: 0 };
  // Not meant to be geographically precise — postcode-level geocoding already isn't — just
  // enough to keep co-located stores individually tappable once a rep zooms to a normal
  // interacting level (a rep can't usefully tell two stores apart at the widest zoom anyway,
  // same as any dense map of points). Deliberately kept well under ~150m: neighboring-but-
  // distinct postcodes in dense areas can be barely 150-200m apart in reality (e.g. CR0 0JB to
  // CR0 0JD is ~170m), and a bigger radius here risks pushing one postcode's offset markers into
  // a completely different, unrelated postcode's cluster.
  const radiusMeters = 30 + Math.min(total, 8) * 12;
  const angle = (2 * Math.PI * index) / total;
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((baseLat * Math.PI) / 180);
  return {
    dLat: (radiusMeters * Math.sin(angle)) / metersPerDegLat,
    dLng: (radiusMeters * Math.cos(angle)) / metersPerDegLng
  };
}

function plotMarkers(entries, cache) {
  mapState.markerLayer.clearLayers();
  mapState.markersByKey = {};
  const bounds = [];
  const newPoints = [];
  const unplacedEntries = [];
  const placeable = [];
  const groups = new Map();

  entries.forEach(function (e) {
    const pc = normalizePostcode(e.store.postcode);
    const geo = cache.entries[pc];
    if (!geo || geo.found === false || geo.lat == null) { unplacedEntries.push(e); return; }
    const item = { e: e, geo: geo };
    placeable.push(item);
    const groupKey = geo.lat.toFixed(5) + "," + geo.lng.toFixed(5);
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(item);
  });

  // entries (and therefore placeable/groups) are already sorted by store key in
  // collectStoreEntries(), so index-within-group is stable across renders.
  groups.forEach(function (group) {
    group.forEach(function (item, i) {
      const offset = offsetForIndex(i, group.length, item.geo.lat);
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
      color: isPlatinum ? PLATINUM_RING_COLOR : "#fff",
      fillColor: mapState.statusColors[status],
      fillOpacity: 0.95
    }).bindPopup(popupHtml(e.store, status, e.key));

    marker.on("popupopen", function () {
      mapState.openPopupKey = e.key;
      const popupEl = marker.getPopup().getElement();
      // Assignment (not addEventListener) so a marker whose popup is closed and reopened without
      // an intervening render() doesn't accumulate duplicate listeners on the same DOM node.
      popupEl.onclick = function (evt) {
        const logBtn = evt.target.closest('button[data-action="log"]');
        if (logBtn) { openVisitModal(logBtn.dataset.key); return; }
        const rangeBtn = evt.target.closest('button[data-action="range"]');
        if (rangeBtn) { openRangeModal(rangeBtn.dataset.key); return; }
        const cbBtn = evt.target.closest('button[data-action="cb"]');
        if (cbBtn) openCbModal(cbBtn.dataset.key);
      };
    });

    marker.addTo(mapState.markerLayer);
    mapState.markersByKey[e.key] = marker;
    bounds.push([item.plotLat, item.plotLng]);
    if (!mapState.plottedKeys.has(e.key)) newPoints.push([item.plotLat, item.plotLng]);
    mapState.plottedKeys.add(e.key);
  });

  updateNotice(unplacedEntries);

  if (bounds.length && !mapState.hasFitBounds) {
    mapState.leaflet.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 });
    mapState.hasFitBounds = true;
  } else if (newPoints.length) {
    // Markers appearing for the first time after the view was already locked — e.g. a
    // secondary-territory upload's postcodes finishing geocoding after the first paint already
    // fit bounds around the primary set. Grow the current view to include them rather than
    // leaving them off-screen, without re-centering away from stores the rep has already seen
    // and may have panned away from.
    const grown = L.latLngBounds(mapState.leaflet.getBounds());
    newPoints.forEach(function (p) { grown.extend(p); });
    mapState.leaflet.fitBounds(grown, { padding: [24, 24], maxZoom: 12 });
  }
}

// A simpler sibling of plotMarkers() for permanent Cash & Carry depot pins: fixed dark-blue
// color (no status), no popup actions, and deliberately doesn't participate in
// bounds/hasFitBounds/plottedKeys — the map's auto-fit behavior stays driven only by store
// markers, C&C pins just sit on whatever view is already showing.
function plotCcMarkers(ccLocations, cache) {
  mapState.ccMarkerLayer.clearLayers();
  const placeable = [];
  const groups = new Map();

  ccLocations.forEach(function (loc) {
    const pc = normalizePostcode(loc.postcode);
    const geo = cache.entries[pc];
    if (!geo || geo.found === false || geo.lat == null) return;
    const item = { loc: loc, geo: geo };
    placeable.push(item);
    const groupKey = geo.lat.toFixed(5) + "," + geo.lng.toFixed(5);
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(item);
  });

  groups.forEach(function (group) {
    group.forEach(function (item, i) {
      const offset = offsetForIndex(i, group.length, item.geo.lat);
      item.plotLat = item.geo.lat + offset.dLat;
      item.plotLng = item.geo.lng + offset.dLng;
    });
  });

  placeable.forEach(function (item) {
    L.circleMarker([item.plotLat, item.plotLng], {
      radius: 9,
      weight: 2,
      color: "#fff",
      fillColor: CC_LOCATION_COLOR,
      fillOpacity: 0.95
    }).bindPopup(ccPopupHtml(item.loc)).addTo(mapState.ccMarkerLayer);
  });
}

// Self-contained geocode-and-plot flow for C&C locations, called unconditionally at the top of
// render() (before any of the store-related empty-state early returns) so C&C pins always attempt
// to plot regardless of whether a call file has been uploaded. Kept separate from render()'s
// store-postcode geocode batch rather than merging into it, to avoid restructuring that function's
// several early-return branches — the tradeoff is a second small network batch when both store and
// C&C postcodes are missing at once, which is fine given C&C locations are typically few.
function renderCcMarkers(state) {
  const ccLocations = state.ccLocations || [];
  const cache = loadGeocodeCache();
  plotCcMarkers(ccLocations, cache); // paint whatever's already cached immediately

  const missing = [];
  const seen = new Set();
  ccLocations.forEach(function (loc) {
    const pc = normalizePostcode(loc.postcode);
    if (cache.entries[pc] || seen.has(pc) || mapState.inFlightPostcodes.has(pc)) return;
    seen.add(pc);
    missing.push(pc);
  });
  if (!missing.length) return;

  missing.forEach(function (pc) { mapState.inFlightPostcodes.add(pc); });
  geocodeMissing(missing)
    .then(function (results) {
      // Re-read the cache fresh before merging, same lost-update-safe pattern render() uses for
      // store postcodes below — an overlapping render() call's own fetch cycle could otherwise
      // overwrite what this one just wrote (or vice versa).
      const latestCache = loadGeocodeCache();
      Object.assign(latestCache.entries, results);
      saveGeocodeCache(latestCache);
      missing.forEach(function (pc) { mapState.inFlightPostcodes.delete(pc); });
      plotCcMarkers(Storage.loadState().ccLocations || [], latestCache);
    })
    .catch(function (err) {
      missing.forEach(function (pc) { mapState.inFlightPostcodes.delete(pc); });
      console.error("C&C postcode lookup failed:", err);
    });
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
  const rows = unplacedEntries.map(function (e) {
    return (
      '<div class="map-notice-store">' +
        '<span class="map-notice-store-name">' + escAttr(e.store.name) + "</span>" +
        '<span class="map-notice-store-postcode">' + escAttr(e.store.postcode) + "</span>" +
        '<a class="map-notice-edit-link" href="callfile.html?edit=' + encodeURIComponent(e.key) + '">Edit</a>' +
      "</div>"
    );
  }).join("");

  el.innerHTML =
    '<div class="map-notice-heading">' + count + " store" + (count === 1 ? "" : "s") +
      " couldn't be placed on the map (postcode not recognized):</div>" +
    '<div class="map-notice-list">' + rows + "</div>";
  el.classList.remove("hidden");
}

function showFetchErrorNotice() {
  const el = document.getElementById("map-notice");
  el.textContent = "Couldn't reach the postcode lookup service — some stores may be missing from the map. Check your connection and reopen this tab to retry.";
  el.classList.remove("hidden");
}

function render() {
  const state = Storage.loadState();
  const activeGrade = state.callfileSession.activeGrade;
  const allStoreKeys = Storage.liveStoreKeys(state.callfile.stores);
  const gradeStoreCount = activeGrade === "All"
    ? allStoreKeys.length
    : allStoreKeys.filter(function (key) { return state.callfile.stores[key].grade === activeGrade; }).length;
  const entries = collectStoreEntries(state);

  document.getElementById("map-meta").textContent = gradeStoreCount
    ? entries.length + " of " + gradeStoreCount + " stores have a postcode"
    : "";

  ensureMap();
  renderCcMarkers(state);

  if (!allStoreKeys.length) {
    showEmpty("Upload a call file (on the Call File tab) to see stores on the map.");
    mapState.markerLayer.clearLayers();
    updateNotice([]);
    return;
  }
  if (!gradeStoreCount) {
    showEmpty("No " + activeGrade + " stores in your uploaded call file.");
    mapState.markerLayer.clearLayers();
    updateNotice([]);
    return;
  }
  if (!entries.length) {
    const label = activeGrade === "All" ? "your uploaded stores" : "your uploaded " + activeGrade + " stores";
    showEmpty("None of " + label + " have a postcode to place on the map.");
    mapState.markerLayer.clearLayers();
    updateNotice([]);
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
        // Re-read the cache fresh right before merging, rather than reusing the closured `cache`
        // loaded at the top of this render() call — render() runs multiple times per page load
        // (initial, post-hydration, onSnapshot echoes), and each one's fetch-then-save cycle can
        // overlap. Saving the stale closured snapshot here would blindly overwrite whatever an
        // overlapping cycle already wrote in the meantime, silently losing its newly-geocoded
        // postcodes (this is what made a random subset of stores disappear from the map on every
        // reload — not a network failure, a lost update between two concurrent cache saves).
        const latestCache = loadGeocodeCache();
        Object.assign(latestCache.entries, results);
        saveGeocodeCache(latestCache);
        missing.forEach(function (pc) { mapState.inFlightPostcodes.delete(pc); });
        // Re-derive entries from current state rather than reusing the closured ones above —
        // an overlapping render() call (cloud hydration, onSnapshot) can resolve its own newer
        // paint before this fetch (kicked off by an earlier, possibly pre-hydration render())
        // finishes; repainting with stale closured data would silently overwrite that newer paint.
        plotMarkers(collectStoreEntries(Storage.loadState()), latestCache);
      })
      .catch(function (err) {
        missing.forEach(function (pc) { mapState.inFlightPostcodes.delete(pc); });
        console.error("Postcode lookup failed:", err);
        showFetchErrorNotice();
      });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  render();

  document.getElementById("locate-btn").addEventListener("click", locateMe);

  document.getElementById("visit-modal-close").addEventListener("click", closeVisitModal);
  document.getElementById("visit-cancel-btn").addEventListener("click", closeVisitModal);

  document.getElementById("visit-modal").addEventListener("click", function (e) {
    if (e.target.id === "visit-modal") closeVisitModal();
  });

  document.getElementById("visit-confirm-btn").addEventListener("click", function () {
    const key = mapUi.logKey;
    if (!key) return;
    const dateVal = document.getElementById("visit-date-input").value;
    if (!dateVal) { alert("Pick a date first."); return; }
    const state = Storage.loadState();
    const store = Storage.getLiveStore(state.callfile.stores, key);
    if (!store) { closeVisitModal(); return; }
    const cfg = window.CALLFILE_GRADE_CONFIG[store.grade] || { cadenceWeeks: 4 };
    Storage.logVisit(key, dateVal, cfg.cadenceWeeks);
    mapUi.logKey = null;
    renderVisitModal(Storage.loadState());
    render();
    reopenPopupIfNeeded();
  });

  document.getElementById("cb-modal-close").addEventListener("click", closeCbModal);
  document.getElementById("cb-cancel-btn").addEventListener("click", closeCbModal);

  document.getElementById("cb-modal").addEventListener("click", function (e) {
    if (e.target.id === "cb-modal") closeCbModal();
    const stepBtn = e.target.closest("button[data-action='cb-inc'], button[data-action='cb-dec']");
    if (!stepBtn) return;
    if (stepBtn.dataset.action === "cb-inc") cbInc(stepBtn.dataset.cat);
    else cbDec(stepBtn.dataset.cat);
  });

  document.getElementById("cb-confirm-btn").addEventListener("click", function () {
    const key = mapUi.cbKey;
    if (!key) return;
    Storage.logCycleBrief(key, todayISO(), mapUi.cbCounts);
    mapUi.cbKey = null;
    mapUi.cbCounts = null;
    renderCbModal(Storage.loadState());
  });

  document.getElementById("range-modal-close").addEventListener("click", closeRangeModal);

  document.getElementById("range-modal").addEventListener("click", function (e) {
    if (e.target.id === "range-modal") closeRangeModal();
  });

  document.getElementById("range-snapshot-tabs").addEventListener("click", function (e) {
    const btn = e.target.closest('button[data-action="range-tab"]');
    if (!btn) return;
    selectRangeTab(parseInt(btn.dataset.index, 10) || 0);
  });

  document.getElementById("range-snapshot-detail").addEventListener("click", function (e) {
    const state = Storage.loadState();
    const store = mapUi.rangeKey ? Storage.getLiveStore(state.callfile.stores, mapUi.rangeKey) : null;
    if (!store) return;
    const history = store.ppHistory || [];

    const tierBtn = e.target.closest('button[data-action="range-new-tier"]');
    if (tierBtn) { startRangeNewTier(tierBtn.dataset.tier); return; }

    const editBtn = e.target.closest('button[data-action="range-edit"]');
    if (editBtn) { startRangeEditExisting(history[Math.min(mapUi.rangeIndex, history.length - 1)]); return; }

    const cancelBtn = e.target.closest('button[data-action="range-cancel"]');
    if (cancelBtn) { cancelRangeEdit(history.length); return; }

    const saveBtn = e.target.closest('button[data-action="range-save"]');
    if (saveBtn) { saveRangeEdit(store, history); return; }

    const row = e.target.closest('.tick-row[data-action="range-toggle"]');
    if (row) { e.preventDefault(); toggleRangeChecked(row.dataset.id); }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && mapUi.logKey) closeVisitModal();
    if (e.key === "Escape" && mapUi.rangeKey) closeRangeModal();
    if (e.key === "Escape" && mapUi.cbKey) closeCbModal();
  });
});
