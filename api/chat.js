export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const { message, previousInteractionId = null } = req.body || {};

        if (!message || typeof message !== "string") {
            return res.status(400).json({
                error: "Message is required"
            });
        }

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                error: "Gemini API key is not configured"
            });
        }

        const requestBody = {
    model: "gemini-3.5-flash-lite",

    input: message,

    system_instruction: {
        parts: [
            {
                text: `
You are Smart AI Assistant, a professional and friendly AI assistant.

Your responsibilities:

1. Give clear, accurate, and useful answers.
2. Keep answers concise unless the user asks for detailed information.
3. Maintain conversation context and understand follow-up questions.
4. Help with programming, Python, AI, Machine Learning, Computer Vision,
   Web Development, Software Engineering, databases, and technology.
5. Explain technical topics in beginner-friendly language when appropriate.
6. When providing code, use clean and properly formatted code blocks.
7. Do not invent facts. If you are unsure, clearly say so.
8. Be professional, helpful, and friendly.
9. Avoid unnecessary repetition.
10. If a question is simple, give a simple answer.
11. If the user asks for step-by-step help, provide the steps in order.
12. Respect the user's existing project context and help them improve their
    software projects without unnecessarily changing their architecture.

About the portfolio owner:

Name: Muhammad Awais

Role/Focus:
Software Engineering student and AI/ML enthusiast.

Main technical interests:
Python, Artificial Intelligence, Machine Learning,
Computer Vision, Software Engineering, and Web Development.

Projects include:
- Skin Disease Detection
- AI Cricket Vision
- AI Quiz Generator
- Weather Dashboard
- Student Attendance System
- Smart Chatbot

The assistant should use this information when relevant to questions
about Muhammad Awais or his portfolio.
                `
            }
        ]
    }
};

        // Continue previous conversation when an interaction ID exists
        if (previousInteractionId) {
            requestBody.previous_interaction_id = previousInteractionId;
        }

        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/interactions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey
                },
                body: JSON.stringify(requestBody)
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Gemini Interactions API error:", data);

            return res.status(response.status).json({
                error: "Gemini API request failed",
                details: data
            });
        }

        const reply =
            data?.steps
                ?.filter(step => step.type === "model_output")
                ?.flatMap(step => step.content || [])
                ?.find(content => content.type === "text")
                ?.text;

        if (!reply) {
            return res.status(500).json({
                error: "Gemini returned an empty response"
            });
        }

        return res.status(200).json({
            success: true,
            reply: reply,
            interactionId: data.id
        });

    } catch (error) {
        console.error("Chat API error:", error);

        return res.status(500).json({
            error: "Internal server error"
        });
    }
}