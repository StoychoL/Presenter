// Call File grouping/cadence rules. Visit cadence is fixed by grade rather than read from the
// uploaded sheet's FREQUENCY/VISITCADENCE columns — the business rule here always wins:
//   Platinum every 4 weeks, Gold every 8, Silver every 12, Bronze every 26.
// "Bronze BW" (Bestway) rows in the sheet are treated as plain Bronze (see normalizeGrade in
// js/callfile.js). Order below is display order: highest-priority tier first.

window.CALLFILE_GRADES = ["Platinum", "Gold", "Silver", "Bronze"];

window.CALLFILE_GRADE_CONFIG = {
  Platinum: { cadenceWeeks: 4 },
  Gold: { cadenceWeeks: 8 },
  Silver: { cadenceWeeks: 12 },
  Bronze: { cadenceWeeks: 26 }
};

// A store still within its cycle turns amber ("Due soon") once its next visit is this close.
window.CALLFILE_DUE_SOON_DAYS = 14;
