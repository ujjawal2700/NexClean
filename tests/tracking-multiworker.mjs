/**
 * Cross-worker live-tracking check.
 *
 * `tracking-realtime.mjs` proves the relay works inside one process. Production
 * is not one process: under PM2 cluster mode the worker holding a cleaner's
 * WebSocket is almost never the worker that handled the HTTP request assigning
 * them the job. The tracking module keeps a per-process cache of "which
 * bookings is this agent currently on", and a cache is only as correct as its
 * invalidation — which, on a single box, is trivially correct and therefore
 * proves nothing.
 *
 * The realistic detail these probes insist on: a cleaner who is online is
 * streaming GPS *continuously*, so the worker holding their socket has a warm
 * cache entry at the exact moment the job is assigned somewhere else. If that
 * entry is not invalidated across workers, the customer's map stays frozen
 * during the minute they care about most.
 *
 * Usage: A=http://127.0.0.1:4501 B=http://127.0.0.1:4502 node tracking-multiworker.mjs
 */
import { io } from "../backend/node_modules/socket.io-client/build/esm/index.js";

const A = process.env.A ?? "http://127.0.0.1:4501";
const B = process.env.B ?? "http://127.0.0.1:4502";
const DEMO_OTP = process.env.DEMO_OTP ?? "123456";
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "superadmin@gmail.com";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "password123";

const NEAR_LAT = 22.7196;
const NEAR_LNG = 75.8577;
const FAKE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

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
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { ok: res.ok, status: res.status, data: json?.data, message: json?.message };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freshPhone = () => "9" + Math.floor(100000000 + Math.random() * 899999999);

function uniqueName(prefix) {
  let n = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  let out = "";
  while (n > 0) { out = String.fromCharCode(97 + (n % 26)) + out; n = Math.floor(n / 26); }
  return `${prefix} ${out}`;
}

function connect(base, token) {
  const socket = io(base, { transports: ["websocket"], auth: { token }, reconnection: false });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`connect timeout ${base}`)), 8000);
    socket.on("connect", () => { clearTimeout(t); resolve(socket); });
    socket.on("connect_error", (e) => { clearTimeout(t); reject(e); });
  });
}

function joinBooking(socket, bookingId) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve({ ok: false, error: "join timeout" }), 5000);
    socket.emit("join_booking", bookingId, (res) => { clearTimeout(t); resolve(res ?? { ok: false }); });
  });
}

const open = [];
const track = (s) => { open.push(s); return s; };

async function newCustomer(base) {
  const phone = freshPhone();
  await call(base, "/auth/send-otp", { method: "POST", body: { phone } });
  const r = await call(base, "/auth/verify-otp", { method: "POST", body: { phone, code: DEMO_OTP } });
  return { token: r.data.token, id: r.data.user.id };
}

async function newVerifiedAgent(base, adminToken) {
  const phone = freshPhone();
  await call(base, "/auth/agent/signup", {
    method: "POST",
    body: { name: uniqueName("Cluster Agent"), phone, area: "Test Zone",
      aadharNumber: "123456789012", aadharFront: FAKE, aadharBack: FAKE },
  });
  const v = await call(base, "/auth/verify-otp", { method: "POST", body: { phone, code: DEMO_OTP } });
  await call(base, `/admin/agents/${v.data.user.id}/status`, {
    method: "PATCH", token: adminToken, body: { status: "verified" },
  });
  return { token: v.data.token, id: v.data.user.id };
}

async function makeBooking(base, customer) {
  const pkgs = await call(base, "/catalog/packages");
  const r = await call(base, "/bookings", {
    method: "POST", token: customer.token,
    body: { vehicleType: "hatchback", vehicleName: "Cluster Car", packageId: pkgs.data[0].id,
      date: new Date(Date.now() + 864e5).toISOString(), slot: "11:00 AM",
      addressLabel: "Home", addressLine: "1 Cluster Street", lat: NEAR_LAT, lng: NEAR_LNG },
  });
  if (!r.ok) throw new Error(`booking failed: ${r.message}`);
  return r.data;
}

/** Walk the agent toward the pin in steps the server accepts as plausible. */
function driver(startOffset = 0.02) {
  let offset = startOffset;
  return async (socket) => {
    offset -= 0.0001;
    socket.emit("agent_location", { lat: NEAR_LAT + offset, lng: NEAR_LNG, heading: 180 });
    await sleep(1200);
  };
}

