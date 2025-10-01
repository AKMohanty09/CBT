// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { 
  getAuth 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  getDocs, 
  updateDoc 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBF-MuH6PP3UYp5P7wOxAMhaY-pHhjPcMY",
  authDomain: "english-with-piyush-j3eolh.firebaseapp.com",
  projectId: "english-with-piyush-j3eolh",
  storageBucket: "english-with-piyush-j3eolh.firebasestorage.app",
  messagingSenderId: "856148637634",
  appId: "1:856148637634:web:5ec09eff3a6f0fb93c885b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Export Firestore helpers so you can import them directly
export {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc
};
