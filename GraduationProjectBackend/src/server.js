import http from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { dbConnect, dbDisconnect } from "./loaders/dbLoader.js";
import { initSocket } from "./realtime/socket.js";
const app=createApp();
const httpServer=http.createServer(app);
await dbConnect();
initSocket(httpServer);
const server=httpServer.listen(env.port,()=>{console.log(`🚀 Server running on http://localhost:${env.port}`);});
async function shutdown(){server.close(async()=>{await dbDisconnect(); process.exit(0);});}
process.on("SIGINT",shutdown); process.on("SIGTERM",shutdown);
