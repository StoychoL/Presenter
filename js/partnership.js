// Partnership Program page logic: product tiles grouped by tier/section, each with an explicit
// tick box underneath. Tapping the tile anywhere outside that tick box opens a magnified product
// modal (see openProductModal/renderModal) instead of toggling stock.

var ppUi = { wasAbove90: false, zoomId: null, storePickerOpen: false };

// All three tiers now share the same "Stock Diageo & Earn" summary graphic (formerly
// images/PP/tier-1.png etc., one differently-branded poster per tier) — see js/pp-deck.js's
// use of the same asset for the Partnership Program pitch deck.
var HERO_IMAGES = {
  tier1: "images/pp-deck-hero.jpg",
  tier2: "images/pp-deck-hero.jpg",
  tier3: "images/pp-deck-hero.jpg"
};

function escAttr(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML.replace(/"/g, "&quot;");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(n) {
  return "£" + (Math.round(n * 100) / 100).toFixed(2);
}

// Local copy of products.js's casePriceFor (that file isn't loaded on this page) — reads the
// same state.prices saved via the Products page price-pill, always for Booker (see products.js).
function casePriceFor(state, id) {
  const p = state.prices[id];
  return (p && p.booker) || 0;
}

function tierTabsHtml(state) {
  return Object.keys(window.PP_LAYOUT).map(function (tierKey) {
    const tier = window.PP_LAYOUT[tierKey];
    const active = state.ppSession.activeTier === tierKey;
    return '<button class="' + (active ? "active" : "") + '" data-tier="' + tierKey + '">' + escAttr(tier.label) + "</button>";
  }).join("");
}

function tileHtml(id, checked, isJumped) {
  const product = window.CATALOG[id];
  return (
    '<div class="tile pp-tile' + (isJumped ? " bonus-jumped" : "") + '" data-id="' + id + '">' +
      (isJumped ? '<span class="bonus-tag">Bonus</span>' : "") +
      '<img src="' + product.image + '" alt="' + escAttr(product.name) + '" />' +
      '<label class="tick-row' + (checked ? " checked" : "") + '" data-action="toggle" data-id="' + id + '">' +
        '<input type="checkbox" ' + (checked ? "checked" : "") + " />" +
        "<span>In stock</span>" +
      "</label>" +
    "</div>"
  );
}

// Products ticked in a non-core section visually "jump" up into the Core Range section (see
// layout-pp.js header comment) without changing what the Core-100% gate itself requires — the
// gate always reads from the section's own fixed `items` list (see coreStats), never this.
function jumpedItems(tier, section, state) {
  if (!section.isCore) return [];
  const ids = [];
  tier.sections.forEach(function (s) {
    if (s === section || s.isCore || !s.promoteOnCheck) return;
    s.items.forEach(function (id) { if (state.ppSession.checked[id]) ids.push(id); });
  });
  return ids;
}

// What a section should actually render: a `promoteOnCheck` non-core section hides items that
// have jumped up to Core Range; the Core Range section shows its fixed items plus whatever
// jumped up into it. Sections without `promoteOnCheck` (e.g. Tier 3's Bonus Range) render
// unchanged, exactly as before.
function sectionItemsToRender(tier, section, state) {
  if (!section.isCore) {
    if (!section.promoteOnCheck) return section.items;
    return section.items.filter(function (id) { return !state.ppSession.checked[id]; });
  }
  return section.items.concat(jumpedItems(tier, section, state));
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
  if (section.gate.hideTag) return "";
  const parts = gate.groups.map(function (g) { return g.label + " " + g.checked + "/" + g.total; }).join(" · ");
  return ' <span class="core-status ' + (gate.complete ? "complete" : "partial") + '">' +
    (gate.complete ? "✓ " + parts : parts) +
  "</span>";
}

function sectionHtml(tier, section, state, stats) {
  const items = sectionItemsToRender(tier, section, state);
  if (items.length === 0 && !section.isCore) return null;
  const coreIds = section.isCore ? new Set(section.items) : null;
  const tiles = items.map(function (id) {
    const isJumped = !section.isCore ? false : !coreIds.has(id);
    return tileHtml(id, !!state.ppSession.checked[id], isJumped);
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
    // hideTag sections (e.g. Tier 2's Captain Morgan/Gordon's pairs) already hide their gate tag
    // on the page — skip them here too so the reward line doesn't surface a breakdown the rep
    // never sees rendered anywhere else.
    if (!section.gate || section.gate.hideTag) return;
    const groupText = section.gate.groups.map(function (g) {
      return "at least " + g.min + " of " + g.items.length + " " + g.label;
    }).join(" and ");
    parts.push(section.label + ": " + groupText);
  });
  return parts.join("; ");
}

// Most items count individually toward a tier's required-product total, but a gate group flagged
// `mergeCount: true` (currently Tier 2's Captain Morgan/Gordon's 35cl+20cl pairs) counts as at
// most 1 no matter how many of its items are ticked — ticking one size, the other, or both all
// count the same.
function tierCheckedCount(state, tier) {
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
    if (state.ppSession.checked[id]) count++;
  });
  mergeGroups.forEach(function (items) {
    if (items.some(function (id) { return !!state.ppSession.checked[id]; })) count++;
  });
  return count;
}

