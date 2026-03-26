/**
 * Vercel Serverless Function — Claude API Proxy
 * /api/claude.js
 *
 * Keeps ANTHROPIC_API_KEY on the server — never exposed to the browser.
 * Set in Vercel dashboard: Settings → Environment Variables → ANTHROPIC_API_KEY
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured on server." });
  }

  try {
    const { system, messages, max_tokens = 1500 } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens,
        ...(system ? { system } : {}),
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", response.status, err);
      return res.status(response.status).json({ error: `Anthropic API error ${response.status}` });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
