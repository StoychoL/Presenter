// Visit-compliance status shared by Call File (js/callfile.js) and Map (js/map.js) — kept in one
// place so the red/amber/green business rule can't drift between the two pages that both need it.
// Reads window.CALLFILE_GRADE_CONFIG from js/layout-callfile.js, so this file must load after it.
//
// Status colour is derived at call time from today's date + the store's visit history, not
// stored — so a new month automatically starts every store back at red with no reset step:
//   - no visit yet this month        -> red
//   - Silver/Gold, 1+ visits         -> green
//   - Platinum, 1 visit              -> amber
//   - Platinum, 2+ visits            -> green

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Cycle Brief totals (js/home.js) reset every calendar quarter the same way storeStatus() below
// resets every calendar month — nothing is deleted, a quarter's totals just stop being summed
// once today's date rolls into the next one.
function quarterKeyForDate(dateStr) {
  const parts = dateStr.split("-").map(Number);
  const q = Math.floor((parts[1] - 1) / 3) + 1;
  return parts[0] + "-Q" + q;
}

function currentQuarterKey() {
  return quarterKeyForDate(todayISO());
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
  if (status === "red") return "Not visited";
  if (status === "amber") return "1 visit";
  return "On track";
}
