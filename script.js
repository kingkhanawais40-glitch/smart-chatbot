// ============================================================
// SMART CHATBOT — MAIN SCRIPT
// ============================================================

"use strict";

// ============================================================
// GLOBAL STATE
// ============================================================

let chatbotData = [];

let previousInteractionId = null;
let conversationHistory = [];

let chatSessions = [];
let activeChatId = null;

let activeController = null;
let isGenerating = false;
let generationRequestId = 0;

const MAX_CONVERSATION_HISTORY = 8;
const MAX_CHAT_SESSIONS = 30;
const MAX_MESSAGE_LENGTH = 4000;
const API_ENDPOINT = "/api/chat";

const STORAGE_KEYS = {
    sessions: "smartChatbotSessions",
    conversation: "smartChatbotConversationHistory",
    legacy: "smartChatbotChatHistory",
    feedback: "smartChatbotFeedback",
    theme: "smartChatbotTheme"
};

// ============================================================
// DOM ELEMENTS
// ============================================================

const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

const stopGenerationBtn = document.getElementById(
    "stop-generation-btn"
);

const themeBtn = document.getElementById("theme-btn");
const voiceBtn = document.getElementById("voice-btn");

const newChatBtn = document.getElementById("new-chat-btn");
const recentChatsBtn = document.getElementById("recent-chats-btn");

const clearChatTopBtn = document.getElementById(
    "clear-chat-top-btn"
);

const exportChatBtn = document.getElementById(
    "export-chat-btn"
);

const clearHistoryBtn = document.getElementById(
    "clear-history-btn"
);

const chatHistorySearch = document.getElementById(
    "chat-history-search"
);

const chatHistoryList = document.getElementById(
    "chat-history-list"
);

const assistantStatusText = document.getElementById(
    "assistant-status-text"
);

const connectionStatus = document.getElementById(
    "connection-status"
);

const appToast = document.getElementById("app-toast");

const mobileMenuBtn = document.getElementById(
    "mobile-menu-btn"
);

const mobileCloseBtn = document.getElementById(
    "mobile-close-btn"
);

const mobileOverlay = document.getElementById(
    "mobile-overlay"
);

const sidebar = document.getElementById("sidebar");

const welcomeScreen = document.getElementById(
    "welcome-screen"
);

const promptCards = document.querySelectorAll(
    ".prompt-card"
);

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
}

