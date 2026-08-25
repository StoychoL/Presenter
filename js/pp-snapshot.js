// Shared tile/section rendering for a Call File "Range" snapshot — used by both js/callfile.js
// and js/map.js (loaded only on callfile.html/map.html, not partnership.html, which keeps its own
// live tile renderer with the jump-to-core cosmetic a bounded single-snapshot editor doesn't
// need). Replaces what used to be two byte-identical copies of the read-only renderer in those
// two files, and adds the editable variant both pages now need identically for range editing.

// Read-only tile — no click handler, just a fixed record of what was ticked. Used for a snapshot
// that isn't currently being edited.
function ppReadOnlyTileHtml(id, checked) {
  const product = window.CATALOG[id];
  if (!product) return "";
  return (
    '<div class="tile pp-tile">' +
      '<img src="' + product.image + '" alt="' + escAttr(product.name) + '" />' +
      '<div class="tick-row' + (checked ? " checked" : "") + '"><span>' + (checked ? "✓ In stock" : "Not stocked") + "</span></div>" +
    "</div>"
  );
}

// Editable tile — modeled on partnership.js's tileHtml, minus the jump-to-core "Bonus" cosmetic
// (not meaningful for a frozen/in-progress snapshot). data-action="range-toggle" is the hook the
// page's delegated click listener toggles membership in the in-progress edit buffer through.
function ppEditableTileHtml(id, checked) {
  const product = window.CATALOG[id];
  if (!product) return "";
  return (
    '<div class="tile pp-tile" data-id="' + id + '">' +
      '<img src="' + product.image + '" alt="' + escAttr(product.name) + '" />' +
      '<label class="tick-row' + (checked ? " checked" : "") + '" data-action="range-toggle" data-id="' + id + '">' +
        '<input type="checkbox" ' + (checked ? "checked" : "") + " />" +
        "<span>In stock</span>" +
      "</label>" +
    "</div>"
  );
}

// Editable-mode-only gate tag, mirroring partnership.js's gateTagHtml but driven by an arbitrary
// checked Set via window.PPStats rather than state.ppSession.checked.
function ppGateTagHtml(section, checkedSet) {
  if (section.isCore) {
    const core = window.PPStats.coreStats({ sections: [section] }, checkedSet);
    return ' <span class="core-status ' + (core.coreComplete ? "complete" : "partial") + '">' +
      (core.coreComplete ? "✓ Complete" : core.coreCheckedCount + "/" + core.coreTotal) +
    "</span>";
  }
  const gate = window.PPStats.sectionGateStats(section, checkedSet);
  if (!gate || section.gate.hideTag) return "";
  const parts = gate.groups.map(function (g) { return g.label + " " + g.checked + "/" + g.total; }).join(" · ");
  return ' <span class="core-status ' + (gate.complete ? "complete" : "partial") + '">' +
    (gate.complete ? "✓ " + parts : parts) +
  "</span>";
}

// tierKey + a checked-id list -> full section HTML. opts.editable=false is byte-identical to the
// old read-only snapshotSectionsHtml (no gate tags, no click handler, fixed section.items, no
// "jump to Core" promotion since that's a live-editing display feature a frozen/single-tier view
// doesn't need). opts.editable=true adds gate tags and clickable checkbox tiles.
function ppSnapshotSectionsHtml(tierKey, checkedIds, opts) {
  const tier = window.PP_LAYOUT[tierKey];
  if (!tier) return "";
  const editable = !!(opts && opts.editable);
  const checkedSet = new Set(checkedIds);
  return tier.sections.map(function (section) {
    const tiles = section.items.map(function (id) {
      return editable ? ppEditableTileHtml(id, checkedSet.has(id)) : ppReadOnlyTileHtml(id, checkedSet.has(id));
    }).join("");
    const gateTag = editable ? ppGateTagHtml(section, checkedSet) : "";
    return '<section class="category"><h3>' + escAttr(section.label) + gateTag + '</h3><div class="tile-grid">' + tiles + "</div></section>";
  }).join("");
}

window.PPSnapshot = { sectionsHtml: ppSnapshotSectionsHtml };
