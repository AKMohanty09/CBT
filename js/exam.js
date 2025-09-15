// ---------------- Firebase Imports ----------------
import { auth, db } from "./firebase-config.js";
import { collection, doc, getDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";


// ---------------- URL Params ----------------
const urlParams = new URLSearchParams(window.location.search);
const testId = urlParams.get("testId");

// ---------------- DOM Elements ----------------
const questionText = document.getElementById("questionText");
const optionsContainer = document.getElementById("optionsContainer");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const submitBtn = document.getElementById("submitBtn");
const clearBtn = document.getElementById("clearBtn");
const markReviewBtn = document.getElementById("markReviewBtn");
const currentQuestionElem = document.getElementById("currentQuestion");
const totalQuestionsElem = document.getElementById("totalQuestions");
const examTitle = document.getElementById("examTitle");
const timerElem = document.getElementById("timer");
const navigatorContainer = document.getElementById("questionNavigator");

// Legend
const legendToggle = document.querySelector(".legend-toggle");
const legendItems = document.querySelector(".legend-items");

// ---------------- Global Variables ----------------
let questions = [];
let currentIndex = 0;
let answers = [];
let reviewStatus = [];
let duration = 0;
let timerInterval = null;
let examPositiveMark = 1;
let examNegativeMark = 0;
let examStartTime = null;

// ---------------- Page Protection ----------------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Please login to access the exam page");
    window.location.replace("index.html");
    return;
  }

  if (!testId) {
    alert("Invalid Test");
    window.location.replace("student-dashboard.html");
    return;
  }

  await loadTest(testId);
});

// ---------------- Load Test ----------------
async function loadTest(id) {
  try {
    const docRef = doc(db, "tests", id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      alert("Test not found");
      window.location.replace("student-dashboard.html");
      return;
    }

    const data = docSnap.data();
    examTitle.textContent = data.title || "Exam";

    questions = data.questions || [];
    duration = data.duration || 10;
    answers = Array(questions.length).fill(null);
    reviewStatus = Array(questions.length).fill("not-visited");

    examPositiveMark = parseFloat(data.positiveMark) || 1;
    examNegativeMark = parseFloat(data.negativeMark) || 0;

    totalQuestionsElem.textContent = questions.length;

    createQuestionNavigator();

    examStartTime = Date.now();
    startTimer(duration * 60);
    renderQuestion();
  } catch (err) {
    console.error("Error loading test:", err);
    alert("Failed to load test. Please check your internet connection and try again.");
  }
}

// ---------------- Create Question Navigator ----------------
function createQuestionNavigator() {
  navigatorContainer.innerHTML = "";
  questions.forEach((q, index) => {
    const box = document.createElement("div");
    box.classList.add("question-box", "not-visited");
    box.setAttribute("data-index", index);
    box.textContent = index + 1;
    box.addEventListener("click", () => {
      saveAnswer();
      currentIndex = index;
      renderQuestion();
    });
    navigatorContainer.appendChild(box);
  });
}

// ---------------- Update Navigator ----------------
function updateNavigator() {
  const boxes = navigatorContainer.querySelectorAll(".question-box");
  boxes.forEach((box, index) => {
    box.className = "question-box"; // reset
    if (index === currentIndex) box.classList.add("active");

    switch (reviewStatus[index]) {
      case "not-visited":
        box.classList.add("not-visited");
        break;
      case "visited-not-attempted":
        box.classList.add("visited-not-attempted");
        break;
      case "attempted":
        box.classList.add("attempted");
        break;
      case "marked-for-review":
        box.classList.add("marked-for-review");
        break;
    }
  });
}

// Auto-scroll navigator to current question
function scrollToCurrentBox() {
  const currentBox = document.querySelector(`.question-box[data-index="${currentIndex}"]`);
  if (currentBox) {
    currentBox.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }
}

// ---------------- Render Question ----------------
function renderQuestion() {
  const q = questions[currentIndex];
  if (!q) return;

  questionText.textContent = q.question || "";
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

  if (reviewStatus[currentIndex] === "not-visited") {
    reviewStatus[currentIndex] = answers[currentIndex] === null ? "visited-not-attempted" : "attempted";
  }

  updateNavigator();
  scrollToCurrentBox();
}

