// Injects the shared left-hand sidebar shell into every rep page so they stay visually
// consistent. Parallel to js/manager-nav.js's manager sidebar (same shell/move-body-into-main
// technique) but kept separate — this file is "the only place that knows the [rep] page list".
//
// Loaded as the LAST script on each page as <script src="js/nav.js" data-page="callfile"> — the
// page key comes from that data attribute (document.currentScript) rather than an inline
// <script>renderNav("callfile")</script>, because the Content-Security-Policy on every page
// (vercel.json + each page's <meta http-equiv>) forbids inline scripts. Being last is what makes
// the "move every existing body child into .rep-main" step below pick up the whole page.

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
        '<div class="rep-sync" id="rep-sync" aria-live="polite"></div>' +
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

  renderSyncStatus();
  window.addEventListener("cloud-sync-status", renderSyncStatus);
  window.addEventListener("online", renderSyncStatus);
  window.addEventListener("offline", renderSyncStatus);
}

// Small one-line sync indicator under the rep's email, driven by js/cloud-sync.js's status
// object + "cloud-sync-status" events and the browser's online/offline state. A rep working
// offline all day used to have no way to know their visits hadn't reached Firestore yet — every
// failure went to console.error only. Pages without cloud sync (deck pages) simply show nothing.
function renderSyncStatus() {
  const el = document.getElementById("rep-sync");
  if (!el || !window.CloudSync) return;
  const status = window.CloudSync.status;
  let text = "";
  let warn = false;
  if (navigator.onLine === false) {
    text = "Offline — changes saved on this device";
    warn = true;
  } else if (status.state === "saving") {
    text = "Saving…";
  } else if (status.state === "error") {
    text = "Not synced — check your connection";
    warn = true;
  } else if (status.state === "synced") {
    text = "Synced";
  }
  el.textContent = text;
  el.classList.toggle("warn", warn);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("service-worker.js").catch(function () {});
  });
}

if (document.currentScript && document.currentScript.dataset.page) {
  renderNav(document.currentScript.dataset.page);
}
