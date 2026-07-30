// Call File page logic: upload an .xls/.xlsx/.csv export, keep only OUTLETNAME / OUTLETGRADE /
// POSTCODE per row, and track visit compliance per store for the current calendar month.
//
// Status colour is derived at render time from today's date + the store's visit history, not
// stored — so a new month automatically starts every store back at red with no reset step:
//   - no visit yet this month        -> red
//   - Silver/Gold, 1+ visits         -> green
//   - Platinum, 1 visit              -> amber
//   - Platinum, 2+ visits            -> green

function escAttr(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML.replace(/"/g, "&quot;");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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

function storeStatus(store) {
  const cfg = window.CALLFILE_GRADE_CONFIG[store.grade] || { visitsRequired: 1 };
  const monthKey = todayISO().slice(0, 7);
  const visitsThisMonth = store.visits.filter(function (d) { return d.slice(0, 7) === monthKey; }).length;
  if (visitsThisMonth <= 0) return "red";
  if (visitsThisMonth < cfg.visitsRequired) return "amber";
  return "green";
}

function statusLabel(status) {
  if (status === "red") return "Not visited this month";
  if (status === "amber") return "1 visit logged";
  return "On track";
}

function storeRowHtml(key, store) {
  const status = storeStatus(store);
  return (
    '<div class="store-card status-' + status + '">' +
      '<div class="store-info">' +
        '<div class="store-name">' + escAttr(store.name) + "</div>" +
        '<div class="store-postcode">' + escAttr(store.postcode) + "</div>" +
      "</div>" +
      '<div class="store-dates">' +
        "<div><span>Last visit</span><strong>" + formatDate(store.lastVisitDate) + "</strong></div>" +
        "<div><span>Next visit</span><strong>" + formatDate(store.nextVisitDate) + "</strong></div>" +
      "</div>" +
      '<div class="store-actions">' +
        '<span class="status-pill">' + statusLabel(status) + "</span>" +
        '<button class="btn small" data-action="log" data-key="' + escAttr(key) + '">Log visit</button>' +
      "</div>" +
    "</div>"
  );
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

function gradePanelHtml(entries) {
  if (!entries.length) return "";
  const counts = { red: 0, amber: 0, green: 0 };
  entries.forEach(function (e) { counts[storeStatus(e.store)]++; });
  const rows = entries.map(function (e) { return storeRowHtml(e.key, e.store); }).join("");
  return (
    '<div class="grade-summary">' +
      '<span class="dot red"></span>' + counts.red + " not visited &nbsp; " +
      '<span class="dot amber"></span>' + counts.amber + " partial &nbsp; " +
      '<span class="dot green"></span>' + counts.green + " on track" +
    "</div>" +
    '<div class="store-list">' + rows + "</div>"
  );
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
  document.getElementById("callfile-sections").innerHTML = gradePanelHtml(byGrade[activeGrade]) ||
    '<p class="empty-note">' + (storeCount ? "No " + activeGrade + " stores match your search." : "Upload a call file (.xls) to get started.") + "</p>";
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
    const btn = e.target.closest('button[data-action="log"]');
    if (!btn) return;
    const key = btn.dataset.key;
    const state = Storage.loadState();
    const store = state.callfile.stores[key];
    if (!store) return;
    const cfg = window.CALLFILE_GRADE_CONFIG[store.grade] || { cadenceWeeks: 4 };
    Storage.logVisit(key, todayISO(), cfg.cadenceWeeks);
    render();
  });
});
