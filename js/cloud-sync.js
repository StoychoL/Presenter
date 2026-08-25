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
// saved data — and, per hydrateAndSubscribe's owner check below, that data is either unowned
// (legacy/never-tagged) or already this same account's — ask before adopting it as the new
// account's starting point. Otherwise the account starts from the same defaults a fresh install
// would use. uid is threaded through purely to stamp ownership once initialization succeeds.
function handleFirstLogin(ref, uid) {
  const importIt = Storage.hasSavedData() && confirm(
    "This device has saved data (prices/call file) from before you signed in. Import it into your new account?"
  );
  const local = Storage.loadState();
  const slice = importIt
    ? { prices: local.prices, targetCounts: local.targetCounts, callfile: local.callfile, cashCarry: local.cashCarry }
    : Storage.defaultPersistedSlice();

  window.FirebaseDb.setDoc(ref, slice)
    .then(function () {
      Storage.hydrateFromCloud(slice);
      Storage.setOwnerUid(uid);
      rerenderIfPossible();
    })
    .catch(function (err) { console.error("Could not initialize your account:", err); });
}

function hydrateAndSubscribe(uid) {
  // This device's cached blob (if any) belongs to whichever uid last stamped it. A mismatch means
  // it's a *different* rep's data — wipe it before anything below can read it as "this account's
  // data", which is what let one rep's cache leak into another rep's brand-new account. No tag at
  // all (a device this code has never run on yet) is left alone here on purpose — that's the
  // legacy "adopt this device's pre-Firebase data" case handleFirstLogin still supports below.
  if (Storage.getOwnerUid() && Storage.getOwnerUid() !== uid) Storage.clearLocal();

  const ref = window.FirebaseDb.doc(window.FirebaseDb.db, "users", uid);

  window.FirebaseDb.getDoc(ref).then(function (snap) {
    if (snap.exists()) {
      Storage.hydrateFromCloud(snap.data());
      Storage.setOwnerUid(uid);
      rerenderIfPossible();
    } else {
      handleFirstLogin(ref, uid);
    }
    subscribeLive(ref);
  }).catch(function (err) {
    console.error("Could not load your saved data:", err);
  });
}

// Every push is chained onto this promise instead of being fired independently, so Firestore
// always receives them in the same order they were locally initiated — see the note in
// initCloudSync() below for why that matters (two unawaited writes can otherwise arrive at the
// server out of order over patchy wifi, letting an older write silently clobber a newer one).
let pushChain = Promise.resolve();

function initCloudSync() {
  const auth = window.FirebaseAuth.auth;

  // prices/targetCounts are always pushed in full (accepted last-write-wins, see CLAUDE.md) —
  // callfile is only included when callfileChanged is true (the non-callfile mutators, e.g.
  // setPrice, pass nothing, so a save from a device holding a stale local copy of the call file
  // can't blindly overwrite the cloud's newer one just because it happened to save something
  // unrelated). mergeFields (rather than a plain {merge: true}) is what makes the callfile write
  // itself safe to send wholesale: it replaces the *entire* callfile field with what's given —
  // including dropping any store key no longer present locally — while {merge: true}'s recursive
  // deep-merge on nested maps would leave a locally-deleted store's key alive on the server.
  //
  // Pushes are chained through pushChain rather than fired independently: a rep logging a
  // Platinum store's 2nd visit seconds after the 1st fires two unawaited setDoc calls, and without
  // this, a slow/patchy connection can let the 1st (older, 1-visit) write arrive at Firestore
  // *after* the 2nd (newer, 2-visit) one, silently overwriting it — even though both are correctly
  // timestamped, since the server just applies whichever write it receives last. Chaining ensures
  // the 2nd write's network request isn't even sent until the 1st has finished.
  window.CloudSync.pushState = function (state, callfileChanged) {
    const user = auth.currentUser;
    if (!user) return;
    // cashCarry is pushed unconditionally every save, same tier as prices/targetCounts — unlike
    // callfile's callfileChanged gate, a single flat always-fully-overwritten draft has no
    // multi-writer race worth guarding against, so there's no need for a dirty flag.
    const payload = { prices: state.prices, targetCounts: state.targetCounts, cashCarry: state.cashCarry };
    const fields = ["prices", "targetCounts", "cashCarry"];
    if (callfileChanged) {
      payload.callfile = state.callfile;
      fields.push("callfile");
    }
    pushChain = pushChain.catch(function () {}).then(function () {
      return window.FirebaseDb.setDoc(window.FirebaseDb.doc(window.FirebaseDb.db, "users", user.uid), payload, { mergeFields: fields });
    }).catch(function (err) { console.error("Cloud save failed:", err); });
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
