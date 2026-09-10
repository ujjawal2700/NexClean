import { Server, Socket } from "socket.io";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { verifyToken } from "../utils/jwt";
import { SupportTicket } from "../../modules/chat/ticket.model";
import { notifyUser } from "../../modules/notification/notification.service";
import { SupportConfig } from "../../modules/chat/supportConfig.model";
import {
  recordAgentLocation,
  assertCanTrack,
  bookingRoom,
  forgetAgentBookingsLocal,
  FORGET_AGENT_EVENT,
} from "../../modules/tracking/tracking.service";
import { env, isProd } from "../../config/env";

let io: Server | null = null;
/**
 * Whether a multi-node adapter is attached, i.e. whether there are other
 * workers to talk to at all. Tracked rather than probed: the in-memory adapter
 * answers a serverSideEmit with a console.warn instead of throwing, so a
 * try/catch cannot detect it and every single-process deployment would log a
 * warning on each assignment and status change.
 */
let clusterAdapterReady = false;
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
    pubClient.on("error", (err) => console.error("Redis pubClient error:", err.message));
    subClient.on("error", (err) => console.error("Redis subClient error:", err.message));
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    clusterAdapterReady = true;
    console.log("🔌 Socket.IO using Redis adapter for cross-worker broadcast");
  }

  /**
   * Another worker is telling us one of its cached facts went stale.
   *
   * Each worker keeps its own agent→bookings map, and the worker that handles
   * the HTTP request assigning a job is almost never the worker holding that
   * cleaner's WebSocket. Clearing only the local copy leaves the socket-holding
   * worker convinced the cleaner has no active job, and it silently drops every
   * GPS fix until its TTL lapses. Delivered via the Redis adapter, so this is a
   * no-op in single-process mode where the local delete was already complete.
   */
  io.on(FORGET_AGENT_EVENT, (agentId: string) => {
    forgetAgentBookingsLocal(agentId);
  });

  /** Pull the requested (or whichever available) role session cookie off the handshake headers. */
  const readTokenFromCookieHeader = (header?: string, roleHint?: string): string | null => {
    if (!header) return null;
    const cookies: Record<string, string> = {};
    for (const part of header.split(";")) {
      const eq = part.indexOf("=");
      if (eq < 0) continue;
      const name = part.slice(0, eq).trim();
      if (name) cookies[name] = decodeURIComponent(part.slice(eq + 1).trim());
    }

    const normalizedRole = roleHint?.toLowerCase();
    if (normalizedRole && cookies[`nc_session_${normalizedRole}`]) {
      return cookies[`nc_session_${normalizedRole}`];
    }

    // Default fallback order if role hint not provided or not found
    if (cookies["nc_session_agent"]) return cookies["nc_session_agent"];
    if (cookies["nc_session_customer"]) return cookies["nc_session_customer"];
    if (cookies["nc_session_admin"]) return cookies["nc_session_admin"];

    for (const [name, val] of Object.entries(cookies)) {
      if (name.startsWith("nc_session_")) return val;
    }
    return null;
  };

  // Authentication Middleware
  io.use((socket: AuthenticatedSocket, next) => {
    // Browser clients authenticate with the httpOnly session cookie, which the
    // handshake carries when the client sets withCredentials — they can no
    // longer read a token to pass explicitly. auth/query are kept for
    // non-browser clients and pre-migration sessions.
    const roleHint = (
      socket.handshake.auth?.role ||
      socket.handshake.query?.role ||
      socket.handshake.headers?.["x-session-role"]
    ) as string | undefined;

    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      readTokenFromCookieHeader(socket.handshake.headers.cookie, roleHint);
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

    /**
     * Watch one booking's live tracking feed.
     *
     * The room is authorized on join rather than on emit: a socket that never
     * proved it owns the booking never enters the room, so the per-fix
     * broadcast path stays a plain room emit with no permission check in the
     * hot loop.
     */
    socket.on("join_booking", async (bookingId: string, ack?: (res: unknown) => void) => {
      if (!bookingId || typeof bookingId !== "string") return;
      try {
        await assertCanTrack(bookingId, { id: userId, role });
        socket.join(bookingRoom(bookingId));
        ack?.({ ok: true, bookingId });
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message });
      }
    });

    socket.on("leave_booking", (bookingId: string) => {
      if (!bookingId || typeof bookingId !== "string") return;
      socket.leave(bookingRoom(bookingId));
    });

    // Agent streams its live GPS position: ranks them for dispatch, and drives
    // the customer/admin live maps for whatever job they are currently on.
    socket.on(
      "agent_location",
      async (data: { lat?: number; lng?: number; heading?: number | null; speed?: number | null }) => {
        if (role !== "agent") return;
        try {
          await recordAgentLocation(userId, {
            lat: Number(data?.lat),
            lng: Number(data?.lng),
            heading: data?.heading ?? null,
            speed: data?.speed ?? null,
          });
        } catch (err) {
          console.error("agent_location update failed:", (err as Error).message);
        }
      },
    );

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

/**
 * Send an event to every OTHER API worker (never back to this one).
 *
 * Used for cache invalidation that has to be fleet-wide. Requires the Redis
 * adapter; with the default in-memory adapter there are no peers and this is
 * correctly a no-op, because a single process has already done the work
 * locally.
 */
export function broadcastToWorkers(event: string, ...args: unknown[]) {
  // Single process: the caller has already applied the change locally, and
  // there is nobody else to tell.
  if (!io || !clusterAdapterReady) return;
  io.serverSideEmit(event, ...args);
}

/**
 * Force one user's sockets out of a room.
 *
 * Room membership is granted once, on join, and would otherwise outlive the
 * permission that granted it. Keyed on the user's personal room so it covers
 * every device they have open, and routed through the adapter so it reaches
 * sockets held by other workers too.
 */
export function evictUserFromRoom(userId: string, room: string) {
  if (!io) return;
  try {
    io.in(`user:${userId}`).socketsLeave(room);
  } catch (err) {
    console.error("[socket] room eviction failed:", (err as Error).message);
  }
}

/** Emit an event to an arbitrary room (booking tracking feeds). */
export function emitToRoom(room: string, event: string, payload: unknown) {
  io?.to(room).emit(event, payload);
}

/** Emit an event to every connected admin (dispatch queue live updates). */
export function emitToAdmins(event: string, payload: unknown) {
  io?.to("support:admins").emit(event, payload);
}
