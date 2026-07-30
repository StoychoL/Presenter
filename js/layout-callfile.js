// Call File grouping/cadence rules. Visit cadence is fixed by grade rather than read from the
// uploaded sheet's FREQUENCY/VISITCADENCE columns: Platinum stays on the file's 2-week cadence,
// but Silver is overridden to a 4-week cadence (same as Gold) per low call volume in this territory.
// Order below is display order: highest-priority tier first.

window.CALLFILE_GRADES = ["Platinum", "Gold", "Silver"];

window.CALLFILE_GRADE_CONFIG = {
  Platinum: { cadenceWeeks: 2, visitsRequired: 2 },
  Gold: { cadenceWeeks: 4, visitsRequired: 1 },
  Silver: { cadenceWeeks: 4, visitsRequired: 1 }
};
