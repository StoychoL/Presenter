// Partnership Program page logic: product tiles grouped by tier/section, each with an explicit
// tick box underneath (tapping the product image itself does nothing — tick box only, per spec).

var ppUi = { wasAbove90: false };

var HERO_IMAGES = {
  tier1: "images/PP/tier-1.png",
  tier2: "images/PP/tier-2.png",
  tier3: "images/PP/tier-3.png"
};

function escAttr(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML.replace(/"/g, "&quot;");
}

function tierTabsHtml(state) {
  return Object.keys(window.PP_LAYOUT).map(function (tierKey) {
    const tier = window.PP_LAYOUT[tierKey];
    const active = state.ppSession.activeTier === tierKey;
    return '<button class="' + (active ? "active" : "") + '" data-tier="' + tierKey + '">' + escAttr(tier.label) + "</button>";
  }).join("");
}

function tileHtml(id, checked) {
  const product = window.CATALOG[id];
  return (
    '<div class="tile pp-tile">' +
      '<img src="' + product.image + '" alt="' + escAttr(product.name) + '" />' +
      '<label class="tick-row' + (checked ? " checked" : "") + '" data-action="toggle" data-id="' + id + '">' +
        '<input type="checkbox" ' + (checked ? "checked" : "") + " />" +
        "<span>In stock</span>" +
      "</label>" +
    "</div>"
  );
}

// Some sections (currently only Tier 3's Bonus Range) require at least `min` ticked within a
// named subgroup rather than either "everything" (isCore) or "nothing" — e.g. 2 of 4 bottles AND
// 1 of 2 crush flavours. Returns null for sections with no `gate` config.
function sectionGateStats(state, section) {
  if (!section.gate) return null;
  const groups = section.gate.groups.map(function (g) {
    const checked = g.items.filter(function (id) { return !!state.ppSession.checked[id]; }).length;
    return { label: g.label, checked: checked, min: g.min, total: g.items.length, met: checked >= g.min };
  });
  return { groups: groups, complete: groups.every(function (g) { return g.met; }) };
}

function gateTagHtml(section, state, stats) {
  if (section.isCore) {
    return ' <span class="core-status ' + (stats.coreComplete ? "complete" : "partial") + '">' +
      (stats.coreComplete ? "✓ Complete" : stats.coreCheckedCount + "/" + stats.coreTotal) +
    "</span>";
  }
  const gate = sectionGateStats(state, section);
  if (!gate) return "";
  const parts = gate.groups.map(function (g) { return g.label + " " + g.checked + "/" + g.total; }).join(" · ");
  return ' <span class="core-status ' + (gate.complete ? "complete" : "partial") + '">' +
    (gate.complete ? "✓ " + parts : parts) +
  "</span>";
}

function sectionHtml(section, state, stats) {
  const tiles = section.items.map(function (id) {
    return tileHtml(id, !!state.ppSession.checked[id]);
  }).join("");
  return (
    '<section class="category">' +
      "<h3>" + escAttr(section.label) + gateTagHtml(section, state, stats) + "</h3>" +
      '<div class="tile-grid">' + tiles + "</div>" +
    "</section>"
  );
}

// Core Range is the mandatory "must stock" baseline (see layout-pp.js) — a tier can't be
// considered reward-eligible on Bonus/Premium items alone, so its completion gates the tier %.
function coreStats(state, tier) {
  const core = tier.sections.find(function (s) { return s.isCore; }) || null;
  if (!core) return { coreTotal: 0, coreCheckedCount: 0, coreComplete: true };
  const total = core.items.length;
  let checked = 0;
  core.items.forEach(function (id) { if (state.ppSession.checked[id]) checked++; });
  return { coreTotal: total, coreCheckedCount: checked, coreComplete: total === 0 || checked === total };
}

// Builds the tier-reward line's parenthetical from whatever gates the tier actually has, so it
// never drifts out of sync with layout-pp.js (e.g. Tier 3's Bonus Range quota, Tier 1/2's plain
// Core Range requirement).
function gateSummaryText(tier) {
  const parts = ["Core Range 100% stocked"];
  tier.sections.forEach(function (section) {
    if (!section.gate) return;
    const groupText = section.gate.groups.map(function (g) {
      return "at least " + g.min + " of " + g.items.length + " " + g.label;
    }).join(" and ");
    parts.push(section.label + ": " + groupText);
  });
  return parts.join("; ");
}

function tierStats(state, tierKey) {
  const tier = window.PP_LAYOUT[tierKey];
  const ids = new Set();
  tier.sections.forEach(function (section) { section.items.forEach(function (id) { ids.add(id); }); });
  let checkedCount = 0;
  ids.forEach(function (id) { if (state.ppSession.checked[id]) checkedCount++; });
  const target = state.targetCounts[tierKey] || 1;
  const realPct = Math.round((checkedCount / target) * 100);

  const core = coreStats(state, tier);
  let gatesComplete = core.coreComplete;
  tier.sections.forEach(function (section) {
    const gate = sectionGateStats(state, section);
    if (gate && !gate.complete) gatesComplete = false;
  });
  const pct = gatesComplete ? realPct : Math.min(realPct, 89);

  return {
    checkedCount: checkedCount, target: target, pct: pct, realPct: realPct,
    coreComplete: core.coreComplete, coreCheckedCount: core.coreCheckedCount, coreTotal: core.coreTotal,
    gatesComplete: gatesComplete
  };
}

function render() {
  const state = Storage.loadState();
  const tierKey = state.ppSession.activeTier;
  const tier = window.PP_LAYOUT[tierKey];

  document.getElementById("tier-tabs").innerHTML = tierTabsHtml(state);

  document.getElementById("tier-panel").className = "tier-panel theme-" + (tierKey === "tier2" ? "gold" : "silver");
  const heroImg = document.getElementById("tier-hero-img");
  heroImg.src = HERO_IMAGES[tierKey];
  heroImg.alt = tier.label + " Retailer Partnership Programme poster";

  const stats = tierStats(state, tierKey);

  document.getElementById("tier-reward").textContent =
    escAttr(tier.label) + " — £" + tier.reward + " reward at 90%+ of " + state.targetCounts[tierKey] +
    " required products stocked (" + gateSummaryText(tier) + ")";

  document.getElementById("tier-sections").innerHTML = tier.sections.map(function (section) {
    return sectionHtml(section, state, stats);
  }).join("");

  document.getElementById("progress-frac").textContent = stats.checkedCount + " / " + stats.target;
  document.getElementById("progress-pct").textContent = stats.pct + "%";

  const badge = document.getElementById("progress-badge");
  const isCelebrating = stats.pct >= 90;
  if (isCelebrating && !ppUi.wasAbove90) {
    badge.classList.remove("celebrate");
    void badge.offsetWidth; // restart animation
  }
  badge.classList.toggle("celebrate", isCelebrating);
  ppUi.wasAbove90 = isCelebrating;
}

document.addEventListener("DOMContentLoaded", function () {
  render();

  document.getElementById("tier-tabs").addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-tier]");
    if (!btn) return;
    Storage.setActiveTier(btn.dataset.tier);
    ppUi.wasAbove90 = false;
    render();
  });

  document.getElementById("tier-sections").addEventListener("click", function (e) {
    const row = e.target.closest(".tick-row");
    if (!row) return;
    e.preventDefault();
    Storage.toggleChecked(row.dataset.id);
    render();
  });

  document.getElementById("target-edit").addEventListener("click", function () {
    const state = Storage.loadState();
    const tierKey = state.ppSession.activeTier;
    const current = state.targetCounts[tierKey];
    const input = prompt("Required product count for " + window.PP_LAYOUT[tierKey].label + ":", current);
    if (input === null) return;
    const n = parseInt(input, 10);
    if (!isNaN(n) && n > 0) {
      Storage.setTierTarget(tierKey, n);
      render();
    }
  });

  document.getElementById("reset-btn").addEventListener("click", function () {
    if (confirm("Start a new store? This will clear all ticked products (targets stay saved).")) {
      Storage.resetPPSession();
      ppUi.wasAbove90 = false;
      render();
    }
  });
});
