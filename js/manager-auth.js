// Manager login page logic — mirrors js/auth.js's rep sign-in/sign-up flow, with two differences:
// (1) signup requires a shared access code. The code is NOT in this file: signup writes it into
// the new managers/{uid} marker doc and firestore.rules compares it against /config/managerAccess
// (a doc no client can read), so the check is enforced server-side even though this app has no
// backend — a wrong code is rejected as permission-denied and the just-created auth account is
// deleted again. That marker doc is what firestore.rules checks via exists() to grant read access
// to every rep's users/{uid} doc; (2) sign-in additionally confirms managers/{uid} exists before
// proceeding, so a rep's own credentials can't accidentally land them in the manager area.
//
// Waits for js/firebase-config.js (an ES module, so it may finish after this classic script
// starts) to signal readiness via the "firebase-ready" event before touching window.FirebaseAuth
// — see that file's header comment for why the handshake is needed.

function showError(message) {
  const el = document.getElementById("auth-error");
  el.textContent = message;
  el.classList.toggle("hidden", !message);
}

function friendlyError(err) {
  const code = err && err.code;
  if (code === "auth/email-already-in-use") return "That email already has an account — try signing in instead.";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") return "Email or password is incorrect.";
  if (code === "auth/weak-password" || code === "auth/password-does-not-meet-requirements") return "Password must be at least 8 characters.";
  if (code === "auth/invalid-email") return "That doesn't look like a valid email address.";
  return (err && err.message) || "Something went wrong — try again.";
}

// Server-only read on purpose: with Firestore's local cache, a plain getDoc() reflects pending
// local writes — so during signup the managers/{uid} doc this page just tried to create looks
// like it exists for the split second before the server rejects it (wrong code), which was
// enough for the onAuthStateChanged redirect below to land the user on the dashboard before the
// rollback could run. getDocFromServer() ignores the cache and pending writes entirely.
function isManager(uid) {
  const ref = window.FirebaseDb.doc(window.FirebaseDb.db, "managers", uid);
  return window.FirebaseDb.getDocFromServer(ref).then(function (snap) { return snap.exists(); });
}

// True from the moment signup starts until it has either landed on the dashboard or been rolled
// back — onAuthStateChanged fires as soon as the auth account exists (before the marker write
// has been accepted), and must not redirect on its own during that window.
let signupInProgress = false;

function initAuthPage() {
  const auth = window.FirebaseAuth.auth;

  // Redirect straight through if already signed in *as a manager*. A signed-in non-manager
  // (e.g. a rep's session in the same browser) is left on the form rather than force-signed-out —
  // signing in again below will correctly reject them with the "not registered as a manager"
  // message instead of silently doing nothing.
  window.FirebaseAuth.onAuthStateChanged(auth, function (user) {
    if (!user || signupInProgress) return;
    isManager(user.uid).then(function (ok) {
      if (ok) window.location.replace("manager-dashboard.html");
    }).catch(function () { /* offline: stay on the form */ });
  });

  let mode = "signin";

  function setMode(next) {
    mode = next;
    document.getElementById("auth-title").textContent = mode === "signin" ? "Manager sign in" : "Create your manager account";
    document.getElementById("auth-submit-btn").textContent = mode === "signin" ? "Sign in" : "Create account";
    document.getElementById("auth-toggle-btn").textContent = mode === "signin" ? "New here? Create a manager account" : "Already have an account? Sign in";
    document.getElementById("auth-forgot-btn").classList.toggle("hidden", mode !== "signin");
    document.getElementById("auth-code-label").classList.toggle("hidden", mode !== "signup");
    document.getElementById("auth-code").classList.toggle("hidden", mode !== "signup");
    showError("");
  }

  document.getElementById("auth-toggle-btn").addEventListener("click", function () {
    setMode(mode === "signin" ? "signup" : "signin");
  });

  document.getElementById("auth-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    const code = document.getElementById("auth-code").value.trim();
    if (!email || !password) { showError("Enter an email and password."); return; }
    if (mode === "signup" && !code) { showError("Enter the manager access code."); return; }

    showError("");
    const submitBtn = document.getElementById("auth-submit-btn");
    submitBtn.disabled = true;

    if (mode === "signup") {
      signupInProgress = true;
      window.FirebaseAuth.createUserWithEmailAndPassword(auth, email, password)
        .then(function (cred) {
          const ref = window.FirebaseDb.doc(window.FirebaseDb.db, "managers", cred.user.uid);
          // email must equal the account's own email and code must match /config/managerAccess,
          // or firestore.rules rejects this with permission-denied.
          return window.FirebaseDb.setDoc(ref, { email: cred.user.email, createdAt: new Date().toISOString(), code: code })
            .catch(function (err) {
              if (err && err.code === "permission-denied") {
                // Wrong code: undo the account creation so no orphan sign-in is left behind, then
                // report it. deleteUser needs a recent sign-in, which a just-created account has.
                return window.FirebaseAuth.deleteUser(cred.user)
                  .catch(function () { return window.FirebaseAuth.signOut(auth); })
                  .then(function () { throw { code: "manager/bad-code" }; });
              }
              throw err;
            });
        })
        .then(function () { window.location.replace("manager-dashboard.html"); })
        .catch(function (err) {
          signupInProgress = false;
          showError(err && err.code === "manager/bad-code" ? "That access code isn't valid." : friendlyError(err));
          submitBtn.disabled = false;
        });
      return;
    }

    window.FirebaseAuth.signInWithEmailAndPassword(auth, email, password)
      .then(function (cred) {
        return isManager(cred.user.uid).then(function (ok) {
          if (!ok) {
            return window.FirebaseAuth.signOut(auth).then(function () {
              showError("This account isn't registered as a manager.");
              submitBtn.disabled = false;
            });
          }
          window.location.replace("manager-dashboard.html");
        });
      })
      .catch(function (err) { showError(friendlyError(err)); submitBtn.disabled = false; });
  });

  document.getElementById("auth-forgot-btn").addEventListener("click", function () {
    const email = document.getElementById("auth-email").value.trim();
    if (!email) { showError("Enter your email above first, then tap this again."); return; }
    window.FirebaseAuth.sendPasswordResetEmail(auth, email)
      .then(function () { showError("Password reset email sent — check your inbox."); })
      .catch(function (err) { showError(friendlyError(err)); });
  });

  const EYE_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  const EYE_OFF_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"></path><circle cx="12" cy="12" r="3"></circle><line x1="3" y1="3" x2="21" y2="21"></line></svg>';

  const passwordInput = document.getElementById("auth-password");
  const passwordToggleBtn = document.getElementById("auth-password-toggle-btn");
  passwordToggleBtn.innerHTML = EYE_ICON;
  passwordToggleBtn.addEventListener("click", function () {
    const showing = passwordInput.type === "text";
    passwordInput.type = showing ? "password" : "text";
    passwordToggleBtn.innerHTML = showing ? EYE_ICON : EYE_OFF_ICON;
    passwordToggleBtn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  });

  setMode("signin");
}

if (window.FirebaseAuth) {
  initAuthPage();
} else {
  window.addEventListener("firebase-ready", initAuthPage, { once: true });
}
