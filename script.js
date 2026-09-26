let chatbotData = [];
let previousInteractionId = null;


// ===============================
// CONVERSATION HISTORY
// ===============================

let conversationHistory = [];

const MAX_CONVERSATION_HISTORY = 8;

const CONVERSATION_STORAGE_KEY =
    "conversationHistory";


// ===============================
// DOM ELEMENTS
// ===============================

const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

const themeBtn = document.getElementById("theme-btn");
const voiceBtn = document.getElementById("voice-btn");

const newChatBtn = document.getElementById("new-chat-btn");

const mobileMenuBtn = document.getElementById("mobile-menu-btn");
const mobileCloseBtn = document.getElementById("mobile-close-btn");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const sidebar = document.getElementById("sidebar");

const welcomeScreen = document.getElementById("welcome-screen");

const promptCards = document.querySelectorAll(".prompt-card");


// ===============================
// LOAD KNOWLEDGE BASE
// ===============================

fetch("knowledge/responses.json")
    .then(response => response.json())
    .then(data => {

        chatbotData = data;

        console.log(
            "Chatbot database loaded:",
            chatbotData.length,
            "questions"
        );

    })
    .catch(error => {

        console.error(
            "JSON loading error:",
            error
        );

        botMessage(
            "Sorry, chatbot database nahi load ho saka."
        );

    });


// ===============================
// SEND BUTTON
// ===============================

if (sendBtn) {

    sendBtn.addEventListener(
        "click",
        sendMessage
    );

}


// ===============================
// ENTER KEY
// Enter = Send
// Shift + Enter = New Line
// ===============================

if (userInput) {

    userInput.addEventListener(
        "keydown",
        function(event) {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();

            }

        }
    );

}


// ===============================
// AUTO RESIZE TEXTAREA
// ===============================

if (userInput) {

    userInput.addEventListener(
        "input",
        function() {

            this.style.height = "auto";

            this.style.height =
                Math.min(
                    this.scrollHeight,
                    160
                ) + "px";

        }
    );

}


// ===============================
// PROMPT CARDS
// ===============================

promptCards.forEach(card => {

    card.addEventListener(
        "click",
        function() {

            const prompt =
                this.dataset.prompt;

            if (!prompt) {
                return;
            }

            userInput.value =
                prompt;

            userInput.dispatchEvent(
                new Event("input")
            );

            sendMessage();

        }
    );

});


// ===============================
// ADD CONVERSATION MESSAGE
// ===============================

function addConversationMessage(
    role,
    content
) {

    if (
        !role ||
        !content
    ) {
        return;
    }

    conversationHistory.push({

        role:
            role,

        content:
            String(content)

    });


    // Keep only recent messages
    if (
        conversationHistory.length >
        MAX_CONVERSATION_HISTORY
    ) {

        conversationHistory =
            conversationHistory.slice(
                -MAX_CONVERSATION_HISTORY
            );

    }


    // Save conversation context
    saveConversationHistory();

}


// ===============================
// GET CONVERSATION HISTORY
// ===============================

function getConversationHistory() {

    return conversationHistory
        .slice(-MAX_CONVERSATION_HISTORY)
        .map(item => ({

            role:
                item.role,

            content:
                item.content

        }));

}


// ===============================
// SAVE CONVERSATION HISTORY
// ===============================

function saveConversationHistory() {

    try {

        localStorage.setItem(
            CONVERSATION_STORAGE_KEY,
            JSON.stringify(
                conversationHistory
            )
        );

    } catch (error) {

        console.error(
            "Conversation history save failed:",
            error
        );

    }

}


// ===============================
// LOAD CONVERSATION HISTORY
// ===============================