async function main() {
  for (const [label, base] of [["A", A], ["B", B]]) {
    const h = await call(base, "/health");
    if (h.status !== 200) { console.error(`worker ${label} unreachable at ${base}`); process.exit(1); }
  }

  const admin = (await call(A, "/auth/admin-login", {
    method: "POST", body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })).data.token;

  /* ═══ X1: assignment on worker B must reach a cleaner streaming on worker A ═══ */
  const customer = await newCustomer(A);
  const booking = await makeBooking(A, customer);
  const agent = await newVerifiedAgent(A, admin);

  await call(A, "/agent/online", {
    method: "PATCH", token: agent.token,
    body: { online: true, lat: NEAR_LAT + 0.02, lng: NEAR_LNG },
  });

  // Agent's socket lives on worker A; the customer watches from worker B.
  const agentSocket = track(await connect(A, agent.token));
  const customerSocket = track(await connect(B, customer.token));

  const drive = driver();

  // Warm worker A's agent→bookings cache BEFORE the job exists. This is what a
  // real online cleaner does every second while waiting for work, and it is
  // precisely the state that makes a stale cache dangerous.
  await drive(agentSocket);
  await drive(agentSocket);

  // Assign from worker B — the other process entirely.
  const assigned = await call(B, `/admin/bookings/${booking.id}/assign`, {
    method: "PATCH", token: admin, body: { agentId: agent.id },
  });
  if (!assigned.ok) throw new Error(`assign failed: ${assigned.message}`);

  const join = await joinBooking(customerSocket, booking.id);
  const fixes = [];
  customerSocket.on("agent_location_update", (p) => { if (p.bookingId === booking.id) fixes.push(p); });

  // Three fixes over ~4s. A correct system delivers all three; a system whose
  // cache is only invalidated on the assigning worker delivers none until the
  // 30s TTL lapses.
  await drive(agentSocket);
  await drive(agentSocket);
  await drive(agentSocket);
  await sleep(500);

  record("X1", "cleaner's fixes reach the customer when the job was assigned on another worker",
    join.ok === true && fixes.length >= 3,
    `join=${JSON.stringify(join)} fixesReceived=${fixes.length} (expected >=3). ` +
    (fixes.length === 0
      ? "NONE arrived — the worker holding the cleaner's socket never learned about the assignment."
      : "delivered."));

  /* ═══ X2: completion on worker B must stop the stream on worker A ═══ */
  {
    const advance = () => call(B, `/agent/jobs/${booking.id}/advance`, { method: "PATCH", token: agent.token });
    const upload = async (kind) => {
      for (let i = 0; i < 4; i++) {
        await call(B, `/agent/jobs/${booking.id}/photo`, { method: "POST", token: agent.token, body: { kind, image: FAKE } });
      }
    };

    // Photos gate two different transitions now, so they cannot all be uploaded
    // at the end: four 'before' shots are required to leave 'arrived', and four
    // 'after' shots to leave 'in_progress'. Uploading them in that order is also
    // what a cleaner actually does on site.
    await advance(); // assigned → enroute
    await advance(); // enroute  → arrived
    await upload("before");
    await advance(); // arrived  → in_progress
    await upload("after");
    const done = await call(B, `/agent/jobs/${booking.id}/advance`, { method: "PATCH", token: agent.token });
    await sleep(600);

    const before = fixes.length;
    await drive(agentSocket);
    await drive(agentSocket);
    await sleep(500);
    const after = fixes.length;

    record("X2", "a job completed on another worker stops the position stream",
      done.ok && after === before,
      `complete=${done.status} fixesAfterCompletion=${after - before} (expected 0). ` +
      (after > before
        ? "STILL STREAMING — the cleaner's live position is leaking into a finished booking's room."
        : "stream stopped."));
  }

  /* ═══ X3: the REST snapshot is consistent from either worker ═══ */
  {
    const customer2 = await newCustomer(A);
    const booking2 = await makeBooking(A, customer2);
    const agent2 = await newVerifiedAgent(A, admin);
    await call(A, "/agent/online", {
      method: "PATCH", token: agent2.token,
      body: { online: true, lat: NEAR_LAT + 0.018, lng: NEAR_LNG },
    });
    await call(A, `/admin/bookings/${booking2.id}/assign`, {
      method: "PATCH", token: admin, body: { agentId: agent2.id },
    });

    const fromA = await call(A, `/tracking/bookings/${booking2.id}`, { token: customer2.token });
    const fromB = await call(B, `/tracking/bookings/${booking2.id}`, { token: customer2.token });
    const same =
      fromA.ok && fromB.ok &&
      fromA.data.trackable === fromB.data.trackable &&
      fromA.data.agent?.id === fromB.data.agent?.id &&
      !!fromA.data.agentLocation === !!fromB.data.agentLocation;

    record("X3", "tracking snapshot agrees whichever worker serves it", same,
      `A: trackable=${fromA.data?.trackable} agent=${fromA.data?.agent?.name} loc=${!!fromA.data?.agentLocation} | ` +
      `B: trackable=${fromB.data?.trackable} agent=${fromB.data?.agent?.name} loc=${!!fromB.data?.agentLocation}`);
  }

  console.log("\n════════ SUMMARY ════════");
  for (const r of results) console.log(`${r.pass ? "🟢 PASS" : "🔴 FAIL"}  [${r.id}]`);
  const bad = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - bad}/${results.length} passed`);
  for (const s of open) s.disconnect();
  process.exit(bad ? 1 : 0);
}

main().catch((e) => {
  console.error("\ncrashed:", e);
  for (const s of open) s.disconnect();
  process.exit(1);
});
