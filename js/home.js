// Home dashboard: aggregates the call file's visit history into a "this week" activity view
// and a "this month" compliance view. Purely derived from Storage.loadState().callfile — no new
// persisted state, and it never mutates the call file.
//
// The actual stat math (weekStats/monthCoverageStats/cycleBriefStats and their HTML builders) now
// lives in js/home-stats.js (window.HomeStats), shared with the manager dashboard's per-territory
// detail view — see that file's header comment. This file keeps only what's rep-page-specific:
// the week prev/next navigation state, the click-a-day popup, and the DOM wiring.

const WEEKS_BACK = 12; // how far the back arrow can go, ~3 months

// Ephemeral UI-only selection (which past week the "This Week" panel shows) — never persisted,
// so the dashboard always opens back on the current week on a fresh load, same as every other
// value in this file is purely derived from Storage.loadState().callfile.
let selectedWeeksAgo = 0;

function escAttr(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML.replace(/"/g, "&quot;");
}

// Ephemeral UI-only selection (which day's popup, if any, is open) — same "never persisted"
// treatment as selectedWeeksAgo above.
let openDayIso = null;

function openDayModal(iso) {
  openDayIso = iso;
  renderDayModal(Storage.loadState());
}

function closeDayModal() {
  openDayIso = null;
  renderDayModal(Storage.loadState());
}

function dayModalBodyHtml(entries) {
  if (!entries.length) return '<p class="empty-note">No visits logged this day.</p>';
  const rows = entries.map(function (e) {
    return (
      '<li class="day-visit-row">' +
        '<span class="store-name">' + escAttr(e.store.name) + "</span>" +
        (e.store.postcode ? '<span class="store-meta">' + escAttr(e.store.postcode) + "</span>" : "") +
        (e.count > 1 ? '<span class="secondary-badge">Visited ' + e.count + "x</span>" : "") +
      "</li>"
    );
  }).join("");
  return '<ul class="day-visit-list">' + rows + "</ul>";
}

function renderDayModal(state) {
  const modal = document.getElementById("day-modal");
  if (!openDayIso) {
    modal.classList.add("hidden");
    return;
  }
  const entries = window.HomeStats.storesVisitedOn(state.callfile.stores || {}, openDayIso);
  document.getElementById("day-modal-title").textContent =
    window.HomeStats.formatFullDate(openDayIso) + " — " + entries.length + (entries.length === 1 ? " store" : " stores") + " visited";
  document.getElementById("day-modal-body").innerHTML = dayModalBodyHtml(entries);
  modal.classList.remove("hidden");
}

function render() {
  const state = Storage.loadState();
  const stores = state.callfile.stores || {};

  const wk = window.HomeStats.weekStats(stores, selectedWeeksAgo);
  document.getElementById("week-range").textContent = window.HomeStats.formatWeekRange(wk.monday, wk.friday);
  document.getElementById("week-panel-body").innerHTML = window.HomeStats.weekPanelBodyHtml(wk);
  document.getElementById("week-prev").disabled = selectedWeeksAgo >= WEEKS_BACK;
  document.getElementById("week-next").disabled = selectedWeeksAgo === 0;

  const territoryBadge = document.getElementById("territory-badge");
  if (state.repTerritory) {
    territoryBadge.textContent = "Territory " + state.repTerritory;
    territoryBadge.classList.remove("hidden");
  } else {
    territoryBadge.classList.add("hidden");
  }

  const mo = window.HomeStats.monthCoverageStats(stores);
  document.getElementById("month-panel-body").innerHTML = window.HomeStats.monthPanelBodyHtml(mo);

  const cb = window.HomeStats.cycleBriefStats(stores);
  document.getElementById("cycle-panel-body").innerHTML = window.HomeStats.cycleBriefBodyHtml(cb);

  renderDayModal(state);
}
window.render = render;

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("week-prev").addEventListener("click", function () {
    selectedWeeksAgo = Math.min(WEEKS_BACK, selectedWeeksAgo + 1);
    render();
  });
  document.getElementById("week-next").addEventListener("click", function () {
    selectedWeeksAgo = Math.max(0, selectedWeeksAgo - 1);
    render();
  });

  document.getElementById("week-panel-body").addEventListener("click", function (e) {
    const col = e.target.closest(".weekday-col");
    if (col && col.dataset.date) openDayModal(col.dataset.date);
  });

  document.getElementById("day-modal-close").addEventListener("click", closeDayModal);
  document.getElementById("day-modal").addEventListener("click", function (e) {
    if (e.target.id === "day-modal") closeDayModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && openDayIso) closeDayModal();
  });

  render();
});
