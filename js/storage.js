// Shared localStorage layer for the Diageo Sales Presenter.
// Product identity/case-size comes from window.CATALOG; grouping from window.PRODUCTS_LAYOUT /
// window.PP_LAYOUT. Only prices (Products), target counts (PP), and the call file (stores +
// visit history) are user-edited and persisted; quantities/units/wholesaler/checked-state are
// session data cleared by the Reset buttons.

const STORAGE_KEY = "diageoPresenter";
const SCHEMA_VERSION = 5;

function defaultState() {
  const prices = {};
  Object.keys(window.CATALOG || {}).forEach(function (id) {
    prices[id] = { booker: 0, bestway: 0 };
  });

  const targetCounts = {};
  Object.keys(window.PP_LAYOUT || {}).forEach(function (tierKey) {
    targetCounts[tierKey] = window.PP_LAYOUT[tierKey].targetCount;
  });

  return {
    version: SCHEMA_VERSION,
    prices: prices,
    targetCounts: targetCounts,
    productsSession: {
      quantities: {},
      units: {},
      activeWholesaler: "booker"
    },
    ppSession: {
      activeTier: "tier3",
      checked: {}
    },
    callfile: {
      fileName: null,
      uploadedAt: null,
      stores: {}
    },
    callfileSession: {
      activeGrade: (window.CALLFILE_GRADES && window.CALLFILE_GRADES[0]) || "Platinum"
    }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const base = defaultState();
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== SCHEMA_VERSION) return base;

    if (parsed.prices) {
      Object.keys(base.prices).forEach(function (id) {
        if (parsed.prices[id]) base.prices[id] = parsed.prices[id];
      });
    }
    if (parsed.targetCounts) {
      Object.keys(base.targetCounts).forEach(function (tierKey) {
        // One-time migration: Tier 3's default target changed from 20 to 23 (Core Range 17 +
        // Bonus Range 6 = 23 total products). A saved value of exactly 20 predates that fix, so
        // treat it as unmigrated and let the new default through rather than carrying it forward.
        if (tierKey === "tier3" && parsed.targetCounts[tierKey] === 20) return;
        // One-time migration: Tier 2's default target changed from 25 to 26 (Core Range shrank to
        // 13 shared products, Bonus Range grew to 13 with both Captain Morgan/Gordon's sizes). A
        // saved value of exactly 25 predates that fix — let the new default through instead.
        if (tierKey === "tier2" && parsed.targetCounts[tierKey] === 25) return;
        // One-time migration: Tier 2's default target changed from 26 to 24 — Captain Morgan and
        // Gordon's 35cl/20cl pairs now count as a single required slot each instead of two
        // separately-counted products (see layout-pp.js's mergeCount / partnership.js's
        // tierCheckedCount). A saved value of exactly 26 predates that fix — let the new default
        // through instead.
        if (tierKey === "tier2" && parsed.targetCounts[tierKey] === 26) return;
        if (typeof parsed.targetCounts[tierKey] === "number") base.targetCounts[tierKey] = parsed.targetCounts[tierKey];
      });
    }
    base.productsSession = parsed.productsSession || base.productsSession;
    base.ppSession = parsed.ppSession || base.ppSession;
    base.callfile = parsed.callfile || base.callfile;
    base.callfileSession = parsed.callfileSession || base.callfileSession;
    return base;
  } catch (e) {
    return defaultState();
  }
}

// touchedStoreKeys (optional): the callfile.stores key(s) this specific mutation actually changed,
// e.g. logVisit(key) passes [key]. CloudSync.pushState uses it to push only those stores via a
// Firestore merge write instead of the whole callfile — see js/cloud-sync.js for why: without it,
// a second device with a stale local cache pushing for an unrelated reason (e.g. a price edit)
// would blindly overwrite every other store's cloud data with whatever it has cached, including
// stores it never touched. Mutators that don't touch callfile.stores (setPrice, toggleChecked,
// etc.) simply omit this argument.
function saveState(state, touchedStoreKeys) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  // Mirrors the persisted slice up to the signed-in rep's Firestore doc in the background — see
  // js/cloud-sync.js. Every mutation already funnels through this one function, so this is the
  // only place cloud sync needs to hook in; localStorage stays the synchronous source of truth
  // every render() reads from, cloud sync is purely a background mirror on top.
  if (window.CloudSync) window.CloudSync.pushState(state, touchedStoreKeys);
}

function hasSavedData() {
  return !!localStorage.getItem(STORAGE_KEY);
}

