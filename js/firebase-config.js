// Firebase SDK init — loaded as an ES module (type="module") since the modular Firebase JS SDK
// requires import syntax. Everything else in this app is plain global scripts (see CLAUDE.md's
// load-order notes), so this module's only job is to set up window.FirebaseAuth/window.FirebaseDb
// plus the handful of SDK functions cloud-sync.js and auth.js need, as plain globals those
// non-module scripts can call.
//
// This config object is public by design — it identifies the project, it isn't a secret. Access
// control lives in firestore.rules (each rep can only read/write their own /users/{uid} doc), not
// in hiding this file.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA2fL4vnHQN-WdK0I9BnqlLM_ykQIl6sHc",
  authDomain: "diageo-sales-presenter.firebaseapp.com",
  projectId: "diageo-sales-presenter",
  storageBucket: "diageo-sales-presenter.firebasestorage.app",
  messagingSenderId: "242429874316",
  appId: "1:242429874316:web:22fa08fac4882cbe8d2ba9"
};

const app = initializeApp(firebaseConfig);

window.FirebaseAuth = {
  auth: getAuth(app),
  onAuthStateChanged: onAuthStateChanged,
  createUserWithEmailAndPassword: createUserWithEmailAndPassword,
  signInWithEmailAndPassword: signInWithEmailAndPassword,
  signOut: signOut,
  sendPasswordResetEmail: sendPasswordResetEmail
};

window.FirebaseDb = {
  db: getFirestore(app),
  doc: doc,
  getDoc: getDoc,
  setDoc: setDoc,
  onSnapshot: onSnapshot
};

window.dispatchEvent(new Event("firebase-ready"));
