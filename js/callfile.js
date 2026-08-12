// Call File page logic: upload an .xls/.xlsx/.csv export, keep only OUTLETNAME / OUTLETGRADE /
// POSTCODE per row, and track visit compliance per store for the current calendar month.
//
// storeStatus()/statusLabel()/todayISO() live in js/callfile-status.js (shared with js/map.js).

// Session-only UI state (not persisted): which store's "Log a visit" date-picker modal is open,
// which store's saved-range review modal is open (rangeIndex picks which of the up to 2 saved
// snapshots is shown), and the add/edit-store modal — null when closed, "__new__" when adding a
// new store, or an existing store's key when editing it.
const callfileUi = { logKey: null, rangeKey: null, rangeIndex: 0, editKey: null };

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
  const history = store.ppHistory || [];
  const rangeBtn = history.length > 0
    ? '<button class="btn small secondary" data-action="range" data-key="' + escAttr(key) + '">Range</button>'
    : "";
  return (
    '<div class="store-card status-' + status + '">' +
      '<div class="store-row-top">' +
        '<span class="store-name">' + escAttr(store.name) + "</span>" +
        '<span class="status-pill">' + statusLabel(status) + "</span>" +
      "</div>" +
      '<div class="store-row-bottom">' +
        '<span class="store-meta">' + meta + "</span>" +
        '<div class="store-row-actions">' +
          rangeBtn +
          '<button class="btn small secondary" data-action="edit" data-key="' + escAttr(key) + '">Edit</button>' +
          '<button class="btn small" data-action="log" data-key="' + escAttr(key) + '">Log visit</button>' +
        "</div>" +
      "</div>" +
    "</div>"
  );
}

// Read-only equivalent of partnership.js's tileHtml — no click handler, no zoom/jump behavior,
// just a fixed record of what was ticked at the time the snapshot was saved.
function snapshotTileHtml(id, checked) {
  const product = window.CATALOG[id];
  if (!product) return "";
  return (
    '<div class="tile pp-tile">' +
      '<img src="' + product.image + '" alt="' + escAttr(product.name) + '" />' +
      '<div class="tick-row' + (checked ? " checked" : "") + '"><span>' + (checked ? "✓ In stock" : "Not stocked") + "</span></div>" +
    "</div>"
  );
}

// Renders a snapshot's sections in the same shape as layout-pp.js's tier definition, but always
// the fixed `items` list per section — no "jump to Core" promotion, since that's a live-editing
// display feature (see partnership.js) that a frozen historical snapshot doesn't need.
function snapshotSectionsHtml(tierKey, checkedIds) {
  const tier = window.PP_LAYOUT[tierKey];
  if (!tier) return "";
  const checkedSet = new Set(checkedIds);
  return tier.sections.map(function (section) {
    const tiles = section.items.map(function (id) { return snapshotTileHtml(id, checkedSet.has(id)); }).join("");
    return '<section class="category"><h3>' + escAttr(section.label) + '</h3><div class="tile-grid">' + tiles + "</div></section>";
  }).join("");
}

function openRangeModal(key) {
  callfileUi.rangeKey = key;
  callfileUi.rangeIndex = 0;
  render();
}

function closeRangeModal() {
  callfileUi.rangeKey = null;
  render();
}

function renderRangeModal(state) {
  const modal = document.getElementById("range-modal");
  const store = callfileUi.rangeKey ? state.callfile.stores[callfileUi.rangeKey] : null;
  const history = store ? (store.ppHistory || []) : [];
  if (!store || history.length === 0) {
    modal.classList.add("hidden");
    return;
  }
  const index = Math.min(callfileUi.rangeIndex, history.length - 1);
  const snapshot = history[index];
  const tier = window.PP_LAYOUT[snapshot.tierKey];

  document.getElementById("range-modal-store").textContent = store.name;

  document.getElementById("range-snapshot-tabs").innerHTML = history.map(function (snap, i) {
    return '<button type="button" class="' + (i === index ? "active" : "") + '" data-action="range-tab" data-index="' + i + '">' +
      formatDateShort(snap.date) + "</button>";
  }).join("");

  const unlockedTag = snapshot.unlocked ? ' <span class="core-status complete">Unlocked</span>' : "";
  document.getElementById("range-snapshot-detail").innerHTML =
    '<p class="range-snapshot-summary">' + escAttr(tier.label) + " &middot; " + formatDate(snapshot.date) + " &middot; " +
      snapshot.checkedCount + "/" + snapshot.target + " (" + snapshot.pct + "%)" + unlockedTag +
    "</p>" +
    snapshotSectionsHtml(snapshot.tierKey, snapshot.checkedIds);

  modal.classList.remove("hidden");
}

