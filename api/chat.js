export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const { message } = req.body || {};

        if (!message || typeof message !== "string") {
            return res.status(400).json({
                error: "Message is required"
            });
        }

        return res.status(200).json({
            success: true,
            reply: `Backend received your message: ${message}`
        });

    } catch (error) {
        console.error("Chat API error:", error);

        return res.status(500).json({
            error: "Internal server error"
        });
    }
}