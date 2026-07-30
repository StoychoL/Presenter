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

function importCallfile(fileName, rows) {
  const state = loadState();
  const existing = state.callfile.stores;
  const next = {};
  const seenInBatch = {};

  rows.forEach(function (row) {
    const baseKey = storeKey(row.name, row.postcode);
    if (!baseKey.replace("|", "")) return;
    // Two rows can share the same name+postcode but be distinct accounts (different grade,
    // different real-world outlet) — suffix so neither silently overwrites the other.
    const occurrence = (seenInBatch[baseKey] || 0) + 1;
    seenInBatch[baseKey] = occurrence;
    const key = occurrence === 1 ? baseKey : baseKey + "#" + occurrence;
    const prior = existing[key];
    next[key] = {
      name: row.name,
      grade: row.grade,
      postcode: row.postcode,
      lastVisitDate: prior ? prior.lastVisitDate : null,
      nextVisitDate: prior ? prior.nextVisitDate : null,
      visits: prior ? prior.visits.slice() : []
    };
  });

  state.callfile = {
    fileName: fileName,
    uploadedAt: new Date().toISOString(),
    stores: next
  };
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
  resetPPSession: resetPPSession,
  storeKey: storeKey,
  importCallfile: importCallfile,
  setCallfileGrade: setCallfileGrade,
  logVisit: logVisit
};
