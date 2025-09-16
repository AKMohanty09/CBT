import { auth, db } from "./firebase-config.js";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

/* ---------------- ALERT HELPER ---------------- */
function showPopup(message, type = "success") {
  let popup = document.getElementById("popup");
  if (!popup) {
    popup = document.createElement("div");
    popup.id = "popup";
    document.body.appendChild(popup);
  }

  popup.textContent = message;
  popup.className = "popup " + type;
  popup.style.display = "block";

  setTimeout(() => {
    popup.style.display = "none";
  }, 3000);
}

/* ---------------- LOGIN ---------------- */
async function login() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!email || !password) {
    showPopup("Please enter both email and password", "error");
    return;
  }

  try {
    // Admin login
    if (email === "admin@gmail.com") {
      await signInWithEmailAndPassword(auth, email, password);
      showPopup("Admin logged in!", "success");
      window.location.href = "admin-dashboard.html";
      return;
    }

    // Authenticate student
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Check if student exists in Firestore
    const studentRef = doc(db, "students", user.uid);
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) {
      showPopup("User not found in database. Please register first.", "error");
      await auth.signOut();
      return;
    }

    showPopup("Student logged in!", "success");
    window.location.href = "student-dashboard.html";

  } catch (err) {
    if (err.code === "auth/wrong-password") {
      showPopup("Incorrect password. Please try again.", "error");
    } else if (err.code === "auth/user-not-found") {
      showPopup("User not found. Please register first.", "error");
    } else {
      console.error(err);
      showPopup("Login error: " + err.message, "error");
    }
  }
}

/* ---------------- REGISTER ---------------- */
async function register() {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value.trim();
  const confirmPassword = document.getElementById("confirmPassword").value.trim();

  if (!name || !email || !password || !confirmPassword) {
    showPopup("All fields are required.", "error");
    return;
  }

  if (password.length < 6) {
    showPopup("Password must be at least 6 characters.", "error");
    return;
  }

  if (password !== confirmPassword) {
    showPopup("Passwords do not match.", "error");
    return;
  }

  try {
    // Check if email already registered in Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Save student in Firestore
    await saveStudentToFirestore(user, name);

    showPopup("Registration successful!", "success");
    window.location.href = "student-dashboard.html";

  } catch (err) {
    if (err.code === "auth/email-already-in-use") {
      showPopup("Email already registered. Please login.", "error");
    } else {
      console.error(err);
      showPopup("Registration error: " + err.message, "error");
    }
  }
}

/* ---------------- SAVE STUDENT ---------------- */
async function saveStudentToFirestore(user, name) {
  if (!user) return;
  const studentRef = doc(db, "students", user.uid);
  await setDoc(studentRef, {
    name: name,
    email: user.email,
    uid: user.uid,
    createdAt: serverTimestamp()
  });
}

window.login = login;
window.register = register;
