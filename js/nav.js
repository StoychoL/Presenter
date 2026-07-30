// Injects the shared header/nav into every page so the three HTML files stay visually consistent.

function renderNav(activePage) {
  const links = [
    { href: "index.html", label: "Home", key: "home" },
    { href: "products.html", label: "Product Presenter", key: "products" },
    { href: "partnership.html", label: "Partnership", key: "partnership" },
    { href: "callfile.html", label: "Call File", key: "callfile" }
  ];

  const linksHtml = links.map(function (l) {
    const activeClass = l.key === activePage ? " active" : "";
    return '<a class="' + activeClass.trim() + '" href="' + l.href + '">' + l.label + "</a>";
  }).join("");

  const header = document.createElement("header");
  header.className = "app-header";
  header.innerHTML =
    '<a class="brand" href="index.html">DIAGEO</a>' +
    '<nav class="app-nav">' + linksHtml + "</nav>";

  document.body.insertBefore(header, document.body.firstChild);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("service-worker.js").catch(function () {});
  });
}
