import { db, auth } from "./firebase-config.js";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  where,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// ===== Elements =====
const chatMessagesEl = document.getElementById("chatMessages");
const chatInputEl = document.getElementById("chatInput");
const sendMessageBtn = document.getElementById("sendMessageBtn");
const onlineIndicatorEl = document.getElementById("onlineIndicator");
const typingIndicatorEl = document.getElementById("typingIndicator");
const clearChatBtn = document.getElementById("clearChatBtn");

// ===== State =====
let lastMessageDate = null;
let typingTimeout = null;
let unsubscribeChat = null;

// ===== Custom Snackbar Function =====
function showSnackbar(message, type = "success", duration = 3000) {
  const container = document.getElementById("customAlertContainer");
  if (!container) return;

  const alertDiv = document.createElement("div");
  alertDiv.className = `custom-alert ${type}`;
  alertDiv.textContent = message;
  container.appendChild(alertDiv);

  setTimeout(() => {
    alertDiv.style.opacity = 0;
    setTimeout(() => container.removeChild(alertDiv), 400);
  }, duration);
}

// ===== Custom Confirm Dialog =====
function showConfirm(message) {
  return new Promise((resolve) => {
    const container = document.getElementById("customAlertContainer");
    if (!container) return resolve(false);

    const alertDiv = document.createElement("div");
    alertDiv.className = "custom-alert confirm";
    alertDiv.innerHTML = `
      <div>${message}</div>
      <div class="alert-buttons">
        <button class="cancel-btn">Cancel</button>
        <button class="confirm-btn">Yes</button>
      </div>
    `;
    container.appendChild(alertDiv);

    const cancelBtn = alertDiv.querySelector(".cancel-btn");
    const confirmBtn = alertDiv.querySelector(".confirm-btn");

    cancelBtn.addEventListener("click", () => {
      alertDiv.remove();
      resolve(false);
    });

    confirmBtn.addEventListener("click", () => {
      alertDiv.remove();
      resolve(true);
    });
  });
}

// ===== Scroll helper =====
function scrollToBottom(force = false) {
  const threshold = 100;
  const isNearBottom =
    chatMessagesEl.scrollHeight -
      chatMessagesEl.scrollTop -
      chatMessagesEl.clientHeight <
    threshold;
  if (isNearBottom || force) {
    requestAnimationFrame(() => {
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    });
  }
}

// ===== Load chat messages =====
function loadChat() {
  if (!auth.currentUser) return;

  if (unsubscribeChat) unsubscribeChat();

  const messagesQuery = query(
    collection(db, "chats"),
    orderBy("timestamp", "asc")
  );

  unsubscribeChat = onSnapshot(messagesQuery, (snapshot) => {
    chatMessagesEl.innerHTML = "";
    lastMessageDate = null;

    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();

      const isChatMsg =
        (msg.from === auth.currentUser.email && msg.to === "admin") ||
        (msg.from === "admin" && msg.to === auth.currentUser.email) ||
        (msg.participants?.includes(auth.currentUser.email) &&
          msg.participants?.includes("admin"));

      if (isChatMsg) {
        const msgDate = msg.timestamp?.toDate().toDateString();
        const msgTime =
          msg.timestamp
            ?.toDate()
            .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "";

        if (lastMessageDate !== msgDate && msgDate) {
          const dateSeparator = document.createElement("div");
          dateSeparator.classList.add("date-separator");
          dateSeparator.textContent = msgDate;
          chatMessagesEl.appendChild(dateSeparator);
          lastMessageDate = msgDate;
        }

        const messageDiv = document.createElement("div");
        messageDiv.classList.add(
          "message",
          msg.from === "admin" ? "admin" : "student"
        );

        const textSpan = document.createElement("span");
        textSpan.classList.add("text");
        textSpan.textContent = msg.text || "";

        const timeSpan = document.createElement("span");
        timeSpan.classList.add("time");
        timeSpan.textContent = msgTime;

        messageDiv.appendChild(textSpan);
        messageDiv.appendChild(timeSpan);
        chatMessagesEl.appendChild(messageDiv);
      }
    });

    if (chatMessagesEl.innerHTML.trim() === "") {
      chatMessagesEl.innerHTML = `<div class="no-chat">Start chatting with admin...</div>`;
    }

    scrollToBottom();
  });
}

