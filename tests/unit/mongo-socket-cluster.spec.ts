import { test, expect } from "@playwright/test";
import { fork, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const backendRequire = createRequire(new URL("../../backend/package.json", import.meta.url));
const { io: client } = backendRequire("socket.io-client");
const jwt = backendRequire("jsonwebtoken");

// Explicit opt-in to a disposable LOCAL replica set; never use backend/.env Atlas.
const uri = process.env.SOCKET_TEST_MONGODB_URI;
const secret = "isolated-mongo-socket-adapter-test-secret";

test("four MongoDB-backed API processes share private events, worker messages and socket management without Redis", async () => {
  test.skip(!uri, "Set SOCKET_TEST_MONGODB_URI to a disposable local MongoDB replica set");
  test.setTimeout(60000);
  const target = new URL(uri!);
  expect(["127.0.0.1", "localhost"], "adapter tests must never access Atlas").toContain(target.hostname);
  expect(target.pathname).toMatch(/^\/nexclean-socket-test/);
  const processes: ChildProcess[] = [];
  const sockets: any[] = [];
  const waitFor = (child: ChildProcess, predicate: (m: any) => boolean) => new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error("Worker response timed out")); }, 12000);
    const cleanup = () => { clearTimeout(timer); child.off("message", onMessage); child.off("exit", onExit); };
    const onMessage = (message: any) => {
      if (message.type === "error") { cleanup(); reject(new Error(message.message)); }
      else if (predicate(message)) { cleanup(); resolve(message); }
    };
    const onExit = (code: number | null) => { cleanup(); reject(new Error(`Worker exited ${code}`)); };
    child.on("message", onMessage);
    child.once("exit", onExit);
  });
  try {
    const ports = await Promise.all(Array.from({ length: 4 }, async (_, index) => {
      const child = fork(fileURLToPath(new URL("../fixtures/mongo-socket-worker.cjs", import.meta.url)), [], {
        cwd: fileURLToPath(new URL("../../backend/", import.meta.url)),
        execArgv: ["--import", backendRequire.resolve("tsx")],
        env: { ...process.env, NODE_ENV: "test", JWT_SECRET: secret, MONGODB_URI: uri!, SOCKET_ADAPTER: "mongo", REDIS_URL: "", NODE_APP_INSTANCE: String(index) },
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      });
      processes[index] = child;
      child.stdout!.resume(); child.stderr!.resume();
      return (await waitFor(child, m => m.type === "ready")).port;
    }));
    const userId = "507f1f77bcf86cd799439012";
    const token = jwt.sign({ sub: userId, role: "customer", ver: 0 }, secret);
    for (const port of ports) {
      const socket = client(`http://127.0.0.1:${port}`, { transports: ["websocket"], auth: { token }, reconnection: false, autoConnect: false });
      sockets.push(socket);
      await new Promise<void>((resolve, reject) => { socket.once("connect", resolve); socket.once("connect_error", reject); socket.connect(); });
    }
    let request = 0;
    await expect.poll(async () => {
      const id = ++request;
      const result = waitFor(processes[0], m => m.type === "result" && m.id === id);
      processes[0].send({ type: "count", userId, id });
      return (await result).count;
    }, { timeout: 15000 }).toBe(4);

    for (const event of ["job_offer", "job_rescheduled", "booking_progress", "new_message"]) {
      const deliveries = sockets.map(socket => new Promise(resolve => socket.once(event, resolve)));
      const payload = { bookingId: "test-booking", event };
      processes[2].send({ type: "emit", userId, event, payload });
      expect(await Promise.all(deliveries)).toEqual(Array(4).fill(payload));
    }
    const workerMessages = processes.slice(1).map(child => waitFor(child, m => m.type === "cluster_probe"));
    processes[0].send({ type: "broadcast", payload: "invalidate-agent-cache" });
    expect((await Promise.all(workerMessages)).map(m => m.payload)).toEqual(Array(3).fill("invalidate-agent-cache"));

    const disconnected = sockets.map(socket => new Promise(resolve => socket.once("disconnect", resolve)));
    processes[1].send({ type: "disconnect", userId });
    await Promise.all(disconnected);
    expect(sockets.every(socket => !socket.connected)).toBe(true);
  } finally {
    sockets.forEach(socket => socket.disconnect());
    await Promise.all(processes.map(child => new Promise<void>(resolve => {
      if (child.exitCode !== null) return resolve();
      const timer = setTimeout(() => child.kill("SIGKILL"), 3000);
      child.once("exit", () => { clearTimeout(timer); resolve(); });
      if (child.connected) child.send({ type: "stop" }); else child.kill();
    })));
  }
});
