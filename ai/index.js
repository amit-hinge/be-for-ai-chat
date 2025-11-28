const { startStreaming } = require("./openAI");

// Configuration - matching communication-service constants
const BATCH_SIZE = 5;
const EARLY_UPDATE_LIMIT = 10;

/**
 * Starts AI bot streaming response to a Stream Chat channel
 * 
 * This implementation mirrors communication-service/src/robin-service/streams/getstream.transform.ts
 * 
 * Flow:
 * 1. Create empty message (like message_start event handler)
 * 2. Stream AI response, updating message text periodically via partialUpdateMessage (like message_delta)
 * 3. Finalize: Set final text with generating: false in single call (like finalizeMessage)
 * 
 * NOTE: The single atomic call in step 3 causes the bug where text doesn't update
 * due to memoization issue in stream-chat-react-native SDK
 */
async function startAiBotStreaming(client, channel, prompt, aiUserId) {
  console.log(`[AI Bot] Starting streaming for prompt: "${prompt.substring(0, 50)}..."`);

  // 1. Create an empty message - mirrors handleEvent for 'message_start'
  const message = await channel.sendMessage({
    user_id: aiUserId,
    type: "regular",
    text: "",
    ai_generated: true,
  });

  const messageId = message.message.id;
  console.log(`[AI Bot] Created initial message: ${messageId}`);

  await sleep(300);

  // 2. Stream AI response - mirrors handleEvent for 'message_delta'
  let extractedText = "";
  let chunkCounter = 0;

  const chunks = startStreaming(prompt);

  try {
    for await (const chunk of chunks) {
      chunkCounter++;
      extractedText += chunk;

      // Matching communication-service batching logic
      const shouldUpdate =
        chunkCounter % BATCH_SIZE === 0 ||
        (chunkCounter < EARLY_UPDATE_LIMIT && chunkCounter % 2 !== 0);

      if (shouldUpdate && messageId) {
        console.log(`[AI Bot] partialUpdateMessage (chunk ${chunkCounter}): ${extractedText.length} chars`);

        await client.partialUpdateMessage(messageId, {
          set: {
            generating: true,
            text: extractedText,
          },
        }, aiUserId);
      }
    }

    // 3. Finalize message - mirrors finalizeMessage()
    // 
    // BROKEN PATTERN (single atomic call):
    // This causes the bug where UI doesn't update because stringifyMessage()
    // doesn't include 'generating' field
    console.log(`[AI Bot] Finalizing message: ${messageId}`);

    await client.partialUpdateMessage(messageId, {
      set: {
        text: extractedText,
        generating: false,
      },
    }, aiUserId);

    console.log(`[AI Bot] Done: ${extractedText.length} chars`);

  } catch (error) {
    console.error(`[AI Bot] Error:`, error);

    try {
      await client.partialUpdateMessage(messageId, {
        set: {
          text: extractedText || "Sorry, an error occurred.",
          generating: false,
        },
      }, aiUserId);
    } catch (finalizeError) {
      console.error(`[AI Bot] Error finalizing:`, finalizeError);
    }

    throw error;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
  startAiBotStreaming,
};
