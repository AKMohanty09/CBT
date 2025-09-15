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

    if (!fileInput.files.length) {
        alert("Please select a CSV file!");
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const text = e.target.result;
            const lines = text.trim().split("\n");

            const questions = lines.slice(1).map((line, idx) => {
                const [q, opt1, opt2, opt3, opt4, answerLetter, explanation] = line.split(",");

                // Map A–D → 0–3
                const answerMap = { A: 0, B: 1, C: 2, D: 3 };
                const ans = answerMap[answerLetter?.trim().toUpperCase()];

                if (ans === undefined) {
                    throw new Error(`Invalid answer index in row ${idx + 2}. Must be A, B, C, or D.`);
                }

                return {
                    question: q.trim(),
                    options: [opt1, opt2, opt3, opt4].map(x => x.trim()),
                    answer: ans, // store as 0-based index
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

// Make sure in your module you already have:
// import { collection, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
// and `db` initialized.

async function loadResults() {
  const resultsDiv = document.getElementById("resultsList");
  resultsDiv.innerHTML = "";

  try {
    const snapshot = await getDocs(collection(db, "results"));

    // Group results by studentEmail and keep Firestore id
    const groupedResults = {};
    snapshot.forEach(docSnap => {
      const r = { id: docSnap.id, ...docSnap.data() };
      if (!groupedResults[r.studentEmail]) groupedResults[r.studentEmail] = [];
      groupedResults[r.studentEmail].push(r);
    });

    // Sort students by latest submittedAt (descending)
    const sortedStudents = Object.keys(groupedResults).sort((a, b) => {
      const latestA = Math.max(...groupedResults[a].map(r => new Date(r.submittedAt).getTime()));
      const latestB = Math.max(...groupedResults[b].map(r => new Date(r.submittedAt).getTime()));
      return latestB - latestA;
    });

    // Render each student's results
    sortedStudents.forEach(studentEmail => {
      const card = document.createElement("div");
      card.classList.add("result-card");

      card.innerHTML = `
        <div class="result-card-header">
          <span class="result-card-title" title="${studentEmail}">${studentEmail}</span>
          <i class="fas fa-chevron-down toggle-icon"></i>
        </div>
        <div class="result-card-body"></div>
      `;

      const body = card.querySelector(".result-card-body");

      // Sort attempts by submittedAt (oldest → newest) and create elements
      groupedResults[studentEmail]
        .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
        .forEach((r, index) => {
          const attemptEl = document.createElement("div");
          attemptEl.classList.add("attempt-card");
          attemptEl.dataset.id = r.id;
          attemptEl.dataset.testTitle = r.testTitle || "";
          attemptEl.innerHTML = `
            <h4>Attempt ${index + 1} — ${r.testTitle || ""}</h4>
            <p><span class="score"><b>Score:</b> ${r.score ?? ""}</span></p> 
            <p><span class="correct"><b>Correct:</b> ${r.correct ?? ""}</span></p> 
            <p><span class="incorrect"><b>Incorrect:</b> ${r.incorrect ?? ""}</span></p> 
            <p><span class="not-attempted"><b>Not Attempted:</b> ${r.notAttempted ?? ""}</span></p>
            <p class="result-time"><b>Submitted At:</b> ${r.submittedAt ? new Date(r.submittedAt).toLocaleString() : ""}</p>
          `;

          // Pointer-based swipe-to-delete (works for desktop + mobile)
          (function attachSwipeHandlers(attemptEl, card, body) {
            let startX = 0;
            let startY = 0;
            let isPointerDown = false;
            let isSwiping = false;
            const THRESHOLD = 120;

            attemptEl.style.touchAction = "pan-y"; // allow vertical scroll, enable horizontal swipe detection
            attemptEl.style.willChange = "transform";

            attemptEl.addEventListener("pointerdown", (e) => {
              // only left button or touch/stylus
              if (e.pointerType === "mouse" && e.button !== 0) return;
              startX = e.clientX;
              startY = e.clientY;
              isPointerDown = true;
              isSwiping = false;
              attemptEl.setPointerCapture(e.pointerId);
              attemptEl.style.transition = "none";
            });

            attemptEl.addEventListener("pointermove", (e) => {
              if (!isPointerDown) return;
              const dx = e.clientX - startX;
              const dy = e.clientY - startY;

              // determine if user intends horizontal swipe or vertical scroll
              if (!isSwiping) {
                if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
                  isSwiping = true;
                } else if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
                  // user is scrolling vertically: cancel swipe capture
                  isPointerDown = false;
                  try { attemptEl.releasePointerCapture(e.pointerId); } catch (err) {}
                  attemptEl.style.transform = "";
                  return;
                } else {
                  return; // not enough movement yet
                }
              }

              if (isSwiping) {
                if (dx > 0) {
                  const translate = Math.min(dx, window.innerWidth); // cap
                  attemptEl.style.transform = `translateX(${translate}px)`;
                  if (translate > THRESHOLD * 0.6) attemptEl.classList.add("dragging");
                  else attemptEl.classList.remove("dragging");
                } else {
                  // ignore left swipes; snap to 0
                  attemptEl.style.transform = `translateX(0px)`;
                  attemptEl.classList.remove("dragging");
                }
              }
            });

            attemptEl.addEventListener("pointerup", async (e) => {
              if (!isPointerDown) return;
              isPointerDown = false;
              attemptEl.releasePointerCapture(e.pointerId);
              attemptEl.style.transition = "transform 0.28s ease, opacity 0.28s ease, background 0.2s ease";

              const dx = e.clientX - startX;
              if (isSwiping && dx > THRESHOLD) {
                // delete attempt (animate out then delete)
                attemptEl.style.transform = `translateX(100%)`;
                attemptEl.style.opacity = "0";
                attemptEl.classList.remove("dragging");

                // wait for the animation then delete from Firestore + DOM
                setTimeout(async () => {
                  try {
                    await deleteDoc(doc(db, "results", attemptEl.dataset.id));
                    attemptEl.remove();

                    // update attempt numbering after removal
                    Array.from(body.querySelectorAll(".attempt-card")).forEach((el, idx) => {
                      const h4 = el.querySelector("h4");
                      if (h4) h4.textContent = `Attempt ${idx + 1} — ${el.dataset.testTitle || ""}`;
                    });

                    // if no attempts left, remove student card
                    if (body.children.length === 0) {
                      card.remove();
                    } else {
                      // recompute expanded height if card is open
                      if (card.classList.contains("open")) {
                        body.style.maxHeight = body.scrollHeight + "px";
                      }
                    }
                  } catch (err) {
                    console.error("Error deleting attempt:", err);
                    // restore visually if deletion failed
                    attemptEl.style.transform = "translateX(0)";
                    attemptEl.style.opacity = "1";
                  }
                }, 260);
              } else {
                // snap back
                attemptEl.style.transform = "translateX(0)";
                attemptEl.classList.remove("dragging");
              }
            });

            attemptEl.addEventListener("pointercancel", (e) => {
              isPointerDown = false;
              try { attemptEl.releasePointerCapture(e.pointerId); } catch (err) {}
              attemptEl.style.transition = "transform 0.25s ease";
              attemptEl.style.transform = "translateX(0)";
              attemptEl.classList.remove("dragging");
            });
          })(attemptEl, card, body);

          body.appendChild(attemptEl);
        });

      // Collapse (accordion) logic: when opening this card, close others
      const header = card.querySelector(".result-card-header");
      const icon = card.querySelector(".toggle-icon");
      header.addEventListener("click", () => {
        // close other open student cards
        document.querySelectorAll(".result-card.open").forEach(other => {
          if (other !== card) {
            other.classList.remove("open");
            const b = other.querySelector(".result-card-body");
            if (b) b.style.maxHeight = null;
            const i = other.querySelector(".toggle-icon");
            if (i) {
              i.classList.remove("fa-chevron-up");
              i.classList.add("fa-chevron-down");
            }
          }
        });

        // toggle this card
        card.classList.toggle("open");
        if (card.classList.contains("open")) {
          body.style.maxHeight = body.scrollHeight + "px";
          icon.classList.replace("fa-chevron-down", "fa-chevron-up");
        } else {
          body.style.maxHeight = null;
          icon.classList.replace("fa-chevron-up", "fa-chevron-down");
        }
      });

      // start collapsed
      body.style.maxHeight = null;

      resultsDiv.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    resultsDiv.innerHTML = "<div style='color:red;'>Error loading results</div>";
  }
}

window.loadResults = loadResults;
