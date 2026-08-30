// Manager Dashboard page logic: groups every rep (window.ManagerData.reps, populated by
// js/manager-cloud.js) by their self-reported repTerritory code into territory cards, and shows a
// read-only per-territory detail view (reps + their stores' visit-compliance status) when a card
// is tapped. Status colour reuses storeStatus()/statusLabel() from js/callfile-status.js — the
// same function Call File and the rep Map already share — so the compliance rule can't drift
// between the rep-facing pages and this manager view.

// Fixed A-E set enforced by Call File's "Set Territory" validation regex (js/callfile.js,
// /^[A-E]\d{3}$/i) — always shown as dropdown options regardless of which letters current reps
// actually have, so a manager can pre-select a letter before any rep has claimed it.
const TERRITORY_LETTERS = ["A", "B", "C", "D", "E"];
const ALL_LETTERS = "__all__";

// Session-only UI state (not persisted): which territory's detail section is expanded, if any,
// and which letter the grid is currently filtered to.
const managerUi = { openTerritory: null, letterFilter: ALL_LETTERS };

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

// Only reps who've actually set a territory code via Call File's "Set Territory" button get a
// card — a rep with no code yet shouldn't produce a tile at all (see manager-dashboard's empty
// states below for what shows instead).
function groupByTerritory(reps) {
  const groups = {};
  reps.forEach(function (rep) {
    if (!rep.repTerritory) return;
    const key = rep.repTerritory;
    if (!groups[key]) groups[key] = [];
    groups[key].push(rep);
  });
  return groups;
}

function repStoreEntries(rep) {
  const stores = (rep.callfile && rep.callfile.stores) || {};
  return Object.keys(stores).map(function (key) { return { key: key, store: stores[key] }; });
}

function territoryStatusCounts(reps) {
  const counts = { red: 0, amber: 0, green: 0 };
  reps.forEach(function (rep) {
    repStoreEntries(rep).forEach(function (e) { counts[storeStatus(e.store)]++; });
  });
  return counts;
}

function territoryCardHtml(code, reps, isActive) {
  const counts = territoryStatusCounts(reps);
  const storeCount = counts.red + counts.amber + counts.green;
  return (
    '<button type="button" class="territory-card' + (isActive ? " active" : "") + '" data-action="open-territory" data-code="' + escAttr(code) + '">' +
      '<div class="territory-card-code">' + escAttr(code) + "</div>" +
      '<div class="territory-card-sub">' + reps.length + " rep" + (reps.length === 1 ? "" : "s") +
        " &middot; " + storeCount + " store" + (storeCount === 1 ? "" : "s") + "</div>" +
      '<div class="territory-card-counts">' +
        '<span class="territory-count territory-count-red"><span class="dot red"></span>' + counts.red + "</span>" +
        '<span class="territory-count territory-count-amber"><span class="dot amber"></span>' + counts.amber + "</span>" +
        '<span class="territory-count territory-count-green"><span class="dot green"></span>' + counts.green + "</span>" +
      "</div>" +
    "</button>"
  );
}

// This Week / This Month / Cycle Brief, reusing the exact same stat math and HTML builders the
// rep's own dashboard uses (window.HomeStats, js/home-stats.js) — a fixed "right now" snapshot,
// deliberately without the rep dashboard's week prev/next paging or click-a-day popup (manager
// view is read-only overview, not an interactive rep tool). weekStats is always called with
// weeksAgo=0 for exactly that reason.
function repStatPanelsHtml(rep) {
  const stores = (rep.callfile && rep.callfile.stores) || {};
  const wk = window.HomeStats.weekStats(stores, 0);
  const mo = window.HomeStats.monthCoverageStats(stores);
  const cb = window.HomeStats.cycleBriefStats(stores);
  return (
    '<div class="dash-stat-grid rep-stat-grid">' +
      '<section class="week-panel" aria-label="This week’s visit activity">' +
        '<div class="week-panel-head">' +
          '<div class="panel-head-title"><h3>This Week</h3></div>' +
          '<span class="week-range">' + escAttr(window.HomeStats.formatWeekRange(wk.monday, wk.friday)) + "</span>" +
        "</div>" +
        window.HomeStats.weekPanelBodyHtml(wk) +
      "</section>" +
      '<section class="month-panel" aria-label="Call file coverage this month">' +
        '<div class="month-panel-head">' +
          '<div class="panel-head-title"><h3>This Month</h3></div>' +
          '<span class="month-sub">Call File coverage</span>' +
        "</div>" +
        window.HomeStats.monthPanelBodyHtml(mo) +
      "</section>" +
      '<section class="week-panel cycle-panel" aria-label="Cycle Brief activity this quarter">' +
        '<div class="week-panel-head">' +
          '<div class="panel-head-title"><h3>Cycle Brief</h3></div>' +
          '<span class="month-sub">This quarter</span>' +
        "</div>" +
        window.HomeStats.cycleBriefBodyHtml(cb) +
      "</section>" +
    "</div>"
  );
}

