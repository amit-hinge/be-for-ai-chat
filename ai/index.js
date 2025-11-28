const { startStreaming } = require("./openAI");

/**
 * Starts AI bot streaming response to a Stream Chat channel
 * 
 * This implementation reproduces the bug in stream-chat-react-native SDK where
 * message text doesn't update when the final partialUpdateMessage call has the
 * EXACT SAME text as the last streaming update.
 * 
 * BUG REPRODUCTION STRATEGY:
 * - Send EVERY chunk during streaming (no batching)
 * - Final call will have the EXACT same text as the last streaming update
 * - Only 'generating' changes from true → false
 * - Since 'generating' is not in stringifyMessage(), the UI won't re-render
 * 
 * Flow:
 * 1. Create empty message with ai_generated: true
 * 2. Stream AI response, updating message text on EVERY chunk
 * 3. Finalize: Set final text (SAME) with generating: false in single atomic call
 *    → This triggers the bug!
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

  // 2. Stream AI response - send EVERY chunk to ensure final text matches last update
  let extractedText = "";
  let chunkCounter = 0;

  const chunks = startStreaming(prompt);

  try {
    for await (const chunk of chunks) {
      if (!chunk) continue; // Skip empty chunks
      
      chunkCounter++;
      extractedText += chunk;

      // Send EVERY chunk - no batching!
      // This ensures the final text will be EXACTLY the same as the last update
      console.log(`[AI Bot] partialUpdateMessage (chunk ${chunkCounter}): ${extractedText.length} chars`);

      await client.partialUpdateMessage(messageId, {
        set: {
          generating: true,
          text: extractedText,
        },
      }, aiUserId);
    }

    // 3. Finalize message - THIS IS THE BUG!
    // 
    // At this point:
    // - extractedText is EXACTLY the same as the last streaming update
    // - Only 'generating' changes from true → false
    // - stringifyMessage() doesn't include 'generating'
    // - So the memoized message context won't update
    // - UI SHOULD NOT re-render (bug!)
    //
    // If updated_at alone triggers re-render, the bug won't appear.
    // The bug appears when text is same AND the timing is right.
    
    console.log(`[AI Bot] Finalizing message (SAME TEXT): ${messageId}`);
    console.log(`[AI Bot] Text length: ${extractedText.length} chars (should match last update)`);

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
