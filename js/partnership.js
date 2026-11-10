// Range page logic (partnership.html — the old Partnership Program tab). One plain list of every
// product (js/layout-pp.js's single "range" tier), each tile with an explicit "In stock" tick box
// underneath; tapping the tile anywhere else opens a magnified product modal. The top-right badge
// is just ticked / total. Ticks are session-only (ppSession.checked) and can be frozen onto a
// store via "Save to Store" (ppHistory, reviewed from Call File/Map).

var ppUi = { wasComplete: false, zoomId: null, storePickerOpen: false };

var RANGE_KEY = "range";

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

function tileHtml(id, checked) {
  const product = window.CATALOG[id];
  return (
    '<div class="tile pp-tile" data-id="' + id + '">' +
      '<img src="' + product.image + '" alt="' + escAttr(product.name) + '" />' +
      '<label class="tick-row' + (checked ? " checked" : "") + '" data-action="toggle" data-id="' + id + '">' +
        '<input type="checkbox" ' + (checked ? "checked" : "") + " />" +
        "<span>In stock</span>" +
      "</label>" +
    "</div>"
  );
}

function rangeTier() {
  return window.PP_LAYOUT[RANGE_KEY];
}

function rangeItems() {
  const ids = [];
  rangeTier().sections.forEach(function (section) { section.items.forEach(function (id) { ids.push(id); }); });
  return ids;
}

function checkedSetFromState(state) {
  const set = new Set();
  Object.keys(state.ppSession.checked).forEach(function (id) {
    if (state.ppSession.checked[id]) set.add(id);
  });
  return set;
}

// Ticked ids within the range, in list order — what gets frozen into a store's snapshot.
function rangeCheckedIds(state) {
  const set = checkedSetFromState(state);
  return rangeItems().filter(function (id) { return set.has(id); });
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
  const items = rangeItems();
  const checkedCount = rangeCheckedIds(state).length;

  document.getElementById("tier-sections").innerHTML =
    '<section class="category"><div class="tile-grid">' +
      items.map(function (id) { return tileHtml(id, !!state.ppSession.checked[id]); }).join("") +
    "</div></section>";

  document.getElementById("progress-frac").textContent = checkedCount + " / " + items.length;

  // A little celebration once every product is ticked.
  const badge = document.getElementById("progress-badge");
  const complete = items.length > 0 && checkedCount === items.length;
  if (complete && !ppUi.wasComplete) {
    badge.classList.remove("celebrate");
    void badge.offsetWidth; // restart animation
  }
  badge.classList.toggle("celebrate", complete);
  ppUi.wasComplete = complete;

  renderModal(state);
  renderStorePicker(state);
}

document.addEventListener("DOMContentLoaded", function () {
  render();

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
    const store = state.callfile.stores[key];
    const ids = rangeCheckedIds(state);
    const total = rangeItems().length;
    Storage.savePPSnapshot(key, window.PPStats.buildSnapshot(RANGE_KEY, ids, total, todayISO()));
    closeStorePicker();
    alert("Saved range for " + store.name + " — " + ids.length + "/" + total);
    render();
  });

  document.getElementById("select-all-btn").addEventListener("click", function () {
    if (confirm("Tick every product? This can't be undone item-by-item.")) {
      Storage.selectAllTier(RANGE_KEY);
      render();
    }
  });

  document.getElementById("reset-btn").addEventListener("click", function () {
    if (confirm("Start a new store? This will clear all ticked products.")) {
      Storage.resetPPSession();
      ppUi.wasComplete = false;
      render();
    }
  });
});