function loadConversationHistory() {

    try {

        const savedHistory =
            localStorage.getItem(
                CONVERSATION_STORAGE_KEY
            );


        if (
            !savedHistory
        ) {

            conversationHistory =
                [];

            return;

        }


        const parsedHistory =
            JSON.parse(
                savedHistory
            );


        if (
            !Array.isArray(
                parsedHistory
            )
        ) {

            conversationHistory =
                [];

            return;

        }


        conversationHistory =
            parsedHistory
                .filter(
                    item =>
                        item &&
                        (
                            item.role === "user" ||
                            item.role === "assistant"
                        ) &&
                        typeof item.content === "string"
                )
                .slice(
                    -MAX_CONVERSATION_HISTORY
                );


        console.log(
            "Conversation history restored:",
            conversationHistory.length,
            "messages"
        );

    } catch (error) {

        console.error(
            "Conversation history load failed:",
            error
        );

        conversationHistory =
            [];

    }

}


// ===============================
// MAIN SEND MESSAGE FUNCTION
// ===============================

function sendMessage() {

    if (!userInput) {
        return;
    }

    const message =
        userInput.value.trim();

    if (message === "") {
        return;
    }


    // Hide welcome screen
    hideWelcomeScreen();


    // Show user message
    userMessage(message);


    // Add user message to conversation history
    addConversationMessage(
        "user",
        message
    );


    // Clear input
    userInput.value = "";

    userInput.style.height =
        "auto";


    // Show typing indicator
    showTyping();


    // Small delay for natural interaction
    setTimeout(
        async () => {

            try {

                const response =
                    await fetch(
                        "/api/chat",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({

                                message:
                                    message,

                                previousInteractionId:
                                    previousInteractionId,

                                conversationHistory:
                                    getConversationHistory()

                            })

                        }
                    );


                const data =
                    await response.json();


                // Remove typing indicator
                removeTyping();


                // Backend error
                if (!response.ok) {

                    console.error(
                        "Backend error:",
                        data
                    );


                    botMessage(

                        data.details?.error?.message ||

                        data.error ||

                        "Gemini API request failed.",

                        message

                    );

                    return;
                }


                // Gemini response
                if (data.reply) {

                    botMessage(
                        data.reply,
                        message
                    );


                    // Add assistant response
                    // to conversation history
                    addConversationMessage(
                        "assistant",
                        data.reply
                    );


                    // Save Gemini interaction ID
                    if (data.interactionId) {

                        previousInteractionId =
                            data.interactionId;

                    }

                } else {

                    // Knowledge base fallback
                    const fallbackAnswer =
                        findAnswer(message);

                    botMessage(
                        fallbackAnswer,
                        message
                    );


                    // Add fallback response
                    // to conversation history
                    addConversationMessage(
                        "assistant",
                        fallbackAnswer
                    );

                }


            } catch (error) {

                removeTyping();


                console.error(
                    "Backend error:",
                    error
                );


                // Knowledge base fallback
                const fallbackAnswer =
                    findAnswer(message);


                botMessage(
                    fallbackAnswer,
                    message
                );


                // Add fallback response
                // to conversation history
                addConversationMessage(
                    "assistant",
                    fallbackAnswer
                );

            }

        },
        700
    );

}


// ===============================
// FIND KNOWLEDGE BASE ANSWER
// ===============================

function findAnswer(question) {

    question =
        question.toLowerCase();


    let bestMatch = null;

    let maxScore = 0;


    chatbotData.forEach(item => {

        let score = 0;


        if (
            !Array.isArray(
                item.keywords
            )
        ) {

            return;

        }


        item.keywords.forEach(
            keyword => {

                if (
                    typeof keyword !==
                    "string"
                ) {

                    return;

                }


                keyword =
                    keyword.toLowerCase();


                // Exact phrase match
                if (
                    question.includes(
                        keyword
                    )
                ) {

                    score += 2;

                }


                // Individual word match
                const words =
                    question.split(
                        /\s+/
                    );


                if (
                    words.includes(
                        keyword
                    )
                ) {

                    score += 1;

                }

            }
        );


        if (
            score > maxScore
        ) {

            maxScore =
                score;

            bestMatch =
                item.answer;

        }

    });


    if (
        bestMatch &&
        maxScore > 0
    ) {

        return bestMatch;

    }


    return "Sorry, I don't understand this question yet. Please ask something related to programming, AI, technology or Muhammad Awais portfolio.";

}


// ===============================
// MESSAGE TIME
// ===============================

