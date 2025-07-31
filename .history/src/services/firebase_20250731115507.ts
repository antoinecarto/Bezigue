// src/firebase.ts
import { initializeApp } from "@firebase/app";
import { getAuth, onAuthStateChanged } from "@firebase/auth";
import { getFirestore } from "@firebase/firestore";

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyATq8DGxk77hX9zjB2eRFHAi_YECasIgQI",
  authDomain: "bezigueweb.firebaseapp.com",
  projectId: "bezigueweb",
  storageBucket: "bezigueweb.firebasestorage.app",
  messagingSenderId: "513186632182",
  appId: "1:513186632182:web:60fdbfa97dfbd2768c37d7",
  measurementId: "G-09VX22707L",
};

// Initialisation Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Connexion anonyme
const waitForAuth = new Promise((resolve, _unused) => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("Utilisateur connecté :", user.uid);
      resolve(user);
    } else {
      console.log("Aucun utilisateur connecté");
      resolve(null); // et surtout, NE PAS appeler signInAnonymously ici
    }
  });
});

export { db, auth, waitForAuth };
