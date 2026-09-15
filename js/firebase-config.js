// Firebase SDK init — loaded as an ES module (type="module") since the modular Firebase JS SDK
// requires import syntax. Everything else in this app is plain global scripts (see CLAUDE.md's
// load-order notes), so this module's only job is to set up window.FirebaseAuth/window.FirebaseDb
// plus the handful of SDK functions cloud-sync.js and auth.js need, as plain globals those
// non-module scripts can call.
//
// This config object is public by design — it identifies the project, it isn't a secret. Access
// control lives in firestore.rules (each rep can only read/write their own /users/{uid} doc), not
// in hiding this file. Restrict the key to this app's domains in the Google Cloud console
// (APIs & Services -> Credentials -> HTTP referrers) so it can't be reused from elsewhere.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, sendPasswordResetEmail, deleteUser
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, getDocFromServer, setDoc, onSnapshot, collection, getDocs
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA2fL4vnHQN-WdK0I9BnqlLM_ykQIl6sHc",
  authDomain: "diageo-sales-presenter.firebaseapp.com",
  projectId: "diageo-sales-presenter",
  storageBucket: "diageo-sales-presenter.firebasestorage.app",
  messagingSenderId: "242429874316",
  appId: "1:242429874316:web:22fa08fac4882cbe8d2ba9"
};

const app = initializeApp(firebaseConfig);

// Persistent (IndexedDB) local cache: a setDoc made while offline is queued durably and replayed
// by the SDK when the connection returns — even if the rep closed the app in between. Without
// this, the queue lived only in page memory, so an offline visit logged and then a closed tab
// meant the write silently never happened (localStorage still had it, but Firestore didn't until
// some later unrelated mutation pushed the whole call file again). Multi-tab manager keeps this
// safe when the app is open in more than one tab of the same browser. Falls back to the plain
// in-memory cache if the browser refuses IndexedDB (private mode etc.).
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  console.warn("Persistent Firestore cache unavailable, using memory cache:", e);
  db = initializeFirestore(app, {});
}

window.FirebaseAuth = {
  auth: getAuth(app),
  onAuthStateChanged: onAuthStateChanged,
  createUserWithEmailAndPassword: createUserWithEmailAndPassword,
  signInWithEmailAndPassword: signInWithEmailAndPassword,
  signOut: signOut,
  sendPasswordResetEmail: sendPasswordResetEmail,
  deleteUser: deleteUser
};

window.FirebaseDb = {
  db: db,
  doc: doc,
  getDoc: getDoc,
  // Server-only read: ignores the local cache AND any pending local write. Used for the manager
  // marker check (js/manager-auth.js, js/manager-cloud.js), which is a security decision and must
  // reflect the server's verdict — a plain getDoc() would happily report a just-attempted (and
  // about-to-be-rejected) managers/{uid} write as existing, via latency compensation.
  getDocFromServer: getDocFromServer,
  setDoc: setDoc,
  onSnapshot: onSnapshot,
  collection: collection,
  getDocs: getDocs
};

window.dispatchEvent(new Event("firebase-ready"));
