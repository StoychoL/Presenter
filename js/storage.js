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

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  // Mirrors the persisted slice up to the signed-in rep's Firestore doc in the background — see
  // js/cloud-sync.js. Every mutation already funnels through this one function, so this is the
  // only place cloud sync needs to hook in; localStorage stays the synchronous source of truth
  // every render() reads from, cloud sync is purely a background mirror on top.
  if (window.CloudSync) window.CloudSync.pushState(state);
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

// Overwrites just the cloud-synced slice from a Firestore snapshot, writing straight to
// localStorage (bypassing saveState/CloudSync.pushState) since this data came FROM the cloud —
// echoing it back up would be redundant. Used by cloud-sync.js on initial hydration and on every
// live update from another device.
function hydrateFromCloud(slice) {
  const state = loadState();
  if (slice.prices) state.prices = slice.prices;
  if (slice.targetCounts) state.targetCounts = slice.targetCounts;
  if (slice.callfile) state.callfile = slice.callfile;
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
    const prior = existing[key];
    next[key] = {
      name: row.name,
      grade: row.grade,
      postcode: row.postcode,
      lastVisitDate: prior ? prior.lastVisitDate : null,
      nextVisitDate: prior ? prior.nextVisitDate : null,
      visits: prior ? prior.visits.slice() : [],
      ppHistory: prior && prior.ppHistory ? prior.ppHistory.slice() : []
    };
  });

  state.callfile = {
    fileName: fileName,
    uploadedAt: new Date().toISOString(),
    stores: next
  };
  saveState(state);
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
  if (state.callfile.stores[key]) return { error: "A store with this name and postcode already exists." };

  state.callfile.stores[key] = {
    name: trimmedName,
    grade: grade,
    postcode: (postcode || "").trim(),
    lastVisitDate: null,
    nextVisitDate: null,
    visits: [],
    ppHistory: []
  };
  saveState(state);
  return { state: state };
}

function updateStore(oldKey, name, grade, postcode) {
  const trimmedName = (name || "").trim();
  if (!trimmedName) return { error: "Enter a store name." };
  if (window.CALLFILE_GRADES.indexOf(grade) === -1) return { error: "Pick a grade." };

  const state = loadState();
  const store = state.callfile.stores[oldKey];
  if (!store) return { error: "That store no longer exists." };

  const newKey = storeKey(trimmedName, postcode);
  if (!newKey.replace("|", "")) return { error: "Enter a store name." };
  if (newKey !== oldKey && state.callfile.stores[newKey]) {
    return { error: "A store with this name and postcode already exists." };
  }

  const updated = {
    name: trimmedName,
    grade: grade,
    postcode: (postcode || "").trim(),
    lastVisitDate: store.lastVisitDate,
    nextVisitDate: store.nextVisitDate,
    visits: store.visits,
    ppHistory: store.ppHistory
  };

  if (newKey !== oldKey) delete state.callfile.stores[oldKey];
  state.callfile.stores[newKey] = updated;

  saveState(state);
  return { state: state, newKey: newKey };
}

function deleteStore(key) {
  const state = loadState();
  delete state.callfile.stores[key];
  saveState(state);
  return state;
}

// Snapshots the Partnership Program checklist state onto a store so a rep can compare visits.
// Keeps only the 2 most recent, newest first — there's no need for unlimited history here.
function savePPSnapshot(key, snapshot) {
  const state = loadState();
  const store = state.callfile.stores[key];
  if (!store) return state;
  const history = (store.ppHistory || []).slice();
  history.unshift(snapshot);
  store.ppHistory = history.slice(0, 2);
  saveState(state);
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
  const store = state.callfile.stores[key];
  if (!store) return state;
  // Each tap is a distinct visit event — a Platinum store visited twice in one day must still
  // count as 2 toward its monthly requirement, so visits are never deduped by date.
  store.visits.push(dateStr);
  store.lastVisitDate = dateStr;
  const next = new Date(dateStr);
  next.setDate(next.getDate() + cadenceWeeks * 7);
  store.nextVisitDate = next.toISOString().slice(0, 10);
  saveState(state);
  return state;
}

function resetVisits(key) {
  const state = loadState();
  const store = state.callfile.stores[key];
  if (!store) return state;
  store.visits = [];
  store.lastVisitDate = null;
  store.nextVisitDate = null;
  saveState(state);
  return state;
}

function resetAllVisits() {
  const state = loadState();
  Object.keys(state.callfile.stores).forEach(function (key) {
    const store = state.callfile.stores[key];
    store.visits = [];
    store.lastVisitDate = null;
    store.nextVisitDate = null;
  });
  saveState(state);
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
