// Shape validation for everything that comes back from localStorage or Firestore before any
// render() touches it. Every page rebuilds its DOM from Storage.loadState() with plain property
// access (store.visits.filter(...), store.ppHistory.length, ...) — one malformed store, whether
// from an interrupted write, an older schema, or a stray console edit, would otherwise throw on
// every page load with no way for the rep to recover short of clearing site data. The manager
// dashboard has it worse: it renders EVERY rep's doc, so a single bad store anywhere would break
// the whole team's view.
//
// Pure functions of their input, no globals touched except reading window.CALLFILE_GRADES (falls
// back to the fixed three grades if js/layout-callfile.js isn't loaded). Loaded on every rep page
// before js/storage.js and on both manager pages before js/manager-cloud.js.
//
// Policy: coerce where a sane value is obvious (a numeric string price, a missing array), DROP
// the record where it isn't (a store with no name or an unknown grade can't be displayed or
// counted, so keeping it just moves the crash downstream).

window.StateShape = (function () {
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function str(v) { return typeof v === "string" ? v : (v == null ? "" : String(v)); }
  function strOrNull(v) { const s = str(v).trim(); return s ? s : null; }
  function num(v, fallback) { const n = typeof v === "number" ? v : Number(v); return Number.isFinite(n) ? n : fallback; }
  function nonNegInt(v) { return Math.max(0, Math.round(num(v, 0))); }

  function isDate(s) {
    return typeof s === "string" && DATE_RE.test(s) && !isNaN(new Date(s + "T00:00:00Z").getTime());
  }
  function dateOrNull(s) { return isDate(s) ? s : null; }

  function grades() { return window.CALLFILE_GRADES || ["Platinum", "Gold", "Silver"]; }

  function sanitizeSnapshot(snap) {
    if (!isObj(snap) || typeof snap.tierKey !== "string" || !isDate(snap.date)) return null;
    return {
      date: snap.date,
      tierKey: snap.tierKey,
      checkedIds: arr(snap.checkedIds).filter(function (id) { return typeof id === "string"; }),
      checkedCount: nonNegInt(snap.checkedCount),
      target: Math.max(1, nonNegInt(snap.target)),
      pct: nonNegInt(snap.pct),
      unlocked: !!snap.unlocked
    };
  }

  function sanitizeCbEvent(ev) {
    if (!isObj(ev) || !isDate(ev.date)) return null;
    return { date: ev.date, direct: nonNegInt(ev.direct), influence: nonNegInt(ev.influence), pos: nonNegInt(ev.pos) };
  }

  function sanitizeStore(store) {
    if (!isObj(store)) return null;
    const name = str(store.name).trim();
    if (!name) return null;
    if (grades().indexOf(store.grade) === -1) return null;
    return {
      name: name,
      grade: store.grade,
      postcode: str(store.postcode).trim(),
      lastVisitDate: dateOrNull(store.lastVisitDate),
      nextVisitDate: dateOrNull(store.nextVisitDate),
      visits: arr(store.visits).filter(isDate),
      ppHistory: arr(store.ppHistory).map(sanitizeSnapshot).filter(Boolean),
      cbEvents: arr(store.cbEvents).map(sanitizeCbEvent).filter(Boolean),
      secondary: !!store.secondary
    };
  }

  function sanitizeStores(stores) {
    const out = {};
    if (!isObj(stores)) return out;
    Object.keys(stores).forEach(function (key) {
      const clean = sanitizeStore(stores[key]);
      if (clean) out[key] = clean;
    });
    return out;
  }

  function sanitizeCallfile(cf) {
    const base = { fileName: null, uploadedAt: null, secondaryFileName: null, secondaryUploadedAt: null, updatedAt: null, stores: {} };
    if (!isObj(cf)) return base;
    base.fileName = strOrNull(cf.fileName);
    base.uploadedAt = strOrNull(cf.uploadedAt);
    base.secondaryFileName = strOrNull(cf.secondaryFileName);
    base.secondaryUploadedAt = strOrNull(cf.secondaryUploadedAt);
    // undefined and null are both "no timestamp yet" to hydrateFromCloud's comparison — keep null.
    base.updatedAt = strOrNull(cf.updatedAt);
    base.stores = sanitizeStores(cf.stores);
    return base;
  }

  function sanitizePrices(prices) {
    const out = {};
    if (!isObj(prices)) return out;
    Object.keys(prices).forEach(function (id) {
      const p = prices[id];
      if (!isObj(p)) return;
      out[id] = { booker: Math.max(0, num(p.booker, 0)), bestway: Math.max(0, num(p.bestway, 0)) };
    });
    return out;
  }

  function sanitizeTargetCounts(tc) {
    const out = {};
    if (!isObj(tc)) return out;
    Object.keys(tc).forEach(function (tierKey) {
      const n = num(tc[tierKey], NaN);
      if (Number.isFinite(n) && n > 0) out[tierKey] = Math.round(n);
    });
    return out;
  }

  function sanitizeCashCarry(cc) {
    const base = {
      seName: "", territoryName: "", chain: null, otherChainText: "", postcode: "", depotName: "",
      region: null, productStatus: {}, sendEmail: "", updatedAt: null
    };
    if (!isObj(cc)) return base;
    base.seName = str(cc.seName);
    base.territoryName = str(cc.territoryName);
    base.chain = strOrNull(cc.chain);
    base.otherChainText = str(cc.otherChainText);
    base.postcode = str(cc.postcode);
    base.depotName = str(cc.depotName);
    base.region = strOrNull(cc.region);
    base.sendEmail = str(cc.sendEmail);
    base.updatedAt = strOrNull(cc.updatedAt);
    if (isObj(cc.productStatus)) {
      Object.keys(cc.productStatus).forEach(function (id) {
        const v = cc.productStatus[id];
        if (typeof v === "string" && v) base.productStatus[id] = v;
      });
    }
    return base;
  }

  function sanitizeCcLocations(list) {
    return arr(list).map(function (loc) {
      if (!isObj(loc)) return null;
      const id = str(loc.id).trim();
      const name = str(loc.name).trim();
      if (!id || !name) return null;
      return {
        id: id,
        name: name,
        postcode: str(loc.postcode).trim(),
        createdAt: strOrNull(loc.createdAt),
        lastVisitDate: dateOrNull(loc.lastVisitDate),
        nextVisitDate: dateOrNull(loc.nextVisitDate)
      };
    }).filter(Boolean);
  }

  function sanitizeRepTerritory(v) {
    const s = str(v).trim().toUpperCase();
    return s ? s : null;
  }

  // Returns an object with the SAME key presence as the input (only keys actually present come
  // back), so hydrateFromCloud can still tell "field absent from this snapshot" apart from "field
  // present and cleared" (e.g. repTerritory set back to null on another device).
  function sanitizePersistedSlice(slice) {
    const out = {};
    if (!isObj(slice)) return out;
    if ("prices" in slice) out.prices = sanitizePrices(slice.prices);
    if ("targetCounts" in slice) out.targetCounts = sanitizeTargetCounts(slice.targetCounts);
    if ("callfile" in slice) out.callfile = sanitizeCallfile(slice.callfile);
    if ("cashCarry" in slice) out.cashCarry = sanitizeCashCarry(slice.cashCarry);
    if ("ccLocations" in slice) out.ccLocations = sanitizeCcLocations(slice.ccLocations);
    if ("repTerritory" in slice) out.repTerritory = sanitizeRepTerritory(slice.repTerritory);
    return out;
  }

  // Session-only state (never synced) gets the same "must be the expected shape" treatment, just
  // lighter — a bad value here only ever came from this device's own localStorage.
  function sanitizeProductsSession(ps) {
    const base = { quantities: {}, units: {}, activeWholesaler: "booker" };
    if (!isObj(ps)) return base;
    if (isObj(ps.quantities)) {
      Object.keys(ps.quantities).forEach(function (id) { base.quantities[id] = nonNegInt(ps.quantities[id]); });
    }
    if (isObj(ps.units)) {
      Object.keys(ps.units).forEach(function (id) {
        if (ps.units[id] === "case" || ps.units[id] === "bottle") base.units[id] = ps.units[id];
      });
    }
    if (ps.activeWholesaler === "booker" || ps.activeWholesaler === "bestway") base.activeWholesaler = ps.activeWholesaler;
    return base;
  }

  function sanitizePpSession(pp, validTiers, defaultTier) {
    const base = { activeTier: defaultTier, checked: {} };
    if (!isObj(pp)) return base;
    if (typeof pp.activeTier === "string" && validTiers.indexOf(pp.activeTier) !== -1) base.activeTier = pp.activeTier;
    if (isObj(pp.checked)) {
      Object.keys(pp.checked).forEach(function (id) { if (pp.checked[id]) base.checked[id] = true; });
    }
    return base;
  }

  function sanitizeCallfileSession(cs, defaultGrade) {
    const base = { activeGrade: defaultGrade };
    if (!isObj(cs)) return base;
    const allowed = ["All"].concat(grades());
    if (typeof cs.activeGrade === "string" && allowed.indexOf(cs.activeGrade) !== -1) base.activeGrade = cs.activeGrade;
    return base;
  }

  return {
    isDate: isDate,
    sanitizeStore: sanitizeStore,
    sanitizeStores: sanitizeStores,
    sanitizeCallfile: sanitizeCallfile,
    sanitizePersistedSlice: sanitizePersistedSlice,
    sanitizeProductsSession: sanitizeProductsSession,
    sanitizePpSession: sanitizePpSession,
    sanitizeCallfileSession: sanitizeCallfileSession
  };
})();
