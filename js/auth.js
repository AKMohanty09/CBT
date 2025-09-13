import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Please enter both email and password");
    return;
  }

  try {
    // Admin login only
    if (email === "admin@gmail.com") {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        alert("Admin logged in!");
        window.location.href = "admin-dashboard.html";
      } catch (err) {
        alert("Invalid admin credentials! Make sure the admin exists in Firebase Auth.");
      }
      return;
    }

    // Student login or auto-register
    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert("Student logged in!");
      window.location.href = "student-dashboard.html";
    } catch (loginErr) {
      // Auto-register student
      try {
        await createUserWithEmailAndPassword(auth, email, password);
        alert("Student registered and logged in!");
        window.location.href = "student-dashboard.html";
      } catch (regErr) {
        alert("Error registering student: " + regErr.message);
      }
    }

  } catch (err) {
    console.error(err);
    alert("Unexpected error: " + err.message);
  }
}

window.login = login;