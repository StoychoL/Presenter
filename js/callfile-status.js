// Visit-compliance status shared by Call File (js/callfile.js) and Map (js/map.js) — kept in one
// place so the red/amber/green business rule can't drift between the two pages that both need it.
// Reads window.CALLFILE_GRADE_CONFIG from js/layout-callfile.js, so this file must load after it.
//
// Status colour is derived at call time from a date + the store's visit history, not stored.
// It's due-date based, from the grade's cadenceWeeks (no monthly reset):
//   - never visited, or past its next due date       -> red   ("Overdue")
//   - within its cycle, next visit due within
//     CALLFILE_DUE_SOON_DAYS                         -> amber ("Due soon")
//   - within its cycle otherwise                     -> green ("On track")
// The next due date is always recomputed from the latest visit + the *current* cadence, so a
// store's stored nextVisitDate (written by Storage.logVisit, possibly under an older cadence) is
// never what the UI shows — use nextDueDate(store) instead.

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

// UTC day arithmetic on "YYYY-MM-DD" strings, matching todayISO()'s UTC basis.
function addDaysISO(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function cadenceDays(store) {
  const cfg = window.CALLFILE_GRADE_CONFIG[store.grade] || { cadenceWeeks: 4 };
  return cfg.cadenceWeeks * 7;
}

// Latest visit on or before dateStr (ISO strings sort chronologically). Read from visits[] rather
// than lastVisitDate, since a back-dated visit sets lastVisitDate to an older date.
function lastVisitOnOrBefore(store, dateStr) {
  let best = null;
  (store.visits || []).forEach(function (d) {
    if (d <= dateStr && (!best || d > best)) best = d;
  });
  return best;
}

function nextDueDate(store) {
  const last = lastVisitOnOrBefore(store, "9999-12-31");
  return last ? addDaysISO(last, cadenceDays(store)) : null;
}

// Status as it stood on dateStr — parameterized so the dashboards can evaluate a past month
// (as of its last day) too, not just "now".
function statusAsOf(store, dateStr) {
  const last = lastVisitOnOrBefore(store, dateStr);
  if (!last) return "red";
  const due = addDaysISO(last, cadenceDays(store));
  if (due < dateStr) return "red";
  const soonDays = window.CALLFILE_DUE_SOON_DAYS == null ? 14 : window.CALLFILE_DUE_SOON_DAYS;
  if (due <= addDaysISO(dateStr, soonDays)) return "amber";
  return "green";
}

function storeStatus(store) {
  return statusAsOf(store, todayISO());
}

function statusLabel(status) {
  if (status === "red") return "Overdue";
  if (status === "amber") return "Due soon";
  return "On track";
}

// cbEvents is append-only and always pushed in save order (Storage.logCycleBrief), so the last
// array element is always the most recently saved Cycle Brief entry — no date-sorting needed.
function lastCbEntry(store) {
  if (!store.cbEvents || !store.cbEvents.length) return null;
  return store.cbEvents[store.cbEvents.length - 1];
}
