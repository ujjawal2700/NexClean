/**
 * Cross-worker real-time check.
 *
 * In production the API runs under PM2 cluster mode, so the worker holding a
 * customer's WebSocket is usually NOT the worker handling the HTTP request that
 * should notify them. Socket.IO only knows about its own process's sockets, so
 * without the Redis adapter those events are silently dropped — and nothing in
 * the single-process test suite can catch that.
 *
 * This connects a socket to worker A, triggers the event from worker B, and
 * fails if it doesn't arrive.
 *
 * Usage: A=http://127.0.0.1:4501 B=http://127.0.0.1:4502 node multiworker.mjs
 */
import { io } from "../backend/node_modules/socket.io-client/build/esm/index.js";

const A = process.env.A ?? "http://127.0.0.1:4501";
const B = process.env.B ?? "http://127.0.0.1:4502";
const DEMO_OTP = "123456";

const results = [];
const record = (id, title, pass, detail) => {
  results.push({ id, pass });
  console.log(`\n${pass ? "🟢 PASS" : "🔴 FAIL"}  [${id}] ${title}\n    ${detail}`);
};

async function call(base, path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}

const freshPhone = () => "9" + Math.floor(100000000 + Math.random() * 899999999);
async function login(base, phone) {
  await call(base, "/auth/send-otp", { method: "POST", body: { phone } });
  const r = await call(base, "/auth/verify-otp", { method: "POST", body: { phone, code: DEMO_OTP } });
  return { token: r.body?.data?.token, userId: r.body?.data?.user?.id };
}

/** Resolve with the first matching event, or null after `ms`. */
function waitForEvent(socket, events, ms = 8000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    for (const e of events) {
      socket.on(e, (payload) => { clearTimeout(t); resolve({ event: e, payload }); });
    }
  });
}

const main = async () => {
  for (const [label, base] of [["A", A], ["B", B]]) {
    const h = await call(base, "/health");
    if (h.status !== 200) { console.error(`worker ${label} not reachable at ${base}`); process.exit(1); }
  }

  const customer = await login(A, freshPhone());
  if (!customer.token) { console.error("login failed"); process.exit(1); }

  // Socket connects to worker A only.
  const socket = io(A, { auth: { token: customer.token }, transports: ["websocket"], reconnection: false });
  const connected = await new Promise((res) => {
    socket.on("connect", () => res(true));
    socket.on("connect_error", (e) => { console.error("socket connect_error:", e.message); res(false); });
    setTimeout(() => res(false), 8000);
  });
  record("W0", "Customer socket connects to worker A", connected, connected ? `socket id ${socket.id}` : "could not establish a websocket");
  if (!connected) { process.exit(1); }

  // ── W1: an event caused on worker B must reach a socket held by worker A ──
  {
    const waiter = waitForEvent(socket, ["notification", "notification:new", "booking_update", "dispatch_update"]);
    // Creating a booking on B triggers a "Booking confirmed" notification to
    // this user, emitted from B's process.
    const pkg = (await call(B, "/catalog/packages")).body?.data?.[0]?.id;
    const created = await call(B, "/bookings", {
      method: "POST", token: customer.token,
      body: {
        vehicleType: "hatchback", vehicleName: "Cross Worker", packageId: pkg,
        date: new Date(Date.now() + 86400000).toISOString(), slot: "11:00 AM",
        addressLabel: "Home", addressLine: "1 Cross Street",
      },
    });
    const got = await waiter;
    record("W1", "Event emitted on worker B arrives at a socket held by worker A",
      Boolean(got),
      got
        ? `received "${got.event}" on the A-socket after POST /bookings on B (booking ${created.body?.data?.id}).`
        : `no event within 8s after POST /bookings on B (HTTP ${created.status}). Without the Redis adapter this is exactly what a clustered deployment would do — the customer never sees the update.`);
  }

  // ── W2: same-worker delivery still works (control) ────────────────────────
  {
    const waiter = waitForEvent(socket, ["notification", "notification:new", "booking_update", "dispatch_update"]);
    const pkg = (await call(A, "/catalog/packages")).body?.data?.[0]?.id;
    await call(A, "/bookings", {
      method: "POST", token: customer.token,
      body: {
        vehicleType: "hatchback", vehicleName: "Same Worker", packageId: pkg,
        date: new Date(Date.now() + 86400000).toISOString(), slot: "12:30 PM",
        addressLabel: "Home", addressLine: "1 Same Street",
      },
    });
    const got = await waiter;
    record("W2", "Control: event emitted on worker A reaches its own socket", Boolean(got),
      got ? `received "${got.event}"` : "no event within 8s — real-time delivery is broken even in-process");
  }

  socket.close();
  console.log("\n════════ SUMMARY ════════");
  for (const r of results) console.log(`${r.pass ? "🟢 PASS" : "🔴 FAIL"}  [${r.id}]`);
  const bad = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - bad}/${results.length} passed`);
  process.exit(bad ? 1 : 0);
};

main().catch((e) => { console.error("crashed:", e); process.exit(1); });
