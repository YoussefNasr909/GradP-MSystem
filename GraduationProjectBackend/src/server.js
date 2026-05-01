import http from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { dbConnect, dbDisconnect } from "./loaders/dbLoader.js";
import { initSocket } from "./realtime/socket.js";

// Initialize Express application
const app = createApp();
const httpServer = http.createServer(app);

// Connect to database and initialize WebSocket
await dbConnect();
initSocket(httpServer);

// Start server
const server = httpServer.listen(env.port, () => {
  console.log(`🚀 Server running on http://localhost:${env.port}`);
});

// Graceful shutdown handler
async function shutdown() {
  server.close(async () => {
    await dbDisconnect();
    process.exit(0);
  });
}

// Listen for termination signals
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
