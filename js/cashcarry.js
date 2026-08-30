// Cash & Carry Form page logic: a native in-app replica of the external Microsoft Form (see
// js/layout-cashcarry.js for the verified schema and CLAUDE.md's "Cash & Carry Form" section for
// the full design rationale). Answers are a single remembered draft — every field, including all
// 39 per-product stock statuses, pre-fills with whatever was last saved until the rep changes it.
// The actual compliance submission still happens on the real Microsoft Form; "Open official form"
// just saves this draft first, then opens it in a new tab so the rep can quickly re-pick the same
// answers there.

function escAttr(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML.replace(/"/g, "&quot;");
}

function productRowsHtml(state) {
  const statuses = state.cashCarry.productStatus || {};
  return window.CASHCARRY_PRODUCTS.map(function (p) {
    const current = statuses[p.id] || "";
    const options = '<option value="">— Select —</option>' + window.CASHCARRY_STATUS_OPTIONS.map(function (opt) {
      return '<option value="' + escAttr(opt) + '"' + (opt === current ? " selected" : "") + ">" + escAttr(opt) + "</option>";
    }).join("");
    return (
      '<div class="cc-product-row">' +
        '<label class="cc-product-name">' + escAttr(p.name) + ", what is the stock status?</label>" +
        '<select class="date-input cc-status-select" data-product-id="' + p.id + '">' + options + "</select>" +
      "</div>"
    );
  }).join("");
}

function render() {
  const state = Storage.loadState();
  const cc = state.cashCarry;

  document.getElementById("cc-se-name").value = cc.seName || "";
  document.getElementById("cc-territory").value = cc.territoryName || "";

  const chainSelect = document.getElementById("cc-chain");
  chainSelect.innerHTML = '<option value="">— Select —</option>' + window.CASHCARRY_CHAINS.map(function (c) {
    return '<option value="' + c + '"' + (cc.chain === c ? " selected" : "") + ">" + c + "</option>";
  }).join("");

  document.getElementById("cc-other-text").value = cc.otherChainText || "";
  document.getElementById("cc-other-wrap").classList.toggle("hidden", cc.chain !== "Other");

  document.getElementById("cc-postcode").value = cc.postcode || "";
  document.getElementById("cc-depot-name").value = cc.depotName || "";

  const regionSelect = document.getElementById("cc-region");
  regionSelect.innerHTML = '<option value="">— Select —</option>' + window.CASHCARRY_REGIONS.map(function (r) {
    return '<option value="' + r + '"' + (cc.region === r ? " selected" : "") + ">" + r + "</option>";
  }).join("");

  document.getElementById("cc-products").innerHTML = productRowsHtml(state);

  document.getElementById("cc-email").value = cc.sendEmail || "";
}

function collectAndSave() {
  const productStatus = {};
  document.querySelectorAll(".cc-status-select").forEach(function (sel) {
    if (sel.value) productStatus[sel.dataset.productId] = sel.value;
  });

  const fields = {
    seName: document.getElementById("cc-se-name").value,
    territoryName: document.getElementById("cc-territory").value,
    chain: document.getElementById("cc-chain").value || null,
    otherChainText: document.getElementById("cc-other-text").value,
    postcode: document.getElementById("cc-postcode").value,
    depotName: document.getElementById("cc-depot-name").value,
    region: document.getElementById("cc-region").value || null,
    productStatus: productStatus,
    sendEmail: document.getElementById("cc-email").value
  };

  Storage.saveCashCarryDraft(fields);
  render();
}

// Plain-text summary for the mailto: body. Lists every product (not just answered ones) so a gap
// itself is visible information, not silently dropped — see CLAUDE.md's Cash & Carry Form section.
function emailBodyText(state) {
  const cc = state.cashCarry;
  const statuses = cc.productStatus || {};
  const lines = [
    "SE Name: " + (cc.seName || ""),
    "Territory: " + (cc.territoryName || ""),
    "C&C Visited: " + (cc.chain || "") + (cc.chain === "Other" && cc.otherChainText ? " (" + cc.otherChainText + ")" : ""),
    "Postcode: " + (cc.postcode || ""),
    "Depot Name: " + (cc.depotName || ""),
    "Region: " + (cc.region || ""),
    "",
    "Product stock statuses:"
  ];
  window.CASHCARRY_PRODUCTS.forEach(function (p) {
    lines.push(p.name + ": " + (statuses[p.id] || "Not answered"));
  });
  return lines.join("\r\n");
}

function openSendEmail() {
  const emailInput = document.getElementById("cc-email");
  if (!emailInput.value || !emailInput.checkValidity()) {
    emailInput.reportValidity();
    emailInput.focus();
    return;
  }

  collectAndSave();

  const state = Storage.loadState();
  const cc = state.cashCarry;
  const subject = "Cash & Carry Stock Report — " + (cc.depotName || cc.chain || "") + " — " + new Date().toLocaleDateString("en-GB");
  const body = emailBodyText(state);

  window.location.href = "mailto:" + encodeURIComponent(emailInput.value) +
    "?subject=" + encodeURIComponent(subject) +
    "&body=" + encodeURIComponent(body);
}

function flashSaved() {
  const btn = document.getElementById("cc-save-btn");
  const original = "Save answers";
  btn.textContent = "Saved ✓";
  setTimeout(function () { btn.textContent = original; }, 1500);
}

document.addEventListener("DOMContentLoaded", function () {
  render();

  document.getElementById("cc-chain").addEventListener("change", function (e) {
    document.getElementById("cc-other-wrap").classList.toggle("hidden", e.target.value !== "Other");
  });

  document.getElementById("cc-save-btn").addEventListener("click", function () {
    collectAndSave();
    flashSaved();
  });

  document.getElementById("cc-send-btn").addEventListener("click", openSendEmail);

  // Belt-and-suspenders: a rep who jumps straight to the official form without tapping "Save
  // answers" first still gets this visit's edits captured — the anchor's default new-tab
  // navigation isn't blocked, this just runs alongside it.
  document.getElementById("cc-open-form-link").addEventListener("click", function () {
    collectAndSave();
  });
});
