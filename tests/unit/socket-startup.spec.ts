import { test, expect } from "@playwright/test";
import { createServer as createHttpServer } from "node:http";
import { createServer as createTcpServer, type Socket } from "node:net";
import { createRequire } from "node:module";
const { io: client } = createRequire(new URL("../../backend/package.json", import.meta.url))("socket.io-client");
import { initSocket } from "../../backend/src/shared/services/socket";
import { env } from "../../backend/src/config/env";

test("socket authentication is installed while Redis handshake stalls, then startup falls back", async () => {
  // A TCP endpoint that accepts connections but never answers Redis commands.
  const connections = new Set<Socket>();
  const redis = createTcpServer((socket) => {
    connections.add(socket);
    socket.on("close", () => connections.delete(socket));
  });
  const http = createHttpServer();
  await new Promise<void>((resolve) => redis.listen(0, "127.0.0.1", resolve));
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  const previous = env.redisUrl;
  env.redisUrl = `redis://127.0.0.1:${(redis.address() as { port: number }).port}`;
  const initialized = initSocket(http);
  const socket = client(`http://127.0.0.1:${(http.address() as { port: number }).port}`, {
    transports: ["websocket"], autoConnect: false, reconnection: false,
  });
  try {
    const result = new Promise<string>((resolve) => {
      socket.on("connect", () => resolve("unauthenticated connection accepted"));
      socket.on("connect_error", (error: Error) => resolve(error.message));
    });
    socket.connect();
    expect(await result).toContain("No token provided");
    // Must settle even though Redis accepted TCP without completing handshake.
    await initialized;
  } finally {
    socket.disconnect();
    env.redisUrl = previous;
    (await initialized).close();
    for (const connection of connections) connection.destroy();
    await new Promise<void>((resolve) => redis.close(() => resolve()));
    if (http.listening) await new Promise<void>((resolve) => http.close(() => resolve()));
  }
});
