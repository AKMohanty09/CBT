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
  apiKey: "AIzaSyDLdiKoaetyS6yEQ2OV4GmQR3W7RdpqOtw",
  authDomain: "login-auth-12e4e.firebaseapp.com",
  projectId: "login-auth-12e4e",
  storageBucket: "login-auth-12e4e.firebasestorage.app",
  messagingSenderId: "121316334429",
  appId: "1:121316334429:web:2a1d55b465204cbc1ea6b4"
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
