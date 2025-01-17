const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");

// Load proto
const PROTO_PATH = path.resolve(__dirname, "./ai_streaming.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH);
const aiProto = grpc.loadPackageDefinition(packageDefinition).ai;

// Create gRPC client
const client = new aiProto.AiStreamingService(
  "localhost:50051",
  grpc.credentials.createInsecure()
);

// Stream AI responses
async function streamAiResponses(provider, prompt) {
  const call = client.StreamResponses();

  // Send request to the server
  call.write({ provider, prompt });
  call.end();
  // Listen for streamed responses
  call.on("data", (response) => {
    if (response.is_final) {
      console.log("Final response:", response.full_text);
    } else {
      console.log("Received chunk:", response.chunk);
    }
  });

  call.on("end", () => {
    console.log("Streaming ended.");
  });

  call.on("error", (error) => {
    console.error("Streaming error:", error.message);
  });

  call.on("status", (status) => {
    console.log("Streaming status:", status);
  });

  // End the request stream
  call.end();
}

// Example usage
streamAiResponses("openai", "hello" ); //"What is the meaning of life?" //what does hinge health do?
