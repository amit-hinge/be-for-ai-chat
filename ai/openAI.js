const OpenAI = require("openai");
require("dotenv").config();

let openai;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/**
 * Streams chat completions from OpenAI
 * @param {string} prompt - The user's message
 * @param {string} systemPrompt - Optional system prompt for context
 * @yields {string} Text chunks from OpenAI
 */
async function* startStreaming(prompt, systemPrompt = "You are a helpful assistant.") {
  if (!openai) {
    throw new Error("Please provide OPENAI_API_KEY env variable");
  }

  const stream = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

module.exports = {
  startStreaming,
};
