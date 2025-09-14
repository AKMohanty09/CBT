import { auth, db } from "./firebase-config.js";
import { collection, doc, getDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
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
let examPositiveMark = 1;
let examNegativeMark = 0;
let examStartTime = null; // ✅ track when student starts

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

        examPositiveMark = parseFloat(data.positiveMark) || 1;
        examNegativeMark = parseFloat(data.negativeMark) || 0;

        totalQuestionsElem.textContent = questions.length;

        examStartTime = Date.now(); // ✅ mark start
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

    const optionLabels = ["A", "B", "C", "D"];

    q.options.forEach((opt, i) => {
        const label = document.createElement("label");
        label.classList.add("option-label");
        label.innerHTML = `
            <input type="radio" name="option" value="${i}" ${answers[currentIndex] === i ? "checked" : ""}>
            <span><b>${optionLabels[i]}.</b> ${opt}</span>
        `;
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

nextBtn.addEventListener("click", () => {
    saveAnswer();
    if (currentIndex < questions.length - 1) currentIndex++;
    renderQuestion();
});

clearBtn.addEventListener("click", () => {
    answers[currentIndex] = null;
    const selected = document.querySelector('input[name="option"]:checked');
    if (selected) selected.checked = false;
});

// ------------------ SAVE ANSWER ------------------
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
        timerElem.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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
        if (!user) {
            alert("No user logged in!");
            return;
        }

        const correctAnswers = questions.map(q => q.answer); // 0-based
        let correct = 0, incorrect = 0, notAttempted = 0;

        answers.forEach((a, i) => {
            if (a === null || a === undefined) {
                notAttempted++;
            } else if (a === correctAnswers[i]) {
                correct++;
            } else {
                incorrect++;
            }
        });

        // ✅ score calculation
        let score = correct * examPositiveMark - incorrect * examNegativeMark;
        if (score < 0) score = 0;

        // ✅ Calculate time taken
        const endTime = Date.now();
        const timeTakenSec = Math.floor((endTime - examStartTime) / 1000);
        const mins = Math.floor(timeTakenSec / 60);
        const secs = timeTakenSec % 60;
        const formattedTimeTaken = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

        // ✅ Store answers as well
        const resultData = {
            studentEmail: user.email,
            testTitle: examTitle.textContent,
            score,
            correct,
            incorrect,
            notAttempted,
            submittedAt: new Date().toISOString(),
            timeTaken: formattedTimeTaken,
            answers // ✅ added here for solution page
        };

        await addDoc(collection(db, "results"), resultData);

        clearInterval(timerInterval);
        showResult(score, correct, incorrect, notAttempted, formattedTimeTaken);
    } catch (err) {
        console.error(err);
        alert("Error submitting exam: " + err.message);
    }
}


// ------------------ SHOW RESULT ------------------
function showResult(score, correct, incorrect, notAttempted, timeTaken) {
    document.getElementById("questionSection").style.display = "none";
    timerElem.style.display = "none";
    document.getElementById("resultSection").style.display = "block";

    document.getElementById("resScore").textContent = score;
    document.getElementById("resCorrect").textContent = correct;
    document.getElementById("resIncorrect").textContent = incorrect;
    document.getElementById("resNotAttempted").textContent = notAttempted;
    document.getElementById("resTimeTaken").textContent = timeTaken; // ✅ show in UI
}

// ------------------ RESULT BUTTONS ------------------
document.getElementById("backDashboardBtn").addEventListener("click", () => {
    window.location.replace("student-dashboard.html");
});

document.getElementById("shareResultBtn").addEventListener("click", () => {
    const body = document.body;
    html2canvas(body).then(canvas => {
        canvas.toBlob(function (blob) {
            const link = document.createElement('a');
            link.download = `Exam_Result_${examTitle.textContent}.png`;
            link.href = URL.createObjectURL(blob);
            link.click();
        });
    });
});

document.getElementById("viewSolutionBtn").addEventListener("click", () => {
    window.location.href = `solution.html?testId=${testId}`;
});
