import { Server, Socket } from "socket.io";
import { Types } from "mongoose";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { verifyToken } from "../utils/jwt";
import { SupportTicket } from "../../modules/chat/ticket.model";
import { notifyUser } from "../../modules/notification/notification.service";
import { SupportConfig } from "../../modules/chat/supportConfig.model";
import { User } from "../../modules/user/user.model";
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
  io.use(async (socket: AuthenticatedSocket, next) => {
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

    let decoded: ReturnType<typeof verifyToken>;
    try {
      decoded = verifyToken(String(token));
    } catch (err) {
      return next(new Error("Authentication error: Invalid token"));
    }
    // Same revocation rule as requireAuth: a session signed out elsewhere (a
    // cleaner who logged in on another phone, a suspension) must not be able
    // to reconnect and keep receiving offers or streaming its location.
    try {
      const account = await User.findById(decoded.sub).select("status tokenVersion").lean();
      if (!account || account.status === "suspended" || (decoded.ver ?? 0) !== (account.tokenVersion ?? 0)) {
        return next(new Error("Authentication error: Session expired"));
      }
    } catch (err) {
      return next(new Error("Authentication error: Could not verify session"));
    }
    socket.user = { id: decoded.sub, role: decoded.role };
    // Visible through fetchSockets() on every worker, so a session cut can
    // tell an old device's socket from the new one's.
    socket.data.ver = decoded.ver ?? 0;
    next();
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

    // Match REST chat authorization: owners see their own conversation,
    // support admins can work any ticket. Never disclose whether a stranger's
    // ticket exists, and fail closed if the database lookup fails.
    socket.on("join_ticket", async (ticketId: string, ack?: (res: unknown) => void) => {
      const respond = typeof ack === "function" ? ack : () => {};
      if (typeof ticketId !== "string" || !Types.ObjectId.isValid(ticketId)) {
        respond({ ok: false, error: "Ticket not found" });
        return;
      }
      try {
        const accessible = await SupportTicket.exists({
          _id: ticketId,
          ...(role === "admin" ? {} : { user: userId }),
        });
        if (!accessible) {
          respond({ ok: false, error: "Ticket not found" });
          return;
        }
        if (!socket.connected) return;
        await socket.join(`ticket:${ticketId}`);
        respond({ ok: true, ticketId });
      } catch {
        respond({ ok: false, error: "Ticket not found" });
      }
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

  // Register authentication and room handlers before waiting for Redis.
  // The HTTP server is already listening while the adapter connects.
  // In single-process mode this is a no-op — events already reach every
  // connected client directly. Under PM2 cluster mode, each worker only
  // knows about its own sockets, so without this adapter io.to(room).emit()
  // (dispatch offers, chat, notifications) would silently miss clients
  // connected to a different worker.
  if (env.redisUrl) {
    // Fail this startup attempt promptly. The redis client's default is to
    // retry forever. Local authenticated sockets and HTTP reconciliation
    // keep the app functional when Redis is unavailable.
    const pubClient = createClient({ url: env.redisUrl, socket: { reconnectStrategy: false, connectTimeout: 3_000 } });
    const subClient = pubClient.duplicate();
    pubClient.on("error", (err) => console.error("Redis pubClient error:", err.message));
    subClient.on("error", (err) => console.error("Redis subClient error:", err.message));
    let connectTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      // TCP may connect while Redis never answers its handshake (e.g. a stuck
      // proxy). connectTimeout alone only covers opening the TCP connection.
      await Promise.race([
        Promise.all([pubClient.connect(), subClient.connect()]),
        new Promise<never>((_, reject) => {
          connectTimer = setTimeout(() => reject(new Error("Redis adapter connection timed out")), 3_000);
        }),
      ]);
      io.adapter(createAdapter(pubClient, subClient));
      clusterAdapterReady = true;
      console.log("🔌 Socket.IO using Redis adapter for cross-worker broadcast");
    } catch (err) {
      // One half may have connected while the other failed. Only destroy an
      // open client; node-redis throws "The client is closed" otherwise and
      // that would abort the local-socket fallback we are trying to preserve.
      if (pubClient.isOpen) pubClient.destroy();
      if (subClient.isOpen) subClient.destroy();
      console.error(
        "⚠️ Socket.IO Redis unavailable; continuing with local sockets + HTTP reconciliation:",
        (err as Error).message,
      );
    } finally {
      if (connectTimer) clearTimeout(connectTimer);
    }
  }

  return io;
}

export function getConnectedAdminsCount(): number {
  return adminConnections.size;
}

/** Whether this staff member currently has at least one connected admin client. */
export function isAdminConnected(userId: string): boolean {
  return (adminConnections.get(userId)?.size ?? 0) > 0;
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
      const ticket = await SupportTicket.findById(ticketId).populate("user", "role");
      if (ticket) {
        const owner = ticket.user as unknown as { _id?: unknown; role?: string } | null;
        // Deep link into that exact conversation in the right app — tapping the
        // push used to open the app with no way back to the chat.
        const base = owner?.role === "agent" ? "/agent/help" : "/app/help";
        const text = String(message.text ?? "") || (message.imageUrl ? "Support sent you a photo" : "Support replied to your conversation");
        await notifyUser(String(owner?._id ?? ticket.user), {
          type: "system",
          title: "💬 NexClean Support replied",
          body: text.length > 140 ? `${text.slice(0, 137)}…` : text,
          data: {
            ticketId,
            kind: "support",
            role: owner?.role === "agent" ? "agent" : "customer",
            url: `${base}?ticket=${ticketId}`,
          },
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
 * End every live connection a user has: tell each device why, then cut it.
 * The disconnect waits a moment so the reason actually reaches the device
 * before its socket closes. Routed through the adapter, so it reaches sockets
 * held by other workers too; the connect-time version check keeps them out.
 */
export async function endUserSessions(userId: string, event: string, currentVersion: number): Promise<void> {
  if (!io) return;
  try {
    // Only sockets from before `currentVersion` — the device that just signed
    // in may already be connecting on the new one.
    const stale = (await io.in(`user:${userId}`).fetchSockets()).filter(
      (s) => Number(s.data?.ver ?? 0) < currentVersion,
    );
    for (const s of stale) s.emit(event, { at: Date.now() });
    setTimeout(() => {
      for (const s of stale) s.disconnect(true);
    }, 1_500);
  } catch (err) {
    console.error("[socket] session cut failed:", (err as Error).message);
  }
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
