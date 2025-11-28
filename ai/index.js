const { startStreaming } = require("./openAI");

// Configuration - can match communication-service or send every chunk
// Set USE_BATCHING=true to match communication-service behavior
const USE_BATCHING = process.env.USE_BATCHING === "true";
const BATCH_SIZE = 15;  // Same as communication-service
const EARLY_UPDATE_LIMIT = 10;  // Same as communication-service

/**
 * Starts AI bot streaming response to a Stream Chat channel
 * 
 * Environment variables:
 * - USE_BATCHING: "true" to use communication-service's batching logic
 * - FINALIZE_DELAY_MS: delay in ms before final update (test timing hypothesis)
 * 
 * Flow:
 * 1. Create empty message with ai_generated: true
 * 2. Stream AI response (either every chunk or batched like communication-service)
 * 3. Finalize: Set final text with generating: false
 */
async function startAiBotStreaming(client, channel, prompt, aiUserId) {
  console.log(`[AI Bot] Starting streaming for prompt: "${prompt.substring(0, 50)}..."`);

  // 1. Create an empty message
  const message = await channel.sendMessage({
    user_id: aiUserId,
    type: "regular",
    text: "",
    ai_generated: true,
  });

  const messageId = message.message.id;
  console.log(`[AI Bot] Created initial message: ${messageId}`);

  await sleep(300);

  // 2. Stream AI response
  let extractedText = "";
  let chunkCounter = 0;

  const chunks = startStreaming(prompt);
  console.log(`[AI Bot] Batching mode: ${USE_BATCHING ? "ON (like communication-service)" : "OFF (every chunk)"}`);

  try {
    for await (const chunk of chunks) {
      if (!chunk) continue; // Skip empty chunks
      
      chunkCounter++;
      extractedText += chunk;

      // Determine if we should send an update
      let shouldUpdate = true;
      if (USE_BATCHING) {
        // Match communication-service batching logic
        shouldUpdate = 
          chunkCounter % BATCH_SIZE === 0 ||
          (chunkCounter < EARLY_UPDATE_LIMIT && chunkCounter % 2 !== 0);
      }

      if (shouldUpdate) {
        console.log(`[AI Bot] partialUpdateMessage (chunk ${chunkCounter}): ${extractedText.length} chars`);

        await client.partialUpdateMessage(messageId, {
          set: {
            generating: true,
            text: extractedText,
          },
        }, aiUserId);
      }
    }

    // 3. Finalize message - TEST TIMING HYPOTHESIS
    // 
    // The 1000ms delay "fix" in communication-service suggests this is a timing issue.
    // Let's test with different delays to understand the behavior.
    //
    // Set FINALIZE_DELAY_MS env var to test different delays:
    // - 0ms (default): immediate finalize, should trigger bug if it's timing-related
    // - 100ms: small delay
    // - 500ms: medium delay  
    // - 1000ms: same as communication-service fix
    
    const finalizeDelay = parseInt(process.env.FINALIZE_DELAY_MS || "0", 10);
    
    console.log(`[AI Bot] Last chunk sent. Text length: ${extractedText.length} chars`);
    console.log(`[AI Bot] Waiting ${finalizeDelay}ms before finalize...`);
    
    if (finalizeDelay > 0) {
      await sleep(finalizeDelay);
    }
    
    console.log(`[AI Bot] Finalizing message: ${messageId}`);

    await client.partialUpdateMessage(messageId, {
      set: {
        text: extractedText,  // SAME as last streaming update!
        generating: false,    // Only this changes
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
