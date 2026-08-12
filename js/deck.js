// Renders the Sales Presenter Deck PDF as a plain scrollable column of <canvas> pages via the
// vendored PDF.js (js/vendor/pdfjs/), instead of relying on native/OS-level PDF viewing.
// Native inline-PDF rendering (an <iframe>/<embed> pointed at the file, or a top-level
// navigation) proved unreliable across standalone-PWA webviews — either stuck on page one with
// no scrolling, or navigating the whole app window away with no way back. Rendering every page
// ourselves onto a canvas guarantees the same fully-scrollable behavior everywhere.

const PDF_URL = "images/Sales%20Presenter%20Deck%20V19%20with%20No%20PMP%20%20(1).pdf";

pdfjsLib.GlobalWorkerOptions.workerSrc = "js/vendor/pdfjs/pdf.worker.min.js";

let pdfDoc = null;

// Only renders a page's canvas once its placeholder scrolls near the viewport — a 60+-page deck
// rendered all at once up front would be slow and memory-heavy on a tablet.
const renderObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (!entry.isIntersecting) return;
    const slot = entry.target;
    renderObserver.unobserve(slot);
    renderPageIntoSlot(parseInt(slot.dataset.pageNum, 10), slot);
  });
}, { rootMargin: "800px 0px" });

function renderPageIntoSlot(pageNum, slot) {
  pdfDoc.getPage(pageNum).then(function (page) {
    const unscaled = page.getViewport({ scale: 1 });
    const containerWidth = document.getElementById("deck-pages").clientWidth;
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min((containerWidth * dpr) / unscaled.width, 2 * dpr);
    const viewport = page.getViewport({ scale: scale });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.className = "deck-page-canvas";

    page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport }).promise.then(function () {
      slot.innerHTML = "";
      slot.style.aspectRatio = "";
      slot.appendChild(canvas);
      slot.classList.add("rendered");
    });
  });
}

function buildSlots(numPages) {
  const container = document.getElementById("deck-pages");
  let chain = Promise.resolve();
  for (let i = 1; i <= numPages; i++) {
    chain = chain.then(function () {
      return pdfDoc.getPage(i).then(function (page) {
        const unscaled = page.getViewport({ scale: 1 });
        const slot = document.createElement("div");
        slot.className = "deck-page-slot";
        slot.dataset.pageNum = String(i);
        slot.style.aspectRatio = unscaled.width + " / " + unscaled.height;
        slot.innerHTML = '<span class="deck-page-num">' + i + "</span>";
        container.appendChild(slot);
        renderObserver.observe(slot);
      });
    });
  }
  return chain;
}

document.addEventListener("DOMContentLoaded", function () {
  const status = document.getElementById("deck-status");
  pdfjsLib.getDocument(PDF_URL).promise
    .then(function (pdf) {
      pdfDoc = pdf;
      return buildSlots(pdf.numPages);
    })
    .then(function () {
      status.classList.add("hidden");
    })
    .catch(function () {
      status.textContent = "Couldn't load the deck. Check your connection and reopen this page.";
    });
});
