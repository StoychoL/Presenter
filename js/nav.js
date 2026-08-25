// Injects the shared header/nav into every page so the three HTML files stay visually consistent.

function renderNav(activePage) {
  const links = [
    { href: "index.html", label: "Dashboard", key: "home" },
    { href: "products.html", label: "Build Order", key: "products" },
    { href: "partnership.html", label: "Partnership", key: "partnership" },
    { href: "callfile.html", label: "Call File", key: "callfile" },
    { href: "map.html", label: "Map", key: "map" },
    { href: "cashcarry.html", label: "Cash & Carry", key: "cashcarry" }
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
    '<div class="rep-menu-wrap">' +
      '<button type="button" class="rep-menu-toggle" id="rep-menu-toggle" aria-label="Account menu" aria-haspopup="true" aria-expanded="false">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"></path></svg>' +
      "</button>" +
      '<div class="rep-menu hidden" id="rep-menu">' +
        '<div class="rep-email" id="rep-email"></div>' +
        '<button type="button" class="rep-logout" id="rep-logout-btn">Log out</button>' +
      "</div>" +
    "</div>";

  document.body.insertBefore(header, document.body.firstChild);

  const menuToggle = document.getElementById("rep-menu-toggle");
  const menu = document.getElementById("rep-menu");

  function closeMenu() {
    menu.classList.add("hidden");
    menuToggle.setAttribute("aria-expanded", "false");
  }
  function toggleMenu() {
    const willOpen = menu.classList.contains("hidden");
    menu.classList.toggle("hidden", !willOpen);
    menuToggle.setAttribute("aria-expanded", String(willOpen));
  }

  menuToggle.addEventListener("click", function (e) {
    e.stopPropagation();
    toggleMenu();
  });
  document.addEventListener("click", function (e) {
    if (!menu.classList.contains("hidden") && !header.contains(e.target)) closeMenu();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !menu.classList.contains("hidden")) closeMenu();
  });

  // Filled in once Firebase resolves the signed-in rep (see js/cloud-sync.js) — this header
  // renders before that's known, so it starts empty rather than waiting on auth.
  document.getElementById("rep-logout-btn").addEventListener("click", function () {
    // Wipe this device's cached data as the rep signs out, so it can't linger — even momentarily —
    // for whoever signs in next on a shared device. See js/storage.js's clearLocal().
    if (window.Storage) window.Storage.clearLocal();
    if (window.FirebaseAuth) window.FirebaseAuth.signOut(window.FirebaseAuth.auth);
    closeMenu();
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
