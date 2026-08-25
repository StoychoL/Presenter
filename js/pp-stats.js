// Partnership Program tier gating/stats math, parameterized on an arbitrary checked-id Set
// instead of reading state.ppSession.checked[id] directly — shared by js/partnership.js (which
// wraps these with a Set built from the live ppSession.checked, so its own behavior/output is
// unchanged) and the range-snapshot editor (js/pp-snapshot.js, used on Call File/Map), which needs
// the identical math against a frozen snapshot's checkedIds or an in-progress edit buffer. Same
// "shared logic, page-local orchestration" split already used for js/callfile-status.js, to keep
// these three pages from drifting on what a tier's gates/percentage/unlock actually mean.

// Core Range is the mandatory "must stock" baseline — a tier can't be reward-eligible on
// Bonus/Premium items alone, so its completion gates the tier %.
function ppCoreStats(tier, checkedSet) {
  const core = tier.sections.find(function (s) { return s.isCore; }) || null;
  if (!core) return { coreTotal: 0, coreCheckedCount: 0, coreComplete: true };
  const total = core.items.length;
  let checked = 0;
  core.items.forEach(function (id) { if (checkedSet.has(id)) checked++; });
  return { coreTotal: total, coreCheckedCount: checked, coreComplete: total === 0 || checked === total };
}

// Some sections (currently only Bonus Range's either/or pairs) require at least `min` ticked
// within a named subgroup rather than either "everything" (isCore) or "nothing". Returns null for
// sections with no `gate` config.
function ppSectionGateStats(section, checkedSet) {
  if (!section.gate) return null;
  const groups = section.gate.groups.map(function (g) {
    const checked = g.items.filter(function (id) { return checkedSet.has(id); }).length;
    return { label: g.label, checked: checked, min: g.min, total: g.items.length, met: checked >= g.min };
  });
  return { groups: groups, complete: groups.every(function (g) { return g.met; }) };
}

// Most items count individually toward a tier's required-product total, but a gate group flagged
// `mergeCount: true` counts as at most 1 no matter how many of its items are ticked.
function ppTierCheckedCount(tier, checkedSet) {
  const mergedIds = new Set();
  const mergeGroups = [];
  tier.sections.forEach(function (section) {
    if (!section.gate) return;
    section.gate.groups.forEach(function (g) {
      if (!g.mergeCount) return;
      mergeGroups.push(g.items);
      g.items.forEach(function (id) { mergedIds.add(id); });
    });
  });
  const ids = new Set();
  tier.sections.forEach(function (section) { section.items.forEach(function (id) { ids.add(id); }); });
  let count = 0;
  ids.forEach(function (id) {
    if (mergedIds.has(id)) return;
    if (checkedSet.has(id)) count++;
  });
  mergeGroups.forEach(function (items) {
    if (items.some(function (id) { return checkedSet.has(id); })) count++;
  });
  return count;
}

function ppTierStats(tier, targetCount, checkedSet) {
  const checkedCount = ppTierCheckedCount(tier, checkedSet);
  const target = targetCount || 1;
  const realPct = Math.round((checkedCount / target) * 100);

  const core = ppCoreStats(tier, checkedSet);
  let gatesComplete = core.coreComplete;
  tier.sections.forEach(function (section) {
    const gate = ppSectionGateStats(section, checkedSet);
    if (gate && !gate.complete) gatesComplete = false;
  });
  const pct = gatesComplete ? realPct : Math.min(realPct, 89);

  // Most tiers unlock their reward at 90%+ of the required count; a tier can instead set
  // `unlockCount` to unlock at that exact count instead — either way, the section gates above
  // still apply on top.
  const unlockCount = tier.unlockCount || null;
  const unlocked = unlockCount != null
    ? (gatesComplete && checkedCount >= unlockCount)
    : (gatesComplete && realPct >= 90);

  return {
    checkedCount: checkedCount, target: target, pct: pct, realPct: realPct,
    coreComplete: core.coreComplete, coreCheckedCount: core.coreCheckedCount, coreTotal: core.coreTotal,
    gatesComplete: gatesComplete, unlockCount: unlockCount, unlocked: unlocked
  };
}

// All product ids checked within a tier (across every section, core + bonus/premium) — this is
// what gets frozen into a Call File snapshot.
function ppTierCheckedIds(tier, checkedSet) {
  const ids = [];
  tier.sections.forEach(function (section) {
    section.items.forEach(function (id) { if (checkedSet.has(id)) ids.push(id); });
  });
  return ids;
}

// Builds a ppHistory-shaped snapshot object from an arbitrary checked-id list, so "what a
// snapshot is" has exactly one definition — used by Partnership's "Save to Call File" and by
// Call File/Map's range-snapshot editor (both create-from-scratch and edit-existing).
function ppBuildSnapshot(tierKey, checkedIds, targetCount, dateStr) {
  const tier = window.PP_LAYOUT[tierKey];
  const checkedSet = new Set(checkedIds);
  const stats = ppTierStats(tier, targetCount, checkedSet);
  return {
    date: dateStr,
    tierKey: tierKey,
    checkedIds: ppTierCheckedIds(tier, checkedSet),
    checkedCount: stats.checkedCount,
    target: stats.target,
    pct: stats.pct,
    unlocked: stats.unlocked
  };
}

window.PPStats = {
  coreStats: ppCoreStats,
  sectionGateStats: ppSectionGateStats,
  tierCheckedCount: ppTierCheckedCount,
  tierStats: ppTierStats,
  tierCheckedIds: ppTierCheckedIds,
  buildSnapshot: ppBuildSnapshot
};