function gradeTabsHtml(state, byGrade) {
  return window.CALLFILE_GRADES.map(function (g) {
    const active = state.callfileSession.activeGrade === g;
    return (
      '<button class="grade-tab grade-tab-' + g.toLowerCase() + (active ? " active" : "") + '" data-grade="' + g + '">' +
        g + ' <span class="grade-tab-count">(' + byGrade[g].length + ")</span>" +
      "</button>"
    );
  }).join("");
}

// Platinum needs a Partial container (a rep can log 1 of the 2 required visits and land
// mid-way); Gold/Silver never can, since storeStatus() only returns "amber" when visits-so-far
// is below cfg.visitsRequired but still >0 — and those grades require just 1 visit to go green.
function statusGroupsForGrade(grade) {
  const groups = [
    { status: "red", label: "Not visited" },
    { status: "amber", label: "Partial" },
    { status: "green", label: "On Track" }
  ];
  return grade === "Platinum" ? groups : groups.filter(function (g) { return g.status !== "amber"; });
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
  const store = callfileUi.logKey ? state.callfile.stores[callfileUi.logKey] : null;
  if (!store) {
    modal.classList.add("hidden");
    return;
  }
  document.getElementById("visit-modal-store").textContent =
    store.name + (store.postcode ? " · " + store.postcode : "");
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
  const store = isNew ? null : state.callfile.stores[callfileUi.editKey];
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
  const storeCount = Object.keys(cf.stores).length;

  document.getElementById("callfile-meta").textContent = cf.fileName
    ? storeCount + " stores loaded from " + cf.fileName
    : "No call file uploaded yet.";

  const query = (document.getElementById("callfile-search").value || "").trim().toLowerCase();

  const byGrade = {};
  window.CALLFILE_GRADES.forEach(function (g) { byGrade[g] = []; });

  Object.keys(cf.stores).forEach(function (key) {
    const store = cf.stores[key];
    if (query) {
      const haystack = (store.name + " " + store.postcode).toLowerCase();
      if (haystack.indexOf(query) === -1) return;
    }
    if (byGrade[store.grade]) byGrade[store.grade].push({ key: key, store: store });
  });

  window.CALLFILE_GRADES.forEach(function (g) {
    byGrade[g].sort(function (a, b) {
      const an = a.store.nextVisitDate || "0000-00-00";
      const bn = b.store.nextVisitDate || "0000-00-00";
      if (an !== bn) return an < bn ? -1 : 1;
      return a.store.name.localeCompare(b.store.name);
    });
  });

  document.getElementById("grade-tabs").innerHTML = gradeTabsHtml(state, byGrade);

  const activeGrade = state.callfileSession.activeGrade;
  document.getElementById("callfile-sections").innerHTML = gradePanelHtml(activeGrade, byGrade[activeGrade]) ||
    '<p class="empty-note">' + (storeCount ? "No " + activeGrade + " stores match your search." : "Upload a call file (.xls) to get started.") + "</p>";

  renderVisitModal(state);
  renderRangeModal(state);
  renderStoreModal(state);
}

document.addEventListener("DOMContentLoaded", function () {
  render();

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
          const storeCount = Object.keys(result.state.callfile.stores).length;
          alert("Loaded " + storeCount + " stores. " + notes.join("; ") + ".");
        }
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
    const editBtn = e.target.closest('button[data-action="edit"]');
    if (editBtn) openEditStoreModal(editBtn.dataset.key);
  });

  document.getElementById("add-store-btn").addEventListener("click", openAddStoreModal);

  document.getElementById("reset-all-visits-btn").addEventListener("click", function () {
    const count = Object.keys(Storage.loadState().callfile.stores).length;
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
    callfileUi.rangeIndex = parseInt(btn.dataset.index, 10) || 0;
    render();
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
    const store = state.callfile.stores[key];
    if (!store) { closeVisitModal(); return; }
    const cfg = window.CALLFILE_GRADE_CONFIG[store.grade] || { cadenceWeeks: 4 };
    Storage.logVisit(key, dateVal, cfg.cadenceWeeks);
    callfileUi.logKey = null;
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
    const store = state.callfile.stores[key];
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
    const store = state.callfile.stores[key];
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
  });
});