// ---------------- Navigation Buttons ----------------
prevBtn.addEventListener("click", () => { saveAnswer(); if (currentIndex > 0) currentIndex--; renderQuestion(); });
nextBtn.addEventListener("click", () => { saveAnswer(); if (currentIndex < questions.length - 1) currentIndex++; renderQuestion(); });
clearBtn.addEventListener("click", () => {
  answers[currentIndex] = null;
  const selected = document.querySelector('input[name="option"]:checked');
  if (selected) selected.checked = false;
  reviewStatus[currentIndex] = "visited-not-attempted";
  updateNavigator();
});
markReviewBtn.addEventListener("click", () => {
  reviewStatus[currentIndex] = "marked-for-review";
  updateNavigator();
});

// Save selected answer
function saveAnswer() {
  const selected = document.querySelector('input[name="option"]:checked');
  answers[currentIndex] = selected ? parseInt(selected.value) : null;
  if (answers[currentIndex] !== null && reviewStatus[currentIndex] !== "marked-for-review") {
    reviewStatus[currentIndex] = "attempted";
  }
}

// ---------------- Timer ----------------
function startTimer(seconds) {
  let remaining = seconds;

  function updateTimer() {
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    timerElem.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

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

// ---------------- Submit Exam ----------------
submitBtn.addEventListener("click", () => {
  if (!confirm("Are you sure you want to submit the exam?")) return;
  submitExam();
});

async function submitExam() {
  saveAnswer();
  try {
    const user = auth.currentUser;
    if (!user) return alert("No user logged in!");

    const correctAnswers = questions.map(q => q.answer);
    let correct = 0, incorrect = 0, notAttempted = 0;

    answers.forEach((a, i) => {
      if (a === null || a === undefined) notAttempted++;
      else if (a === correctAnswers[i]) correct++;
      else incorrect++;
    });

    let score = correct * examPositiveMark - incorrect * examNegativeMark;
    if (score < 0) score = 0;

    const endTime = Date.now();
    const timeTakenSec = Math.floor((endTime - examStartTime) / 1000);
    const mins = Math.floor(timeTakenSec / 60);
    const secs = timeTakenSec % 60;
    const formattedTimeTaken = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

    const resultData = {
      studentEmail: user.email,
      testId,
      testTitle: examTitle.textContent,
      score,
      correct,
      incorrect,
      notAttempted,
      submittedAt: new Date().toISOString(),
      timestamp: endTime,
      timeTaken: formattedTimeTaken,
      answers
    };

    await addDoc(collection(db, "results"), resultData);

    clearInterval(timerInterval);
    showResult(score, correct, incorrect, notAttempted, formattedTimeTaken);

  } catch (err) {
    console.error("Error submitting exam:", err);
    alert("Failed to submit exam. Please check your connection.");
  }
}

// ---------------- Show Result ----------------
function showResult(score, correct, incorrect, notAttempted, timeTaken) {
  document.querySelector(".second-row").style.display = "none";
  document.querySelector(".navigator-legend-container").style.display = "none";
  timerElem.style.display = "none";
  document.getElementById("resultSection").style.display = "block";

  document.getElementById("resScore").textContent = score;
  document.getElementById("resCorrect").textContent = correct;
  document.getElementById("resIncorrect").textContent = incorrect;
  document.getElementById("resNotAttempted").textContent = notAttempted;
  document.getElementById("resTimeTaken").textContent = timeTaken;
}

// ---------------- Result Buttons ----------------
document.getElementById("backDashboardBtn").addEventListener("click", () => {
  window.location.replace("student-dashboard.html");
});

// ✅ Updated Share Result Code
// ---------------- Share Result ----------------
document.getElementById("shareResultBtn").addEventListener("click", async () => {
  const resultCard = document.querySelector(".result-card");
  if (!resultCard) return alert("No result card found!");

  try {
    // Take screenshot of result card
    const canvas = await html2canvas(resultCard, { backgroundColor: null });
    const blob = await new Promise(resolve => canvas.toBlob(resolve));
    const file = new File([blob], `Exam_Result_${examTitle.textContent}.png`, { type: "image/png" });

    // Share only image
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file]
      });
    } else {
      // fallback: download screenshot
      const link = document.createElement("a");
      link.download = file.name;
      link.href = URL.createObjectURL(blob);
      link.click();
      alert("Sharing not supported on this device. Screenshot downloaded instead.");
    }

  } catch (err) {
    console.error("Error sharing result:", err);
    alert("Failed to share result. Please try again.");
  }
});

document.getElementById("viewSolutionBtn").addEventListener("click", () => {
  window.location.href = `solution.html?testId=${testId}`;
});

// ---------------- Legend Toggle (Mobile) ----------------
legendToggle.addEventListener("click", () => {
  legendItems.classList.toggle("show");
  legendToggle.classList.toggle("active");
});
