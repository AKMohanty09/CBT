import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { collection, getDocs, query, where, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const testsDiv = document.getElementById("testsList");
const resultsDiv = document.getElementById("resultsList");

// Overlay elements
const overlay = document.getElementById("instructionOverlay");
const closeOverlay = document.getElementById("closeOverlay");
const testTitle = document.getElementById("testTitle");
const testInstructions = document.getElementById("testInstructions");
const testDuration = document.getElementById("testDuration");
const testPositive = document.getElementById("testPositive");
const testNegative = document.getElementById("testNegative");
const startExamBtn = document.getElementById("startExamBtn");

let selectedTest = null;

// --------- CUSTOM ALERT SYSTEM ---------
const alertContainer = document.getElementById("customAlertContainer");

// Show alert
function showAlert({ message, type = "success", duration = 3000 }) {
    const alertEl = document.createElement("div");
    alertEl.classList.add("custom-alert", type);
    alertEl.innerHTML = `<div>${message}</div>`;
    alertContainer.appendChild(alertEl);

    setTimeout(() => alertEl.remove(), duration);
}

// Show confirm dialog
function showConfirm({ message, onConfirm, onCancel }) {
    const alertEl = document.createElement("div");
    alertEl.classList.add("custom-alert", "confirm");
    alertEl.innerHTML = `
        <div>${message}</div>
        <div class="alert-buttons">
            <button class="cancel-btn">Cancel</button>
            <button class="confirm-btn">Yes</button>
        </div>
    `;
    alertContainer.appendChild(alertEl);

    alertEl.querySelector(".confirm-btn").addEventListener("click", () => {
        onConfirm?.();
        alertEl.remove();
    });

    alertEl.querySelector(".cancel-btn").addEventListener("click", () => {
        onCancel?.();
        alertEl.remove();
    });
}

// ------------------ PAGE PROTECTION ------------------
auth.onAuthStateChanged((user) => {
    if (!user) {
        showAlert({ message: "Please login to access Student Dashboard", type: "warning" });
        setTimeout(() => window.location.replace("index.html"), 1500);
    } else {
        loadActiveTests();
        loadResults(user.email);
    }
});

// ------------------ LOGOUT ------------------
document.getElementById("logoutBtn").addEventListener("click", () => {
    showConfirm({
        message: "Are you sure you want to logout?",
        onConfirm: () => {
            signOut(auth)
                .then(() => {
                    showAlert({ message: "Logged out successfully", type: "success" });
                    setTimeout(() => window.location.replace("index.html"), 1000);
                })
                .catch(err => {
                    console.error(err);
                    showAlert({ message: "Error logging out: " + err.message, type: "error" });
                });
        }
    });
});

// ------------------ LOAD ACTIVE TESTS ------------------
async function loadActiveTests() {
    testsDiv.innerHTML = "<p>Loading...</p>";

    try {
        const q = query(collection(db, "tests"), where("active", "==", true));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            testsDiv.innerHTML = "<p>No active tests available</p>";
            return;
        }

        testsDiv.innerHTML = "";
        snapshot.forEach(docSnap => {
            const t = docSnap.data();
            const card = document.createElement("div");
            card.classList.add("test-card");

            card.innerHTML = `
                <div class="test-card-title">${t.title}</div>
                <p><b>Duration:</b> ${t.duration} mins</p>
                <button class="start-test-btn">Start</button>
            `;

            // Start button
            card.querySelector(".start-test-btn").addEventListener("click", () => {
                selectedTest = { id: docSnap.id, ...t };
                showInstructions(selectedTest);
            });

            testsDiv.appendChild(card);
        });
    } catch (err) {
        console.error(err);
        testsDiv.innerHTML = "<p style='color:red;'>Error loading tests</p>";
        showAlert({ message: "Error loading tests", type: "error" });
    }
}

// ------------------ SHOW INSTRUCTIONS OVERLAY ------------------
function showInstructions(test) {
    testTitle.textContent = test.title + " Instructions";
    testInstructions.textContent = test.instructions;
    testDuration.textContent = test.duration;
    testPositive.textContent = test.positiveMark;
    testNegative.textContent = test.negativeMark;

    overlay.style.display = "flex";
}

// Close Overlay
closeOverlay.addEventListener("click", () => {
    overlay.style.display = "none";
});

// Start Exam
startExamBtn.addEventListener("click", () => {
    if (!selectedTest) return;
    overlay.style.display = "none";
    window.location.href = `exam.html?testId=${selectedTest.id}`;
});

// ------------------ LOAD STUDENT RESULTS ------------------
async function loadResults(studentEmail) {
    resultsDiv.innerHTML = "<p>Loading...</p>";

    try {
        const q = query(collection(db, "results"), where("studentEmail", "==", studentEmail));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            resultsDiv.innerHTML = "<p>No results found yet</p>";
            return;
        }

        const resultsArray = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        resultsArray.sort((a, b) => b.timestamp - a.timestamp);

        resultsDiv.innerHTML = "";
        resultsArray.forEach(r => {
            const card = document.createElement("div");
            card.classList.add("result-card");

            card.innerHTML = `
                <button class="delete-result-btn" title="Delete Result">
                    <span class="material-icons">delete</span>
                </button>
                <h3>${r.testTitle}</h3>
                <p><b>Score:</b> ${r.score}</p>
                <p><b>Correct:</b> ${r.correct}</p>
                <p><b>Incorrect:</b> ${r.incorrect}</p>
                <p><b>Not Attempted:</b> ${r.notAttempted}</p>
                <p><b>Submitted:</b> ${new Date(r.submittedAt).toLocaleString()}</p>
                <p><b>Time Taken:</b> ${r.timeTaken || "N/A"}</p>
            `;

            card.querySelector(".delete-result-btn").addEventListener("click", () => {
                showConfirm({
                    message: "Are you sure you want to delete this result?",
                    onConfirm: async () => {
                        try {
                            await deleteDoc(doc(db, "results", r.id));
                            showAlert({ message: "Result deleted successfully", type: "success" });
                            loadResults(studentEmail);
                        } catch (err) {
                            console.error(err);
                            showAlert({ message: "Error deleting result: " + err.message, type: "error" });
                        }
                    }
                });
            });

            resultsDiv.appendChild(card);
        });
    } catch (err) {
        console.error(err);
        resultsDiv.innerHTML = "<p style='color:red;'>Error loading results</p>";
        showAlert({ message: "Error loading results", type: "error" });
    }
}

// ------------------ SIDEBAR TOGGLE & TAB SWITCHING ------------------
document.addEventListener("DOMContentLoaded", () => {
    const menuToggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    menuToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        sidebar.classList.toggle("open");
    });

    document.addEventListener("click", (e) => {
        if (sidebar.classList.contains("open") && !sidebar.contains(e.target) && e.target !== menuToggle) {
            sidebar.classList.remove("open");
        }
    });

    tabButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');

            sidebar.classList.remove("open");
        });
    });
});
