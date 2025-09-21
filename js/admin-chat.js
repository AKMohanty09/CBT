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
  getDocs,
  where,
  limit,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// Elements
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
const clearChatBtn = document.getElementById("clearChatBtn");

let selectedStudentEmail = null;
let lastMessageDate = null;
let typingTimeout = null;
let unsubscribeMessages = null;

chatInputArea.style.display = "none";
chatMessagesEl.innerHTML = `<div class="no-chat">👉 Select a student to start chatting</div>`;
clearChatBtn.style.display = "none"; // initially hidden

// ---------------- Load Student List ----------------
function loadStudentList() {
  const studentsRef = collection(db, "students");

  onSnapshot(studentsRef, async (snapshot) => {
    if (snapshot.empty) {
      studentListEl.innerHTML = `<li style="color:gray">No students found</li>`;
      return;
    }

    let students = [];

    for (let docSnap of snapshot.docs) {
      const student = docSnap.data();
      if (!student.email) continue;

      let latestMsgTime = 0;
      try {
        const chatsRef = collection(db, "chats");
        const messagesQuery = query(
          chatsRef,
          where("participants", "array-contains", student.email),
          orderBy("timestamp", "desc"),
          limit(1)
        );
        const msgSnap = await getDocs(messagesQuery);
        if (!msgSnap.empty) {
          latestMsgTime = msgSnap.docs[0].data().timestamp?.toMillis() || 0;
        }
      } catch (err) {
        console.warn("Chat fetch error:", err);
      }

      students.push({
        email: student.email,
        name: student.name || student.email,
        lastMsg: latestMsgTime,
      });
    }

    students.sort((a, b) => b.lastMsg - a.lastMsg);

    studentListEl.innerHTML = "";
    students.forEach((student) => {
      const li = document.createElement("li");
      li.textContent = student.name;
      li.dataset.email = student.email;
      li.style.position = "relative";

      // Unread badge
      const badge = document.createElement("span");
      badge.classList.add("unread-badge");
      badge.style.display = "none";
      li.appendChild(badge);

      const messagesQuery = query(
        collection(db, "chats"),
        where("from", "==", student.email),
        where("to", "==", "admin"),
        orderBy("timestamp", "asc")
      );
      onSnapshot(messagesQuery, (snap) => {
        let unreadCount = 0;
        snap.forEach((msgSnap) => {
          const msg = msgSnap.data();
          if (!msg.seenByAdmin) unreadCount++;
        });
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? "inline-block" : "none";
      });

      li.addEventListener("click", () => {
        selectedStudentEmail = student.email;
        chatHeaderEl.textContent = student.name;
        chatInputArea.style.display = "flex";
        clearChatBtn.style.display = "inline-flex"; // show clear chat button

        document.querySelectorAll("#studentList li").forEach((el) =>
          el.classList.remove("active")
        );
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
  if (unsubscribeMessages) unsubscribeMessages();

  const messagesQuery = query(collection(db, "chats"), orderBy("timestamp", "asc"));
  unsubscribeMessages = onSnapshot(messagesQuery, async (snapshot) => {
    chatMessagesEl.innerHTML = "";
    lastMessageDate = null;

    snapshot.forEach(async (docSnap) => {
      const msg = docSnap.data();
      if (
        (msg.from === studentEmail && msg.to === "admin") ||
        (msg.from === "admin" && msg.to === studentEmail)
      ) {
        const msgDate = msg.timestamp?.toDate().toDateString();
        const msgTime = msg.timestamp?.toDate().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }) || "";

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

        // Mark seen
        if (msg.to === "admin" && !msg.seenByAdmin) {
          await updateDoc(doc(db, "chats", docSnap.id), { seenByAdmin: true });
        }
      }
    });

    if (chatMessagesEl.innerHTML.trim() === "") {
      chatMessagesEl.innerHTML = `<div class="no-chat">No messages yet with ${studentEmail}</div>`;
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
    participants: ["admin", selectedStudentEmail],
    timestamp: serverTimestamp(),
    text,
    seenByAdmin: true,
  });

  chatInputEl.value = "";

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
      const diff = (now - lastSeen) / 1000;
      isOnline = diff < 15;
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

// ---------------- Clear Chat ----------------
clearChatBtn.addEventListener("click", async () => {
  if (!selectedStudentEmail) return;
  if (!confirm(`Are you sure you want to clear chat with ${selectedStudentEmail}?`)) return;

  const messagesQuery = query(
    collection(db, "chats"),
    where("participants", "array-contains", selectedStudentEmail)
  );

  const snapshot = await getDocs(messagesQuery);
  const batchDeletes = [];
  snapshot.forEach((docSnap) => {
    batchDeletes.push(deleteDoc(doc(db, "chats", docSnap.id)));
  });

  await Promise.all(batchDeletes);

  chatMessagesEl.innerHTML = `<div class="no-chat">Chat cleared with ${selectedStudentEmail}</div>`;
});

// ---------------- Initialize Admin Status ----------------
async function initAdminStatus() {
  await setDoc(doc(db, "status", "admin"), { online: true, typing: false }, { merge: true });

  window.addEventListener("beforeunload", async () => {
    await setDoc(doc(db, "status", "admin"), { online: false, typing: false }, { merge: true });
  });

  setInterval(async () => {
    await setDoc(doc(db, "status", "admin"), { online: true }, { merge: true });
  }, 30000);
}

// ---------------- Initialize ----------------
loadStudentList();
initAdminStatus();