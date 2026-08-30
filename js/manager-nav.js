// Injects the manager area's left-hand sidebar shell (Dashboard/Map + account menu) into
// manager-dashboard.html/manager-map.html. Kept fully separate from js/nav.js, which CLAUDE.md
// notes is "the only place that knows the [rep] page list" — the manager area is a parallel,
// unrelated account type with its own two-page nav, not an extension of the rep shell.

function renderManagerNav(activePage) {
  const links = [
    { href: "manager-dashboard.html", label: "Dashboard", key: "dashboard" },
    { href: "manager-map.html", label: "Map", key: "map" }
  ];

  const linksHtml = links.map(function (l) {
    const activeClass = l.key === activePage ? " active" : "";
    return '<a class="' + activeClass.trim() + '" href="' + l.href + '">' + l.label + "</a>";
  }).join("");

  const shell = document.createElement("div");
  shell.className = "manager-shell";
  shell.innerHTML =
    '<aside class="manager-sidebar">' +
      '<a class="brand" href="manager-dashboard.html">DIAGEO</a>' +
      '<div class="manager-sidebar-label">Manager</div>' +
      '<nav class="manager-sidebar-nav">' + linksHtml + "</nav>" +
      '<div class="manager-account">' +
        '<div class="rep-email" id="rep-email"></div>' +
        '<button type="button" class="rep-logout" id="rep-logout-btn">Log out</button>' +
      "</div>" +
    "</aside>" +
    '<div class="manager-main"></div>';

  // Move every existing body child into the new <main>, then mount the shell — same
  // "wrap whatever the page already declared" approach as js/nav.js inserting a header, just
  // sidewise instead of on top, since the sidebar needs to sit alongside the content, not above it.
  const mainEl = shell.querySelector(".manager-main");
  while (document.body.firstChild) mainEl.appendChild(document.body.firstChild);
  document.body.appendChild(shell);

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