function getMessageTime() {
    return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function scrollChat() {
    if (!chatBox) return;

    requestAnimationFrame(() => {
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

function showToast(message, duration = 3000) {
    if (!appToast) return;

    appToast.textContent = message;
    appToast.classList.add("show");

    clearTimeout(showToast.timeout);

    showToast.timeout = setTimeout(() => {
        appToast.classList.remove("show");
    }, duration);
}

function updateConnectionStatus(isConnected = true) {
    if (!connectionStatus) return;

    connectionStatus.classList.toggle(
        "offline",
        !isConnected
    );

    const text = connectionStatus.querySelector(
        ".connection-status-text"
    );

    if (text) {
        text.textContent = isConnected
            ? "Online"
            : "Offline";
    }
}

function isOnline() {
    return navigator.onLine;
}

function createId(prefix = "id") {
    return `${prefix}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 9)}`;
}

function safeJSONParse(value, fallback = null) {
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function saveJSON(key, value) {
    try {
        localStorage.setItem(
            key,
            JSON.stringify(value)
        );
    } catch (error) {
        console.warn(
            "LocalStorage save failed:",
            error
        );
    }
}

function loadJSON(key, fallback = null) {
    try {
        const value = localStorage.getItem(key);

        if (!value) {
            return fallback;
        }

        return safeJSONParse(value, fallback);
    } catch (error) {
        console.warn(
            "LocalStorage load failed:",
            error
        );

        return fallback;
    }
}

// ============================================================
// KNOWLEDGE BASE
// ============================================================

async function loadKnowledgeBase() {
    try {
        const response = await fetch(
            "knowledge/responses.json",
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `Knowledge base HTTP ${response.status}`
            );
        }

        const data = await response.json();

        chatbotData = Array.isArray(data)
            ? data
            : [];

        console.log(
            `Knowledge base loaded: ${chatbotData.length} entries`
        );

        return chatbotData;
    } catch (error) {
        console.error(
            "Knowledge base loading failed:",
            error
        );

        chatbotData = [];

        return [];
    }
}

// ============================================================
// CHAT SESSION MANAGEMENT
// ============================================================

function createChatSession(firstMessage = "") {
    const id = createId("chat");

    const session = {
        id,
        title: createChatTitle(firstMessage),
        messages: [],
        previousInteractionId: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    chatSessions.unshift(session);

    if (chatSessions.length > MAX_CHAT_SESSIONS) {
        chatSessions = chatSessions.slice(
            0,
            MAX_CHAT_SESSIONS
        );
    }

    activeChatId = id;

    saveChatSessions();
    renderChatSessions();

    return session;
}

function createChatTitle(message = "") {
    const clean = String(message)
        .replace(/\s+/g, " ")
        .trim();

    if (!clean) {
        return "New Chat";
    }

    if (clean.length <= 35) {
        return clean;
    }

    return `${clean.slice(0, 35)}...`;
}

function getActiveChat() {
    return chatSessions.find(
        session => session.id === activeChatId
    );
}

function saveChatSessions() {
    saveJSON(
        STORAGE_KEYS.sessions,
        chatSessions
    );
}

function saveCurrentChat() {
    const session = getActiveChat();

    if (!session) return;

    session.messages = conversationHistory.map(
        item => ({
            role: item.role,
            content: item.content,
            timestamp:
                item.timestamp || Date.now()
        })
    );

    session.previousInteractionId =
        previousInteractionId;

    session.updatedAt = Date.now();

    saveChatSessions();
    renderChatSessions();
}

function restoreChatSession(session) {
    if (!session) return;

    activeChatId = session.id;

    conversationHistory = Array.isArray(
        session.messages
    )
        ? session.messages
        : [];

    previousInteractionId =
        session.previousInteractionId || null;

    renderConversationHistory();

    hideWelcomeScreen();

    saveConversationHistory();
}

function renderChatSessions() {
    if (!chatHistoryList) return;

    const searchTerm =
        chatHistorySearch?.value
            ?.trim()
            .toLowerCase() || "";

    const sorted = [...chatSessions].sort(
        (a, b) =>
            (b.updatedAt || 0) -
            (a.updatedAt || 0)
    );

    const filtered = sorted.filter(session => {
        if (!searchTerm) return true;

        return (
            session.title
                ?.toLowerCase()
                .includes(searchTerm)
        );
    });

    chatHistoryList.innerHTML = "";

    if (!filtered.length) {
        const empty = document.createElement("div");

        empty.className = "chat-history-empty";
        empty.textContent = searchTerm
            ? "No chats found."
            : "No recent chats.";

        chatHistoryList.appendChild(empty);

        return;
    }

    filtered.forEach(session => {
        const item = document.createElement("div");

        item.className =
            "chat-session-item";

        if (session.id === activeChatId) {
            item.classList.add("active");
        }

        const titleBtn =
            document.createElement("button");

        titleBtn.type = "button";
        titleBtn.className =
            "chat-session-title";
        titleBtn.textContent =
            session.title || "New Chat";

        titleBtn.addEventListener(
            "click",
            () => {
                restoreChatSession(session);
                renderChatSessions();
                closeMobileSidebar();
            }
        );

        const actions =
            document.createElement("div");

        actions.className =
            "chat-session-actions";

        const renameBtn =
            document.createElement("button");

        renameBtn.type = "button";
        renameBtn.className =
            "chat-session-action";
        renameBtn.textContent = "✎";
        renameBtn.title = "Rename chat";

        renameBtn.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                renameChatSession(session.id);
            }
        );

        const deleteBtn =
            document.createElement("button");

        deleteBtn.type = "button";
        deleteBtn.className =
            "chat-session-action";
        deleteBtn.textContent = "×";
        deleteBtn.title = "Delete chat";

        deleteBtn.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                deleteChatSession(session.id);
            }
        );

        actions.appendChild(renameBtn);
        actions.appendChild(deleteBtn);

        item.appendChild(titleBtn);
        item.appendChild(actions);

        chatHistoryList.appendChild(item);
    });
}

function renameChatSession(chatId) {
    const session = chatSessions.find(
        item => item.id === chatId
    );

    if (!session) return;

    const newTitle = window.prompt(
        "Enter new chat name:",
        session.title || "New Chat"
    );

    if (
        newTitle === null ||
        !newTitle.trim()
    ) {
        return;
    }

    session.title =
        newTitle.trim().slice(0, 60);

    session.updatedAt = Date.now();

    saveChatSessions();
    renderChatSessions();

    showToast("Chat renamed.");
}

function deleteChatSession(chatId) {
    const sessionIndex =
        chatSessions.findIndex(
            item => item.id === chatId
        );

    if (sessionIndex === -1) return;

    chatSessions.splice(sessionIndex, 1);

    if (activeChatId === chatId) {
        activeChatId = null;
        conversationHistory = [];
        previousInteractionId = null;

        prepareEmptyChat();
    }

    saveChatSessions();
    renderChatSessions();

    showToast("Chat deleted.");
}

function clearAllChatSessions() {
    chatSessions = [];
    activeChatId = null;
    conversationHistory = [];
    previousInteractionId = null;

    saveChatSessions();
    saveConversationHistory();

    prepareEmptyChat();
    renderChatSessions();

    showToast("All chats cleared.");
}

// ============================================================
// CONVERSATION HISTORY
// ============================================================

function addConversationMessage(
    role,
    content
) {
    conversationHistory.push({
        role,
        content,
        timestamp: Date.now()
    });

    if (
        conversationHistory.length >
        MAX_CONVERSATION_HISTORY
    ) {
        conversationHistory =
            conversationHistory.slice(
                -MAX_CONVERSATION_HISTORY
            );
    }

    saveConversationHistory();
    saveCurrentChat();
}

function getConversationHistory() {
    return conversationHistory
        .slice(-MAX_CONVERSATION_HISTORY)
        .map(item => ({
            role: item.role,
            content: item.content
        }));
}

function saveConversationHistory() {
    saveJSON(
        STORAGE_KEYS.conversation,
        conversationHistory
    );
}

function loadConversationHistory() {
    const stored = loadJSON(
        STORAGE_KEYS.conversation,
        []
    );

    conversationHistory =
        Array.isArray(stored)
            ? stored
            : [];
}

function renderConversationHistory() {
    if (!chatBox) return;

    chatBox.innerHTML = "";

    if (!conversationHistory.length) {
        showWelcomeScreen();
        return;
    }

    hideWelcomeScreen();

    conversationHistory.forEach(message => {
        if (message.role === "user") {
            userMessage(
                message.content,
                message.timestamp,
                false
            );
        } else if (
            message.role === "assistant"
        ) {
            botMessage(
                message.content,
                [],
                message.timestamp,
                false
            );
        }
    });

    scrollChat();
}

// ============================================================
// SEND MESSAGE
// ============================================================

async function sendMessage(customMessage = null) {
    if (isGenerating) {
        return;
    }

    const message =
        customMessage !== null
            ? String(customMessage).trim()
            : userInput?.value.trim();

    if (!message) {
        return;
    }

    if (
        message.length >
        MAX_MESSAGE_LENGTH
    ) {
        showToast(
            `Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`
        );

        return;
    }

    if (!activeChatId) {
        createChatSession(message);
    }

    hideWelcomeScreen();

    userMessage(message);

    addConversationMessage(
        "user",
        message
    );

    if (userInput) {
        userInput.value = "";
        autoResizeInput();
    }

    await requestAIResponse(message);
}

// ============================================================
// API RESPONSE PARSER
// ============================================================

async function parseAPIResponse(response) {
    const rawText = await response.text();

    if (!rawText) {
        return {
            data: null,
            rawText: ""
        };
    }

    const data = safeJSONParse(
        rawText,
        null
    );

    return {
        data,
        rawText
    };
}

function getAPIErrorMessage(
    response,
    data,
    rawText
) {
    const details =
        data?.details?.error?.message ||
        data?.details?.message ||
        data?.error?.message ||
        data?.error ||
        data?.message;

    if (details) {
        return String(details);
    }

    if (response.status === 404) {
        return "AI endpoint was not found. Make sure the project is running with Vercel Dev.";
    }

    if (response.status === 405) {
        return "AI endpoint rejected the HTTP method. Make sure /api/chat is being served by Vercel Dev.";
    }

    if (response.status === 429) {
        return "Too many requests. Please wait a moment and try again.";
    }

    if (response.status >= 500) {
        return "The AI server returned an internal error. Check the Vercel terminal for details.";
    }

    if (rawText) {
        return rawText
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 300);
    }

    return `AI request failed with HTTP ${response.status}.`;
}

