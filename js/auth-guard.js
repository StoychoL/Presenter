// Minimal sign-in guard for pages that have no rep state to sync (deck.html / pp-deck.html) and
// therefore don't load js/storage.js + js/cloud-sync.js. Same "firebase-ready" handshake as
// everywhere else (see js/firebase-config.js): redirect to login.html the moment Firebase reports
// no signed-in user. Without this, the two deck pages were the only app pages reachable without an
// account, and js/nav.js's Log out button / email label on them had no Firebase to talk to.

function initAuthGuard() {
  window.FirebaseAuth.onAuthStateChanged(window.FirebaseAuth.auth, function (user) {
    if (!user) window.location.replace("login.html");
  });
}

if (window.FirebaseAuth) {
  initAuthGuard();
} else {
  window.addEventListener("firebase-ready", initAuthGuard, { once: true });
}
