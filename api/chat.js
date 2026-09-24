export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
       const { message, history = [] } = req.body || {};

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

        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey
                },
                body: JSON.stringify({
                    contents: [
    ...history,
    {
        role: "user",
        parts: [
            {
                text: message
            }
        ]
    }
]
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
    console.error("Gemini API error:", data);

    return res.status(response.status).json({
        error: "Gemini API request failed",
        details: data
    });
}

        const reply =
            data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!reply) {
            return res.status(500).json({
                error: "Gemini returned an empty response"
            });
        }

        return res.status(200).json({
            success: true,
            reply: reply
        });

    } catch (error) {
        console.error("Chat API error:", error);

        return res.status(500).json({
            error: "Internal server error"
        });
    }
}