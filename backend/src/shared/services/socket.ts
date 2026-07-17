import { Server, Socket } from "socket.io";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { verifyToken } from "../utils/jwt";
import { SupportTicket } from "../../modules/chat/ticket.model";
import { notifyUser } from "../../modules/notification/notification.service";
import { SupportConfig } from "../../modules/chat/supportConfig.model";
import { updateAgentLocation } from "../../modules/agent/agent.service";
import { env, isProd } from "../../config/env";

let io: Server | null = null;
const adminConnections = new Map<string, Set<string>>(); // userId -> Set of socketIds

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    role: string;
  };
}

export async function initSocket(server: any) {
  io = new Server(server, {
    cors: {
      origin(origin, callback) {
        const normalized = origin ? origin.replace(/\/+$/, "") : "";
        if (
          !origin ||
          env.clientOrigins.includes("*") ||
          env.clientOrigins.includes(normalized) ||
          (!isProd && (normalized.startsWith("http://localhost:") || normalized.startsWith("http://127.0.0.1:")))
        ) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Skip HTTP long-polling entirely. Under PM2 cluster mode, nginx proxies
    // every request to the same port 4000, but which of the 4 worker
    // processes actually handles a given connection is decided inside
    // Node's cluster module — invisible to nginx. Polling's sequential
    // handshake requests can each land on a different worker, and a worker
    // that doesn't recognize another's session id returns 400. A WebSocket
    // is one persistent connection, so it's pinned to a single worker for
    // its lifetime and never hits this.
    transports: ["websocket"],
  });

  // In single-process mode this is a no-op — events already reach every
  // connected client directly. Under PM2 cluster mode, each worker only
  // knows about its own sockets, so without this adapter io.to(room).emit()
  // (dispatch offers, chat, notifications) would silently miss clients
  // connected to a different worker.
  if (env.redisUrl) {
    const pubClient = createClient({ url: env.redisUrl });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log("🔌 Socket.IO using Redis adapter for cross-worker broadcast");
  }

  // Authentication Middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    try {
      const decoded = verifyToken(String(token));
      socket.user = {
        id: decoded.sub,
        role: decoded.role,
      };
      next();
    } catch (err) {
      return next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", async (socket: AuthenticatedSocket) => {
    if (!socket.user) return;

    const { id: userId, role } = socket.user;

    // Join personal user room
    socket.join(`user:${userId}`);

    // If Admin, track presence and join admins room
    if (role === "admin") {
      socket.join("support:admins");
      if (!adminConnections.has(userId)) {
        adminConnections.set(userId, new Set());
      }
      adminConnections.get(userId)!.add(socket.id);

      // Recalculate support status and notify everyone
      await syncAndBroadcastSupportStatus();
    }

    console.log(`🔌 User connected: ${userId} (${role}) | Socket: ${socket.id}`);

    // Handle joining ticket room
    socket.on("join_ticket", (ticketId: string) => {
      if (!ticketId || typeof ticketId !== "string") return;
      socket.join(`ticket:${ticketId}`);
      console.log(`🎟️ Socket ${socket.id} joined ticket:${ticketId}`);
    });

    // Handle leaving ticket room
    socket.on("leave_ticket", (ticketId: string) => {
      if (!ticketId || typeof ticketId !== "string") return;
      socket.leave(`ticket:${ticketId}`);
      console.log(`🎟️ Socket ${socket.id} left ticket:${ticketId}`);
    });

    // Agent streams its live GPS position while online (for nearest-agent dispatch).
    socket.on("agent_location", async (data: { lat?: number; lng?: number }) => {
      if (role !== "agent") return;
      const lat = Number(data?.lat);
      const lng = Number(data?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      try {
        await updateAgentLocation(userId, lat, lng);
      } catch (err) {
        console.error("agent_location update failed:", (err as Error).message);
      }
    });

    socket.on("disconnect", async () => {
      console.log(`🔌 User disconnected: ${userId} | Socket: ${socket.id}`);

      if (role === "admin") {
        const sockets = adminConnections.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            adminConnections.delete(userId);
          }
        }
        // Recalculate support status and notify everyone
        await syncAndBroadcastSupportStatus();
      }
    });
  });

  return io;
}

export function getConnectedAdminsCount(): number {
  return adminConnections.size;
}

export async function syncAndBroadcastSupportStatus() {
  if (!io) return;

  // Calculate online status
  let config = await SupportConfig.findOne();
  if (!config) {
    config = await SupportConfig.create({ manualSupportStatus: "auto" });
  }

  const manualStatus = config.manualSupportStatus;
  let isOnline = false;
  if (manualStatus === "online") {
    isOnline = true;
  } else if (manualStatus === "offline") {
    isOnline = false;
  } else {
    isOnline = getConnectedAdminsCount() > 0;
  }

  io.emit("support_status", { isOnline });
}

export function broadcastSupportStatus(isOnline: boolean) {
  if (io) {
    io.emit("support_status", { isOnline });
  }
}

export async function broadcastNewMessage(ticketId: string, message: any, senderRole: string) {
  if (!io) return;

  // Send to the ticket room
  io.to(`ticket:${ticketId}`).emit("new_message", message);

  // Send updates to admin room to refresh ticket listing
  io.to("support:admins").emit("ticket_update", { ticketId, lastMessage: message });

  // If message is sent by staff, send FCM Push & in-app notification to the customer
  if (senderRole === "admin") {
    try {
      const ticket = await SupportTicket.findById(ticketId);
      if (ticket) {
        // Persist Notification & trigger push via fcm service
        await notifyUser(String(ticket.user), {
          type: "system",
          title: "💬 New support reply",
          body: message.text,
          data: { ticketId, type: "chat" },
        });
      }
    } catch (err: any) {
      console.error("Failed to send support reply push notification:", err.message);
    }
  }
}

export function broadcastTicketStatus(ticketId: string, status: "open" | "closed") {
  if (!io) return;

  // Notify ticket room
  io.to(`ticket:${ticketId}`).emit("ticket_status_change", { ticketId, status });

  // Refresh admin queue
  io.to("support:admins").emit("ticket_update", { ticketId, status });
}

/** Emit an event to a single user's personal room (all their connected devices). */
export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

/** Emit an event to every connected admin (dispatch queue live updates). */
export function emitToAdmins(event: string, payload: unknown) {
  io?.to("support:admins").emit(event, payload);
}
