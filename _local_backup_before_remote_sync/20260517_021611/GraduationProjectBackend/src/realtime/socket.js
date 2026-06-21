import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../loaders/dbLoader.js";
import { AppError } from "../common/errors/AppError.js";
import {
  addUserSocket,
  clearSocketActiveConversation,
  joinUserRoom as joinChatUserRoom,
  registerChatIo,
  removeUserSocket,
  setSocketActiveConversation,
} from "../modules/chat/chat.realtime.js";
import {
  getChatUnreadCountService,
  markConversationSeenService,
  markPendingDeliveriesService,
  sendChatMessageService,
} from "../modules/chat/chat.service.js";

let ioInstance = null;

async function getUserRoomTeamIds(userId) {
  const [led, membership, doctorTeams, taTeams] = await Promise.all([
    prisma.team.findUnique({ where: { leaderId: userId }, select: { id: true } }),
    prisma.teamMember.findUnique({ where: { userId }, select: { teamId: true } }),
    prisma.team.findMany({ where: { doctorId: userId }, select: { id: true } }),
    prisma.team.findMany({ where: { taId: userId }, select: { id: true } }),
  ]);

  return Array.from(
    new Set([led?.id, membership?.teamId, ...doctorTeams.map((team) => team.id), ...taTeams.map((team) => team.id)].filter(Boolean)),
  );
}

function extractSocketToken(socket) {
  return (
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "") ||
    socket.handshake.query?.token
  );
}

function toSocketErrorPayload(error) {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  return {
    code: "SOCKET_ERROR",
    message: "Something went wrong while processing the socket event.",
  };
}

export function initSocket(httpServer) {
  ioInstance = new Server(httpServer, { cors: { origin: env.corsOrigins, credentials: false } });
  registerChatIo(ioInstance);

  ioInstance.use(async (socket, next) => {
    try {
      const token = extractSocketToken(socket);
      if (!token) return next(new Error("UNAUTHORIZED"));

      const payload = jwt.verify(String(token), env.jwtSecret);
      const user = await prisma.user.findUnique({
        where: { id: payload?.id },
        select: { id: true, role: true },
      });

      if (!user) return next(new Error("UNAUTHORIZED"));

      socket.data.user = user;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  ioInstance.on("connection", async (socket) => {
    const user = socket.data.user;

    socket.join(`user:${user.id}`);
    joinChatUserRoom(socket, user.id);
    addUserSocket(user.id, socket.id);

    try {
      const teamIds = await getUserRoomTeamIds(user.id);
      teamIds.forEach((teamId) => socket.join(`team:${teamId}`));
    } catch (error) {
      console.error("SOCKET_TEAM_ROOM_SYNC_FAILED:", error);
    }

    try {
      await markPendingDeliveriesService(user);
      const unread = await getChatUnreadCountService(user);
      socket.emit("chat:badge", unread);
    } catch (error) {
      console.error("CHAT_SOCKET_CONNECT_SYNC_FAILED:", error);
    }

    socket.on("team:subscribe", (teamId) => {
      if (typeof teamId === "string" && teamId.trim()) {
        socket.join(`team:${teamId.trim()}`);
      }
    });

    socket.on("chat:message:send", async (payload, ack) => {
      try {
        const result = await sendChatMessageService(user, payload);
        ack?.({ ok: true, data: result });
      } catch (error) {
        ack?.({ ok: false, error: toSocketErrorPayload(error) });
      }
    });

    socket.on("chat:conversation:open", async (payload, ack) => {
      try {
        setSocketActiveConversation(socket.id, payload?.conversationId ?? null);
        const result = await markConversationSeenService(user, payload?.conversationId);
        ack?.({ ok: true, data: result });
      } catch (error) {
        ack?.({ ok: false, error: toSocketErrorPayload(error) });
      }
    });

    socket.on("chat:conversation:close", () => {
      clearSocketActiveConversation(socket.id);
    });

    socket.on("disconnect", () => {
      clearSocketActiveConversation(socket.id);
      removeUserSocket(user.id, socket.id);
    });
  });

  return ioInstance;
}

export function emitToUser(userId, event, payload) {
  if (ioInstance && userId) ioInstance.to(`user:${userId}`).emit(event, payload);
}

export function emitToTeam(teamId, event, payload) {
  if (ioInstance && teamId) ioInstance.to(`team:${teamId}`).emit(event, payload);
}
