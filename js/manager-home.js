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

// How far each panel's back-arrow can page. WEEKS_BACK matches js/home.js's own rep-dashboard cap
// (~3 months of weeks). MONTHS_BACK is a literal 3 months. QUARTERS_BACK is 1 because a quarter
// already *is* 3 months, so "up to 3 months back" only ever allows a single step there.
const WEEKS_BACK = 12;
const MONTHS_BACK = 3;
const QUARTERS_BACK = 1;
const NAV_CAPS = { weeksAgo: WEEKS_BACK, monthsAgo: MONTHS_BACK, quartersAgo: QUARTERS_BACK };

// Session-only UI state (not persisted): which territory's detail section is expanded, if any,
// which letter the grid is currently filtered to, and each rep's current This Week/This
// Month/Cycle Brief paging position (keyed by uid, since the detail view can show several reps'
// panels at once and each pages independently).
const managerUi = { openTerritory: null, letterFilter: ALL_LETTERS, repNav: {} };

function getRepNav(uid) {
  if (!managerUi.repNav[uid]) managerUi.repNav[uid] = { weeksAgo: 0, monthsAgo: 0, quartersAgo: 0 };
  return managerUi.repNav[uid];
}

// Mirrors the `.week-nav`/`.week-nav-btn`/`.week-range` markup index.html already uses for the
// rep dashboard's week prev/next arrows — those classes are already generic in css/styles.css, so
// this reuses them verbatim for This Week, This Month, and Cycle Brief alike with no new CSS.
function navArrowsHtml(uid, field, current, label) {
  const cap = NAV_CAPS[field];
  return (
    '<div class="week-nav">' +
      '<button type="button" class="week-nav-btn" data-nav="' + field + '" data-dir="prev" data-uid="' + escAttr(uid) + '"' +
        (current >= cap ? " disabled" : "") + ' aria-label="Previous period">‹</button>' +
      '<span class="week-range">' + escAttr(label) + "</span>" +
      '<button type="button" class="week-nav-btn" data-nav="' + field + '" data-dir="next" data-uid="' + escAttr(uid) + '"' +
        (current === 0 ? " disabled" : "") + ' aria-label="Next period">›</button>' +
    "</div>"
  );
}

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
// rep's own dashboard uses (window.HomeStats, js/home-stats.js), each independently pageable up to
// ~3 months back via getRepNav(rep.uid) + navArrowsHtml() — see the click handler in
// DOMContentLoaded below for how the paging state actually changes.
function repStatPanelsHtml(rep) {
  const stores = (rep.callfile && rep.callfile.stores) || {};
  const nav = getRepNav(rep.uid);
  const wk = window.HomeStats.weekStats(stores, nav.weeksAgo);
  const mo = window.HomeStats.monthCoverageStats(stores, nav.monthsAgo);
  const cb = window.HomeStats.cycleBriefStats(stores, nav.quartersAgo);
  return (
    '<div class="dash-stat-grid rep-stat-grid">' +
      '<section class="week-panel" aria-label="This week’s visit activity">' +
        '<div class="week-panel-head">' +
          '<div class="panel-head-title"><h3>This Week</h3></div>' +
          navArrowsHtml(rep.uid, "weeksAgo", nav.weeksAgo, window.HomeStats.formatWeekRange(wk.monday, wk.friday)) +
        "</div>" +
        window.HomeStats.weekPanelBodyHtml(wk) +
      "</section>" +
      '<section class="month-panel" aria-label="Call file coverage">' +
        '<div class="month-panel-head">' +
          '<div class="panel-head-title"><h3>This Month</h3></div>' +
          navArrowsHtml(rep.uid, "monthsAgo", nav.monthsAgo, window.HomeStats.monthLabel(mo.monthKey)) +
        "</div>" +
        window.HomeStats.monthPanelBodyHtml(mo) +
      "</section>" +
      '<section class="week-panel cycle-panel" aria-label="Cycle Brief activity">' +
        '<div class="week-panel-head">' +
          '<div class="panel-head-title"><h3>Cycle Brief</h3></div>' +
          navArrowsHtml(rep.uid, "quartersAgo", nav.quartersAgo, window.HomeStats.quarterLabel(cb.qKey)) +
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
        '<div class="rep-group-head">' + escAttr(window.ManagerData.displayName(rep)) + "</div>" +
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

  // Delegated on the container since territory-detail-body's innerHTML is fully rebuilt every
  // render (same pattern as the territory-grid listener above) — one listener survives that.
  document.getElementById("territory-detail-body").addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-nav]");
    if (!btn) return;
    const nav = getRepNav(btn.dataset.uid);
    const field = btn.dataset.nav;
    const cap = NAV_CAPS[field];
    nav[field] = btn.dataset.dir === "prev" ? Math.min(cap, nav[field] + 1) : Math.max(0, nav[field] - 1);
    render();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && managerUi.openTerritory) {
      managerUi.openTerritory = null;
      render();
    }
  });
});
