// Range checklist (the old Partnership Program tab, partnership.html). The tiered scheme (Tier
// 1/2/3, Core/Bonus Range, gates, rewards) was dropped: the page is now one plain list of every
// product, ticked to record what a store stocks.
//
// It is still exposed as a single-"tier" PP_LAYOUT so everything built on that shape keeps
// working unchanged — js/pp-stats.js's math, js/pp-snapshot.js's Call File/Map range pop-up,
// ppHistory snapshots and state.targetCounts. With no isCore/gate/unlockCount the stats reduce to
// a plain checked/total count. Old snapshots saved under tier1/2/3 are mapped onto "range" by
// js/state-shape.js's sanitizeSnapshot.
//
// Order follows Build Your Order (window.PRODUCTS_LAYOUT) when that file is loaded on the page;
// otherwise catalog order. The target is the catalog size either way, so it matches on every page.

(function () {
  const catalogIds = Object.keys(window.CATALOG || {});
  let items = [];
  (window.PRODUCTS_LAYOUT || []).forEach(function (section) {
    section.items.forEach(function (id) {
      if (window.CATALOG[id] && items.indexOf(id) === -1) items.push(id);
    });
  });
  // Anything in the catalog but not in the products layout still belongs in the range.
  catalogIds.forEach(function (id) { if (items.indexOf(id) === -1) items.push(id); });

  window.PP_LAYOUT = {
    range: {
      label: "Range",
      targetCount: catalogIds.length,
      sections: [{ label: "", items: items }]
    }
  };
})();
