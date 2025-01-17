const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");
const { startStreaming: startOpenAIStreaming } = require("./../openAI");
const { startStreaming: startGeminiAIStreaming } = require("./../geminiAI");
const { startStreaming: startMockStreaming } = require("./../mockAI");

// Load proto
const PROTO_PATH = path.resolve(__dirname, "./ai_streaming.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH);
const aiProto = grpc.loadPackageDefinition(packageDefinition).ai;

// Select AI service based on the provider
function getAiService(provider) {
  switch (provider) {
    case "openai":
      return startOpenAIStreaming;
    case "gemini":
      return startGeminiAIStreaming;
    case "mock":
      return startMockStreaming;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

// Implement the StreamResponses RPC
async function streamResponses(call) {
  try {
    let aggregatedText = "";

    for await (const request of call) {
      const { provider, prompt } = request;
      console.log(`Received request: provider=${provider}, prompt=${prompt}`);
      const aiService = getAiService(provider);

      const chunks = aiService(prompt);
      for await (const chunk of chunks) {
        aggregatedText += chunk;

        // Stream each chunk back to the client
        call.write({
          chunk,
          is_final: false,
        });
      }
      console.log("After for loop");

      // Send the final aggregated response
      call.write({
        chunk: "",
        full_text: aggregatedText,
        is_final: true,
      });
      console.log("After call.write.");
      call.end(); // <-- Ensure this is called
    }
    call.end();
  } catch (error) {
    console.error("Error in streamResponses:", error.message);
    call.end();
  }
}

// Start gRPC server
function main() {
  const server = new grpc.Server();
  server.addService(aiProto.AiStreamingService.service, { StreamResponses: streamResponses });
  const PORT = "50051";
  server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), () => {
    console.log(`gRPC server is running on port ${PORT}`);
    server.start();
  });
}

main();
