// Home dashboard stat math, extracted out of js/home.js so it can be reused by the manager
// dashboard's per-territory detail view (js/manager-home.js) without duplicating this fairly
// intricate date math a second time — same "shared logic, page-local orchestration" split already
// used for js/pp-stats.js (Partnership Program) and js/callfile-status.js (Call File/Map).
// js/home.js keeps its own selectedWeeksAgo/day-modal state and DOM wiring; its copies of the
// functions below become thin wrappers delegating here, with zero behavior change.
//
// Deliberately self-contained: iterates Object.keys(stores || {}) directly rather than calling
// Storage.liveStoreKeys() (a thin wrapper around the same thing, js/storage.js:197-199), since the
// manager dashboard doesn't load js/storage.js at all — these are pure functions of a `stores` map,
// nothing else.
//
// Dates in store.visits are plain "YYYY-MM-DD" strings with no time component (see js/storage.js
// logVisit). js/callfile-status.js's todayISO()/storeStatus() compare those against UTC "today",
// which is an acceptable one-day-near-midnight tradeoff for a monthly red/amber/green badge, but
// would misfile visits into the wrong weekday column here — so weekday/week-boundary math below
// uses local dates instead. storeStatus() itself IS reused for the monthly coverage stat, since
// that's the same tradeoff Call File already relies on, not a new risk.

