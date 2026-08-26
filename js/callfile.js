// Call File page logic: upload an .xls/.xlsx/.csv export, keep only OUTLETNAME / OUTLETGRADE /
// POSTCODE per row, and track visit compliance per store for the current calendar month.
//
// storeStatus()/statusLabel()/todayISO() live in js/callfile-status.js (shared with js/map.js).

// Session-only UI state (not persisted): which store's "Log a visit" date-picker modal is open,
// which store's saved-range review modal is open (rangeIndex picks which of the up to 2 saved
// snapshots is shown), and the add/edit-store modal — null when closed, "__new__" when adding a
// new store, or an existing store's key when editing it. rangeEditing/rangeEditChecked/
// rangeNewTier back the range modal's edit mode: rangeEditing is true while showing an editable
// checklist (either an existing snapshot being edited, or a from-scratch range for a store with
// no saved history yet); rangeEditChecked is the in-progress edit buffer (a Set of ids), only
// non-null while rangeEditing; rangeNewTier is the tier picked for the from-scratch flow, before
// any snapshot exists to attach it to.
// cbKey/cbCounts back the Cycle Brief modal: cbKey is the store being logged against, cbCounts
// is the in-progress { direct, influence, pos } edit buffer, reset to zeros every time the modal
// opens (each save is a fresh dated entry, not an edit of a running total — see Storage.logCycleBrief).
const callfileUi = {
  logKey: null, rangeKey: null, rangeIndex: 0, editKey: null,
  rangeEditing: false, rangeEditChecked: null, rangeNewTier: null,
  cbKey: null, cbCounts: null
};

