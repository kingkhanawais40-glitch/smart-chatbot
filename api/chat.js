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
            input: message
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