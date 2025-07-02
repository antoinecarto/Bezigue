// src/firebase.js
import { initializeApp } from "firebase/app"
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBhDxXo229PBARurrpVrngCwfj98DEmSy8",
  authDomain: "bezigue-d315b.firebaseapp.com",
  projectId: "bezigue-d315b",
  storageBucket: "bezigue-d315b.appspot.com",
  messagingSenderId: "752744440964",
  appId: "1:752744440964:web:19e40832b10f1cc726ced1",
  measurementId: "G-RRK4KDBHH0"
}

// Initialisation Firebase
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = getAuth(app)

// Connexion anonyme
const waitForAuth = new Promise((resolve, reject) => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      resolve(user)
          console.log("Utilisateur connecté :", user.uid)

    } else {
      signInAnonymously(auth).catch(reject)
          console.log("Pas d'utilisateur connecté")

    }
  })
})



export { db, auth, waitForAuth }
