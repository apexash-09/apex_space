/**
 * Apex Personal Dashboard - Firebase Configuration & SDK Initialization
 * Project: apex-space-09
 * Services: Authentication, Cloud Firestore, Firebase Cloud Storage
 */

const firebaseConfig = {
  apiKey: "AIzaSyAEzSi9Y3qR_kkuugsx4LFr6qfpOv_4yIg",
  authDomain: "apex-space-09.firebaseapp.com",
  projectId: "apex-space-09",
  storageBucket: "apex-space-09.firebasestorage.app",
  messagingSenderId: "268216859148",
  appId: "1:268216859148:web:b4883203358d0e10460c29",
  measurementId: "G-NCW7LBY999"
};

// Designated Administrator Email
const ADMIN_EMAIL = "apexms0905@gmail.com";

// Initialize Firebase App
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Global Firebase service instances
window.fbAuth = firebase.auth();
window.fbDb = firebase.firestore();
window.fbStorage = firebase.storage();
window.ADMIN_EMAIL = ADMIN_EMAIL;

console.log("▲ Apex Firebase Backend Initialized (Auth, Firestore, Storage)");