function shouldRetryWithoutInteraction(
    response,
    errorMessage
) {
    if (!previousInteractionId) {
        return false;
    }

    if (
        ![400, 404, 409, 500, 502].includes(
            response.status
        )
    ) {
        return false;
    }

    const message = String(
        errorMessage || ""
    ).toLowerCase();

    return (
        message.includes("previous interaction") ||
        message.includes("interaction id") ||
        message.includes("previous_interaction_id") ||
        message.includes("invalid interaction") ||
        message.includes("interaction not found")
    );
}

// ============================================================
// API REQUEST
// ============================================================

async function sendAPIRequest(
    message,
    interactionId = null,
    signal = null
) {
    const body = {
        message,
        previousInteractionId:
            interactionId,
        conversationHistory:
            getConversationHistory()
    };

    const response = await fetch(
        API_ENDPOINT,
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json",
                Accept: "application/json"
            },

            body: JSON.stringify(body),

            signal
        }
    );

    const parsed =
        await parseAPIResponse(response);

    return {
        response,
        data: parsed.data,
        rawText: parsed.rawText
    };
}

// ============================================================
// AI RESPONSE
// ============================================================

async function requestAIResponse(message) {
    if (!isOnline()) {
        updateConnectionStatus(false);

        const offlineReply =
            "You appear to be offline. Please check your internet connection and try again.";

        botMessage(offlineReply);

        addConversationMessage(
            "assistant",
            offlineReply
        );

        return;
    }

    const requestId =
        ++generationRequestId;

    isGenerating = true;

    activeController =
        new AbortController();

    setGeneratingUI(true);
    showTypingIndicator();

    updateAssistantStatus(
        "Thinking..."
    );

    try {
        let result =
            await sendAPIRequest(
                message,
                previousInteractionId,
                activeController.signal
            );

        if (
            !result.response.ok
        ) {
            const errorMessage =
                getAPIErrorMessage(
                    result.response,
                    result.data,
                    result.rawText
                );

            /*
             * If the stored Gemini interaction ID
             * has become invalid, retry once without it.
             */
            if (
                shouldRetryWithoutInteraction(
                    result.response,
                    errorMessage
                )
            ) {
                updateAssistantStatus(
                    "Refreshing AI context..."
                );

                result =
                    await sendAPIRequest(
                        message,
                        null,
                        activeController.signal
                    );
            }
        }

        if (!result.response.ok) {
            const errorMessage =
                getAPIErrorMessage(
                    result.response,
                    result.data,
                    result.rawText
                );

            throw new Error(
                `AI request failed (HTTP ${result.response.status}): ${errorMessage}`
            );
        }

        if (
            requestId !==
            generationRequestId
        ) {
            return;
        }

        const data = result.data;

        const reply =
            typeof data?.reply === "string"
                ? data.reply.trim()
                : "";

        if (!reply) {
            throw new Error(
                "The AI server returned an empty response."
            );
        }

        const suggestions =
            Array.isArray(
                data?.suggestions
            )
                ? data.suggestions
                : [];

        previousInteractionId =
            data?.interactionId ||
            null;

        botMessage(
            reply,
            suggestions
        );

        addConversationMessage(
            "assistant",
            reply
        );

        saveCurrentChat();

        updateConnectionStatus(true);

        updateAssistantStatus(
            "Online"
        );

        restoreSmartSuggestionButtons();

    } catch (error) {
        if (
            error?.name ===
            "AbortError"
        ) {
            const stoppedReply =
                "Generation stopped.";

            botMessage(
                stoppedReply
            );

            addConversationMessage(
                "assistant",
                stoppedReply
            );

            updateAssistantStatus(
                "Ready"
            );

            return;
        }

        console.error(
            "AI request error:",
            error
        );

        /*
         * Local knowledge fallback.
         *
         * We only use it when the AI request
         * itself fails.
         */
        const localAnswer =
            findAnswer(message);

        if (localAnswer) {
            const fallbackReply =
                `${localAnswer}\n\n_This response came from the local knowledge base because the AI service was temporarily unavailable._`;

            botMessage(
                fallbackReply
            );

            addConversationMessage(
                "assistant",
                fallbackReply
            );

            updateAssistantStatus(
                "Local knowledge"
            );

            showToast(
                error.message ||
                    "AI service unavailable. Used local knowledge."
            );

            return;
        }

        const errorReply =
            `AI service error: ${escapeHTML(
                error.message ||
                    "Unable to get an AI response."
            )}`;

        botMessage(
            errorReply
        );

        addConversationMessage(
            "assistant",
            errorReply
        );

        updateAssistantStatus(
            "AI unavailable"
        );

        showToast(
            "AI request failed. Check the local server terminal."
        );

    } finally {
        if (
            requestId ===
            generationRequestId
        ) {
            isGenerating = false;

            activeController = null;

            hideTypingIndicator();

            setGeneratingUI(false);

            if (assistantStatusText) {
                assistantStatusText.textContent =
                    "Online";
            }
        }
    }
}

