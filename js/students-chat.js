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
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// Elements
const chatMessagesEl = document.getElementById("chatMessages");
const chatInputEl = document.getElementById("chatInput");
const sendMessageBtn = document.getElementById("sendMessageBtn");
const onlineIndicatorEl = document.getElementById("onlineIndicator");
const typingIndicatorEl = document.getElementById("typingIndicator");
const clearChatBtn = document.getElementById("clearChatBtn"); // add button in HTML

let lastMessageDate = null;
let typingTimeout = null;
let unsubscribeChat = null;

// ===== Helper: Scroll chat to bottom (only if near bottom) =====
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

  // cleanup old listener
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

      if (
        (msg.from === auth.currentUser.email && msg.to === "admin") ||
        (msg.from === "admin" && msg.to === auth.currentUser.email)
      ) {
        const msgDate = msg.timestamp?.toDate().toDateString();
        const msgTime =
          msg.timestamp
            ?.toDate()
            .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "";

        // date separator
        if (lastMessageDate !== msgDate && msgDate) {
          const dateSeparator = document.createElement("div");
          dateSeparator.classList.add("date-separator");
          dateSeparator.textContent = msgDate;
          chatMessagesEl.appendChild(dateSeparator);
          lastMessageDate = msgDate;
        }

        // message bubble
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

    scrollToBottom(); // only scroll if near bottom
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
      text,
      timestamp: serverTimestamp(),
    });

    chatInputEl.value = "";
    await updatePresence(); // update lastSeen and online
    scrollToBottom(true);
  } catch (err) {
    console.error("Error sending message:", err);
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
      {
        typing: false,
        lastSeen: serverTimestamp(),
      },
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

// ===== Initialize student status =====
async function initStudentStatus() {
  if (!auth.currentUser) return;

  await updatePresence(); // Initial presence
  setInterval(updatePresence, 5000); // ping every 5 sec

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

// ===== Clear chat for student =====
clearChatBtn.addEventListener("click", async () => {
  if (!auth.currentUser) return;
  if (!confirm("Are you sure you want to clear all chat with admin?")) return;

  try {
    const messagesQuery = query(
      collection(db, "chats"),
      where("participants", "array-contains", auth.currentUser.email)
    );

    const snapshot = await getDocs(messagesQuery);
    const deletePromises = [];

    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      if (
        msg.participants.includes("admin") &&
        msg.participants.includes(auth.currentUser.email)
      ) {
        deletePromises.push(deleteDoc(doc(db, "chats", docSnap.id)));
      }
    });

    await Promise.all(deletePromises);
    chatMessagesEl.innerHTML = `<div class="no-chat">Chat cleared successfully!</div>`;
    alert("All chats with admin cleared!");
  } catch (err) {
    console.error("Error clearing chat:", err);
    alert("Failed to clear chat. Try again!");
  }
});

// ===== Auth state =====
auth.onAuthStateChanged((user) => {
  if (user) {
    initStudentStatus();
    loadChat();
    monitorAdminStatus();
    clearChatBtn.style.display = "inline-flex"; // show clear button when logged in
  } else {
    if (unsubscribeChat) unsubscribeChat();
    chatMessagesEl.innerHTML = `<div class="no-chat">Please login to start chatting.</div>`;
    clearChatBtn.style.display = "none";
  }
});