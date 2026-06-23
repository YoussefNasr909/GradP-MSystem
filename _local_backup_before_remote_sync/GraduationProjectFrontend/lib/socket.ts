"use client"
import { io, type Socket } from "socket.io-client"
import { API_BASE_URL } from "@/lib/api/http"
let socket: Socket | null = null
const resolveSocketUrl = () => API_BASE_URL.replace(/\/api\/v1\/?$/, "")
export function getSocket(token?: string | null) { if (!token) return null; if (socket) return socket; socket = io(resolveSocketUrl(), { transports: ["websocket", "polling"], auth: { token } }); return socket }
export function disconnectSocket() { if (socket) { socket.disconnect(); socket = null } }
