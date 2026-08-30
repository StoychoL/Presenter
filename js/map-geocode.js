// Shared, rep-independent map helpers: postcode geocoding (via the free postcodes.io bulk API,
// cached in a separate localStorage key — not the schema-versioned diageoPresenter blob, since
// coordinates are derived reference data, not private per-rep state), co-located-marker spreading,
// and status-color resolution from CSS custom properties. Extracted out of js/map.js so
// manager-map.js can reuse the identical, non-trivial logic (in particular the geocode-cache
// lost-update fix documented below) rather than maintaining a second copy that could drift.
// Loaded on both map.html and manager-map.html, before the page's own script.

window.MapGeocode = (function () {
  const GEOCODE_CACHE_KEY = "diageoGeocodeCache";
  const GEOCODE_CACHE_VERSION = 1;
  const POSTCODES_IO_BATCH_SIZE = 100; // hard limit per postcodes.io bulk request

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

  // A large upload (e.g. a secondary-territory call file, or a manager view spanning many reps)
  // can span several batches. Promise.all would reject the whole call the moment any one batch
  // fails (a single flaky response over patchy in-store wifi), discarding the other batches'
  // perfectly good results too — silently dropping stores from the map that never should have
  // been affected. Promise.allSettled keeps whatever succeeded; postcodes whose batch failed
  // simply stay uncached and get retried on the next render(), same as any other not-yet-geocoded
  // postcode.
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

  // postcodes.io geocodes to a postcode's centroid, not an exact address — so entries that share a
  // postcode (a shopping parade, e.g., or two different reps' stores that happen to share one)
  // land on the exact same coordinate. Left alone, Leaflet just stacks one circleMarker on top of
  // another: only the one drawn last is visible or clickable, the rest are perfectly hidden
  // underneath (not missing data, just visually/interactively unreachable — and since it's
  // whichever one happened to be drawn last, which entry "wins" can look like it changes across
  // reloads). offsetForIndex spreads a group's members around a small fixed-radius circle centered
  // on the true point, so every entry gets its own distinguishable, tappable pin.
  function offsetForIndex(index, total, baseLat) {
    if (total <= 1) return { dLat: 0, dLng: 0 };
    // Not meant to be geographically precise — postcode-level geocoding already isn't — just
    // enough to keep co-located entries individually tappable once zoomed to a normal interacting
    // level. Deliberately kept well under ~150m: neighboring-but-distinct postcodes in dense areas
    // can be barely 150-200m apart in reality (e.g. CR0 0JB to CR0 0JD is ~170m), and a bigger
    // radius here risks pushing one postcode's offset markers into a completely different,
    // unrelated postcode's cluster.
    const radiusMeters = 30 + Math.min(total, 8) * 12;
    const angle = (2 * Math.PI * index) / total;
    const metersPerDegLat = 111320;
    const metersPerDegLng = 111320 * Math.cos((baseLat * Math.PI) / 180);
    return {
      dLat: (radiusMeters * Math.sin(angle)) / metersPerDegLat,
      dLng: (radiusMeters * Math.cos(angle)) / metersPerDegLng
    };
  }

  return {
    normalizePostcode: normalizePostcode,
    loadGeocodeCache: loadGeocodeCache,
    saveGeocodeCache: saveGeocodeCache,
    geocodeMissing: geocodeMissing,
    resolveStatusColors: resolveStatusColors,
    offsetForIndex: offsetForIndex
  };
})();
