/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendButton = chatForm.querySelector("button");
const STORAGE_KEY = "loreal-chat-context";

/* Cloudflare Worker endpoint that forwards requests to OpenAI */
const API_ENDPOINT = "https://loreal.kailebehayes.workers.dev/";

/* Keep the chat in one place so the user can follow the conversation */
const baseSystemPrompt =
  "You are a helpful L'Oréal assistant. Answer only questions about L'Oréal products, routines, and recommendations. If the user asks about anything else, respond exactly with: I do not know.";

const savedState = loadConversationState();
const messages = savedState.messages.length > 0 ? savedState.messages : [];
let userName = savedState.userName || "";

/* Show the first greeting in the chat window */
appendMessage("assistant", buildGreeting());
renderConversationHistory();

/* Handle form submit */
chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const userText = userInput.value.trim();
  if (!userText) {
    return;
  }

  // Show the user's message right away.
  appendMessage("user", userText);

  // Add the message to the conversation history that we send to the API.
  messages.push({ role: "user", content: userText });
  trackUserName(userText);
  saveConversationState();

  // Clear the input and tell the user we are working on the reply.
  userInput.value = "";
  userInput.disabled = true;
  sendButton.disabled = true;
  const loadingMessage = appendMessage("assistant", "Typing...");

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: buildRequestMessages(),
      }),
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        responseData?.error || `Request failed with status ${response.status}`,
      );
    }

    const assistantReply = responseData?.choices?.[0]?.message?.content;

    if (!assistantReply) {
      throw new Error("The API response did not include a reply.");
    }

    // Replace the loading text with the real assistant response.
    loadingMessage.textContent = assistantReply;
    messages.push({ role: "assistant", content: assistantReply });
    saveConversationState();
  } catch (error) {
    loadingMessage.textContent =
      "Sorry, something went wrong while getting the answer. Please try again.";
    console.error("Chat request error:", error);
  } finally {
    userInput.disabled = false;
    sendButton.disabled = false;
    userInput.focus();
  }
});

/* Create a visible chat bubble for each message */
function appendMessage(role, text) {
  const messageElement = document.createElement("div");
  messageElement.className = `msg ${role === "assistant" ? "ai" : role}`;
  messageElement.textContent = text;
  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return messageElement;
}

function renderConversationHistory() {
  const historyMessages = messages.filter(
    (message) => message.role !== "system",
  );

  if (historyMessages.length === 0) {
    return;
  }

  chatWindow.textContent = "";

  if (userName) {
    appendMessage("assistant", `👋 Welcome back, ${userName}.`);
  }

  historyMessages.forEach((message) => {
    appendMessage(message.role, message.content);
  });
}

function buildGreeting() {
  if (userName) {
    return `👋 Hello, ${userName}! How can I help you today?`;
  }

  return "👋 Hello! How can I help you today?";
}

function buildRequestMessages() {
  const contextualMessages = [];

  contextualMessages.push({
    role: "system",
    content: userName
      ? `${baseSystemPrompt} The user's name is ${userName}. Use it naturally when helpful.`
      : baseSystemPrompt,
  });

  return contextualMessages.concat(
    messages.filter((message) => message.role !== "system"),
  );
}

function trackUserName(userText) {
  const namePatterns = [
    /\bmy name is\s+([A-Za-z' -]+)$/i,
    /\bi am\s+([A-Za-z' -]+)$/i,
    /\bi'm\s+([A-Za-z' -]+)$/i,
    /\bcall me\s+([A-Za-z' -]+)$/i,
  ];

  for (const pattern of namePatterns) {
    const match = userText.match(pattern);
    if (match?.[1]) {
      userName = match[1].trim();
      return;
    }
  }
}

function loadConversationState() {
  try {
    const storedState = localStorage.getItem(STORAGE_KEY);
    if (!storedState) {
      return { messages: [], userName: "" };
    }

    const parsedState = JSON.parse(storedState);
    return {
      messages: Array.isArray(parsedState.messages) ? parsedState.messages : [],
      userName:
        typeof parsedState.userName === "string" ? parsedState.userName : "",
    };
  } catch {
    return { messages: [], userName: "" };
  }
}

function saveConversationState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, userName }));
  } catch {
    // Ignore storage errors so the chat still works.
  }
}
