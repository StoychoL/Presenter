// Login page logic. Waits for js/firebase-config.js (an ES module, so it may finish after this
// classic script starts) to signal readiness via the "firebase-ready" event before touching
// window.FirebaseAuth — see that file's header comment for why the handshake is needed.

function showError(message) {
  const el = document.getElementById("auth-error");
  el.textContent = message;
  el.classList.toggle("hidden", !message);
}

function friendlyError(err) {
  const code = err && err.code;
  if (code === "auth/email-already-in-use") return "That email already has an account — try signing in instead.";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") return "Email or password is incorrect.";
  if (code === "auth/weak-password") return "Password must be at least 6 characters.";
  if (code === "auth/invalid-email") return "That doesn't look like a valid email address.";
  return (err && err.message) || "Something went wrong — try again.";
}

function initAuthPage() {
  const auth = window.FirebaseAuth.auth;

  // Redirect straight through if already signed in.
  window.FirebaseAuth.onAuthStateChanged(auth, function (user) {
    if (user) window.location.replace("index.html");
  });

  let mode = "signin";

  function setMode(next) {
    mode = next;
    document.getElementById("auth-title").textContent = mode === "signin" ? "Rep sign in" : "Create your account";
    document.getElementById("auth-submit-btn").textContent = mode === "signin" ? "Sign in" : "Create account";
    document.getElementById("auth-toggle-btn").textContent = mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in";
    document.getElementById("auth-forgot-btn").classList.toggle("hidden", mode !== "signin");
    showError("");
  }

  document.getElementById("auth-toggle-btn").addEventListener("click", function () {
    setMode(mode === "signin" ? "signup" : "signin");
  });

  document.getElementById("auth-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    if (!email || !password) { showError("Enter an email and password."); return; }

    showError("");
    const submitBtn = document.getElementById("auth-submit-btn");
    submitBtn.disabled = true;

    const action = mode === "signin"
      ? window.FirebaseAuth.signInWithEmailAndPassword(auth, email, password)
      : window.FirebaseAuth.createUserWithEmailAndPassword(auth, email, password);

    action
      .then(function () { window.location.replace("index.html"); })
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