function repStoreRowHtml(entry) {
  const status = storeStatus(entry.store);
  return (
    '<div class="store-card status-' + status + '">' +
      '<div class="store-row-top">' +
        '<span class="store-name">' + escAttr(entry.store.name) + "</span>" +
        '<span class="status-pill">' + statusLabel(status) + "</span>" +
      "</div>" +
      '<div class="store-row-bottom">' +
        '<span class="store-meta">' +
          (entry.store.postcode ? escAttr(entry.store.postcode) + " &middot; " : "") +
          "Last " + formatDateShort(entry.store.lastVisitDate) + " &middot; Next " + formatDateShort(entry.store.nextVisitDate) +
        "</span>" +
      "</div>" +
    "</div>"
  );
}

function territoryDetailHtml(reps) {
  return reps.map(function (rep) {
    const entries = repStoreEntries(rep).sort(function (a, b) {
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    });
    const storesHtml = entries.length
      ? '<div class="rep-store-list">' + entries.map(repStoreRowHtml).join("") + "</div>"
      : '<p class="manager-empty-note">No stores in this rep’s call file.</p>';
    return (
      '<div class="rep-group">' +
        '<div class="rep-group-head">' + escAttr(rep.repEmail || rep.uid) + "</div>" +
        repStatPanelsHtml(rep) +
        '<div class="rep-store-heading">Stores</div>' +
        storesHtml +
      "</div>"
    );
  }).join("");
}

function renderTerritoryDetail(groups) {
  const section = document.getElementById("territory-detail");
  const code = managerUi.openTerritory;
  if (!code || !groups[code]) {
    section.classList.add("hidden");
    return;
  }
  document.getElementById("territory-detail-title").textContent = code;
  document.getElementById("territory-detail-map-link").href = "manager-map.html?territory=" + encodeURIComponent(code);
  document.getElementById("territory-detail-body").innerHTML = territoryDetailHtml(groups[code]);
  section.classList.remove("hidden");
  section.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Options never change (fixed A-E list), so this only needs to run once on page load, not on
// every render() — unlike the Map page's dynamic populateTerritoryFilter(), which rebuilds its
// list from whatever codes currently exist.
function populateLetterFilter(selected) {
  const select = document.getElementById("territory-letter-filter");
  select.innerHTML = ['<option value="' + ALL_LETTERS + '">All letters</option>']
    .concat(TERRITORY_LETTERS.map(function (l) { return '<option value="' + l + '">' + l + "</option>"; }))
    .join("");
  select.value = selected;
}

function render() {
  const reps = window.ManagerData.reps;
  const grid = document.getElementById("territory-grid");
  const empty = document.getElementById("manager-empty");

  if (reps === null) {
    grid.innerHTML = "";
    empty.textContent = "Loading territories…";
    empty.classList.remove("hidden");
    renderTerritoryDetail({});
    return;
  }

  if (!reps.length) {
    grid.innerHTML = "";
    empty.textContent = "No rep accounts have synced any data yet.";
    empty.classList.remove("hidden");
    renderTerritoryDetail({});
    return;
  }

  const groups = groupByTerritory(reps);
  const allCodes = Object.keys(groups).sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });

  if (!allCodes.length) {
    grid.innerHTML = "";
    empty.textContent = "No reps have an assigned territory yet — set one via Call File's “Set Territory” button.";
    empty.classList.remove("hidden");
    renderTerritoryDetail({});
    return;
  }

  const codes = managerUi.letterFilter === ALL_LETTERS
    ? allCodes
    : allCodes.filter(function (c) { return c.charAt(0).toUpperCase() === managerUi.letterFilter; });

  if (!codes.length) {
    grid.innerHTML = "";
    empty.textContent = "No reps assigned to territory letter " + managerUi.letterFilter + " yet.";
    empty.classList.remove("hidden");
    renderTerritoryDetail({});
    return;
  }

  empty.classList.add("hidden");
  grid.innerHTML = codes.map(function (code) {
    return territoryCardHtml(code, groups[code], code === managerUi.openTerritory);
  }).join("");
  renderTerritoryDetail(groups);
}

document.addEventListener("DOMContentLoaded", function () {
  populateLetterFilter(managerUi.letterFilter);
  render();

  document.getElementById("territory-letter-filter").addEventListener("change", function (e) {
    managerUi.letterFilter = e.target.value;
    // An open detail card whose code no longer matches the new filter shouldn't stay stranded open.
    managerUi.openTerritory = null;
    render();
  });

  document.getElementById("territory-grid").addEventListener("click", function (e) {
    const btn = e.target.closest('button[data-action="open-territory"]');
    if (!btn) return;
    // Clicking the already-open territory's card collapses it — standard expand-in-place toggle,
    // not just a one-way "open via card, close via ×" popup flow.
    managerUi.openTerritory = managerUi.openTerritory === btn.dataset.code ? null : btn.dataset.code;
    render();
  });

  document.getElementById("territory-detail-close").addEventListener("click", function () {
    managerUi.openTerritory = null;
    render();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && managerUi.openTerritory) {
      managerUi.openTerritory = null;
      render();
    }
  });
});
