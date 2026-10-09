import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { initSocket } from "../../backend/src/shared/services/socket";
import { User } from "../../backend/src/modules/user/user.model";
import { SupportTicket } from "../../backend/src/modules/chat/ticket.model";
import { SupportConfig } from "../../backend/src/modules/chat/supportConfig.model";
import { signToken, type Role } from "../../backend/src/shared/utils/jwt";
import { env } from "../../backend/src/config/env";
const { io: client } = createRequire(new URL("../../backend/package.json", import.meta.url))("socket.io-client");

test("chat sockets admit ticket owners and admins, reject strangers and lookup failures", async () => {
  const ticketId = "507f1f77bcf86cd799439011";
  const ownerId = "507f1f77bcf86cd799439012";
  const otherId = "507f1f77bcf86cd799439013";
  const findUser = User.findById;
  const exists = SupportTicket.exists;
  const findConfig = SupportConfig.findOne;
  const previousRedis = env.redisUrl;
  const http = createServer();
  const clients: any[] = [];
  let databaseFails = false;
  let lookups = 0;
  let server: Awaited<ReturnType<typeof initSocket>> | undefined;
  try {
    env.redisUrl = "";
    User.findById = (() => ({ select: () => ({ lean: () => Promise.resolve({ status: "active", tokenVersion: 0 }) }) })) as any;
    SupportConfig.findOne = (() => Promise.resolve({ manualSupportStatus: "online" })) as any;
    SupportTicket.exists = ((filter: any) => {
      lookups++;
      if (databaseFails) return Promise.reject(new Error("Database unavailable"));
      return Promise.resolve(filter._id === ticketId && (!filter.user || filter.user === ownerId) ? { _id: ticketId } : null);
    }) as any;
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    server = await initSocket(http);
    const connect = async (id: string, role: Role) => {
      const socket = client(`http://127.0.0.1:${(http.address() as { port: number }).port}`, {
        transports: ["websocket"], auth: { token: signToken(id, role) }, autoConnect: false, reconnection: false,
      });
      clients.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
        socket.connect();
      });
      return socket;
    };
    const owner = await connect(ownerId, "customer");
    const stranger = await connect(otherId, "customer");
    const agent = await connect(otherId, "agent");
    const admin = await connect(otherId, "admin");
    const join = (socket: any, id: string) => socket.timeout(2_000).emitWithAck("join_ticket", id);
    expect(await join(owner, ticketId)).toEqual({ ok: true, ticketId });
    expect(await join(admin, ticketId)).toEqual({ ok: true, ticketId });
    expect(await join(stranger, ticketId)).toEqual({ ok: false, error: "Ticket not found" });
    expect(await join(agent, ticketId)).toEqual({ ok: false, error: "Ticket not found" });
    const joined = await server.in(`ticket:${ticketId}`).fetchSockets();
    expect(joined.map((socket) => socket.id).sort()).toEqual([owner.id, admin.id].sort());
    const received = new Promise((resolve) => owner.once("new_message", resolve));
    server.to(`ticket:${ticketId}`).emit("new_message", { text: "Owner's private message" });
    expect(await received).toEqual({ text: "Owner's private message" });
    const beforeInvalid = lookups;
    expect(await join(stranger, "invalid-id")).toEqual({ ok: false, error: "Ticket not found" });
    expect(lookups).toBe(beforeInvalid);
    expect(await join(stranger, "507f1f77bcf86cd799439014")).toEqual({ ok: false, error: "Ticket not found" });
    databaseFails = true;
    expect(await join(stranger, ticketId)).toEqual({ ok: false, error: "Ticket not found" });
    expect((await server.in(`ticket:${ticketId}`).fetchSockets()).length).toBe(2);
  } finally {
    clients.forEach((socket) => socket.disconnect());
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    if (http.listening) await new Promise<void>((resolve) => http.close(() => resolve()));
    User.findById = findUser;
    SupportTicket.exists = exists;
    SupportConfig.findOne = findConfig;
    env.redisUrl = previousRedis;
  }
});