// ============================================================
// GENERATION UI
// ============================================================

function setGeneratingUI(generating) {
    if (sendBtn) {
        sendBtn.disabled = generating;
    }

    if (stopGenerationBtn) {
        stopGenerationBtn.disabled =
            !generating;

        stopGenerationBtn.style.display =
            generating
                ? "inline-flex"
                : "none";
    }

    if (userInput) {
        userInput.disabled = generating;
    }
}

function updateAssistantStatus(text) {
    if (!assistantStatusText) return;

    assistantStatusText.textContent =
        text;
}

function stopGeneration() {
    if (
        !isGenerating ||
        !activeController
    ) {
        return;
    }

    activeController.abort();

    generationRequestId++;

    isGenerating = false;

    activeController = null;

    setGeneratingUI(false);

    hideTypingIndicator();

    updateAssistantStatus(
        "Generation stopped"
    );
}

// ============================================================
// LOCAL KNOWLEDGE FALLBACK
// ============================================================

function normalizeText(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/[^\w\s.-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function findAnswer(query) {
    const normalizedQuery =
        normalizeText(query);

    if (
        !normalizedQuery ||
        !Array.isArray(chatbotData) ||
        !chatbotData.length
    ) {
        return null;
    }

    let bestMatch = null;
    let bestScore = 0;

    chatbotData.forEach(item => {
        if (
            !item ||
            !Array.isArray(item.keywords)
        ) {
            return;
        }

        let score = 0;

        item.keywords.forEach(keyword => {
            const normalizedKeyword =
                normalizeText(keyword);

            if (!normalizedKeyword) {
                return;
            }

            if (
                normalizedQuery.includes(
                    normalizedKeyword
                )
            ) {
                score +=
                    normalizedKeyword.length >= 6
                        ? 3
                        : 1;
            }
        });

        if (
            score > bestScore &&
            typeof item.answer ===
                "string"
        ) {
            bestScore = score;
            bestMatch = item.answer;
        }
    });

    return bestMatch;
}

// ============================================================
// USER MESSAGE
// ============================================================

function userMessage(
    message,
    timestamp = Date.now(),
    shouldScroll = true
) {
    if (!chatBox) return;

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "message user-message";

    wrapper.dataset.role = "user";

    const content =
        document.createElement("div");

    content.className =
        "message-content";

    content.textContent = message;

    const time =
        document.createElement("div");

    time.className =
        "message-time";

    time.textContent =
        formatTimestamp(timestamp);

    wrapper.appendChild(content);
    wrapper.appendChild(time);

    chatBox.appendChild(wrapper);

    if (shouldScroll) {
        scrollChat();
    }
}

// ============================================================
// BOT MESSAGE
// ============================================================

function botMessage(
    message,
    suggestions = [],
    timestamp = Date.now(),
    shouldScroll = true
) {
    if (!chatBox) return;

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "message bot-message";

    wrapper.dataset.role =
        "assistant";

    const content =
        document.createElement("div");

    content.className =
        "message-content bot-content";

    content.innerHTML =
        formatBotMessage(message);

    const time =
        document.createElement("div");

    time.className =
        "message-time";

    time.textContent =
        formatTimestamp(timestamp);

    const actions =
        createMessageActions();

    wrapper.appendChild(content);
    wrapper.appendChild(actions);
    wrapper.appendChild(time);

    chatBox.appendChild(wrapper);

    if (
        Array.isArray(suggestions) &&
        suggestions.length
    ) {
        appendSmartSuggestions(
            suggestions
        );
    }

    if (shouldScroll) {
        scrollChat();
    }

    attachCopyButtons(
        wrapper
    );
}

function formatTimestamp(timestamp) {
    try {
        return new Date(
            timestamp
        ).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
    } catch {
        return getMessageTime();
    }
}

// ============================================================
// MESSAGE ACTIONS
// ============================================================

function createMessageActions() {
    const actions =
        document.createElement("div");

    actions.className =
        "message-actions";

    const copyBtn =
        document.createElement("button");

    copyBtn.type = "button";
    copyBtn.className =
        "message-action copy-message";
    copyBtn.dataset.action = "copy";
    copyBtn.title = "Copy response";
    copyBtn.textContent = "Copy";

    const regenerateBtn =
        document.createElement("button");

    regenerateBtn.type = "button";
    regenerateBtn.className =
        "message-action regenerate-message";
    regenerateBtn.dataset.action =
        "regenerate";
    regenerateBtn.title =
        "Regenerate response";
    regenerateBtn.textContent =
        "Regenerate";

    const likeBtn =
        document.createElement("button");

    likeBtn.type = "button";
    likeBtn.className =
        "message-action feedback-btn";
    likeBtn.dataset.feedback =
        "positive";
    likeBtn.title =
        "Good response";
    likeBtn.textContent = "👍";

    const dislikeBtn =
        document.createElement("button");

    dislikeBtn.type = "button";
    dislikeBtn.className =
        "message-action feedback-btn";
    dislikeBtn.dataset.feedback =
        "negative";
    dislikeBtn.title =
        "Bad response";
    dislikeBtn.textContent = "👎";

    actions.appendChild(copyBtn);
    actions.appendChild(regenerateBtn);
    actions.appendChild(likeBtn);
    actions.appendChild(dislikeBtn);

    return actions;
}

function attachCopyButtons(
    container
) {
    if (!container) return;

    const copyBtn =
        container.querySelector(
            ".copy-message"
        );

    if (copyBtn) {
        copyBtn.addEventListener(
            "click",
            () => {
                const content =
                    container.querySelector(
                        ".message-content"
                    );

                if (!content) return;

                copyText(
                    content.innerText
                );
            }
        );
    }

    const regenerateBtn =
        container.querySelector(
            ".regenerate-message"
        );

    if (regenerateBtn) {
        regenerateBtn.addEventListener(
            "click",
            () => {
                regenerateResponse(
                    container
                );
            }
        );
    }

    container
        .querySelectorAll(
            ".feedback-btn"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    handleFeedback(
                        container,
                        button.dataset.feedback
                    );
                }
            );
        });
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(
            text
        );

        showToast("Copied to clipboard.");
    } catch {
        const textarea =
            document.createElement(
                "textarea"
            );

        textarea.value = text;

        document.body.appendChild(
            textarea
        );

        textarea.select();

        document.execCommand("copy");

        textarea.remove();

        showToast("Copied to clipboard.");
    }
}

