/**
 * Setup script to create users, channel, and generate tokens for testing
 * 
 * Usage:
 *   STREAM_API_KEY=xxx STREAM_API_SECRET=xxx node setup.js
 * 
 * Or with .env file:
 *   node setup.js
 */

require("dotenv").config();

const { StreamChat } = require("stream-chat");

const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

if (!apiKey || !apiSecret) {
  console.error("Please provide STREAM_API_KEY and STREAM_API_SECRET");
  process.exit(1);
}

const AI_BOT_USER_ID = "ai-assistant";
const TEST_USER_ID = "test-user-1";
const CHANNEL_ID = "ai-test-channel";

async function setup() {
  const client = StreamChat.getInstance(apiKey, apiSecret);

  console.log("🚀 Setting up Stream Chat for AI testing...\n");

  // 1. Create/update AI bot user
  console.log("1️⃣ Creating AI bot user...");
  await client.upsertUser({
    id: AI_BOT_USER_ID,
    name: "AI Assistant",
    role: "admin",
  });
  console.log(`   ✅ AI bot user created: ${AI_BOT_USER_ID}\n`);

  // 2. Create/update test user
  console.log("2️⃣ Creating test user...");
  await client.upsertUser({
    id: TEST_USER_ID,
    name: "Test User",
    image: "https://getstream.io/random_png/?name=TestUser",
  });
  console.log(`   ✅ Test user created: ${TEST_USER_ID}\n`);

  // 3. Generate token for test user
  console.log("3️⃣ Generating user token...");
  const userToken = client.createToken(TEST_USER_ID);
  console.log(`   ✅ Token generated\n`);

  // 4. Create channel with aiName property
  console.log("4️⃣ Creating AI chat channel...");
  const channel = client.channel("messaging", CHANNEL_ID, {
    name: "AI Chat Test",
    members: [TEST_USER_ID, AI_BOT_USER_ID],
    aiName: AI_BOT_USER_ID, // This is read by the backend to know which user to respond as
    created_by_id: TEST_USER_ID,
  });
  await channel.create();
  console.log(`   ✅ Channel created: ${CHANNEL_ID}\n`);

  // 5. Output configuration for SampleApp
  console.log("═".repeat(60));
  console.log("📋 ADD THIS TO SampleApp/src/ChatUsers.ts:");
  console.log("═".repeat(60));
  console.log(`
// AI Chat Test Configuration
export const AI_TEST_API_KEY = '${apiKey}';
export const AI_TEST_USER_ID = '${TEST_USER_ID}';
export const AI_TEST_USER_TOKEN = '${userToken}';
export const AI_TEST_CHANNEL_ID = '${CHANNEL_ID}';
export const AI_BOT_USER_ID = '${AI_BOT_USER_ID}';
`);

  console.log("═".repeat(60));
  console.log("🔧 WEBHOOK CONFIGURATION:");
  console.log("═".repeat(60));
  console.log(`
1. Go to Stream Dashboard: https://dashboard.getstream.io/
2. Select your app (API Key: ${apiKey})
3. Go to Chat > Overview > Webhooks
4. Set webhook URL to: https://be-for-ai-chat.onrender.com
5. Enable "message.new" event
`);

  console.log("═".repeat(60));
  console.log("✅ Setup complete!");
  console.log("═".repeat(60));

  process.exit(0);
}

setup().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});

