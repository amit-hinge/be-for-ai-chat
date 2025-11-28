require("dotenv").config();

const express = require("express");
const StreamChat = require("stream-chat").StreamChat;
const { startAiBotStreaming } = require("./ai");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.raw({ type: "application/json" }));

const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

if (!apiKey || !apiSecret) {
  console.error("Please provide STREAM_API_KEY and STREAM_API_SECRET env variables");
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("Please provide OPENAI_API_KEY env variable");
  process.exit(1);
}

const reqHandler = async (req, res) => {
  const client = StreamChat.getInstance(apiKey, apiSecret);

  // Parse and verify webhook
  const rawBody = req.body;
  const isValid = client.verifyWebhook(rawBody, req.headers["x-signature"]);

  if (!isValid) {
    return res.status(400).send("Invalid signature");
  }

  const body = JSON.parse(rawBody);
  if (!body) {
    return res.status(400).send("Invalid JSON");
  }

  const event = body;

  // Only handle new messages from users (not from AI bot)
  if (
    event.type !== "message.new" ||
    !event.message ||
    event.message.user.id === event.channel.aiName ||
    !event.channel_type ||
    !event.channel_id
  ) {
    return res.status(200).send("Not a new user message");
  }

  // Skip retries
  if (req.headers["x-webhook-attempt"] > 1) {
    return res.status(200).send("Skipping retry");
  }

  const channel = client.channel(event.channel_type, event.channel_id);
  const prompt = event.message?.text;
  const aiUserId = event?.channel?.aiName || "ai-bot";

  if (channel && prompt) {
    // Start streaming in async mode
    startAiBotStreaming(client, channel, prompt, aiUserId).catch((error) => {
      console.error("AI streaming error:", error);
    });
  }

  return res.status(200).send("OK");
};

app.post("/", reqHandler);

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.listen(port, () => {
  console.log(`AI Chat Backend listening on port ${port}`);
  console.log(`OpenAI Model: ${process.env.OPENAI_MODEL || "gpt-4o-mini"}`);
});
