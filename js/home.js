// Home dashboard: aggregates the call file's visit history into a "this week" activity view
// and a "this month" compliance view. Purely derived from Storage.loadState().callfile — no new
// persisted state, and it never mutates the call file.
//
// Dates in store.visits are plain "YYYY-MM-DD" strings with no time component (see js/storage.js
// logVisit). js/callfile-status.js's todayISO()/storeStatus() compare those against UTC "today",
// which is an acceptable one-day-near-midnight tradeoff for a monthly red/amber/green badge, but
// would misfile visits into the wrong weekday column here — so weekday/week-boundary math below
// uses local dates instead. storeStatus() itself IS reused for the monthly coverage stat, since
// that's the same tradeoff Call File already relies on, not a new risk.

const WEEKLY_TARGET = 60;
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKS_BACK = 12; // plus the current week = 13 tabs, ~3 months

// Ephemeral UI-only selection (which past week the "This Week" panel shows) — never persisted,
// so the dashboard always opens back on the current week on a fresh load, same as every other
// value in this file is purely derived from Storage.loadState().callfile.
let selectedWeeksAgo = 0;

function parseLocalDate(dateStr) {
  const parts = dateStr.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function localToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function mondayOfWeek(date) {
  const day = date.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return monday;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatWeekRange(monday, friday) {
  if (monday.getMonth() === friday.getMonth()) {
    return monday.getDate() + "–" + friday.getDate() + " " + MONTH_ABBR[friday.getMonth()];
  }
  return monday.getDate() + " " + MONTH_ABBR[monday.getMonth()] + " – " + friday.getDate() + " " + MONTH_ABBR[friday.getMonth()];
}

// Mon-Fri visit counts for the local week `weeksAgo` weeks before the current one (0 = this
// week), plus which column (if any) is today — only ever set when viewing the current week.
function weekStats(stores, weeksAgo) {
  const today = localToday();
  const monday = mondayOfWeek(today);
  monday.setDate(monday.getDate() - weeksAgo * 7);
  const weekDates = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDates.push(d);
  }
  const todayIdx = weeksAgo === 0 ? weekDates.findIndex(function (d) { return sameDay(d, today); }) : -1;

  const counts = [0, 0, 0, 0, 0];
  Storage.liveStoreKeys(stores).forEach(function (key) {
    stores[key].visits.forEach(function (dateStr) {
      const visitDate = parseLocalDate(dateStr);
      const dayIdx = weekDates.findIndex(function (d) { return sameDay(d, visitDate); });
      if (dayIdx !== -1) counts[dayIdx]++;
    });
  });

  const total = counts.reduce(function (a, b) { return a + b; }, 0);
  return { monday: monday, friday: weekDates[4], counts: counts, total: total, todayIdx: todayIdx };
}

// Coverage this local month, overall and per grade. "Covered" reuses storeStatus()'s green
// definition (visitsThisMonth >= CALLFILE_GRADE_CONFIG[grade].visitsRequired) — the exact rule
// Call File already shows per store, just aggregated here.
//
// "Partial" (storeStatus() === "amber") is tracked separately as info only — it never adds to
// coveredTotal/pct. In practice this only ever fires for Platinum stores (1 of their 2 required
// visits done this month); Gold/Silver jump straight red -> green since they only need 1 visit.
function monthCoverageStats(stores) {
  const perGrade = {};
  (window.CALLFILE_GRADES || []).forEach(function (g) { perGrade[g] = { covered: 0, total: 0 }; });

  let coveredTotal = 0;
  let partialTotal = 0;
  let storeTotal = 0;
  Storage.liveStoreKeys(stores).forEach(function (key) {
    const store = stores[key];
    if (!perGrade[store.grade]) return;
    storeTotal++;
    perGrade[store.grade].total++;
    const status = storeStatus(store);
    if (status === "green") {
      coveredTotal++;
      perGrade[store.grade].covered++;
    } else if (status === "amber") {
      partialTotal++;
    }
  });

  return { coveredTotal: coveredTotal, partialTotal: partialTotal, storeTotal: storeTotal, perGrade: perGrade };
}

function weekTabsHtml(selected) {
  const today = localToday();
  const buttons = [];
  for (let i = 0; i <= WEEKS_BACK; i++) {
    let label;
    if (i === 0) {
      label = "This Week";
    } else if (i === 1) {
      label = "Last Week";
    } else {
      const monday = mondayOfWeek(today);
      monday.setDate(monday.getDate() - i * 7);
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);
      label = formatWeekRange(monday, friday);
    }
    buttons.push(
      '<button class="week-tab' + (i === selected ? " active" : "") + '" data-offset="' + i + '">' +
        label +
      "</button>"
    );
  }
  return buttons.join("");
}

