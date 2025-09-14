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
  apiKey: "AIzaSyBmr4O_aIdTl9TEnugVUhm93aG9YLlHtok",
  authDomain: "teacheradminapp.firebaseapp.com",
  projectId: "teacheradminapp",
  storageBucket: "teacheradminapp.appspot.com",
  messagingSenderId: "1070459298316",
  appId: "1:1070459298316:web:7c281e12053c972f024429"
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
