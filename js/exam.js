import { auth, db } from "./firebase-config.js";
import { collection, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

const urlParams = new URLSearchParams(window.location.search);
const testId = urlParams.get("testId");

const questionText = document.getElementById("questionText");
const optionsContainer = document.getElementById("optionsContainer");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const submitBtn = document.getElementById("submitBtn");
const currentQuestionElem = document.getElementById("currentQuestion");
const totalQuestionsElem = document.getElementById("totalQuestions");
const examTitle = document.getElementById("examTitle");
const clearBtn = document.getElementById("clearBtn");
const timerElem = document.getElementById("timer");

let questions = [];
let currentIndex = 0;
let answers = [];
let duration = 0; // in minutes
let timerInterval = null;

// ------------------ PAGE PROTECTION ------------------
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        alert("Please login to access the exam page");
        window.location.replace("index.html");
        return;
    }

    if (!testId) {
        alert("Invalid Test");
        window.location.replace("student.html");
        return;
    }

    await loadTest(testId);
});

// ------------------ LOAD TEST ------------------
async function loadTest(id) {
    try {
        const docSnap = await getDoc(doc(db, "tests", id));
        if (!docSnap.exists()) {
            alert("Test not found");
            window.location.replace("student.html");
            return;
        }
        const data = docSnap.data();
        examTitle.textContent = data.title;
        questions = data.questions;
        duration = data.duration;
        answers = Array(questions.length).fill(null);
        totalQuestionsElem.textContent = questions.length;

        startTimer(duration * 60);
        renderQuestion();
    } catch (err) {
        console.error(err);
        alert("Error loading test: " + err.message);
    }
}

// ------------------ RENDER QUESTION ------------------
function renderQuestion() {
    const q = questions[currentIndex];
    questionText.textContent = q.question;
    optionsContainer.innerHTML = "";

    q.options.forEach((opt, i) => {
        const label = document.createElement("label");
        label.innerHTML = `<input type="radio" name="option" value="${i}" ${answers[currentIndex] === i ? "checked" : ""}> ${opt}`;
        optionsContainer.appendChild(label);
    });

    currentQuestionElem.textContent = currentIndex + 1;
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === questions.length - 1;
}

// ------------------ NAVIGATION BUTTONS ------------------
prevBtn.addEventListener("click", () => {
    saveAnswer();
    if (currentIndex > 0) currentIndex--;
    renderQuestion();
});


// ------------------ CLEAR RESPONSE ------------------
clearBtn.addEventListener("click", () => {
    answers[currentIndex] = null; // remove answer from array
    const selected = document.querySelector('input[name="option"]:checked');
    if (selected) selected.checked = false; // uncheck the radio button
});

nextBtn.addEventListener("click", () => {
    saveAnswer();
    if (currentIndex < questions.length - 1) currentIndex++;
    renderQuestion();
});

function saveAnswer() {
    const selected = document.querySelector('input[name="option"]:checked');
    answers[currentIndex] = selected ? parseInt(selected.value) : null;
}

// ------------------ TIMER ------------------
function startTimer(seconds) {
    let remaining = seconds;

    function updateTimer() {
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        timerElem.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        if (remaining <= 0) {
            clearInterval(timerInterval);
            alert("Time's up! Exam will be submitted automatically.");
            submitExam();
        }
        remaining--;
    }

    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

// ------------------ SUBMIT EXAM ------------------
submitBtn.addEventListener("click", () => {
    if (!confirm("Are you sure you want to submit the exam?")) return;
    submitExam();
});

async function submitExam() {
    saveAnswer();
    try {
        const user = auth.currentUser;
        const correctAnswers = questions.map(q => q.answer); // assuming "answer" in test data is index
        let score = 0, correct = 0, incorrect = 0, notAttempted = 0;

        answers.forEach((a, i) => {
            if (a === null) notAttempted++;
            else if (a === correctAnswers[i]) { score++; correct++; }
            else { incorrect++; }
        });

        const resultData = {
            studentEmail: user.email,
            testTitle: examTitle.textContent,
            score,
            correct,
            incorrect,
            notAttempted,
            submittedAt: new Date().toISOString()
        };

        await setDoc(doc(collection(db, "results"), `${user.uid}_${testId}_${Date.now()}`), resultData);

        // Stop the timer
        clearInterval(timerInterval);

        // Show result
        showResult(score, correct, incorrect, notAttempted);

    } catch (err) {
        console.error(err);
        alert("Error submitting exam: " + err.message);
    }
}

// ------------------ SHOW RESULT ------------------
function showResult(score, correct, incorrect, notAttempted) {
    // Hide question section
    document.getElementById("questionSection").style.display = "none";
    
    // Hide the timer completely
    const timerElem = document.getElementById("timer");
    if (timerElem) {
        timerElem.style.display = "none"; // hides both timer and text
    }

    // Show result section
    document.getElementById("resultSection").style.display = "block";

    document.getElementById("resScore").textContent = score;
    document.getElementById("resCorrect").textContent = correct;
    document.getElementById("resIncorrect").textContent = incorrect;
    document.getElementById("resNotAttempted").textContent = notAttempted;
}


// ------------------ RESULT BUTTONS ------------------
document.getElementById("backDashboardBtn").addEventListener("click", () => {
    window.location.replace("student-dashboard.html");
});

document.getElementById("shareResultBtn").addEventListener("click", () => {
    const body = document.body; // capture the entire page
    html2canvas(body).then(canvas => {
        canvas.toBlob(function(blob) {
            const link = document.createElement('a');
            link.download = `Exam_Result_${examTitle.textContent}.png`;
            link.href = URL.createObjectURL(blob);
            link.click();
        });
    });
});

document.getElementById("viewSolutionBtn").addEventListener("click", () => {
    const testId = new URLSearchParams(window.location.search).get("testId");
    window.location.href = `solution.html?testId=${testId}`;
});