window.HomeStats = (function () {
  const WEEKLY_TARGET = 60;
  const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function storeKeys(stores) {
    return Object.keys(stores || {});
  }

  function parseLocalDate(dateStr) {
    const parts = dateStr.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function toLocalISO(date) {
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + mm + "-" + dd;
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
  // Unlike monthCoverageStats below, this counts secondary-territory stores too — a visit made
  // while covering a colleague's territory is still real activity that week, even though it
  // shouldn't count toward the rep's own monthly compliance.
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
    storeKeys(stores).forEach(function (key) {
      stores[key].visits.forEach(function (dateStr) {
        const visitDate = parseLocalDate(dateStr);
        const dayIdx = weekDates.findIndex(function (d) { return sameDay(d, visitDate); });
        if (dayIdx !== -1) counts[dayIdx]++;
      });
    });

    const total = counts.reduce(function (a, b) { return a + b; }, 0);
    const isoDates = weekDates.map(toLocalISO);
    return { monday: monday, friday: weekDates[4], counts: counts, total: total, todayIdx: todayIdx, isoDates: isoDates };
  }

  // Every store (including secondary-territory ones, same as weekStats above) whose visits array
  // contains `iso` one or more times — count uses .filter() rather than a single indexOf check so a
  // store visited twice the same day (Platinum) is reflected as 2, not silently deduped to 1.
  function storesVisitedOn(stores, iso) {
    const result = [];
    storeKeys(stores).forEach(function (key) {
      const store = stores[key];
      const count = store.visits.filter(function (d) { return d === iso; }).length;
      if (count > 0) result.push({ store: store, count: count });
    });
    return result;
  }

  function formatFullDate(iso) {
    const d = parseLocalDate(iso);
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short" });
  }

  // Pure integer month/year arithmetic off todayISO() (not a Date object), so monthsAgo=0 always
  // produces exactly the same "YYYY-MM" storeStatus() itself would use for "now".
  function monthKeyOffset(monthsAgo) {
    const parts = todayISO().slice(0, 7).split("-").map(Number);
    let year = parts[0];
    let month = parts[1] - 1 - monthsAgo; // 0-indexed
    while (month < 0) { month += 12; year -= 1; }
    return year + "-" + String(month + 1).padStart(2, "0");
  }

  function monthLabel(monthKey) {
    const parts = monthKey.split("-").map(Number);
    return MONTH_ABBR[parts[1] - 1] + " " + parts[0];
  }

  // Quarters are just months in groups of 3, so this reuses monthKeyOffset rather than
  // duplicating the year-rollover arithmetic a second time.
  function quarterKeyOffset(quartersAgo) {
    return quarterKeyForDate(monthKeyOffset(quartersAgo * 3) + "-01");
  }

  function quarterLabel(qKey) {
    const idx = qKey.indexOf("-Q");
    return "Q" + qKey.slice(idx + 2) + " " + qKey.slice(0, idx);
  }

  // Coverage for the local month `monthsAgo` months before the current one (0 = this month),
  // overall and per grade. "Covered" reuses statusForMonth()'s green definition (visits in that
  // month >= CALLFILE_GRADE_CONFIG[grade].visitsRequired) — the exact rule Call File already shows
  // per store, just aggregated here for an arbitrary month instead of only "now".
  //
  // "Partial" (statusForMonth() === "amber") is tracked separately as info only — it never adds to
  // coveredTotal/pct. In practice this only ever fires for Platinum stores (1 of their 2 required
  // visits done that month); Gold/Silver jump straight red -> green since they only need 1 visit.
  function monthCoverageStats(stores, monthsAgo) {
    const monthKey = monthKeyOffset(monthsAgo || 0);
    const perGrade = {};
    (window.CALLFILE_GRADES || []).forEach(function (g) { perGrade[g] = { covered: 0, total: 0 }; });

    let coveredTotal = 0;
    let partialTotal = 0;
    let storeTotal = 0;
    storeKeys(stores).forEach(function (key) {
      const store = stores[key];
      if (store.secondary) return;
      if (!perGrade[store.grade]) return;
      storeTotal++;
      perGrade[store.grade].total++;
      const status = statusForMonth(store, monthKey);
      if (status === "green") {
        coveredTotal++;
        perGrade[store.grade].covered++;
      } else if (status === "amber") {
        partialTotal++;
      }
    });

    return { coveredTotal: coveredTotal, partialTotal: partialTotal, storeTotal: storeTotal, perGrade: perGrade, monthKey: monthKey };
  }

  const CB_CATEGORIES = [
    { key: "direct", label: "Direct Sale NPDs", dot: "grade-dot-direct" },
    { key: "influence", label: "Influence Sales NPDs", dot: "grade-dot-influence" },
    { key: "pos", label: "POS Activation", dot: "grade-dot-pos" }
  ];

  // Sums every store's cbEvents whose date falls in the calendar quarter `quartersAgo` quarters
  // before the current one (0 = this quarter) — nothing is ever deleted (see
  // Storage.logCycleBrief), so this is what actually makes the totals "reset" every quarter: a
  // past quarter's entries simply stop matching the *current* qKey once today's date rolls over,
  // but remain summable here by asking for that quarter specifically. Mirrors monthCoverageStats()
  // above, just with quarterKeyForDate() (js/callfile-status.js) instead of statusForMonth()'s
  // implicit monthly bucketing. qKey is included on the returned object purely for the caller to
  // label the period with (quarterLabel()) — cycleBriefBodyHtml() only reads direct/influence/pos.
  function cycleBriefStats(stores, quartersAgo) {
    const qKey = quarterKeyOffset(quartersAgo || 0);
    const totals = { direct: 0, influence: 0, pos: 0, qKey: qKey };
    storeKeys(stores).forEach(function (key) {
      (stores[key].cbEvents || []).forEach(function (ev) {
        if (quarterKeyForDate(ev.date) !== qKey) return;
        totals.direct += ev.direct;
        totals.influence += ev.influence;
        totals.pos += ev.pos;
      });
    });
    return totals;
  }

  function cycleBriefBodyHtml(totals) {
    const pills = CB_CATEGORIES.map(function (cat) {
      return (
        '<div class="grade-pill">' +
          '<div class="grade-pill-top">' +
            '<span class="grade-dot ' + cat.dot + '"></span>' +
            '<span class="grade-pill-name">' + cat.label + "</span>" +
          "</div>" +
          '<span class="grade-pill-frac">' + totals[cat.key] + "</span>" +
        "</div>"
      );
    }).join("");
    return '<div class="grade-breakdown">' + pills + "</div>";
  }

  function weekPanelBodyHtml(wk) {
    const pct = Math.min(100, Math.round((wk.total / WEEKLY_TARGET) * 100));
    const strip = WEEKDAY_LABELS.map(function (label, i) {
      const count = wk.counts[i];
      const max = Math.max(1, wk.counts[0], wk.counts[1], wk.counts[2], wk.counts[3], wk.counts[4]);
      const barPct = Math.round((count / max) * 100);
      const isToday = i === wk.todayIdx;
      return (
        '<div class="weekday-col' + (isToday ? " is-today" : "") + '" data-date="' + wk.isoDates[i] + '">' +
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

  return {
    WEEKLY_TARGET: WEEKLY_TARGET,
    parseLocalDate: parseLocalDate,
    toLocalISO: toLocalISO,
    localToday: localToday,
    mondayOfWeek: mondayOfWeek,
    sameDay: sameDay,
    formatWeekRange: formatWeekRange,
    formatFullDate: formatFullDate,
    weekStats: weekStats,
    storesVisitedOn: storesVisitedOn,
    monthKeyOffset: monthKeyOffset,
    monthLabel: monthLabel,
    quarterKeyOffset: quarterKeyOffset,
    quarterLabel: quarterLabel,
    monthCoverageStats: monthCoverageStats,
    cycleBriefStats: cycleBriefStats,
    weekPanelBodyHtml: weekPanelBodyHtml,
    monthPanelBodyHtml: monthPanelBodyHtml,
    cycleBriefBodyHtml: cycleBriefBodyHtml,
    gradeBreakdownHtml: gradeBreakdownHtml
  };
})();
