import { auth, db } from "./firebase-config.js";
import { collection, doc, getDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

const urlParams = new URLSearchParams(window.location.search);
const testId = urlParams.get("testId");

const solutionContainer = document.getElementById("solutionContainer");
const backDashboardBtn = document.getElementById("backDashboardBtn");

// ------------------ PAGE PROTECTION ------------------
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        alert("Please login to view solutions");
        window.location.replace("index.html");
        return;
    }

    if (!testId) {
        alert("Invalid Test");
        window.location.replace("student-dashboard.html");
        return;
    }

    await loadSolution(user.email, testId);
});

// ------------------ BACK BUTTON ------------------
// Back button functionality
const backBtn = document.getElementById("backBtn");

if (backBtn) {
    backBtn.addEventListener("click", () => {
        window.location.href = "student-dashboard.html"; // redirects to dashboard
    });
}



// ------------------ LOAD SOLUTION ------------------
async function loadSolution(studentEmail, testId) {
    solutionContainer.innerHTML = "<p>Loading...</p>";

    try {
        // Fetch test document
        const testDoc = await getDoc(doc(db, "tests", testId));
        if (!testDoc.exists()) {
            solutionContainer.innerHTML = "<p>Test not found</p>";
            return;
        }
        const testData = testDoc.data();

        // Fetch student's result
        const resultQuery = query(
            collection(db, "results"),
            where("studentEmail", "==", studentEmail)
        );
        const snapshot = await getDocs(resultQuery);

        // Find the result for this test
        let studentResult = null;
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.testTitle === testData.title) {
                studentResult = data;
            }
        });

        if (!studentResult) {
            solutionContainer.innerHTML = "<p>No submitted result found for this test.</p>";
            return;
        }

        solutionContainer.innerHTML = "";
        const answers = studentResult.answers || []; // stored answers
        const correctAnswers = testData.questions.map(q => q.answer);

        testData.questions.forEach((q, index) => {
            const userAns = answers[index] !== undefined ? answers[index] : null;
            let cardClass = "solution-card unattempted";

            if (userAns === correctAnswers[index]) cardClass = "solution-card correct";
            else if (userAns !== null && userAns !== correctAnswers[index]) cardClass = "solution-card incorrect";

            const card = document.createElement("div");
            card.className = cardClass;

            card.innerHTML = `
                <div class="question-header">
                    <strong>Q${index + 1}:</strong> ${q.question}
                    <button class="toggle-btn">Show/Hide Options</button>
                </div>
                <div class="options-container" style="display:none;">
                    ${q.options.map((opt, i) => {
                        const selected = userAns === i ? "<b>(Your Answer)</b>" : "";
                        const correct = correctAnswers[index] === i ? "<b>(Correct)</b>" : "";
                        return `<p>${opt} ${selected} ${correct}</p>`;
                    }).join("")}
                    <p><b>Explanation:</b> ${q.explanation || "No explanation provided"}</p>
                </div>
            `;

            // Toggle options visibility
            card.querySelector(".toggle-btn").addEventListener("click", () => {
                const optionsDiv = card.querySelector(".options-container");
                optionsDiv.style.display = optionsDiv.style.display === "none" ? "block" : "none";
            });

            solutionContainer.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        solutionContainer.innerHTML = `<p style='color:red;'>Error loading solution: ${err.message}</p>`;
    }
}
