import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const studentListEl = document.getElementById("studentList");
const chatHeaderEl = document.getElementById("chatTitle");
const chatMessagesEl = document.getElementById("chatMessages");
const chatInputEl = document.getElementById("chatInput");
const sendMessageBtn = document.getElementById("sendMessageBtn");
const onlineIndicatorEl = document.getElementById("onlineIndicator");
const typingIndicatorEl = document.getElementById("typingIndicator");
const chatInputArea = document.getElementById("chatInputArea");
const chatWindow = document.getElementById("chatWindow");
const studentListWrapper = document.getElementById("studentListWrapper");
const backBtn = document.getElementById("backBtn");

let selectedStudentEmail = null;
let lastMessageDate = null;
let typingTimeout = null;

chatInputArea.style.display = "none";
chatMessagesEl.innerHTML = `<div class="no-chat">👉 Select a student to start chatting</div>`;

// ---------------- Load Student List ----------------
function loadStudentList() {
  const studentsRef = collection(db, "students");
  onSnapshot(studentsRef, (snapshot) => {
    studentListEl.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const student = docSnap.data();
      if (!student.email) return;

      const li = document.createElement("li");
      li.textContent = student.email;
      li.dataset.email = student.email;
      li.style.position = "relative";

      // Unread badge
      const badge = document.createElement("span");
      badge.classList.add("unread-badge");
      badge.style.position = "absolute";
      badge.style.right = "10px";
      badge.style.top = "50%";
      badge.style.transform = "translateY(-50%)";
      badge.style.background = "red";
      badge.style.color = "#fff";
      badge.style.fontSize = "12px";
      badge.style.fontWeight = "bold";
      badge.style.borderRadius = "50%";
      badge.style.padding = "2px 6px";
      badge.style.display = "none";
      li.appendChild(badge);

      // Monitor unread messages
      const messagesQuery = query(collection(db, "chats"), orderBy("timestamp", "asc"));
      onSnapshot(messagesQuery, (snap) => {
        let unreadCount = 0;
        snap.forEach((msgSnap) => {
          const msg = msgSnap.data();
          if (msg.from === student.email && msg.to === "admin" && !msg.seenByAdmin) {
            unreadCount++;
          }
        });
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? "inline-block" : "none";
      });

      li.addEventListener("click", () => {
        selectedStudentEmail = student.email;
        chatHeaderEl.textContent = student.email;
        chatInputArea.style.display = "flex";

        document.querySelectorAll("#studentList li").forEach((el) => el.classList.remove("active"));
        li.classList.add("active");

        if (window.innerWidth <= 768) {
          studentListWrapper.style.display = "none";
          chatWindow.style.display = "flex";
        }

        loadChatMessages(student.email);
        monitorStudentStatus(student.email);
      });

      studentListEl.appendChild(li);
    });
  });
}

// ---------------- Load Chat Messages ----------------
function loadChatMessages(studentEmail) {
  const messagesQuery = query(collection(db, "chats"), orderBy("timestamp", "asc"));
  onSnapshot(messagesQuery, async (snapshot) => {
    const atBottom =
      chatMessagesEl.scrollHeight - chatMessagesEl.scrollTop <= chatMessagesEl.clientHeight + 50;

    chatMessagesEl.innerHTML = "";
    lastMessageDate = null;

    snapshot.forEach(async (docSnap) => {
      const msg = docSnap.data();
      if ((msg.from === studentEmail && msg.to === "admin") || (msg.from === "admin" && msg.to === studentEmail)) {
        const msgDate = msg.timestamp?.toDate().toDateString();
        const msgTime = msg.timestamp?.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "";

        if (lastMessageDate !== msgDate && msgDate) {
          const dateSeparator = document.createElement("div");
          dateSeparator.classList.add("date-separator");
          dateSeparator.textContent = msgDate;
          chatMessagesEl.appendChild(dateSeparator);
          lastMessageDate = msgDate;
        }

        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message", msg.from === "admin" ? "admin" : "student");

        const textSpan = document.createElement("span");
        textSpan.classList.add("text");
        textSpan.textContent = msg.text || "";

        const timeSpan = document.createElement("span");
        timeSpan.classList.add("time");
        timeSpan.textContent = msgTime;

        messageDiv.appendChild(textSpan);
        messageDiv.appendChild(timeSpan);
        chatMessagesEl.appendChild(messageDiv);

        // Mark student messages as seen
        if (msg.to === "admin" && !msg.seenByAdmin) {
          await updateDoc(doc(db, "chats", docSnap.id), { seenByAdmin: true });
        }
      }
    });

    if (chatMessagesEl.innerHTML.trim() === "") {
      chatMessagesEl.innerHTML = `<div class="no-chat">No messages yet with ${studentEmail}</div>`;
    }

    // Scroll only if already at bottom before new messages
    if (atBottom) {
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    }
  });
}

// ---------------- Send Message ----------------
sendMessageBtn.addEventListener("click", async () => {
  const text = chatInputEl.value.trim();
  if (!text || !selectedStudentEmail) return;

  await addDoc(collection(db, "chats"), {
    from: "admin",
    to: selectedStudentEmail,
    timestamp: serverTimestamp(),
    text,
    seenByAdmin: true
  });

  chatInputEl.value = "";

  // Update admin online
  await setDoc(doc(db, "status", "admin"), { online: true, typing: false }, { merge: true });
});

// ---------------- Typing Indicator ----------------
chatInputEl.addEventListener("input", async () => {
  await setDoc(doc(db, "status", "admin"), { online: true, typing: true }, { merge: true });

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(async () => {
    await setDoc(doc(db, "status", "admin"), { online: true, typing: false }, { merge: true });
  }, 1500);
});

// ---------------- Monitor Student Status ----------------
function monitorStudentStatus(studentEmail) {
  const statusDoc = doc(db, "status", studentEmail);
  onSnapshot(statusDoc, (docSnap) => {
    const data = docSnap.data();
    let isOnline = false;

    if (data?.lastSeen) {
      const lastSeen = data.lastSeen.toDate();
      const now = new Date();
      const diff = (now - lastSeen) / 1000; // seconds
      isOnline = diff < 15; // consider online if seen in last 15 seconds
    }

    onlineIndicatorEl.textContent = isOnline ? "Online" : "Offline";
    typingIndicatorEl.style.display = data?.typing ? "inline" : "none";
  });
}


// ---------------- Back Button ----------------
backBtn.addEventListener("click", () => {
  chatWindow.style.display = "none";
  studentListWrapper.style.display = "flex";
});

// ---------------- Initialize Admin Status ----------------
async function initAdminStatus() {
  await setDoc(doc(db, "status", "admin"), { online: true, typing: false }, { merge: true });

  window.addEventListener("beforeunload", async () => {
    await setDoc(doc(db, "status", "admin"), { online: false, typing: false }, { merge: true });
  });

  // Optional: ping online every 30s
  setInterval(async () => {
    await setDoc(doc(db, "status", "admin"), { online: true }, { merge: true });
  }, 30000);
}

// ---------------- Initialize ----------------
loadStudentList();
initAdminStatus();
