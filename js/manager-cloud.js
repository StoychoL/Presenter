// Auth guard + read-only cross-rep data fetch for the manager pages (manager-dashboard.html,
// manager-map.html) — the manager-side counterpart to js/cloud-sync.js, but fundamentally
// different in shape: cloud-sync.js hydrates ONE rep's own users/{uid} doc and keeps it live via
// onSnapshot; this file confirms the signed-in account is a registered manager (managers/{uid},
// see js/manager-auth.js and firestore.rules), then does a single getDocs() across every rep's
// users/{uid} doc and exposes the result as window.ManagerData.reps. Manager pages never write to
// Firestore at all, so there's no push/subscribe machinery here, and js/storage.js/js/cloud-sync.js
// are not loaded on these pages — managers have no local rep-state blob of their own.
//
// Waits for js/firebase-config.js (an ES module, so it may finish after this classic script
// starts) to signal readiness via the "firebase-ready" event, same handshake as everywhere else
// Firebase is used.

// reps starts null (distinct from an empty array) so page render() functions can tell "still
// loading" apart from "loaded, but there are genuinely no rep accounts yet".
window.ManagerData = { reps: null, displayName: repDisplayName };

// Turns "tony.lyubenov@diageotrade.co.uk" into "Tony Lyubenov" — reps' emails follow a
// firstname.lastname@ convention, so this is a display-only formatting of already-fetched data,
// not a new field. Falls back to the raw email (no "." in the local part) or the uid (no email at
// all) so a rep record missing repEmail still renders something rather than breaking.
function repDisplayName(rep) {
  const email = rep && rep.repEmail;
  if (!email) return (rep && rep.uid) || "";
  const local = email.split("@")[0];
  if (!local) return email;
  const parts = local.split(".").filter(Boolean).map(function (part) {
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  });
  return parts.length ? parts.join(" ") : email;
}

function rerenderIfPossible() {
  if (typeof window.render === "function") window.render();
}

// Each users/{uid} doc holds a rep's full persisted slice (prices/targetCounts/cashCarry/
// ccLocations/repTerritory/repEmail/callfile) — the manager dashboard/map only need callfile,
// repTerritory, and repEmail, but the client SDK has no field-projection option, so the rest just
// goes unused per rep here.
function loadAllReps() {
  const usersRef = window.FirebaseDb.collection(window.FirebaseDb.db, "users");
  return window.FirebaseDb.getDocs(usersRef).then(function (snap) {
    const reps = [];
    snap.forEach(function (doc) {
      const data = doc.data();
      reps.push({
        uid: doc.id,
        repEmail: data.repEmail || null,
        repTerritory: data.repTerritory || null,
        callfile: data.callfile || { stores: {} }
      });
    });
    window.ManagerData.reps = reps;
    rerenderIfPossible();
  }).catch(function (err) {
    console.error("Could not load rep data:", err);
  });
}

function initManagerCloud() {
  const auth = window.FirebaseAuth.auth;

  window.FirebaseAuth.onAuthStateChanged(auth, function (user) {
    if (!user) { window.location.replace("manager-login.html"); return; }

    const managerRef = window.FirebaseDb.doc(window.FirebaseDb.db, "managers", user.uid);
    window.FirebaseDb.getDoc(managerRef).then(function (snap) {
      if (!snap.exists()) {
        // Signed in, but not a registered manager (e.g. a rep account) — this page has nothing
        // for them; sign out rather than leaving a half-authenticated session sitting on it.
        window.FirebaseAuth.signOut(auth).then(function () {
          window.location.replace("manager-login.html");
        });
        return;
      }
      loadAllReps();
    }).catch(function (err) {
      console.error("Could not verify manager account:", err);
    });
  });
}

if (window.FirebaseAuth) {
  initManagerCloud();
} else {
  window.addEventListener("firebase-ready", initManagerCloud, { once: true });
}
