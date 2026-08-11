// Auth guard + Firestore sync layer sitting on top of js/storage.js, loaded on every page except
// login.html. See CLAUDE.md's "Cloud sync (Firebase)" section for the full design rationale:
// localStorage stays the synchronous read path every page's render() already uses; this file's
// only job is to keep it hydrated from — and mirrored up to — the signed-in rep's private
// Firestore document (js/storage.js's saveState() calls CloudSync.pushState() on every save).
//
// Waits for js/firebase-config.js (an ES module, so it may finish after this classic script
// starts) to signal readiness via the "firebase-ready" event before touching window.FirebaseAuth.

// A safe no-op until Firebase is ready — storage.js may call this before hydration completes.
window.CloudSync = { pushState: function () {} };

function rerenderIfPossible() {
  if (typeof window.render === "function") window.render();
}

function subscribeLive(ref) {
  window.FirebaseDb.onSnapshot(ref, function (snap) {
    if (!snap.exists() || snap.metadata.hasPendingWrites) return; // hasPendingWrites = our own write echoing back
    Storage.hydrateFromCloud(snap.data());
    rerenderIfPossible();
  }, function (err) { console.error("Live sync error:", err); });
}

// First time this rep has ever signed in (no Firestore doc yet): if this device already has real
// saved data, ask before adopting it as the new account's starting point — otherwise the account
// starts from the same defaults a fresh install would use.
function handleFirstLogin(ref) {
  const importIt = Storage.hasSavedData() && confirm(
    "This device has saved data (prices/call file) from before you signed in. Import it into your new account?"
  );
  const local = Storage.loadState();
  const slice = importIt
    ? { prices: local.prices, targetCounts: local.targetCounts, callfile: local.callfile }
    : Storage.defaultPersistedSlice();

  window.FirebaseDb.setDoc(ref, slice)
    .then(function () {
      Storage.hydrateFromCloud(slice);
      rerenderIfPossible();
    })
    .catch(function (err) { console.error("Could not initialize your account:", err); });
}

function hydrateAndSubscribe(uid) {
  const ref = window.FirebaseDb.doc(window.FirebaseDb.db, "users", uid);

  window.FirebaseDb.getDoc(ref).then(function (snap) {
    if (snap.exists()) {
      Storage.hydrateFromCloud(snap.data());
      rerenderIfPossible();
    } else {
      handleFirstLogin(ref);
    }
    subscribeLive(ref);
  }).catch(function (err) {
    console.error("Could not load your saved data:", err);
  });
}

function initCloudSync() {
  const auth = window.FirebaseAuth.auth;

  window.CloudSync.pushState = function (state) {
    const user = auth.currentUser;
    if (!user) return;
    const slice = { prices: state.prices, targetCounts: state.targetCounts, callfile: state.callfile };
    window.FirebaseDb.setDoc(window.FirebaseDb.doc(window.FirebaseDb.db, "users", user.uid), slice)
      .catch(function (err) { console.error("Cloud save failed:", err); });
  };

  window.FirebaseAuth.onAuthStateChanged(auth, function (user) {
    if (!user) { window.location.replace("login.html"); return; }
    hydrateAndSubscribe(user.uid);
  });
}

if (window.FirebaseAuth) {
  initCloudSync();
} else {
  window.addEventListener("firebase-ready", initCloudSync, { once: true });
}