// The subset of state that's mirrored to Firestore — prices/targetCounts/callfile, exactly the
// fields already documented as "persisted across resets" (session state never leaves the device).
function cloudSlice(state) {
  return { prices: state.prices, targetCounts: state.targetCounts, callfile: state.callfile };
}

function defaultPersistedSlice() {
  return cloudSlice(defaultState());
}

// A rep can navigate to another page before a just-made change (e.g. logVisit) has actually
// finished pushing to Firestore — the next page's own hydration read can then race that in-flight
// write and come back stale. pickNewerStore/mergeCallfile compare each store's updatedAt so a
// stale read can't roll back a newer local change; whichever side was genuinely written more
// recently wins, which also means a legitimate resetVisits from another device still propagates
// correctly (unlike a naive "keep whichever visits array is longer" comparison would allow).
function pickNewerStore(localStore, cloudStore) {
  if (!localStore) return cloudStore;
  if (!cloudStore) return localStore;
  if (localStore.updatedAt && cloudStore.updatedAt) {
    return localStore.updatedAt >= cloudStore.updatedAt ? localStore : cloudStore;
  }
  // Records saved before updatedAt existed: fall back to the old blind-overwrite-safe heuristic.
  // (visits may be absent on a tombstone — see deleteStore/updateStore/importCallfile below.)
  const localCount = localStore.visits ? localStore.visits.length : 0;
  const cloudCount = cloudStore.visits ? cloudStore.visits.length : 0;
  return localCount >= cloudCount ? localStore : cloudStore;
}

// A rep can rename a store (changing its name|postcode key), delete it, or re-upload a call file
// that drops it — all three used to just `delete` the key locally. That's not safe under the
// per-store merge above: mergeCallfile() can't tell "never synced to this device" apart from
// "was deleted," so a stale cloud read that still has the old key resurrects it. Tombstoning
// (leaving a small `{ deleted: true, updatedAt }` marker instead of removing the key) gives the
// removal its own updatedAt, so the same last-write-wins comparison that protects a just-logged
// visit also protects a deletion/rename from being undone by a stale read.
function tombstone() {
  return { deleted: true, updatedAt: new Date().toISOString(), visits: [] };
}

// Every direct consumer of callfile.stores must go through these two so a tombstone is invisible
// everywhere except the merge layer itself (js/callfile.js, js/map.js, js/partnership.js, js/home.js).
function liveStoreKeys(stores) {
  return Object.keys(stores || {}).filter(function (key) { return !stores[key].deleted; });
}

function getLiveStore(stores, key) {
  const store = (stores || {})[key];
  return store && !store.deleted ? store : null;
}

function mergeCallfile(localCallfile, cloudCallfile) {
  const mergedStores = {};
  Object.keys(cloudCallfile.stores || {}).forEach(function (key) {
    mergedStores[key] = pickNewerStore(localCallfile && localCallfile.stores[key], cloudCallfile.stores[key]);
  });
  if (localCallfile && localCallfile.stores) {
    Object.keys(localCallfile.stores).forEach(function (key) {
      if (!mergedStores[key]) mergedStores[key] = localCallfile.stores[key]; // e.g. added locally, not yet pushed
    });
  }
  return { fileName: cloudCallfile.fileName, uploadedAt: cloudCallfile.uploadedAt, stores: mergedStores };
}

