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

// ------------------ PAGE PROTECTION ------------------
auth.onAuthStateChanged((user) => {
    if (!user) {
        alert("Please login to access Student Dashboard");
        window.location.replace("index.html");
    } else {
        loadActiveTests();
        loadResults(user.email);
    }
});

// ------------------ LOGOUT ------------------
document.getElementById("logoutBtn").addEventListener("click", () => {
    // Ask confirmation before logout
    if (!confirm("Are you sure you want to logout?")) return;

    // Sign out
    signOut(auth)
        .then(() => {
            window.location.replace("index.html"); // redirect to login page
        })
        .catch(err => {
            console.error(err);
            alert("Error logging out: " + err.message);
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
    // Redirect to exam page (to be implemented)
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

        resultsDiv.innerHTML = "";
        snapshot.forEach(docSnap => {
            const r = docSnap.data();
            const card = document.createElement("div");
            card.classList.add("result-card");

            // Card content with delete icon
            card.innerHTML = `
        <button class="delete-result-btn" title="Delete Result">🗑️</button>
        <h3>${r.testTitle}</h3>
        <p><b>Score:</b> ${r.score}</p>
        <p><b>Correct:</b> ${r.correct}</p>
        <p><b>Incorrect:</b> ${r.incorrect}</p>
        <p><b>Not Attempted:</b> ${r.notAttempted}</p>
        <p><b>Submitted:</b> ${new Date(r.submittedAt).toLocaleString()}</p>
      `;

            // Delete result event
            card.querySelector(".delete-result-btn").addEventListener("click", async () => {
                if (confirm("Are you sure you want to delete this result?")) {
                    try {
                        await deleteDoc(doc(db, "results", docSnap.id));
                        loadResults(studentEmail); // refresh results after deletion
                    } catch (err) {
                        console.error(err);
                        alert("Error deleting result: " + err.message);
                    }
                }
            });


            resultsDiv.appendChild(card);
        });
    } catch (err) {
        console.error(err);
        resultsDiv.innerHTML = "<p style='color:red;'>Error loading results</p>";
    }
}


// ------------------ SIDEBAR TOGGLE & TAB SWITCHING ------------------
document.addEventListener("DOMContentLoaded", () => {
    const menuToggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Toggle sidebar
    menuToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        sidebar.classList.toggle("open");
    });

    // Close sidebar when clicking outside
    document.addEventListener("click", (e) => {
        if (sidebar.classList.contains("open")) {
            if (!sidebar.contains(e.target) && e.target !== menuToggle) {
                sidebar.classList.remove("open");
            }
        }
    });

    // Tab click
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