function tierStats(state, tierKey) {
  const tier = window.PP_LAYOUT[tierKey];
  const checkedCount = tierCheckedCount(state, tier);
  const target = state.targetCounts[tierKey] || 1;
  const realPct = Math.round((checkedCount / target) * 100);

  const core = coreStats(state, tier);
  let gatesComplete = core.coreComplete;
  tier.sections.forEach(function (section) {
    const gate = sectionGateStats(state, section);
    if (gate && !gate.complete) gatesComplete = false;
  });
  const pct = gatesComplete ? realPct : Math.min(realPct, 89);

  // Most tiers unlock their reward at 90%+ of the required count; a tier can instead set
  // `unlockCount` (Tier 3 at 20 of 23, Tier 2 at 22 of 24) to unlock at that exact count instead —
  // either way, the section gates above (Core Range 100%, Bonus Range quotas) still apply on top.
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

function openProductModal(id) {
  ppUi.zoomId = id;
  render();
}

function closeProductModal() {
  ppUi.zoomId = null;
  render();
}

function renderModal(state) {
  const modal = document.getElementById("product-modal");
  if (!ppUi.zoomId) {
    modal.classList.add("hidden");
    return;
  }
  const id = ppUi.zoomId;
  const product = window.CATALOG[id];
  const casePrice = casePriceFor(state, id);
  const checked = !!state.ppSession.checked[id];

  document.getElementById("modal-img").src = product.image;
  document.getElementById("modal-img").alt = product.name;
  document.getElementById("modal-name").textContent = product.name;

  const rows = ["Case size: " + product.caseSize + " per case"];
  if (casePrice > 0) {
    rows.push("Case price (Booker): " + formatMoney(casePrice));
    rows.push("Per bottle: " + formatMoney(casePrice / product.caseSize));
  } else {
    rows.push("Price not set on Products page yet");
  }
  document.getElementById("modal-info").innerHTML = rows.map(function (r) { return "<div>" + escAttr(r) + "</div>"; }).join("");

  document.getElementById("modal-tick-row").dataset.id = id;
  document.getElementById("modal-tick-row").classList.toggle("checked", checked);
  document.getElementById("modal-checkbox").checked = checked;

  modal.classList.remove("hidden");
}

// All product ids checked within a tier (across every section, core + bonus/premium) — this is
// what gets frozen into a Call File snapshot, since ppSession.checked is a flat map shared across
// tiers (core range ids are the same across tier1/2/3).
function tierCheckedIds(tier, state) {
  const ids = [];
  tier.sections.forEach(function (section) {
    section.items.forEach(function (id) { if (state.ppSession.checked[id]) ids.push(id); });
  });
  return ids;
}

function openStorePicker() {
  ppUi.storePickerOpen = true;
  render();
}

function closeStorePicker() {
  ppUi.storePickerOpen = false;
  render();
}

function storePickRowHtml(key, store) {
  return (
    '<button type="button" class="store-card" data-action="pick" data-key="' + escAttr(key) + '">' +
      '<div class="store-row-top">' +
        '<span class="store-name">' + escAttr(store.name) + '</span>' +
        '<span class="status-pill">' + escAttr(store.grade) + '</span>' +
      "</div>" +
      '<div class="store-row-bottom"><span class="store-meta">' + escAttr(store.postcode || "") + "</span></div>" +
    "</button>"
  );
}

function renderStorePicker(state) {
  const modal = document.getElementById("store-picker-modal");
  if (!ppUi.storePickerOpen) {
    modal.classList.add("hidden");
    return;
  }
  const query = (document.getElementById("store-picker-search").value || "").trim().toLowerCase();
  const stores = state.callfile.stores;
  const rows = Storage.liveStoreKeys(stores)
    .filter(function (key) {
      if (!query) return true;
      const store = stores[key];
      return (store.name + " " + store.postcode).toLowerCase().indexOf(query) !== -1;
    })
    .sort(function (a, b) { return stores[a].name.localeCompare(stores[b].name); })
    .map(function (key) { return storePickRowHtml(key, stores[key]); })
    .join("");
  document.getElementById("store-picker-list").innerHTML = rows ||
    '<p class="empty-note">No stores match your search.</p>';
  modal.classList.remove("hidden");
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

  const rewardCondition = stats.unlockCount != null
    ? stats.unlockCount + " of " + state.targetCounts[tierKey]
    : "90%+ of " + state.targetCounts[tierKey];
  document.getElementById("tier-reward").textContent =
    escAttr(tier.label) + " — £" + tier.reward + " reward at " + rewardCondition +
    " required products stocked (" + gateSummaryText(tier) + ")";

  document.getElementById("tier-sections").innerHTML = tier.sections.map(function (section) {
    return sectionHtml(tier, section, state, stats);
  }).filter(function (html) { return html !== null; }).join("");

  document.getElementById("progress-frac").textContent = stats.checkedCount + " / " + stats.target;
  document.getElementById("progress-pct").textContent = stats.pct + "%";

  const badge = document.getElementById("progress-badge");
  const isCelebrating = stats.unlocked;
  if (isCelebrating && !ppUi.wasAbove90) {
    badge.classList.remove("celebrate");
    void badge.offsetWidth; // restart animation
  }
  badge.classList.toggle("celebrate", isCelebrating);
  ppUi.wasAbove90 = isCelebrating;

  renderModal(state);
  renderStorePicker(state);
}

document.addEventListener("DOMContentLoaded", function () {
  render();

  document.getElementById("tier-tabs").addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-tier]");
    if (!btn) return;
    Storage.setActiveTier(btn.dataset.tier);
    ppUi.wasAbove90 = false;
    ppUi.zoomId = null;
    render();
  });

  document.getElementById("tier-sections").addEventListener("click", function (e) {
    const row = e.target.closest(".tick-row");
    if (row) {
      e.preventDefault();
      Storage.toggleChecked(row.dataset.id);
      render();
      return;
    }
    const tile = e.target.closest(".pp-tile");
    if (tile) openProductModal(tile.dataset.id);
  });

  document.getElementById("modal-close-btn").addEventListener("click", closeProductModal);

  document.getElementById("product-modal").addEventListener("click", function (e) {
    if (e.target.id === "product-modal") {
      closeProductModal();
      return;
    }
    const row = e.target.closest("#modal-tick-row");
    if (row) {
      e.preventDefault();
      Storage.toggleChecked(row.dataset.id);
      render();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && ppUi.zoomId) closeProductModal();
    if (e.key === "Escape" && ppUi.storePickerOpen) closeStorePicker();
  });

  document.getElementById("save-callfile-btn").addEventListener("click", function () {
    const state = Storage.loadState();
    if (Storage.liveStoreKeys(state.callfile.stores).length === 0) {
      alert("Upload a call file first (Call File tab) before saving a range to a store.");
      return;
    }
    openStorePicker();
  });

  document.getElementById("store-picker-close").addEventListener("click", closeStorePicker);

  document.getElementById("store-picker-modal").addEventListener("click", function (e) {
    if (e.target.id === "store-picker-modal") closeStorePicker();
  });

  document.getElementById("store-picker-search").addEventListener("input", render);

  document.getElementById("store-picker-list").addEventListener("click", function (e) {
    const btn = e.target.closest('button[data-action="pick"]');
    if (!btn) return;
    const key = btn.dataset.key;
    const state = Storage.loadState();
    const tierKey = state.ppSession.activeTier;
    const tier = window.PP_LAYOUT[tierKey];
    const stats = tierStats(state, tierKey);
    const store = state.callfile.stores[key];
    Storage.savePPSnapshot(key, {
      date: todayISO(),
      tierKey: tierKey,
      checkedIds: tierCheckedIds(tier, state),
      checkedCount: stats.checkedCount,
      target: stats.target,
      pct: stats.pct,
      unlocked: stats.unlocked
    });
    closeStorePicker();
    alert("Saved " + tier.label + " range for " + store.name + " — " + stats.checkedCount + "/" + stats.target + " (" + stats.pct + "%)");
    render();
  });

  document.getElementById("select-all-btn").addEventListener("click", function () {
    const state = Storage.loadState();
    const tier = window.PP_LAYOUT[state.ppSession.activeTier];
    if (confirm("Tick every product in " + tier.label + "? This can't be undone item-by-item.")) {
      Storage.selectAllTier(state.ppSession.activeTier);
      render();
    }
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
