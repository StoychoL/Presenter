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

function sectionHtml(section, state, stats) {
  const tiles = section.items.map(function (id) {
    return tileHtml(id, !!state.ppSession.checked[id]);
  }).join("");
  const coreTag = section.isCore
    ? ' <span class="core-status ' + (stats.coreComplete ? "complete" : "partial") + '">' +
        (stats.coreComplete ? "✓ Complete" : stats.coreCheckedCount + "/" + stats.coreTotal) +
      "</span>"
    : "";
  return (
    '<section class="category">' +
      "<h3>" + escAttr(section.label) + coreTag + "</h3>" +
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

function tierStats(state, tierKey) {
  const tier = window.PP_LAYOUT[tierKey];
  const ids = new Set();
  tier.sections.forEach(function (section) { section.items.forEach(function (id) { ids.add(id); }); });
  let checkedCount = 0;
  ids.forEach(function (id) { if (state.ppSession.checked[id]) checkedCount++; });
  const target = state.targetCounts[tierKey] || 1;
  const realPct = Math.round((checkedCount / target) * 100);

  const core = coreStats(state, tier);
  const pct = core.coreComplete ? realPct : Math.min(realPct, 89);

  return {
    checkedCount: checkedCount, target: target, pct: pct, realPct: realPct,
    coreComplete: core.coreComplete, coreCheckedCount: core.coreCheckedCount, coreTotal: core.coreTotal
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
    " required products stocked (Core Range must be 100% stocked first)";

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