// ============================================================
// REGENERATE RESPONSE
// ============================================================

async function regenerateResponse(
    messageElement
) {
    if (
        isGenerating ||
        !messageElement
    ) {
        return;
    }

    const index =
        [...chatBox.children].indexOf(
            messageElement
        );

    if (index === -1) return;

    let userPrompt = "";

    for (
        let i = index - 1;
        i >= 0;
        i--
    ) {
        const element =
            chatBox.children[i];

        if (
            element.classList.contains(
                "user-message"
            )
        ) {
            const content =
                element.querySelector(
                    ".message-content"
                );

            if (content) {
                userPrompt =
                    content.textContent.trim();
            }

            break;
        }
    }

    if (!userPrompt) {
        showToast(
            "Unable to find the original question."
        );

        return;
    }

    messageElement.remove();

    const session =
        getActiveChat();

    if (session) {
        const lastAssistantIndex =
            conversationHistory
                .map(item => item.role)
                .lastIndexOf(
                    "assistant"
                );

        if (
            lastAssistantIndex !== -1
        ) {
            conversationHistory.splice(
                lastAssistantIndex,
                1
            );
        }

        saveConversationHistory();
        saveCurrentChat();
    }

    await requestAIResponse(
        userPrompt
    );
}

// ============================================================
// FEEDBACK
// ============================================================

function handleFeedback(
    messageElement,
    feedback
) {
    if (!messageElement) return;

    const content =
        messageElement.querySelector(
            ".message-content"
        );

    const responseText =
        content?.innerText || "";

    const feedbackData =
        loadJSON(
            STORAGE_KEYS.feedback,
            []
        );

    feedbackData.push({
        feedback,
        response:
            responseText.slice(
                0,
                1000
            ),
        timestamp: Date.now()
    });

    saveJSON(
        STORAGE_KEYS.feedback,
        feedbackData.slice(-100)
    );

    messageElement
        .querySelectorAll(
            ".feedback-btn"
        )
        .forEach(button => {
            button.classList.remove(
                "selected"
            );
        });

    const selected =
        messageElement.querySelector(
            `[data-feedback="${feedback}"]`
        );

    if (selected) {
        selected.classList.add(
            "selected"
        );
    }

    showToast(
        feedback === "positive"
            ? "Thanks for the feedback!"
            : "Thanks. Your feedback was saved."
    );
}

// ============================================================
// SMART SUGGESTIONS
// ============================================================

function appendSmartSuggestions(
    suggestions
) {
    if (!chatBox) return;

    const validSuggestions =
        suggestions
            .filter(
                suggestion =>
                    typeof suggestion ===
                    "string"
            )
            .map(
                suggestion =>
                    suggestion.trim()
            )
            .filter(Boolean)
            .slice(0, 4);

    if (!validSuggestions.length) {
        return;
    }

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "smart-suggestions";

    validSuggestions.forEach(
        suggestion => {
            const button =
                document.createElement(
                    "button"
                );

            button.type = "button";
            button.className =
                "smart-suggestion-btn";

            button.textContent =
                suggestion;

            button.dataset.suggestion =
                suggestion;

            button.addEventListener(
                "click",
                () => {
                    if (
                        isGenerating
                    ) {
                        return;
                    }

                    sendMessage(
                        suggestion
                    );
                }
            );

            wrapper.appendChild(
                button
            );
        }
    );

    chatBox.appendChild(wrapper);

    scrollChat();
}

function restoreSmartSuggestionButtons() {
    if (!chatBox) return;

    chatBox
        .querySelectorAll(
            ".smart-suggestion-btn"
        )
        .forEach(button => {
            if (
                button.dataset.bound ===
                "true"
            ) {
                return;
            }

            button.dataset.bound =
                "true";

            button.addEventListener(
                "click",
                () => {
                    if (
                        isGenerating
                    ) {
                        return;
                    }

                    sendMessage(
                        button.dataset
                            .suggestion ||
                            button.textContent
                    );
                }
            );
        });
}

// ============================================================
// MESSAGE FORMATTER
// ============================================================

