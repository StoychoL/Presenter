// Injects the shared left-hand sidebar shell into every rep page so they stay visually
// consistent. Parallel to js/manager-nav.js's manager sidebar (same shell/move-body-into-main
// technique) but kept separate — this file is "the only place that knows the [rep] page list".

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

  const shell = document.createElement("div");
  shell.className = "rep-shell";
  shell.innerHTML =
    '<aside class="rep-sidebar">' +
      '<a class="brand" href="index.html">DIAGEO</a>' +
      '<nav class="rep-sidebar-nav">' + linksHtml + "</nav>" +
      '<div class="rep-account">' +
        '<div class="rep-email" id="rep-email"></div>' +
        '<button type="button" class="rep-logout" id="rep-logout-btn">Log out</button>' +
      "</div>" +
    "</aside>" +
    '<div class="rep-main"></div>';

  // Move every existing body child into the new <main>, then mount the shell — same
  // "wrap whatever the page already declared" approach as js/manager-nav.js.
  const mainEl = shell.querySelector(".rep-main");
  while (document.body.firstChild) mainEl.appendChild(document.body.firstChild);
  document.body.appendChild(shell);

  // Filled in once Firebase resolves the signed-in rep (see js/cloud-sync.js) — this sidebar
  // renders before that's known, so it starts empty rather than waiting on auth.
  document.getElementById("rep-logout-btn").addEventListener("click", function () {
    // Wipe this device's cached data as the rep signs out, so it can't linger — even momentarily —
    // for whoever signs in next on a shared device. See js/storage.js's clearLocal().
    if (window.Storage) window.Storage.clearLocal();
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