// ===== Send message =====
sendMessageBtn.addEventListener("click", async () => {
  const text = chatInputEl.value.trim();
  if (!text || !auth.currentUser) return;

  try {
    await addDoc(collection(db, "chats"), {
      from: auth.currentUser.email,
      to: "admin",
      participants: [auth.currentUser.email, "admin"],
      text,
      timestamp: serverTimestamp(),
    });

    chatInputEl.value = "";
    await updatePresence();
    scrollToBottom(true);
  } catch (err) {
    console.error("Error sending message:", err);
    showSnackbar("Failed to send message.", "error");
  }
});

// ===== Typing indicator =====
chatInputEl.addEventListener("input", async () => {
  if (!auth.currentUser) return;

  await setDoc(
    doc(db, "status", auth.currentUser.email),
    {
      typing: true,
      lastSeen: serverTimestamp(),
    },
    { merge: true }
  );

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(async () => {
    if (!auth.currentUser) return;
    await setDoc(
      doc(db, "status", auth.currentUser.email),
      { typing: false, lastSeen: serverTimestamp() },
      { merge: true }
    );
  }, 1500);
});

// ===== Monitor admin status =====
function monitorAdminStatus() {
  onSnapshot(doc(db, "status", "admin"), (docSnap) => {
    const data = docSnap.data();
    onlineIndicatorEl.textContent = data?.online ? "Online" : "Offline";
    typingIndicatorEl.style.display = data?.typing ? "inline" : "none";
  });
}

// ===== Update student presence =====
async function updatePresence() {
  if (!auth.currentUser) return;
  await setDoc(
    doc(db, "status", auth.currentUser.email),
    {
      online: true,
      lastSeen: serverTimestamp(),
    },
    { merge: true }
  );
}

// ===== Init student status =====
async function initStudentStatus() {
  if (!auth.currentUser) return;

  await updatePresence();
  setInterval(updatePresence, 5000);

  window.addEventListener("beforeunload", async () => {
    if (!auth.currentUser) return;
    await setDoc(
      doc(db, "status", auth.currentUser.email),
      {
        online: false,
        typing: false,
        lastSeen: serverTimestamp(),
      },
      { merge: true }
    );
  });
}

// ===== Clear chat =====
clearChatBtn.addEventListener("click", async () => {
  if (!auth.currentUser) return;

  const confirmClear = await showConfirm(
    "Clear all chat with admin?"
  );
  if (!confirmClear) return;

  try {
    const messagesQuery = query(
      collection(db, "chats"),
      where("participants", "array-contains", auth.currentUser.email)
    );

    const snapshot = await getDocs(messagesQuery);
    const batchDeletes = [];

    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      if (
        (msg.from === auth.currentUser.email && msg.to === "admin") ||
        (msg.from === "admin" && msg.to === auth.currentUser.email) ||
        (msg.participants?.includes(auth.currentUser.email) &&
          msg.participants?.includes("admin"))
      ) {
        batchDeletes.push(deleteDoc(doc(db, "chats", docSnap.id)));
      }
    });

    await Promise.all(batchDeletes);
    chatMessagesEl.innerHTML = `<div class="no-chat">Chat cleared successfully!</div>`;
    showSnackbar("Chat cleared successfully!", "success");
  } catch (err) {
    console.error("Error clearing chat:", err);
    showSnackbar("Failed to clear chat. Try again.", "error");
  }
});

// ===== Auth state =====
auth.onAuthStateChanged((user) => {
  if (user) {
    initStudentStatus();
    loadChat();
    monitorAdminStatus();
    clearChatBtn.style.display = "inline-flex";
  } else {
    if (unsubscribeChat) unsubscribeChat();
    chatMessagesEl.innerHTML =
      `<div class="no-chat">Please login to start chatting.</div>`;
    clearChatBtn.style.display = "none";
  }
});