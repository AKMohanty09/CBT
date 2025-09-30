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
  apiKey: "AIzaSyBGaFROqcmDd2iK9co1ggdo5vsYXHuY0XY",
  authDomain: "english-with-piyush-gfs9z7.firebaseapp.com",
  projectId: "english-with-piyush-gfs9z7",
  storageBucket: "english-with-piyush-gfs9z7.firebasestorage.app",
  messagingSenderId: "282716431728",
  appId: "1:282716431728:web:2be3e17b50e29e04cc1bb5"
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