function weekPanelBodyHtml(wk) {
  const pct = Math.min(100, Math.round((wk.total / WEEKLY_TARGET) * 100));
  const strip = WEEKDAY_LABELS.map(function (label, i) {
    const count = wk.counts[i];
    const max = Math.max(1, wk.counts[0], wk.counts[1], wk.counts[2], wk.counts[3], wk.counts[4]);
    const barPct = Math.round((count / max) * 100);
    const isToday = i === wk.todayIdx;
    return (
      '<div class="weekday-col' + (isToday ? " is-today" : "") + '">' +
        '<span class="weekday-count">' + count + "</span>" +
        '<div class="weekday-bar-track"><div class="weekday-bar-fill" style="height:' + barPct + '%"></div></div>' +
        '<span class="weekday-label">' + label + "</span>" +
      "</div>"
    );
  }).join("");

  return (
    '<div class="week-total">' +
      '<span class="week-total-frac">' + wk.total + " / " + WEEKLY_TARGET + "</span>" +
      '<span class="week-total-label">visits toward this week’s target</span>' +
    "</div>" +
    '<div class="week-progress"><div class="week-progress-fill" style="width:' + pct + '%"></div></div>' +
    '<div class="weekday-strip">' + strip + "</div>"
  );
}

function gradeDotClass(grade) {
  return "grade-dot-" + grade.toLowerCase();
}

function gradeBreakdownHtml(perGrade) {
  return (window.CALLFILE_GRADES || []).map(function (grade) {
    const g = perGrade[grade];
    const fracHtml = !g || g.total === 0
      ? '<span class="grade-pill-frac">—</span>'
      : (function () {
          const status = g.covered >= g.total ? "green" : g.covered === 0 ? "red" : "amber";
          return '<span class="grade-pill-frac status-pill status-' + status + '-pill">' + g.covered + "/" + g.total + "</span>";
        })();
    return (
      '<div class="grade-pill">' +
        '<div class="grade-pill-top">' +
          '<span class="grade-dot ' + gradeDotClass(grade) + '"></span>' +
          '<span class="grade-pill-name">' + grade + "</span>" +
        "</div>" +
        fracHtml +
      "</div>"
    );
  }).join("");
}

function monthPanelBodyHtml(mo) {
  if (mo.storeTotal === 0) {
    return '<p class="empty-note">Upload a call file to see coverage here.</p>';
  }
  const pct = Math.round((mo.coveredTotal / mo.storeTotal) * 100);
  const partialHtml = mo.partialTotal > 0
    ? '<p class="coverage-partial"><span class="dot amber"></span>' +
        mo.partialTotal + (mo.partialTotal === 1 ? " store" : " stores") +
        " partially visited — not counted toward coverage</p>"
    : "";
  return (
    '<div class="coverage-row">' +
      '<span class="coverage-pct">' + pct + "%</span>" +
      '<span class="coverage-copy">' + mo.coveredTotal + " of " + mo.storeTotal + " stores compliant</span>" +
    "</div>" +
    partialHtml +
    '<div class="coverage-bar"><div class="coverage-bar-fill" style="width:' + pct + '%"></div></div>' +
    '<div class="grade-breakdown">' + gradeBreakdownHtml(mo.perGrade) + "</div>"
  );
}

function render() {
  const state = Storage.loadState();
  const stores = state.callfile.stores || {};

  document.getElementById("week-tabs").innerHTML = weekTabsHtml(selectedWeeksAgo);

  const wk = weekStats(stores, selectedWeeksAgo);
  document.getElementById("week-range").textContent = formatWeekRange(wk.monday, wk.friday);
  document.getElementById("week-panel-body").innerHTML = weekPanelBodyHtml(wk);

  const mo = monthCoverageStats(stores);
  document.getElementById("month-panel-body").innerHTML = monthPanelBodyHtml(mo);
}
window.render = render;

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("week-tabs").addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-offset]");
    if (!btn) return;
    selectedWeeksAgo = Number(btn.dataset.offset);
    render();
  });
  render();
});
