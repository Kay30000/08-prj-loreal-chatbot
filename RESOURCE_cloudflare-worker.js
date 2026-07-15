// Copy this code into your Cloudflare Worker script

const SYSTEM_PROMPT =
  "You are a helpful L'Oréal assistant. Answer only questions about L'Oréal products, routines, and recommendations. If the user asks about anything else, respond exactly with: I apologize, I do not know. Please make the question geared towards L'Oréal products, routines, and recommendations.";

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    // Handle CORS preflight requests.
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Only POST requests are allowed." }),
        { status: 405, headers: corsHeaders },
      );
    }

    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing OPENAI_API_KEY secret." }),
        { status: 500, headers: corsHeaders },
      );
    }

    let requestData;
    try {
      requestData = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Request body must be valid JSON." }),
        { status: 400, headers: corsHeaders },
      );
    }

    const userMessages = Array.isArray(requestData?.messages)
      ? requestData.messages
      : [];

    if (userMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: "A messages array is required." }),
        { status: 400, headers: corsHeaders },
      );
    }

    const requestBody = {
      model: "gpt-4o",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...userMessages],
      temperature: 0.2,
    };

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        return new Response(
          JSON.stringify({
            error: data?.error?.message || "OpenAI request failed.",
          }),
          { status: response.status, headers: corsHeaders },
        );
      }

      return new Response(JSON.stringify(data), { headers: corsHeaders });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Unable to reach OpenAI.",
          details: error instanceof Error ? error.message : String(error),
        }),
        { status: 502, headers: corsHeaders },
      );
    }
  },
};
