import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const fileInput = document.getElementById("csvFile");
const fileLabel = document.querySelector('.form-group label[for="csvFile"]');

fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) {
        fileLabel.textContent = `Selected: ${fileInput.files[0].name}`;
    } else {
        fileLabel.textContent = "Upload CSV File";
    }
});



// Sidebar toggle & auto-collapse
document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  if (menuToggle && sidebar) {
    // Toggle when clicking button
    menuToggle.addEventListener("click", (e) => {
      e.stopPropagation(); // stop bubbling
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

    // Sidebar item click -> switch tab + collapse sidebar
    tabButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        // Switch tab
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');

        // Collapse sidebar
        sidebar.classList.remove("open");
      });
    });
  }
});

// ------------------ PAGE PROTECTION ------------------
auth.onAuthStateChanged((user) => {
    if (!user) {
        alert("Login to enter the admin page!");
        window.location.replace("index.html");
    } else if (user.email !== "admin@gmail.com") {
        alert("You are not authorized to access this page!");
        window.location.replace("index.html");
    } else {
        loadTests();
        loadResults();
    }
});

// ------------------ LOGOUT ------------------
function logout() {
  if (confirm("Are you sure you want to logout?")) {
    signOut(auth)
      .then(() => {
        window.location.replace("index.html"); // Redirect after logout
      })
      .catch(err => {
        console.error(err);
        alert("Error logging out: " + err.message);
      });
  }
}

document.getElementById("logoutBtn").addEventListener("click", logout);


// ------------------ TAB SWITCHING (already in HTML script) ------------------
// createTestTab, manageTestsTab, resultsTab switching is in HTML itself

// ------------------ CREATE TEST ------------------
document.getElementById("createTestForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const testName = document.getElementById("testName").value.trim();
    const positiveMark = parseFloat(document.getElementById("positiveMark").value);
    const negativeMark = parseFloat(document.getElementById("negativeMark").value);
    const duration = parseInt(document.getElementById("duration").value);
    const instructions = document.getElementById("instructions").value.trim();
    const fileInput = document.getElementById("csvFile");

    if (!fileInput.files.length) { alert("Please select a CSV file!"); return; }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const text = e.target.result;
            const lines = text.trim().split("\n");
            const questions = lines.slice(1).map(line => {
                const [q, opt1, opt2, opt3, opt4, answerIndex, explanation] = line.split(",");
                return {
                    question: q.trim(),
                    options: [opt1, opt2, opt3, opt4].map(x => x.trim()),
                    answer: parseInt(answerIndex),
                    explanation: explanation ? explanation.trim() : ""
                };
            });

            const testData = {
                title: testName,
                positiveMark,
                negativeMark,
                duration,
                instructions,
                questions,
                active: true,
                createdAt: new Date().toISOString()
            };

            await addDoc(collection(db, "tests"), testData);
            alert("Test created successfully!");
            document.getElementById("createTestForm").reset();
            loadTests();
        } catch (err) {
            console.error(err);
            alert("Error processing CSV: " + err.message);
        }
    };
    reader.readAsText(fileInput.files[0]);
});

// ------------------ LOAD TESTS ------------------
async function loadTests() {
    const testsDiv = document.getElementById("testsList");
    testsDiv.innerHTML = "";

    try {
        const snapshot = await getDocs(collection(db, "tests"));
        snapshot.forEach(docSnap => {
            const t = docSnap.data();
            const card = document.createElement("div");
            card.classList.add("test-card");
            card.innerHTML = `
            <div class="test-card-title">${t.title}</div>
                <div><b>Duration:</b> ${t.duration} mins | <b>Active:</b> ${t.active}</div>
                <div class="test-card-actions">
                    <button onclick="toggleTestStatus('${docSnap.id}', ${t.active})">
                        ${t.active ? "Deactivate" : "Activate"}
                    </button>
                    <button onclick="deleteTest('${docSnap.id}')">Delete</button>
                </div>
            `;
            testsDiv.appendChild(card);
        });
    } catch (err) {
        console.error(err);
        testsDiv.innerHTML = "<div style='color:red;'>Error loading tests</div>";
    }
}
window.loadTests = loadTests;

// ------------------ ACTIVATE / DEACTIVATE TEST ------------------
window.toggleTestStatus = async function(id, currentStatus) {
    try {
        await updateDoc(doc(db, "tests", id), { active: !currentStatus });
        alert("Test status updated!");
        loadTests();
    } catch(err) {
        console.error(err);
        alert("Error updating test: " + err.message);
    }
}

// ------------------ DELETE TEST ------------------
window.deleteTest = async function(id) {
    if (!confirm("Are you sure you want to delete this test?")) return;
    try {
        await deleteDoc(doc(db, "tests", id));
        alert("Test deleted successfully!");
        loadTests();
    } catch(err) {
        console.error(err);
        alert("Error deleting test: " + err.message);
    }
}

// ------------------ LOAD RESULTS ------------------
async function loadResults() {
  const resultsDiv = document.getElementById("resultsList");
  resultsDiv.innerHTML = "";

  try {
    const snapshot = await getDocs(collection(db, "results"));

    // Group results by studentEmail
    const groupedResults = {};

    snapshot.forEach(docSnap => {
      const r = docSnap.data();
      if (!groupedResults[r.studentEmail]) {
        groupedResults[r.studentEmail] = [];
      }
      groupedResults[r.studentEmail].push(r);
    });

    // Render each student's results
    Object.keys(groupedResults).forEach(studentEmail => {
      const card = document.createElement("div");
      card.classList.add("result-card");

      // Student header
      let attemptsHTML = `<div class="result-card-title">${studentEmail}</div>`;

      // Each attempt
      groupedResults[studentEmail].forEach((r, index) => {
        attemptsHTML += 
          `<div class="attempt-card">
            <h4>Attempt ${index + 1} — ${r.testTitle}</h4>
            <p>
              <span class="score"><b>Score:</b> ${r.score}</span> | 
              <span class="correct"><b>Correct:</b> ${r.correct}</span> | 
              <span class="incorrect"><b>Incorrect:</b> ${r.incorrect}</span> | 
              <span class="not-attempted"><b>Not Attempted:</b> ${r.notAttempted}</span>
            </p>
            <p class="result-time"><b>Submitted At:</b> ${new Date(r.submittedAt).toLocaleString()}</p>
          </div>
        `;
      });

      card.innerHTML = attemptsHTML;
      resultsDiv.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    resultsDiv.innerHTML = "<div style='color:red;'>Error loading results</div>";
  }
}

window.loadResults = loadResults;