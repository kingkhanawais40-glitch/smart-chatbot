let chatbotData = [];

const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

// Load JSON file
fetch("knowledge/responses.json")
    .then(response => response.json())
    .then(data => {
        chatbotData = data;
        console.log("Chatbot database loaded:", chatbotData.length, "questions");
    })
    .catch(error => {
        console.error("JSON loading error:", error);
        botMessage("Sorry, chatbot database load nahi ho saka.");
    });


// Send message button
sendBtn.addEventListener("click", sendMessage);


// Enter key support
userInput.addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        sendMessage();
    }
});


// Main function
function sendMessage() {

    let message = userInput.value.trim();

    if (message === "") return;


    userMessage(message);

    userInput.value = "";


    showTyping();


    setTimeout(() => {

        removeTyping();

        let answer = findAnswer(message);

        botMessage(answer);


    }, 800);

}



// Find matching answer
function findAnswer(question) {

    question = question.toLowerCase();


    let bestMatch = null;
    let maxScore = 0;


    chatbotData.forEach(item => {

        let score = 0;


        item.keywords.forEach(keyword => {

            keyword = keyword.toLowerCase();


            if (question.includes(keyword)) {
                score++;
            }


            let words = question.split(" ");

            if (words.includes(keyword)) {
                score++;
            }

        });



        if (score > maxScore) {

            maxScore = score;
            bestMatch = item.answer;

        }


    });



    if (bestMatch && maxScore > 0) {

        return bestMatch;

    }


    return "Sorry, I don't understand this question yet. Please ask something related to programming, AI, technology or Muhammad Awais portfolio.";

}



// User message display
function userMessage(message) {

    let div = document.createElement("div");

    div.className = "user-message";

    div.innerHTML = message;

    chatBox.appendChild(div);

    scrollChat();

}



// Bot message display
function botMessage(message) {

    let div = document.createElement("div");

    div.className = "bot-message";

    div.innerHTML = message;

    chatBox.appendChild(div);

    scrollChat();

}



// Typing animation
function showTyping() {

    let div = document.createElement("div");

    div.id = "typing";

    div.className = "bot-message";

    div.innerHTML = "Bot is typing...";

    chatBox.appendChild(div);

}



function removeTyping() {

    let typing = document.getElementById("typing");

    if (typing) {

        typing.remove();

    }

}


// Auto scroll
function scrollChat() {

    chatBox.scrollTop = chatBox.scrollHeight;

}



// Clear chat function
function clearChat() {

    chatBox.innerHTML = "";

}
// Save chat history

function saveChat() {

    localStorage.setItem(
        "chatHistory",
        chatBox.innerHTML
    );

}


// Load chat history

window.onload = function() {

    let oldChat = localStorage.getItem("chatHistory");

    if (oldChat) {

        chatBox.innerHTML = oldChat;

    }

};



// Save after every message

const oldUserMessage = userMessage;

userMessage = function(message) {

    oldUserMessage(message);
    saveChat();

}



const oldBotMessage = botMessage;

botMessage = function(message) {

    oldBotMessage(message);
    saveChat();

}



// Theme change

const themeBtn = document.getElementById("theme-btn");


themeBtn.onclick = function() {

    document.body.classList.toggle("dark");


    if (document.body.classList.contains("dark")) {

        themeBtn.innerHTML = "☀️";

    } else {

        themeBtn.innerHTML = "🌙";

    }

};
// Voice Input Feature

const voiceBtn = document.getElementById("voice-btn");


voiceBtn.onclick = function() {

    let recognition = new webkitSpeechRecognition();

    recognition.lang = "en-US";


    recognition.start();



    recognition.onresult = function(event) {

        let voiceText = event.results[0][0].transcript;


        userInput.value = voiceText;


    };


};