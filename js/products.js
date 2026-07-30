// Product Presenter page logic: per-product tiles with wholesaler-aware case/bottle pricing
// and a live SUM / VAT 20% / Total summary.

function escAttr(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML.replace(/"/g, "&quot;");
}

function formatMoney(n) {
  return "£" + (Math.round(n * 100) / 100).toFixed(2);
}

function casePriceFor(state, id, wholesaler) {
  const p = state.prices[id];
  return (p && p[wholesaler]) || 0;
}

function unitPriceFor(casePrice, caseSize, unit) {
  return unit === "bottle" ? casePrice / caseSize : casePrice;
}

function lineTotal(state, id) {
  const product = window.CATALOG[id];
  const wholesaler = state.productsSession.activeWholesaler;
  const casePrice = casePriceFor(state, id, wholesaler);
  const unit = state.productsSession.units[id] || "case";
  const qty = state.productsSession.quantities[id] || 0;
  return qty * unitPriceFor(casePrice, product.caseSize, unit);
}

function computeSum(state) {
  let sum = 0;
  window.PRODUCTS_LAYOUT.forEach(function (section) {
    section.items.forEach(function (id) {
      sum += lineTotal(state, id);
    });
  });
  return sum;
}

function tileHtml(id, state) {
  const product = window.CATALOG[id];
  const wholesaler = state.productsSession.activeWholesaler;
  const casePrice = casePriceFor(state, id, wholesaler);
  const unit = state.productsSession.units[id] || "case";
  const qty = state.productsSession.quantities[id] || 0;
  const unitPrice = unitPriceFor(casePrice, product.caseSize, unit);
  const priceLabel = casePrice > 0 ? formatMoney(unitPrice) + (unit === "bottle" ? " / bottle" : " / case") : "Set case price";

  return (
    '<div class="tile" data-id="' + id + '">' +
      '<img src="' + product.image + '" alt="' + escAttr(product.name) + '" />' +
      '<button class="price-pill" data-action="price" data-id="' + id + '">' + priceLabel + "</button>" +
      '<div class="unit-toggle" data-id="' + id + '">' +
        '<button class="' + (unit === "case" ? "active" : "") + '" data-action="unit" data-unit="case" data-id="' + id + '">Case</button>' +
        '<button class="' + (unit === "bottle" ? "active" : "") + '" data-action="unit" data-unit="bottle" data-id="' + id + '">Bottle</button>' +
      "</div>" +
      '<div class="stepper">' +
        '<button data-action="dec" data-id="' + id + '" ' + (qty <= 0 ? "disabled" : "") + ">−</button>" +
        '<span class="qty">' + qty + "</span>" +
        '<button data-action="inc" data-id="' + id + '">+</button>' +
      "</div>" +
    "</div>"
  );
}

function sectionHtml(section, state) {
  const tiles = section.items.map(function (id) { return tileHtml(id, state); }).join("");
  return (
    '<section class="category">' +
      "<h3>" + escAttr(section.label) + "</h3>" +
      '<div class="tile-grid">' + tiles + "</div>" +
    "</section>"
  );
}

function render() {
  const state = Storage.loadState();

  document.querySelectorAll(".wholesaler-tabs button").forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.wholesaler === state.productsSession.activeWholesaler);
  });

  document.getElementById("sections").innerHTML = window.PRODUCTS_LAYOUT.map(function (section) {
    return sectionHtml(section, state);
  }).join("");

  const sum = computeSum(state);
  const vat = sum * 0.2;
  const total = sum + vat;
  document.getElementById("sum-value").textContent = formatMoney(sum);
  document.getElementById("vat-value").textContent = formatMoney(vat);
  document.getElementById("total-value").textContent = formatMoney(total);
}

document.addEventListener("DOMContentLoaded", function () {
  render();

  document.getElementById("wholesaler-tabs").addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-wholesaler]");
    if (!btn) return;
    Storage.setActiveWholesaler(btn.dataset.wholesaler);
    render();
  });

  document.getElementById("sections").addEventListener("click", function (e) {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "price") {
      const state = Storage.loadState();
      const wholesaler = state.productsSession.activeWholesaler;
      const product = window.CATALOG[id];
      const current = casePriceFor(state, id, wholesaler);
      const input = prompt("Case price for " + product.name + " (" + wholesaler + "):", current > 0 ? current : "");
      if (input === null) return;
      const price = parseFloat(input);
      if (!isNaN(price) && price >= 0) {
        Storage.setPrice(id, wholesaler, price);
        render();
      }
    } else if (action === "unit") {
      Storage.setUnit(id, btn.dataset.unit);
      render();
    } else if (action === "inc") {
      const state = Storage.loadState();
      Storage.setQty(id, (state.productsSession.quantities[id] || 0) + 1);
      render();
    } else if (action === "dec") {
      const state = Storage.loadState();
      Storage.setQty(id, Math.max(0, (state.productsSession.quantities[id] || 0) - 1));
      render();
    }
  });

  document.getElementById("reset-btn").addEventListener("click", function () {
    if (confirm("Start a new client? This will clear all quantities (your saved prices stay).")) {
      Storage.resetProductsSession();
      render();
    }
  });
});