function formatBotMessage(message) {
    if (!message) {
        return "";
    }

    let text = String(message);

    const codeBlocks = [];

    text = text.replace(
        /```([\w+-]*)\n?([\s\S]*?)```/g,
        (match, language, code) => {
            const index =
                codeBlocks.length;

            codeBlocks.push({
                language:
                    language || "",
                code:
                    escapeHTML(
                        code.trim()
                    )
            });

            return `@@CODE_BLOCK_${index}@@`;
        }
    );

    text = escapeHTML(text);

    text = text.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );

    text = text.replace(
        /`([^`]+)`/g,
        "<code>$1</code>"
    );

    text = text.replace(
        /^### (.+)$/gm,
        "<h4>$1</h4>"
    );

    text = text.replace(
        /^## (.+)$/gm,
        "<h3>$1</h3>"
    );

    text = text.replace(
        /^# (.+)$/gm,
        "<h2>$1</h2>"
    );

    text = text.replace(
        /^\s*[-*]\s+(.+)$/gm,
        "• $1"
    );

    text = text.replace(
        /\n/g,
        "<br>"
    );

    codeBlocks.forEach(
        (block, index) => {
            const languageLabel =
                block.language
                    ? `<span class="code-language">${escapeHTML(
                          block.language
                      )}</span>`
                    : "";

            const codeHTML = `
                <div class="code-block-wrapper">
                    <div class="code-block-header">
                        ${languageLabel}
                        <button
                            type="button"
                            class="copy-code-btn"
                            data-code="${escapeHTML(
                                block.code
                            )}"
                        >
                            Copy
                        </button>
                    </div>
                    <pre><code>${block.code}</code></pre>
                </div>
            `;

            text = text.replace(
                `@@CODE_BLOCK_${index}@@`,
                codeHTML
            );
        }
    );

    return text;
}

// ============================================================
// CODE COPY
// ============================================================

function attachCodeCopyButtons() {
    if (!chatBox) return;

    chatBox
        .querySelectorAll(
            ".copy-code-btn"
        )
        .forEach(button => {
            if (
                button.dataset.bound ===
                "true"
            ) {
                return;
            }

            button.dataset.bound =
                "true";

            button.addEventListener(
                "click",
                () => {
                    const code =
                        button.dataset
                            .code || "";

                    const textarea =
                        document.createElement(
                            "textarea"
                        );

                    textarea.innerHTML =
                        code;

                    copyText(
                        textarea
                            .value
                    );
                }
            );
        });
}

// ============================================================
// TYPING INDICATOR
// ============================================================

function showTypingIndicator() {
    if (!chatBox) return;

    hideTypingIndicator();

    const typing =
        document.createElement("div");

    typing.id =
        "typing-indicator";

    typing.className =
        "message bot-message typing-message";

    typing.innerHTML = `
        <div class="message-content">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
        </div>
    `;

    chatBox.appendChild(typing);

    scrollChat();
}

function hideTypingIndicator() {
    const typing =
        document.getElementById(
            "typing-indicator"
        );

    if (typing) {
        typing.remove();
    }
}

// ============================================================
// WELCOME SCREEN
// ============================================================

function hideWelcomeScreen() {
    if (!welcomeScreen) return;

    welcomeScreen.classList.add("hidden");
}

function showWelcomeScreen() {
    if (!welcomeScreen) return;

    welcomeScreen.classList.remove(
        "hidden"
    );
}

function prepareEmptyChat() {
    if (chatBox) {
        chatBox.innerHTML = "";
    }

    conversationHistory = [];
    previousInteractionId = null;

    saveConversationHistory();

    showWelcomeScreen();

    updateAssistantStatus(
        "Online"
    );
}

// ============================================================
// NEW CHAT
// ============================================================

function startNewChat() {
    if (isGenerating) {
        stopGeneration();
    }

    activeChatId = null;

    conversationHistory = [];
    previousInteractionId = null;

    prepareEmptyChat();

    closeMobileSidebar();

    if (userInput) {
        userInput.value = "";
        autoResizeInput();
        userInput.focus();
    }

    renderChatSessions();

    showToast("New chat started.");
}

// ============================================================
// CLEAR CURRENT CHAT
// ============================================================

function clearCurrentChat() {
    if (!activeChatId) {
        prepareEmptyChat();
        return;
    }

    const session =
        getActiveChat();

    if (!session) {
        prepareEmptyChat();
        return;
    }

    session.messages = [];
    session.previousInteractionId =
        null;
    session.updatedAt = Date.now();

    conversationHistory = [];
    previousInteractionId = null;

    saveConversationHistory();
    saveChatSessions();

    prepareEmptyChat();
    renderChatSessions();

    showToast("Current chat cleared.");
}

// ============================================================
// EXPORT CHAT
// ============================================================

function exportCurrentChat() {
    if (
        !conversationHistory.length
    ) {
        showToast(
            "There is no chat to export."
        );

        return;
    }

    const session =
        getActiveChat();

    const title =
        session?.title ||
        "Smart Chatbot Chat";

    let output =
        `${title}\n${"=".repeat(
            title.length
        )}\n\n`;

    conversationHistory.forEach(
        message => {
            const role =
                message.role ===
                "user"
                    ? "You"
                    : "AI";

            output += `${role}:\n${message.content}\n\n`;
        }
    );

    const blob =
        new Blob(
            [output],
            {
                type:
                    "text/plain;charset=utf-8"
            }
        );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;

    link.download =
        `${createSafeFileName(
            title
        )}.txt`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

    showToast("Chat exported.");
}

function createSafeFileName(
    name
) {
    return String(name)
        .replace(
            /[<>:"/\\|?*\x00-\x1F]/g,
            ""
        )
        .replace(/\s+/g, "_")
        .slice(0, 80) ||
        "smart-chat";
}

// ============================================================
// LEGACY CHAT MIGRATION
// ============================================================

function loadLegacyChatHistory() {
    const legacy =
        loadJSON(
            STORAGE_KEYS.legacy,
            []
        );

    if (
        !Array.isArray(legacy) ||
        !legacy.length
    ) {
        return;
    }

    if (chatSessions.length) {
        return;
    }

    const session =
        createChatSession(
            legacy.find(
                item =>
                    item.role ===
                    "user"
            )?.content || "Previous Chat"
        );

    session.messages = legacy;
    session.updatedAt = Date.now();

    saveChatSessions();

    conversationHistory =
        legacy;

    renderConversationHistory();
}

// ============================================================
// THEME
// ============================================================

function applyTheme(theme) {
    const selectedTheme =
        theme === "light"
            ? "light"
            : "dark";

    document.documentElement.dataset.theme =
        selectedTheme;

    // CSS uses body.light
    document.body.classList.toggle(
        "light",
        selectedTheme === "light"
    );

    saveJSON(
        STORAGE_KEYS.theme,
        selectedTheme
    );

    updateThemeButton(
        selectedTheme
    );
}

function updateThemeButton(theme) {
    if (!themeBtn) return;

    const icon =
        theme === "light"
            ? "☀️"
            : "🌙";

    themeBtn.textContent = icon;

    themeBtn.title =
        theme === "light"
            ? "Switch to dark mode"
            : "Switch to light mode";

    themeBtn.setAttribute(
        "aria-label",
        theme === "light"
            ? "Switch to dark mode"
            : "Switch to light mode"
    );
}

function toggleTheme() {
    const current =
        document.documentElement
            .dataset.theme ||
        "dark";

    applyTheme(
        current === "dark"
            ? "light"
            : "dark"
    );
}

function loadTheme() {
    const saved =
        loadJSON(
            STORAGE_KEYS.theme,
            null
        );

    if (
        saved === "light" ||
        saved === "dark"
    ) {
        applyTheme(saved);
        return;
    }

    const prefersLight =
        window.matchMedia &&
        window.matchMedia(
            "(prefers-color-scheme: light)"
        ).matches;

    applyTheme(
        prefersLight
            ? "light"
            : "dark"
    );
}

// ============================================================
// MOBILE SIDEBAR
// ============================================================

function openMobileSidebar() {
    if (sidebar) {
        sidebar.classList.add(
            "mobile-open"
        );
    }

    if (mobileOverlay) {
        mobileOverlay.classList.add(
            "active"
        );
    }

    document.body.classList.add(
        "sidebar-open"
    );
}

function closeMobileSidebar() {
    if (sidebar) {
        sidebar.classList.remove(
            "mobile-open"
        );
    }

    if (mobileOverlay) {
        mobileOverlay.classList.remove(
            "active"
        );
    }

    document.body.classList.remove(
        "sidebar-open"
    );
}

// ============================================================
// VOICE INPUT
// ============================================================

let recognition = null;
let isListening = false;

function setupVoiceRecognition() {
    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        if (voiceBtn) {
            voiceBtn.disabled = true;
            voiceBtn.title =
                "Voice input is not supported in this browser.";
        }

        return;
    }

    recognition =
        new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
        isListening = true;

        if (voiceBtn) {
            voiceBtn.classList.add(
                "listening"
            );

            voiceBtn.title =
                "Listening...";
        }

        showToast("Listening...");
    };

    recognition.onresult = event => {
        let transcript = "";

        for (
            let i =
                event.resultIndex;
            i <
            event.results.length;
            i++
        ) {
            transcript +=
                event.results[i][0]
                    .transcript;
        }

        if (userInput) {
            userInput.value =
                transcript;

            autoResizeInput();
        }
    };

    recognition.onerror =
        event => {
            console.error(
                "Speech recognition error:",
                event.error
            );

            showToast(
                "Voice input failed."
            );
        };

    recognition.onend = () => {
        isListening = false;

        if (voiceBtn) {
            voiceBtn.classList.remove(
                "listening"
            );

            voiceBtn.title =
                "Voice input";
        }
    };
}

function toggleVoiceInput() {
    if (!recognition) {
        showToast(
            "Voice input is not supported in this browser."
        );

        return;
    }

    if (isListening) {
        recognition.stop();
    } else {
        recognition.start();
    }
}

// ============================================================
// INPUT RESIZE
// ============================================================

function autoResizeInput() {
    if (!userInput) return;

    userInput.style.height = "auto";

    userInput.style.height =
        `${Math.min(
            userInput.scrollHeight,
            180
        )}px`;
}

// ============================================================
// CHAT HISTORY SEARCH
// ============================================================

function searchChatHistory() {
    renderChatSessions();
}

// ============================================================
// PROMPT CARDS
// ============================================================

function handlePromptCard(card) {
    if (!card) return;

    const prompt =
        card.dataset.prompt ||
        card.getAttribute(
            "data-prompt"
        ) ||
        card.textContent.trim();

    if (!prompt) return;

    if (userInput) {
        userInput.value =
            prompt;

        autoResizeInput();

        userInput.focus();
    }

    sendMessage(prompt);
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function attachEventListeners() {
    if (
        sendBtn &&
        !sendBtn.dataset.bound
    ) {
        sendBtn.dataset.bound =
            "true";

        sendBtn.addEventListener(
            "click",
            () => sendMessage()
        );
    }

    if (
        stopGenerationBtn &&
        !stopGenerationBtn.dataset
            .bound
    ) {
        stopGenerationBtn.dataset.bound =
            "true";

        stopGenerationBtn.addEventListener(
            "click",
            stopGeneration
        );
    }

    if (
        userInput &&
        !userInput.dataset.bound
    ) {
        userInput.dataset.bound =
            "true";

        userInput.addEventListener(
            "input",
            autoResizeInput
        );

        userInput.addEventListener(
            "keydown",
            event => {
                if (
                    event.key ===
                        "Enter" &&
                    !event.shiftKey
                ) {
                    event.preventDefault();

                    sendMessage();
                }
            }
        );
    }

    if (
        themeBtn &&
        !themeBtn.dataset.bound
    ) {
        themeBtn.dataset.bound =
            "true";

        themeBtn.addEventListener(
            "click",
            toggleTheme
        );
    }

    if (
        voiceBtn &&
        !voiceBtn.dataset.bound
    ) {
        voiceBtn.dataset.bound =
            "true";

        voiceBtn.addEventListener(
            "click",
            toggleVoiceInput
        );
    }

    if (
        newChatBtn &&
        !newChatBtn.dataset.bound
    ) {
        newChatBtn.dataset.bound =
            "true";

        newChatBtn.addEventListener(
            "click",
            startNewChat
        );
    }

    if (
        clearChatTopBtn &&
        !clearChatTopBtn.dataset.bound
    ) {
        clearChatTopBtn.dataset.bound =
            "true";

        clearChatTopBtn.addEventListener(
            "click",
            clearCurrentChat
        );
    }

    if (
        exportChatBtn &&
        !exportChatBtn.dataset.bound
    ) {
        exportChatBtn.dataset.bound =
            "true";

        exportChatBtn.addEventListener(
            "click",
            exportCurrentChat
        );
    }

    if (
        clearHistoryBtn &&
        !clearHistoryBtn.dataset
            .bound
    ) {
        clearHistoryBtn.dataset.bound =
            "true";

        clearHistoryBtn.addEventListener(
            "click",
            () => {
                const confirmed =
                    window.confirm(
                        "Delete all recent chats?"
                    );

                if (confirmed) {
                    clearAllChatSessions();
                }
            }
        );
    }

    if (
        recentChatsBtn &&
        !recentChatsBtn.dataset.bound
    ) {
        recentChatsBtn.dataset.bound =
            "true";

        recentChatsBtn.addEventListener(
            "click",
            () => {
                renderChatSessions();

                openMobileSidebar();
            }
        );
    }

    if (
        chatHistorySearch &&
        !chatHistorySearch.dataset
            .bound
    ) {
        chatHistorySearch.dataset.bound =
            "true";

        chatHistorySearch.addEventListener(
            "input",
            searchChatHistory
        );
    }

    if (
        mobileMenuBtn &&
        !mobileMenuBtn.dataset.bound
    ) {
        mobileMenuBtn.dataset.bound =
            "true";

        mobileMenuBtn.addEventListener(
            "click",
            openMobileSidebar
        );
    }

    if (
        mobileCloseBtn &&
        !mobileCloseBtn.dataset.bound
    ) {
        mobileCloseBtn.dataset.bound =
            "true";

        mobileCloseBtn.addEventListener(
            "click",
            closeMobileSidebar
        );
    }

    if (
        mobileOverlay &&
        !mobileOverlay.dataset.bound
    ) {
        mobileOverlay.dataset.bound =
            "true";

        mobileOverlay.addEventListener(
            "click",
            closeMobileSidebar
        );
    }

    promptCards.forEach(card => {
        if (card.dataset.bound) {
            return;
        }

        card.dataset.bound =
            "true";

        card.addEventListener(
            "click",
            () => handlePromptCard(card)
        );
    });

    if (
        chatBox &&
        !chatBox.dataset.bound
    ) {
        chatBox.dataset.bound =
            "true";

        chatBox.addEventListener(
            "click",
            event => {
                const codeButton =
                    event.target.closest(
                        ".copy-code-btn"
                    );

                if (codeButton) {
                    const code =
                        codeButton.dataset
                            .code || "";

                    copyText(code);
                }
            }
        );
    }
}

// ============================================================
// GLOBAL KEYBOARD SHORTCUTS
// ============================================================

function setupKeyboardShortcuts() {
    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key === "/" &&
                document.activeElement !==
                    userInput
            ) {
                event.preventDefault();

                userInput?.focus();

                return;
            }

            if (
                event.key === "Escape"
            ) {
                if (isGenerating) {
                    stopGeneration();
                }

                closeMobileSidebar();
            }
        }
    );
}

// ============================================================
// NETWORK STATUS
// ============================================================

function setupNetworkListeners() {
    window.addEventListener(
        "online",
        () => {
            updateConnectionStatus(
                true
            );

            updateAssistantStatus(
                "Online"
            );

            showToast(
                "Internet connection restored."
            );
        }
    );

    window.addEventListener(
        "offline",
        () => {
            updateConnectionStatus(
                false
            );

            updateAssistantStatus(
                "Offline"
            );

            showToast(
                "You are offline."
            );
        }
    );
}

// ============================================================
// WINDOW EVENTS
// ============================================================

function setupWindowEvents() {
    window.addEventListener(
        "resize",
        () => {
            autoResizeInput();
        }
    );

    window.addEventListener(
        "beforeunload",
        () => {
            saveConversationHistory();
            saveChatSessions();
        }
    );

    document.addEventListener(
        "visibilitychange",
        () => {
            if (
                document.visibilityState ===
                "hidden"
            ) {
                saveConversationHistory();
                saveChatSessions();
            }
        }
    );
}

// ============================================================
// RESTORE MOST RECENT CHAT
// ============================================================

function restoreMostRecentChat() {
    if (!chatSessions.length) {
        loadLegacyChatHistory();

        if (!chatSessions.length) {
            prepareEmptyChat();
        }

        return;
    }

    const sorted =
        [...chatSessions].sort(
            (a, b) =>
                (b.updatedAt || 0) -
                (a.updatedAt || 0)
        );

    const latest = sorted[0];

    if (latest) {
        restoreChatSession(
            latest
        );
    } else {
        prepareEmptyChat();
    }
}

// ============================================================
// LOAD CHAT SESSIONS
// ============================================================

function loadChatSessions() {
    const stored =
        loadJSON(
            STORAGE_KEYS.sessions,
            []
        );

    chatSessions =
        Array.isArray(stored)
            ? stored
            : [];

    chatSessions =
        chatSessions
            .filter(
                session =>
                    session &&
                    typeof session.id ===
                        "string"
            )
            .slice(
                0,
                MAX_CHAT_SESSIONS
            );
}

// ============================================================
// INITIALIZATION
// ============================================================

async function initializeChatbot() {
    loadTheme();

    loadChatSessions();

    loadConversationHistory();

    restoreMostRecentChat();

    renderChatSessions();

    attachEventListeners();

    setupKeyboardShortcuts();

    setupNetworkListeners();

    setupWindowEvents();

    setupVoiceRecognition();

    attachCodeCopyButtons();

    restoreSmartSuggestionButtons();

    updateConnectionStatus(
        isOnline()
    );

    setGeneratingUI(false);

    autoResizeInput();

    await loadKnowledgeBase();

    console.log(
        "Smart Chatbot initialized successfully."
    );
}

// ============================================================
// DOM READY
// ============================================================

if (
    document.readyState ===
    "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        initializeChatbot
    );
} else {
    initializeChatbot();
}

// ============================================================
// DEBUG ACCESS
// ============================================================

window.smartChatbot = {
    getState() {
        return {
            activeChatId,
            previousInteractionId,
            conversationHistory,
            chatSessions,
            isGenerating,
            knowledgeEntries:
                chatbotData.length
        };
    },

    clearCurrentChat,

    startNewChat,

    stopGeneration,

    loadKnowledgeBase
};