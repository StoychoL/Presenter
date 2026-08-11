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
    '<nav class="app-nav">' + linksHtml + "</nav>" +
    '<span class="rep-email" id="rep-email"></span>' +
    '<button type="button" class="rep-logout" id="rep-logout-btn">Log out</button>';

  document.body.insertBefore(header, document.body.firstChild);

  // Filled in once Firebase resolves the signed-in rep (see js/cloud-sync.js) — this header
  // renders before that's known, so it starts empty rather than waiting on auth.
  document.getElementById("rep-logout-btn").addEventListener("click", function () {
    if (window.FirebaseAuth) window.FirebaseAuth.signOut(window.FirebaseAuth.auth);
  });
  function showRepEmail() {
    const user = window.FirebaseAuth.auth.currentUser;
    document.getElementById("rep-email").textContent = user ? user.email : "";
  }
  if (window.FirebaseAuth) {
    window.FirebaseAuth.onAuthStateChanged(window.FirebaseAuth.auth, showRepEmail);
  } else {
    window.addEventListener("firebase-ready", function () {
      window.FirebaseAuth.onAuthStateChanged(window.FirebaseAuth.auth, showRepEmail);
    }, { once: true });
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("service-worker.js").catch(function () {});
  });
}