function getMessageTime() {

    return new Date().toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


// ===============================
// USER MESSAGE
// ===============================

function userMessage(message) {

    const div =
        document.createElement(
            "div"
        );


    div.className =
        "user-message";


    // Escape user text safely before using innerHTML
    const safeMessage =
        String(message)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            .replace(/\n/g, "<br>");


    div.innerHTML = `
        <div class="message-content">
            ${safeMessage}
        </div>

        <div class="message-time">
            ${getMessageTime()}
        </div>
    `;


    chatBox.appendChild(
        div
    );


    scrollChat();

}


// ===============================
// BOT MESSAGE
// ===============================

function botMessage(
    message,
    originalUserPrompt = ""
) {

    const div =
        document.createElement(
            "div"
        );


    div.className =
        "bot-message";


    div.innerHTML = `
        <div class="message-content">
            ${formatBotMessage(message)}
        </div>

        <div class="message-time">
            ${getMessageTime()}
        </div>

        <div class="message-actions">

            <button
                class="message-action-btn copy-message-btn"
                type="button"
                title="Copy response"
            >
                Copy
            </button>

            <button
                class="message-action-btn regenerate-btn"
                type="button"
                title="Regenerate response"
            >
                Regenerate
            </button>

        </div>
    `;


    // Store original user prompt
    div.dataset.userPrompt =
        originalUserPrompt;


    chatBox.appendChild(
        div
    );


    addCopyButtons();

    addMessageActions();


    scrollChat();

}


// ===============================
// FORMAT BOT MESSAGE
// ===============================

function formatBotMessage(message) {

    if (!message) {
        return "";
    }


    let formatted =
        String(message);


    // ===============================
    // EXTRACT CODE BLOCKS FIRST
    // ===============================

    const codeBlocks = [];


    formatted =
        formatted.replace(
            /```([a-zA-Z0-9_+#.-]*)[ \t]*\n?([\s\S]*?)```/g,
            function(
                match,
                language,
                code
            ) {

                const index =
                    codeBlocks.length;


                const cleanLanguage =
                    language.trim() ||
                    "Code";


                // Escape code safely
                const escapedCode =
                    code
                        .replace(
                            /&/g,
                            "&amp;"
                        )
                        .replace(
                            /</g,
                            "&lt;"
                        )
                        .replace(
                            />/g,
                            "&gt;"
                        );


                codeBlocks.push({

                    language:
                        cleanLanguage,

                    code:
                        escapedCode

                });


                // Temporary placeholder
                return `___CODE_BLOCK_${index}___`;

            }
        );


    // ===============================
    // ESCAPE NORMAL HTML
    // ===============================

    formatted =
        formatted
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            );


    // ===============================
    // REMOVE DUPLICATE CODE LABEL
    // ===============================

    formatted =
        formatted.replace(
            /\*\*[a-zA-Z0-9_+#.-]+Copy\*\*(?=\s*___CODE_BLOCK_\d+___)/g,
            ""
        );


    // ===============================
    // BOLD TEXT
    // ===============================

    formatted =
        formatted.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );


    // ===============================
    // INLINE CODE
    // ===============================

    formatted =
        formatted.replace(
            /`([^`\n]+)`/g,
            '<code class="inline-code">$1</code>'
        );


    // ===============================
    // BULLET POINTS
    // ===============================

    formatted =
        formatted.replace(
            /^[-•]\s+(.*)$/gm,
            "<li>$1</li>"
        );


    // ===============================
    // NUMBERED LISTS
    // ===============================

    formatted =
        formatted.replace(
            /^\d+\.\s+(.*)$/gm,
            "<li>$1</li>"
        );


    // ===============================
    // LINE BREAKS
    // ===============================

    formatted =
        formatted.replace(
            /\n/g,
            "<br>"
        );


    // ===============================
    // RESTORE CODE BLOCKS
    // ===============================

    codeBlocks.forEach(
        function(
            block,
            index
        ) {

            const codeBlockHTML = `
                <div class="code-block">

                    <div class="code-header">

                        <span class="code-language">
                            ${block.language}
                        </span>

                        <button
                            class="copy-code-btn"
                            type="button"
                        >
                            Copy
                        </button>

                    </div>

                    <pre><code>${block.code}</code></pre>

                </div>
            `;


            formatted =
                formatted.replace(
                    `___CODE_BLOCK_${index}___`,
                    codeBlockHTML
                );

        }
    );


    return formatted;

}


// ===============================
// COPY CODE BUTTON
// ===============================

function addCopyButtons() {

    const buttons =
        document.querySelectorAll(
            ".copy-code-btn"
        );


    buttons.forEach(
        button => {

            if (
                button.dataset.copyReady
            ) {

                return;

            }


            button.dataset.copyReady =
                "true";


            button.addEventListener(
                "click",
                async function() {

                    const codeBlock =
                        button.closest(
                            ".code-block"
                        );


                    if (!codeBlock) {
                        return;
                    }


                    const code =
                        codeBlock.querySelector(
                            "code"
                        );


                    if (!code) {
                        return;
                    }


                    try {

                        await navigator.clipboard.writeText(
                            code.innerText
                        );


                        button.innerText =
                            "Copied!";


                        setTimeout(
                            () => {

                                button.innerText =
                                    "Copy";

                            },
                            1500
                        );


                    } catch (error) {

                        console.error(
                            "Copy failed:",
                            error
                        );


                        button.innerText =
                            "Failed";


                        setTimeout(
                            () => {

                                button.innerText =
                                    "Copy";

                            },
                            1500
                        );

                    }

                }
            );

        }
    );

}


// ===============================
// MESSAGE ACTIONS
// ===============================

function addMessageActions() {

    // ===============================
    // COPY MESSAGE
    // ===============================

    const copyButtons =
        document.querySelectorAll(
            ".copy-message-btn"
        );


    copyButtons.forEach(
        button => {

            if (
                button.dataset.actionReady
            ) {

                return;

            }


            button.dataset.actionReady =
                "true";


            button.addEventListener(
                "click",
                async function() {

                    const messageElement =
                        button.closest(
                            ".bot-message"
                        );


                    if (!messageElement) {
                        return;
                    }


                    const content =
                        messageElement.querySelector(
                            ".message-content"
                        );


                    if (!content) {
                        return;
                    }


                    try {

                        await navigator.clipboard.writeText(
                            content.innerText
                        );


                        button.innerText =
                            "Copied!";


                        setTimeout(
                            () => {

                                button.innerText =
                                    "Copy";

                            },
                            1500
                        );


                    } catch (error) {

                        console.error(
                            "Message copy failed:",
                            error
                        );


                        button.innerText =
                            "Failed";


                        setTimeout(
                            () => {

                                button.innerText =
                                    "Copy";

                            },
                            1500
                        );

                    }

                }
            );

        }
    );


    // ===============================
    // REGENERATE
    // ===============================

    const regenerateButtons =
        document.querySelectorAll(
            ".regenerate-btn"
        );


    regenerateButtons.forEach(
        button => {

            if (
                button.dataset.actionReady
            ) {

                return;

            }


            button.dataset.actionReady =
                "true";


            button.addEventListener(
                "click",
                async function() {

                    const messageElement =
                        button.closest(
                            ".bot-message"
                        );


                    if (!messageElement) {
                        return;
                    }


                    const prompt =
                        messageElement.dataset.userPrompt;


                    if (!prompt) {

                        console.error(
                            "Regenerate failed: original user prompt not found."
                        );

                        return;

                    }


                    button.disabled =
                        true;


                    button.innerText =
                        "Regenerating...";


                    try {

                        showTyping();


                        // Get current conversation context
                        const regenerationHistory =
                            getConversationHistory();


                        const response =
                            await fetch(
                                "/api/chat",
                                {
                                    method: "POST",

                                    headers: {
                                        "Content-Type":
                                            "application/json"
                                    },

                                    body: JSON.stringify({

                                        message:
                                            prompt,

                                        previousInteractionId:
                                            previousInteractionId,

                                        conversationHistory:
                                            regenerationHistory

                                    })

                                }
                            );


                        const data =
                            await response.json();


                        removeTyping();


                        if (!response.ok) {

                            console.error(
                                "Regenerate error:",
                                data
                            );


                            botMessage(
                                data.details?.error?.message ||
                                data.error ||
                                "Unable to regenerate response.",
                                prompt
                            );


                            return;

                        }


                        if (data.reply) {

                            botMessage(
                                data.reply,
                                prompt
                            );


                            // Save regenerated response
                            addConversationMessage(
                                "assistant",
                                data.reply
                            );


                            // Update interaction ID
                            if (
                                data.interactionId
                            ) {

                                previousInteractionId =
                                    data.interactionId;

                            }

                        } else {

                            const fallbackAnswer =
                                findAnswer(prompt);


                            botMessage(
                                fallbackAnswer,
                                prompt
                            );


                            addConversationMessage(
                                "assistant",
                                fallbackAnswer
                            );

                        }


                    } catch (error) {

                        removeTyping();


                        console.error(
                            "Regenerate failed:",
                            error
                        );


                        const fallbackAnswer =
                            findAnswer(prompt);


                        botMessage(
                            fallbackAnswer,
                            prompt
                        );


                        addConversationMessage(
                            "assistant",
                            fallbackAnswer
                        );


                    } finally {

                        button.disabled =
                            false;


                        button.innerText =
                            "Regenerate";

                    }

                }
            );

        }
    );

}


// ===============================
// TYPING INDICATOR
// ===============================

function showTyping() {

    removeTyping();


    const div =
        document.createElement(
            "div"
        );


    div.id =
        "typing";


    div.className =
        "bot-message typing-message";


    div.innerHTML = `
        <span class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
        </span>
    `;


    chatBox.appendChild(
        div
    );


    scrollChat();

}


// ===============================
// REMOVE TYPING
// ===============================

function removeTyping() {

    const typing =
        document.getElementById(
            "typing"
        );


    if (typing) {

        typing.remove();

    }

}


// ===============================
// AUTO SCROLL
// ===============================

function scrollChat() {

    if (!chatBox) {
        return;
    }


    chatBox.scrollTop =
        chatBox.scrollHeight;

}


// ===============================
// HIDE WELCOME SCREEN
// ===============================

function hideWelcomeScreen() {

    if (welcomeScreen) {

        welcomeScreen.style.display =
            "none";

    }

}


// ===============================
// SHOW WELCOME SCREEN
// ===============================

function showWelcomeScreen() {

    if (welcomeScreen) {

        welcomeScreen.style.display =
            "flex";

    }

}


// ===============================
// SAVE CHAT HISTORY
// ===============================

function saveChat() {

    localStorage.setItem(
        "chatHistory",
        chatBox.innerHTML
    );

}


// ===============================
// LOAD CHAT HISTORY
// ===============================

function loadChatHistory() {

    const oldChat =
        localStorage.getItem(
            "chatHistory"
        );


    if (
        oldChat &&
        oldChat.trim() !== ""
    ) {

        chatBox.innerHTML =
            oldChat;


        hideWelcomeScreen();


        // Restore copy buttons
        addCopyButtons();

        // Restore message actions
        addMessageActions();

    }

}


// ===============================
// CLEAR CHAT
// ===============================

function clearChat() {

    chatBox.innerHTML =
        "";


    previousInteractionId =
        null;


    conversationHistory =
        [];


    localStorage.removeItem(
        CONVERSATION_STORAGE_KEY
    );


    localStorage.removeItem(
        "chatHistory"
    );


    showWelcomeScreen();


    userInput.value =
        "";


    userInput.style.height =
        "auto";


    userInput.focus();

}


// ===============================
// NEW CHAT
// ===============================

function startNewChat() {

    chatBox.innerHTML =
        "";


    previousInteractionId =
        null;


    conversationHistory =
        [];


    localStorage.removeItem(
        CONVERSATION_STORAGE_KEY
    );


    localStorage.removeItem(
        "chatHistory"
    );


    showWelcomeScreen();


    userInput.value =
        "";


    userInput.style.height =
        "auto";


    closeMobileSidebar();


    userInput.focus();

}


// ===============================
// NEW CHAT BUTTON
// ===============================

if (newChatBtn) {

    newChatBtn.addEventListener(
        "click",
        startNewChat
    );

}


// ===============================
// MOBILE SIDEBAR
// ===============================

function openMobileSidebar() {

    if (sidebar) {

        sidebar.classList.add(
            "open"
        );

    }


    if (sidebarOverlay) {

        sidebarOverlay.classList.add(
            "active"
        );

    }

}


// ===============================
// CLOSE MOBILE SIDEBAR
// ===============================

function closeMobileSidebar() {

    if (sidebar) {

        sidebar.classList.remove(
            "open"
        );

    }


    if (sidebarOverlay) {

        sidebarOverlay.classList.remove(
            "active"
        );

    }

}


// Open mobile menu
if (mobileMenuBtn) {

    mobileMenuBtn.addEventListener(
        "click",
        openMobileSidebar
    );

}


// Close mobile menu
if (mobileCloseBtn) {

    mobileCloseBtn.addEventListener(
        "click",
        closeMobileSidebar
    );

}


// Close when clicking overlay
if (sidebarOverlay) {

    sidebarOverlay.addEventListener(
        "click",
        closeMobileSidebar
    );

}


// ===============================
// THEME
// ===============================

function applyTheme(theme) {

    if (
        theme === "light"
    ) {

        document.body.classList.add(
            "light"
        );


        if (themeBtn) {

            themeBtn.innerHTML =
                "☀";

        }

    } else {

        document.body.classList.remove(
            "light"
        );


        if (themeBtn) {

            themeBtn.innerHTML =
                "☾";

        }

    }


    localStorage.setItem(
        "theme",
        theme
    );

}


// Theme button
if (themeBtn) {

    themeBtn.addEventListener(
        "click",
        function() {

            const isLight =
                document.body.classList.contains(
                    "light"
                );


            applyTheme(
                isLight
                    ? "dark"
                    : "light"
            );

        }
    );

}


// ===============================
// VOICE INPUT
// ===============================

if (voiceBtn) {

    voiceBtn.addEventListener(
        "click",
        startVoiceRecognition
    );

}


function startVoiceRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

        botMessage(
            "Voice input is not supported in this browser."
        );

        return;

    }


    const recognition =
        new SpeechRecognition();


    recognition.lang =
        "en-US";


    recognition.interimResults =
        false;


    recognition.maxAlternatives =
        1;


    recognition.onstart =
        function() {

            voiceBtn.classList.add(
                "recording"
            );

        };


    recognition.onend =
        function() {

            voiceBtn.classList.remove(
                "recording"
            );

        };


    recognition.onerror =
        function(event) {

            voiceBtn.classList.remove(
                "recording"
            );


            console.error(
                "Voice recognition error:",
                event.error
            );

        };


    recognition.onresult =
        function(event) {

            const voiceText =
                event.results[0][0].transcript;


            userInput.value =
                voiceText;


            userInput.dispatchEvent(
                new Event("input")
            );


            userInput.focus();

        };


    recognition.start();

}


// ===============================
// RESTORE THEME + CHAT
// ===============================

window.addEventListener(
    "DOMContentLoaded",
    function() {

        const savedTheme =
            localStorage.getItem(
                "theme"
            );


        if (savedTheme) {

            applyTheme(
                savedTheme
            );

        } else {

            applyTheme(
                "dark"
            );

        }


        loadChatHistory();

        loadConversationHistory();

    }
);


// ===============================
// SAVE CHAT AFTER MESSAGES
// ===============================

// Keep original message functions
// and automatically save chat.

const originalUserMessage =
    userMessage;


userMessage =
    function(message) {

        originalUserMessage(
            message
        );

        saveChat();

    };


const originalBotMessage =
    botMessage;


botMessage =
    function(
        message,
        originalUserPrompt = ""
    ) {

        // IMPORTANT:
        // Pass the original user prompt
        // to the real botMessage function.

        originalBotMessage(
            message,
            originalUserPrompt
        );

        saveChat();

    };