function escAttr(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML.replace(/"/g, "&quot;");
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function normalizeGrade(value) {
  const v = String(value == null ? "" : value).trim().toLowerCase();
  const match = window.CALLFILE_GRADES.find(function (g) { return g.toLowerCase() === v; });
  return match || null;
}

function findHeaderKey(keys, target) {
  return keys.find(function (k) { return k.replace(/\s+/g, "").toUpperCase() === target; });
}

// Reads only OUTLETNAME / OUTLETGRADE / POSTCODE from the sheet; everything else in the export
// (DIAGEOID, FREQUENCY, VISITCADENCE, TERRITORY, ...) is ignored.
function parseWorkbook(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (!json.length) return { rows: [], skipped: 0 };

  const keys = Object.keys(json[0]);
  const nameKey = findHeaderKey(keys, "OUTLETNAME");
  const gradeKey = findHeaderKey(keys, "OUTLETGRADE");
  const postcodeKey = findHeaderKey(keys, "POSTCODE");

  let skipped = 0;
  const rows = [];
  json.forEach(function (raw) {
    const name = String(raw[nameKey] || "").trim();
    const grade = normalizeGrade(raw[gradeKey]);
    const postcode = String(raw[postcodeKey] || "").trim();
    if (!name || !grade) { skipped++; return; }
    rows.push({ name: name, grade: grade, postcode: postcode });
  });
  return { rows: rows, skipped: skipped };
}

function formatDateShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function storeRowHtml(key, store) {
  const status = storeStatus(store);
  const meta = (store.postcode ? escAttr(store.postcode) + " &middot; " : "") +
    "Last " + formatDateShort(store.lastVisitDate) + " &middot; Next " + formatDateShort(store.nextVisitDate);
  const rangeBtn = '<button class="btn small secondary" data-action="range" data-key="' + escAttr(key) + '">Range</button>';
  const cbBtn = '<button class="btn small secondary" data-action="cb" data-key="' + escAttr(key) + '">CB</button>';
  return (
    '<div class="store-card status-' + status + '">' +
      '<div class="store-row-top">' +
        '<span class="store-name">' + escAttr(store.name) + "</span>" +
        (store.secondary ? '<span class="secondary-badge">Secondary</span>' : "") +
        '<span class="status-pill">' + statusLabel(status) + "</span>" +
      "</div>" +
      '<div class="store-row-bottom">' +
        '<span class="store-meta">' + meta + "</span>" +
        '<div class="store-row-actions">' +
          rangeBtn +
          cbBtn +
          '<button class="btn small secondary" data-action="edit" data-key="' + escAttr(key) + '">Edit</button>' +
          '<button class="btn small" data-action="log" data-key="' + escAttr(key) + '">Log visit</button>' +
        "</div>" +
      "</div>" +
    "</div>"
  );
}

function openRangeModal(key) {
  callfileUi.rangeKey = key;
  callfileUi.rangeIndex = 0;
  callfileUi.rangeEditing = false;
  callfileUi.rangeEditChecked = null;
  callfileUi.rangeNewTier = null;
  render();
}

function closeRangeModal() {
  callfileUi.rangeKey = null;
  callfileUi.rangeEditing = false;
  callfileUi.rangeEditChecked = null;
  callfileUi.rangeNewTier = null;
  render();
}

function selectRangeTab(index) {
  callfileUi.rangeIndex = index;
  callfileUi.rangeEditing = false;
  callfileUi.rangeEditChecked = null;
  render();
}

function startRangeEditExisting(snapshot) {
  callfileUi.rangeEditing = true;
  callfileUi.rangeEditChecked = new Set(snapshot.checkedIds);
  render();
}

function startRangeNewTier(tierKey) {
  callfileUi.rangeNewTier = tierKey;
  callfileUi.rangeEditing = true;
  callfileUi.rangeEditChecked = new Set();
  render();
}

function toggleRangeChecked(id) {
  if (callfileUi.rangeEditChecked.has(id)) callfileUi.rangeEditChecked.delete(id);
  else callfileUi.rangeEditChecked.add(id);
  render();
}

// historyLen lets Cancel know whether to fall back to the tier picker (from-scratch flow, no
// snapshot to return to) or the read-only view of the snapshot that was being edited.
function cancelRangeEdit(historyLen) {
  callfileUi.rangeEditing = false;
  callfileUi.rangeEditChecked = null;
  if (historyLen === 0) callfileUi.rangeNewTier = null;
  render();
}

function saveRangeEdit(store, history) {
  const state = Storage.loadState();
  if (history.length === 0) {
    const tierKey = callfileUi.rangeNewTier;
    const target = state.targetCounts[tierKey] || 1;
    const snapshot = window.PPStats.buildSnapshot(tierKey, Array.from(callfileUi.rangeEditChecked), target, todayISO());
    Storage.savePPSnapshot(callfileUi.rangeKey, snapshot);
    callfileUi.rangeIndex = 0;
    callfileUi.rangeNewTier = null;
  } else {
    const snapshot = history[callfileUi.rangeIndex];
    const target = state.targetCounts[snapshot.tierKey] || 1;
    // Date is deliberately preserved (same date, same index) — this overwrites the existing
    // snapshot in place rather than creating a new dated entry.
    const updated = window.PPStats.buildSnapshot(snapshot.tierKey, Array.from(callfileUi.rangeEditChecked), target, snapshot.date);
    Storage.updatePPSnapshot(callfileUi.rangeKey, callfileUi.rangeIndex, updated);
  }
  callfileUi.rangeEditing = false;
  callfileUi.rangeEditChecked = null;
  render();
}

function renderRangeModal(state) {
  const modal = document.getElementById("range-modal");
  const store = callfileUi.rangeKey ? Storage.getLiveStore(state.callfile.stores, callfileUi.rangeKey) : null;
  if (!store) {
    modal.classList.add("hidden");
    return;
  }
  const history = store.ppHistory || [];
  document.getElementById("range-modal-store").textContent = store.name;
  const detail = document.getElementById("range-snapshot-detail");

  if (history.length === 0) {
    document.getElementById("range-snapshot-tabs").innerHTML = "";
    if (!callfileUi.rangeEditing) {
      detail.innerHTML =
        '<p class="range-snapshot-summary">No saved range yet for this store — pick a tier to start one.</p>' +
        '<div class="tier-tabs range-tier-picker">' +
          Object.keys(window.PP_LAYOUT).map(function (tierKey) {
            return '<button type="button" data-action="range-new-tier" data-tier="' + tierKey + '">' +
              escAttr(window.PP_LAYOUT[tierKey].label) + "</button>";
          }).join("") +
        "</div>";
    } else {
      const tierKey = callfileUi.rangeNewTier;
      const tier = window.PP_LAYOUT[tierKey];
      const target = state.targetCounts[tierKey] || 1;
      const stats = window.PPStats.tierStats(tier, target, callfileUi.rangeEditChecked);
      const unlockedTag = stats.unlocked ? ' <span class="core-status complete">Unlocked</span>' : "";
      detail.innerHTML =
        '<p class="range-snapshot-summary">' + escAttr(tier.label) + " &middot; " +
          stats.checkedCount + "/" + stats.target + " (" + stats.pct + "%)" + unlockedTag + "</p>" +
        '<div class="range-modal-actions">' +
          '<button type="button" class="btn secondary small" data-action="range-cancel">Cancel</button>' +
          '<button type="button" class="btn small" data-action="range-save">Save</button>' +
        "</div>" +
        window.PPSnapshot.sectionsHtml(tierKey, Array.from(callfileUi.rangeEditChecked), { editable: true });
    }
    modal.classList.remove("hidden");
    return;
  }

  const index = Math.min(callfileUi.rangeIndex, history.length - 1);
  const snapshot = history[index];
  const tier = window.PP_LAYOUT[snapshot.tierKey];

  document.getElementById("range-snapshot-tabs").innerHTML = history.map(function (snap, i) {
    return '<button type="button" class="' + (i === index ? "active" : "") + '" data-action="range-tab" data-index="' + i + '">' +
      formatDateShort(snap.date) + "</button>";
  }).join("");

  if (callfileUi.rangeEditing) {
    const target = state.targetCounts[snapshot.tierKey] || 1;
    const stats = window.PPStats.tierStats(tier, target, callfileUi.rangeEditChecked);
    const unlockedTag = stats.unlocked ? ' <span class="core-status complete">Unlocked</span>' : "";
    detail.innerHTML =
      '<p class="range-snapshot-summary">' + escAttr(tier.label) + " &middot; " +
        stats.checkedCount + "/" + stats.target + " (" + stats.pct + "%)" + unlockedTag + "</p>" +
      '<div class="range-modal-actions">' +
        '<button type="button" class="btn secondary small" data-action="range-cancel">Cancel</button>' +
        '<button type="button" class="btn small" data-action="range-save">Save</button>' +
      "</div>" +
      window.PPSnapshot.sectionsHtml(snapshot.tierKey, Array.from(callfileUi.rangeEditChecked), { editable: true });
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

// "All" is a UI-only pseudo-grade for the tab strip/store-list filtering below — it must never
// be added to window.CALLFILE_GRADES itself, since that array is also the whitelist for real
// store grade values (Storage.addStore/updateStore, the store-edit-modal <select>, home.js's
// per-grade breakdown).
const CALLFILE_TABS = ["All"].concat(window.CALLFILE_GRADES);

function gradeTabsHtml(state, byGrade) {
  return CALLFILE_TABS.map(function (g) {
    const active = state.callfileSession.activeGrade === g;
    return (
      '<button class="grade-tab grade-tab-' + g.toLowerCase() + (active ? " active" : "") + '" data-grade="' + g + '">' +
        g + ' <span class="grade-tab-count">(' + byGrade[g].length + ")</span>" +
      "</button>"
    );
  }).join("");
}

// Platinum (and All, since it can contain Platinum stores) needs a Partial container (a rep can
// log 1 of the 2 required visits and land mid-way); Gold/Silver never can, since storeStatus()
// only returns "amber" when visits-so-far is below cfg.visitsRequired but still >0 — and those
// grades require just 1 visit to go green.
function statusGroupsForGrade(grade) {
  const groups = [
    { status: "red", label: "Not visited" },
    { status: "amber", label: "Partial" },
    { status: "green", label: "On Track" }
  ];
  return (grade === "Platinum" || grade === "All") ? groups : groups.filter(function (g) { return g.status !== "amber"; });
}

function statusGroupHtml(label, status, entries) {
  if (!entries.length) return "";
  const rows = entries.map(function (e) { return storeRowHtml(e.key, e.store); }).join("");
  return (
    '<div class="status-group">' +
      '<div class="status-group-heading">' +
        '<span><span class="dot ' + status + '"></span>' + label + "</span>" +
        "<span>" + entries.length + "</span>" +
      "</div>" +
      '<div class="store-list">' + rows + "</div>" +
    "</div>"
  );
}

// A store just moved into "amber"/"green" by logging a visit should surface at the top of its
// new group rather than wherever the grade-wide nextVisitDate sort happened to leave it.
function byRecentVisit(a, b) {
  const al = a.store.lastVisitDate || "";
  const bl = b.store.lastVisitDate || "";
  if (al !== bl) return al > bl ? -1 : 1;
  return a.store.name.localeCompare(b.store.name);
}

function gradePanelHtml(grade, entries) {
  if (!entries.length) return "";
  const byStatus = { red: [], amber: [], green: [] };
  entries.forEach(function (e) { byStatus[storeStatus(e.store)].push(e); });
  byStatus.amber.sort(byRecentVisit);
  byStatus.green.sort(byRecentVisit);
  const groups = statusGroupsForGrade(grade).map(function (g) {
    return statusGroupHtml(g.label, g.status, byStatus[g.status]);
  }).join("");
  return (
    '<div class="grade-summary">' +
      '<span class="dot red"></span>' + byStatus.red.length + " not visited &nbsp; " +
      '<span class="dot amber"></span>' + byStatus.amber.length + " partial &nbsp; " +
      '<span class="dot green"></span>' + byStatus.green.length + " on track" +
    "</div>" +
    groups
  );
}

function openVisitModal(key) {
  callfileUi.logKey = key;
  render();
  const dateInput = document.getElementById("visit-date-input");
  dateInput.max = todayISO();
  dateInput.value = todayISO();
}

function closeVisitModal() {
  callfileUi.logKey = null;
  render();
}

function renderVisitModal(state) {
  const modal = document.getElementById("visit-modal");
  const store = callfileUi.logKey ? Storage.getLiveStore(state.callfile.stores, callfileUi.logKey) : null;
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
  callfileUi.cbKey = key;
  callfileUi.cbCounts = { direct: 0, influence: 0, pos: 0 };
  render();
}

function closeCbModal() {
  callfileUi.cbKey = null;
  callfileUi.cbCounts = null;
  render();
}

function cbInc(cat) {
  callfileUi.cbCounts[cat]++;
  renderCbModal(Storage.loadState());
}

function cbDec(cat) {
  callfileUi.cbCounts[cat] = Math.max(0, callfileUi.cbCounts[cat] - 1);
  renderCbModal(Storage.loadState());
}

function renderCbModal(state) {
  const modal = document.getElementById("cb-modal");
  const store = callfileUi.cbKey ? Storage.getLiveStore(state.callfile.stores, callfileUi.cbKey) : null;
  if (!store) {
    modal.classList.add("hidden");
    return;
  }
  document.getElementById("cb-modal-store").textContent =
    store.name + (store.postcode ? " · " + store.postcode : "");
  CB_CATEGORIES.forEach(function (cat) {
    document.getElementById("cb-qty-" + cat).textContent = callfileUi.cbCounts[cat];
  });
  modal.classList.remove("hidden");
}

function openAddStoreModal() {
  callfileUi.editKey = "__new__";
  render();
}

function openEditStoreModal(key) {
  callfileUi.editKey = key;
  render();
}

function closeStoreModal() {
  callfileUi.editKey = null;
  render();
}

function renderStoreModal(state) {
  const modal = document.getElementById("store-modal");
  if (!callfileUi.editKey) {
    modal.classList.add("hidden");
    return;
  }
  const isNew = callfileUi.editKey === "__new__";
  const store = isNew ? null : Storage.getLiveStore(state.callfile.stores, callfileUi.editKey);
  if (!isNew && !store) {
    // Store was deleted/renamed elsewhere while this modal was open — close gracefully.
    modal.classList.add("hidden");
    return;
  }

  document.getElementById("store-modal-title").textContent = isNew ? "Add store" : "Edit store";
  document.getElementById("store-name-input").value = store ? store.name : "";
  document.getElementById("store-postcode-input").value = store ? store.postcode : "";

  const gradeSelect = document.getElementById("store-grade-input");
  gradeSelect.innerHTML = window.CALLFILE_GRADES.map(function (g) {
    return '<option value="' + g + '"' + (store && store.grade === g ? " selected" : "") + ">" + g + "</option>";
  }).join("");

  document.getElementById("store-reset-visits-btn").classList.toggle("hidden", isNew);
  document.getElementById("store-delete-btn").classList.toggle("hidden", isNew);

  modal.classList.remove("hidden");
}

function render() {
  const state = Storage.loadState();
  const cf = state.callfile;
  const storeCount = Storage.liveStoreKeys(cf.stores).length;

  const metaParts = [];
  if (cf.fileName) metaParts.push(storeCount + " stores loaded from " + cf.fileName);
  if (cf.secondaryFileName) metaParts.push("+ secondary territory from " + cf.secondaryFileName);
  document.getElementById("callfile-meta").textContent = metaParts.length
    ? metaParts.join(" ")
    : "No call file uploaded yet.";

  const query = (document.getElementById("callfile-search").value || "").trim().toLowerCase();

  const byGrade = { All: [] };
  window.CALLFILE_GRADES.forEach(function (g) { byGrade[g] = []; });

  Storage.liveStoreKeys(cf.stores).forEach(function (key) {
    const store = cf.stores[key];
    if (query) {
      const haystack = (store.name + " " + store.postcode).toLowerCase();
      if (haystack.indexOf(query) === -1) return;
    }
    const entry = { key: key, store: store };
    if (byGrade[store.grade]) byGrade[store.grade].push(entry);
    byGrade.All.push(entry);
  });

  CALLFILE_TABS.forEach(function (g) {
    byGrade[g].sort(function (a, b) {
      const an = a.store.nextVisitDate || "0000-00-00";
      const bn = b.store.nextVisitDate || "0000-00-00";
      if (an !== bn) return an < bn ? -1 : 1;
      return a.store.name.localeCompare(b.store.name);
    });
  });

  document.getElementById("grade-tabs").innerHTML = gradeTabsHtml(state, byGrade);

  const activeGrade = state.callfileSession.activeGrade;
  const noMatchLabel = activeGrade === "All" ? "No stores" : "No " + activeGrade + " stores";
  document.getElementById("callfile-sections").innerHTML = gradePanelHtml(activeGrade, byGrade[activeGrade]) ||
    '<p class="empty-note">' + (storeCount ? noMatchLabel + " match your search." : "Upload a call file (.xls) to get started.") + "</p>";

  renderVisitModal(state);
  renderRangeModal(state);
  renderStoreModal(state);
  renderCbModal(state);
}

document.addEventListener("DOMContentLoaded", function () {
  render();

  // Deep link from Map's "couldn't be placed" notice (?edit=<storeKey>) straight into this
  // store's edit modal, so a rep can jump from "which store failed to geocode" to fixing its
  // postcode in one tap instead of hunting for it in the list.
  const editKeyParam = new URLSearchParams(location.search).get("edit");
  if (editKeyParam) {
    const linkedStore = Storage.getLiveStore(Storage.loadState().callfile.stores, editKeyParam);
    if (linkedStore) {
      if (window.CALLFILE_GRADES.indexOf(linkedStore.grade) !== -1) Storage.setCallfileGrade(linkedStore.grade);
      openEditStoreModal(editKeyParam);
    }
  }

  document.getElementById("callfile-input").addEventListener("change", function (e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const parsed = parseWorkbook(workbook);
        if (!parsed.rows.length) {
          alert("No usable rows found — expected OUTLETNAME / OUTLETGRADE / POSTCODE columns.");
          return;
        }
        const result = Storage.importCallfile(file.name, parsed.rows);
        render();
        const notes = [];
        if (parsed.skipped) notes.push(parsed.skipped + " row(s) skipped (missing name or unrecognized grade)");
        if (result.duplicateCount) notes.push(result.duplicateCount + " duplicate row(s) collapsed to one store each");
        if (notes.length) {
          const storeCount = Storage.liveStoreKeys(result.state.callfile.stores).length;
          alert("Loaded " + storeCount + " stores. " + notes.join("; ") + ".");
        }
      } catch (err) {
        alert("Could not read that file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  });

  // Additive upload for temporarily covering a colleague's territory — merged into the same
  // stores map (Storage.importSecondaryCallfile) rather than replacing the rep's own call file,
  // and tagged `secondary: true` so Dashboard's compliance panels exclude them while Call
  // File/Map/Partnership keep showing them normally. Always confirms via alert, unlike the
  // primary upload, so it's unambiguous the rows landed as a secondary territory.
  document.getElementById("callfile-secondary-input").addEventListener("change", function (e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const parsed = parseWorkbook(workbook);
        if (!parsed.rows.length) {
          alert("No usable rows found — expected OUTLETNAME / OUTLETGRADE / POSTCODE columns.");
          return;
        }
        const result = Storage.importSecondaryCallfile(file.name, parsed.rows);
        render();
        const notes = [];
        if (parsed.skipped) notes.push(parsed.skipped + " row(s) skipped (missing name or unrecognized grade)");
        if (result.duplicateCount) notes.push(result.duplicateCount + " duplicate row(s) collapsed to one store each");
        if (result.skippedPrimaryCollision) notes.push(result.skippedPrimaryCollision + " row(s) skipped (already in your primary call file)");
        const secondaryCount = Storage.liveStoreKeys(result.state.callfile.stores).filter(function (key) {
          return result.state.callfile.stores[key].secondary;
        }).length;
        alert("Loaded " + secondaryCount + " stores from secondary territory (" + file.name + ")." + (notes.length ? " " + notes.join("; ") + "." : ""));
      } catch (err) {
        alert("Could not read that file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  });

  document.getElementById("callfile-search").addEventListener("input", render);

  document.getElementById("grade-tabs").addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-grade]");
    if (!btn) return;
    Storage.setCallfileGrade(btn.dataset.grade);
    render();
  });

  document.getElementById("callfile-sections").addEventListener("click", function (e) {
    const logBtn = e.target.closest('button[data-action="log"]');
    if (logBtn) { openVisitModal(logBtn.dataset.key); return; }
    const rangeBtn = e.target.closest('button[data-action="range"]');
    if (rangeBtn) { openRangeModal(rangeBtn.dataset.key); return; }
    const cbBtn = e.target.closest('button[data-action="cb"]');
    if (cbBtn) { openCbModal(cbBtn.dataset.key); return; }
    const editBtn = e.target.closest('button[data-action="edit"]');
    if (editBtn) openEditStoreModal(editBtn.dataset.key);
  });

  document.getElementById("add-store-btn").addEventListener("click", openAddStoreModal);

  document.getElementById("reset-all-visits-btn").addEventListener("click", function () {
    const count = Storage.liveStoreKeys(Storage.loadState().callfile.stores).length;
    if (!count) return;
    if (!confirm("Reset visit history for all " + count + " stores? This can't be undone.")) return;
    Storage.resetAllVisits();
    render();
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
    const store = callfileUi.rangeKey ? Storage.getLiveStore(state.callfile.stores, callfileUi.rangeKey) : null;
    if (!store) return;
    const history = store.ppHistory || [];

    const tierBtn = e.target.closest('button[data-action="range-new-tier"]');
    if (tierBtn) { startRangeNewTier(tierBtn.dataset.tier); return; }

    const editBtn = e.target.closest('button[data-action="range-edit"]');
    if (editBtn) { startRangeEditExisting(history[Math.min(callfileUi.rangeIndex, history.length - 1)]); return; }

    const cancelBtn = e.target.closest('button[data-action="range-cancel"]');
    if (cancelBtn) { cancelRangeEdit(history.length); return; }

    const saveBtn = e.target.closest('button[data-action="range-save"]');
    if (saveBtn) { saveRangeEdit(store, history); return; }

    const row = e.target.closest('.tick-row[data-action="range-toggle"]');
    if (row) { e.preventDefault(); toggleRangeChecked(row.dataset.id); }
  });

  document.getElementById("visit-modal-close").addEventListener("click", closeVisitModal);
  document.getElementById("visit-cancel-btn").addEventListener("click", closeVisitModal);

  document.getElementById("visit-modal").addEventListener("click", function (e) {
    if (e.target.id === "visit-modal") closeVisitModal();
  });

  document.getElementById("visit-confirm-btn").addEventListener("click", function () {
    const key = callfileUi.logKey;
    if (!key) return;
    const dateVal = document.getElementById("visit-date-input").value;
    if (!dateVal) { alert("Pick a date first."); return; }
    const state = Storage.loadState();
    const store = Storage.getLiveStore(state.callfile.stores, key);
    if (!store) { closeVisitModal(); return; }
    const cfg = window.CALLFILE_GRADE_CONFIG[store.grade] || { cadenceWeeks: 4 };
    Storage.logVisit(key, dateVal, cfg.cadenceWeeks);
    callfileUi.logKey = null;
    render();
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
    const key = callfileUi.cbKey;
    if (!key) return;
    Storage.logCycleBrief(key, todayISO(), callfileUi.cbCounts);
    callfileUi.cbKey = null;
    callfileUi.cbCounts = null;
    render();
  });

  document.getElementById("store-modal-close").addEventListener("click", closeStoreModal);
  document.getElementById("store-cancel-btn").addEventListener("click", closeStoreModal);

  document.getElementById("store-modal").addEventListener("click", function (e) {
    if (e.target.id === "store-modal") closeStoreModal();
  });

  document.getElementById("store-save-btn").addEventListener("click", function () {
    const key = callfileUi.editKey;
    if (!key) return;
    const name = document.getElementById("store-name-input").value;
    const postcode = document.getElementById("store-postcode-input").value;
    const grade = document.getElementById("store-grade-input").value;

    const result = key === "__new__"
      ? Storage.addStore(name, grade, postcode)
      : Storage.updateStore(key, name, grade, postcode);

    if (result.error) { alert(result.error); return; }

    callfileUi.editKey = null;
    render();
  });

  document.getElementById("store-reset-visits-btn").addEventListener("click", function () {
    const key = callfileUi.editKey;
    if (!key || key === "__new__") return;
    const state = Storage.loadState();
    const store = Storage.getLiveStore(state.callfile.stores, key);
    const name = store ? store.name : "this store";
    if (!confirm("Reset visit history for " + name + "? This can't be undone.")) return;
    Storage.resetVisits(key);
    callfileUi.editKey = null;
    render();
  });

  document.getElementById("store-delete-btn").addEventListener("click", function () {
    const key = callfileUi.editKey;
    if (!key || key === "__new__") return;
    const state = Storage.loadState();
    const store = Storage.getLiveStore(state.callfile.stores, key);
    const name = store ? store.name : "this store";
    if (!confirm("Delete " + name + "? This removes its visit history and can't be undone.")) return;
    Storage.deleteStore(key);
    callfileUi.editKey = null;
    render();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && callfileUi.logKey) closeVisitModal();
    if (e.key === "Escape" && callfileUi.rangeKey) closeRangeModal();
    if (e.key === "Escape" && callfileUi.editKey) closeStoreModal();
    if (e.key === "Escape" && callfileUi.cbKey) closeCbModal();
  });
});