// Overwrites just the cloud-synced slice from a Firestore snapshot, writing straight to
// localStorage (bypassing saveState/CloudSync.pushState) since this data came FROM the cloud —
// echoing it back up would be redundant. Used by cloud-sync.js on initial hydration and on every
// live update from another device. callfile is merged per-store (see mergeCallfile) rather than
// replaced wholesale, since this hydration can race a not-yet-committed local write.
function hydrateFromCloud(slice) {
  const state = loadState();
  if (slice.prices) state.prices = slice.prices;
  if (slice.targetCounts) state.targetCounts = slice.targetCounts;
  if (slice.callfile) state.callfile = mergeCallfile(state.callfile, slice.callfile);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

// ---- Products mutations ----

function setPrice(id, wholesaler, price) {
  const state = loadState();
  if (!state.prices[id]) state.prices[id] = { booker: 0, bestway: 0 };
  state.prices[id][wholesaler] = price;
  saveState(state);
  return state;
}

function setQty(id, qty) {
  const state = loadState();
  state.productsSession.quantities[id] = Math.max(0, qty);
  saveState(state);
  return state;
}

function setUnit(id, unit) {
  const state = loadState();
  state.productsSession.units[id] = unit;
  saveState(state);
  return state;
}

function setActiveWholesaler(wholesaler) {
  const state = loadState();
  state.productsSession.activeWholesaler = wholesaler;
  saveState(state);
  return state;
}

function resetProductsSession() {
  const state = loadState();
  state.productsSession = { quantities: {}, units: {}, activeWholesaler: state.productsSession.activeWholesaler };
  saveState(state);
  return state;
}

// ---- Partnership Program mutations ----

function toggleChecked(id) {
  const state = loadState();
  state.ppSession.checked[id] = !state.ppSession.checked[id];
  saveState(state);
  return state;
}

function setActiveTier(tierKey) {
  const state = loadState();
  state.ppSession.activeTier = tierKey;
  saveState(state);
  return state;
}

function setTierTarget(tierKey, targetCount) {
  const state = loadState();
  state.targetCounts[tierKey] = Math.max(1, targetCount);
  saveState(state);
  return state;
}

function selectAllTier(tierKey) {
  const state = loadState();
  const tier = window.PP_LAYOUT[tierKey];
  tier.sections.forEach(function (section) {
    section.items.forEach(function (id) { state.ppSession.checked[id] = true; });
  });
  saveState(state);
  return state;
}

function resetPPSession() {
  const state = loadState();
  state.ppSession.checked = {};
  saveState(state);
  return state;
}

// ---- Call File mutations ----
// Stores are keyed by a normalized "name|postcode" key (the callfile export has no stable id
// once DIAGEOID/TERRITORY etc. are dropped), so re-uploading the same store keeps its visit
// history and only genuinely new/removed rows change.

function storeKey(name, postcode) {
  return (name || "").trim().toLowerCase() + "|" + (postcode || "").trim().toLowerCase().replace(/\s+/g, "");
}

// Duplicate rows for the same name+postcode collapse to a single store — the last matching row
// in the file wins. There's no DIAGEOID to tell a true duplicate apart from two different accounts
// that coincidentally share a name+postcode, so this is a deliberate simplification: the caller is
// told how many rows collapsed (duplicateCount) so it isn't fully silent.
function importCallfile(fileName, rows) {
  const state = loadState();
  const existing = state.callfile.stores;
  const next = {};
  let duplicateCount = 0;

  rows.forEach(function (row) {
    const key = storeKey(row.name, row.postcode);
    if (!key.replace("|", "")) return;
    if (next[key]) duplicateCount++;
    // A tombstoned prior (this key was deleted/renamed away since the last upload) is treated as
    // no prior at all — reappearing in a fresh upload starts it clean rather than reviving old data.
    const prior = getLiveStore(existing, key);
    next[key] = {
      name: row.name,
      grade: row.grade,
      postcode: row.postcode,
      lastVisitDate: prior ? prior.lastVisitDate : null,
      nextVisitDate: prior ? prior.nextVisitDate : null,
      visits: prior ? prior.visits.slice() : [],
      ppHistory: prior && prior.ppHistory ? prior.ppHistory.slice() : [],
      updatedAt: new Date().toISOString()
    };
  });

  // Any store that was live before this upload but isn't in the new file needs to be tombstoned,
  // not just dropped — otherwise a stale cloud read that still has it can resurrect it later.
  liveStoreKeys(existing).forEach(function (key) {
    if (!next[key]) next[key] = tombstone();
  });

  state.callfile = {
    fileName: fileName,
    uploadedAt: new Date().toISOString(),
    stores: next
  };
  saveState(state, Object.keys(next));
  return { state: state, duplicateCount: duplicateCount };
}

// Adding/editing a store via the Add/Edit modal (as opposed to importCallfile's bulk
// re-upload path). Both guard against colliding with a different existing store's key —
// silently merging into another store's key would destroy that store's visit history.

function addStore(name, grade, postcode) {
  const trimmedName = (name || "").trim();
  if (!trimmedName) return { error: "Enter a store name." };
  if (window.CALLFILE_GRADES.indexOf(grade) === -1) return { error: "Pick a grade." };

  const state = loadState();
  const key = storeKey(trimmedName, postcode);
  if (!key.replace("|", "")) return { error: "Enter a store name." };
  if (getLiveStore(state.callfile.stores, key)) return { error: "A store with this name and postcode already exists." };

  state.callfile.stores[key] = {
    name: trimmedName,
    grade: grade,
    postcode: (postcode || "").trim(),
    lastVisitDate: null,
    nextVisitDate: null,
    visits: [],
    ppHistory: [],
    updatedAt: new Date().toISOString()
  };
  saveState(state, [key]);
  return { state: state };
}

function updateStore(oldKey, name, grade, postcode) {
  const trimmedName = (name || "").trim();
  if (!trimmedName) return { error: "Enter a store name." };
  if (window.CALLFILE_GRADES.indexOf(grade) === -1) return { error: "Pick a grade." };

  const state = loadState();
  const store = getLiveStore(state.callfile.stores, oldKey);
  if (!store) return { error: "That store no longer exists." };

  const newKey = storeKey(trimmedName, postcode);
  if (!newKey.replace("|", "")) return { error: "Enter a store name." };
  if (newKey !== oldKey && getLiveStore(state.callfile.stores, newKey)) {
    return { error: "A store with this name and postcode already exists." };
  }

  const updated = {
    name: trimmedName,
    grade: grade,
    postcode: (postcode || "").trim(),
    lastVisitDate: store.lastVisitDate,
    nextVisitDate: store.nextVisitDate,
    visits: store.visits,
    ppHistory: store.ppHistory,
    updatedAt: new Date().toISOString()
  };

  // Renaming changes the key (name|postcode) — tombstone the old one rather than deleting it
  // outright, so a stale cloud read can't resurrect it (see tombstone() above).
  if (newKey !== oldKey) state.callfile.stores[oldKey] = tombstone();
  state.callfile.stores[newKey] = updated;

  saveState(state, newKey !== oldKey ? [oldKey, newKey] : [oldKey]);
  return { state: state, newKey: newKey };
}

function deleteStore(key) {
  const state = loadState();
  if (!getLiveStore(state.callfile.stores, key)) return state;
  state.callfile.stores[key] = tombstone();
  saveState(state, [key]);
  return state;
}

// Snapshots the Partnership Program checklist state onto a store so a rep can compare visits.
// Keeps only the 2 most recent, newest first — there's no need for unlimited history here.
function savePPSnapshot(key, snapshot) {
  const state = loadState();
  const store = getLiveStore(state.callfile.stores, key);
  if (!store) return state;
  const history = (store.ppHistory || []).slice();
  history.unshift(snapshot);
  store.ppHistory = history.slice(0, 2);
  store.updatedAt = new Date().toISOString();
  saveState(state, [key]);
  return state;
}

function setCallfileGrade(grade) {
  const state = loadState();
  state.callfileSession.activeGrade = grade;
  saveState(state);
  return state;
}

function logVisit(key, dateStr, cadenceWeeks) {
  const state = loadState();
  const store = getLiveStore(state.callfile.stores, key);
  if (!store) return state;
  // Each tap is a distinct visit event — a Platinum store visited twice in one day must still
  // count as 2 toward its monthly requirement, so visits are never deduped by date.
  store.visits.push(dateStr);
  store.lastVisitDate = dateStr;
  const next = new Date(dateStr);
  next.setDate(next.getDate() + cadenceWeeks * 7);
  store.nextVisitDate = next.toISOString().slice(0, 10);
  store.updatedAt = new Date().toISOString();
  saveState(state, [key]);
  return state;
}

function resetVisits(key) {
  const state = loadState();
  const store = getLiveStore(state.callfile.stores, key);
  if (!store) return state;
  store.visits = [];
  store.lastVisitDate = null;
  store.nextVisitDate = null;
  store.updatedAt = new Date().toISOString();
  saveState(state, [key]);
  return state;
}

function resetAllVisits() {
  const state = loadState();
  const keys = liveStoreKeys(state.callfile.stores);
  keys.forEach(function (key) {
    const store = state.callfile.stores[key];
    store.visits = [];
    store.lastVisitDate = null;
    store.nextVisitDate = null;
    store.updatedAt = new Date().toISOString();
  });
  saveState(state, keys);
  return state;
}

window.Storage = {
  loadState: loadState,
  saveState: saveState,
  setPrice: setPrice,
  setQty: setQty,
  setUnit: setUnit,
  setActiveWholesaler: setActiveWholesaler,
  resetProductsSession: resetProductsSession,
  toggleChecked: toggleChecked,
  setActiveTier: setActiveTier,
  setTierTarget: setTierTarget,
  selectAllTier: selectAllTier,
  resetPPSession: resetPPSession,
  storeKey: storeKey,
  liveStoreKeys: liveStoreKeys,
  getLiveStore: getLiveStore,
  importCallfile: importCallfile,
  addStore: addStore,
  updateStore: updateStore,
  deleteStore: deleteStore,
  setCallfileGrade: setCallfileGrade,
  logVisit: logVisit,
  resetVisits: resetVisits,
  resetAllVisits: resetAllVisits,
  savePPSnapshot: savePPSnapshot,
  hasSavedData: hasSavedData,
  defaultPersistedSlice: defaultPersistedSlice,
  hydrateFromCloud: hydrateFromCloud
};
