import { Server, Socket } from "socket.io";
import { verifyToken } from "../utils/jwt";
import { SupportTicket } from "../../modules/chat/ticket.model";
import { notifyUser } from "../../modules/notification/notification.service";
import { SupportConfig } from "../../modules/chat/supportConfig.model";

let io: Server | null = null;
const adminConnections = new Map<string, Set<string>>(); // userId -> Set of socketIds

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    role: string;
  };
}

export function initSocket(server: any) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

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
