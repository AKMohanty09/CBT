import { auth, db } from "./firebase-config.js";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Please enter both email and password");
    return;
  }

  // Simple email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert("Please enter a valid email address.");
    return;
  }

  // Password minimum length check
  if (password.length < 6) {
    alert("Password must be at least 6 characters long.");
    return;
  }

  try {
    // Admin login
    if (email === "admin@gmail.com") {
      await signInWithEmailAndPassword(auth, email, password);
      alert("Admin logged in!");
      window.location.href = "admin-dashboard.html";
      return;
    }

    // Student login
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await saveStudentToFirestore(userCredential.user);
      alert("Student logged in!");
      window.location.href = "student-dashboard.html";
    } catch (loginErr) {
      if (loginErr.code === "auth/user-not-found") {
        // Auto-register new student
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await saveStudentToFirestore(userCredential.user);
        alert("Student registered and logged in!");
        window.location.href = "student-dashboard.html";
      } else if (loginErr.code === "auth/wrong-password") {
        alert("Incorrect password. Please try again.");
      } else if (loginErr.code === "auth/email-already-in-use") {
        alert("This email is already registered. Please log in.");
      } else if (loginErr.code === "auth/invalid-email") {
        alert("Invalid email format. Please check.");
      } else {
        console.error(loginErr);
        alert("Login error: " + loginErr.message);
      }
    }

  } catch (err) {
    console.error(err);
    alert("Unexpected error: " + err.message);
  }
}

async function saveStudentToFirestore(user) {
  if (!user) return;
  const studentRef = doc(db, "students", user.uid);
  await setDoc(studentRef, {
    email: user.email,
    uid: user.uid,
    lastLogin: serverTimestamp()
  }, { merge: true });
}

window.login = login;
