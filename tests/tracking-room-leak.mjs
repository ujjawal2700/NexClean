/**
 * Does a cleaner who LOSES a job stop seeing it?
 *
 * `join_booking` authorizes once, at join time, and a socket then stays in that
 * room for the rest of its life. Authorization that is only ever evaluated on
 * the way in is not authorization — it is a turnstile. These probes check the
 * two ways a cleaner can stop being entitled to a booking after already being
 * inside its room:
 *
 *   L1  they were offered the job, joined, then declined it
 *   L2  they were assigned the job, joined, then an admin moved it to someone else
 *
 * In both cases they must stop receiving the winning cleaner's live GPS and the
 * customer's booking progress. Leaking either means one cleaner can watch
 * another's movements, and a stranger can watch a customer's service unfold.
 *
 * Usage: API=http://127.0.0.1:4111/api node tracking-room-leak.mjs
 */
import { io } from "../backend/node_modules/socket.io-client/build/esm/index.js";

const API = process.env.API ?? "http://127.0.0.1:4111/api";
const SOCKET = API.replace(/\/api\/?$/, "");
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
  console.log(`\n${pass ? "🟢 PASS" : "🔴 LEAK"}  [${id}] ${title}\n    ${detail}`);
};

async function call(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
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

const open = [];
function connect(token) {
  const s = io(SOCKET, { transports: ["websocket"], auth: { token }, reconnection: false });
  open.push(s);
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("connect timeout")), 8000);
    s.on("connect", () => { clearTimeout(t); resolve(s); });
    s.on("connect_error", (e) => { clearTimeout(t); reject(e); });
  });
}

function joinBooking(socket, bookingId) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve({ ok: false, error: "timeout" }), 5000);
    socket.emit("join_booking", bookingId, (r) => { clearTimeout(t); resolve(r ?? { ok: false }); });
  });
}

async function adminToken() {
  return (await call("/auth/admin-login", { method: "POST", body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).data.token;
}

async function newCustomer() {
  const phone = freshPhone();
  await call("/auth/send-otp", { method: "POST", body: { phone } });
  const r = await call("/auth/verify-otp", { method: "POST", body: { phone, code: DEMO_OTP } });
  return { token: r.data.token, id: r.data.user.id };
}

async function newVerifiedAgent(admin, { online = true, offsetLat = 0.02 } = {}) {
  const phone = freshPhone();
  await call("/auth/agent/signup", {
    method: "POST",
    body: { name: uniqueName("Leak Agent"), phone, area: "Test Zone",
      aadharNumber: "123456789012", aadharFront: FAKE, aadharBack: FAKE },
  });
  const v = await call("/auth/verify-otp", { method: "POST", body: { phone, code: DEMO_OTP } });
  await call(`/admin/agents/${v.data.user.id}/status`, { method: "PATCH", token: admin, body: { status: "verified" } });
  if (online) {
    await call("/agent/online", { method: "PATCH", token: v.data.token,
      body: { online: true, lat: NEAR_LAT + offsetLat, lng: NEAR_LNG } });
  }
  return { token: v.data.token, id: v.data.user.id };
}

async function makeBooking(customer) {
  const pkgs = await call("/catalog/packages");
  const r = await call("/bookings", {
    method: "POST", token: customer.token,
    body: { vehicleType: "hatchback", vehicleName: "Leak Car", packageId: pkgs.data[0].id,
      date: new Date(Date.now() + 864e5).toISOString(), slot: "11:00 AM",
      addressLabel: "Home", addressLine: "1 Leak Street", lat: NEAR_LAT, lng: NEAR_LNG },
  });
  if (!r.ok) throw new Error(`booking failed: ${r.message}`);
  return r.data;
}

function driver(startOffset) {
  let offset = startOffset;
  return async (socket) => {
    offset -= 0.0001;
    socket.emit("agent_location", { lat: NEAR_LAT + offset, lng: NEAR_LNG, heading: 180 });
    await sleep(1200);
  };
}

async function main() {
  const admin = await adminToken();

  /* ═══ L1: an agent who declined the offer must lose the room ═══ */
  {
    const customer = await newCustomer();
    // The only online agent, so the offer is guaranteed to go to them.
    const loser = await newVerifiedAgent(admin, { offsetLat: 0.02 });
    const booking = await makeBooking(customer);

    // Wait for the offer to land on `loser`.
    let offered = null;
    for (let i = 0; i < 25 && !offered; i++) {
      const r = await call("/agent/offers/current", { token: loser.token });
      if (r.data?.bookingId === booking.id) offered = r.data;
      else await sleep(400);
    }

    const loserSocket = await connect(loser.token);
    const join = await joinBooking(loserSocket, booking.id);

    const leaked = [];
    loserSocket.on("agent_location_update", (p) => { if (p.bookingId === booking.id) leaked.push(p); });
    loserSocket.on("booking_progress", (p) => { if (p.bookingId === booking.id) leaked.push(p); });

    // Decline, then let a different agent take it and start moving.
    await call(`/agent/offers/${booking.id}/decline`, { method: "POST", token: loser.token });
    const winner = await newVerifiedAgent(admin, { offsetLat: 0.015 });
    await call(`/admin/bookings/${booking.id}/assign`, {
      method: "PATCH", token: admin, body: { agentId: winner.id },
    });

    const winnerSocket = await connect(winner.token);
    const drive = driver(0.015);
    await drive(winnerSocket);
    await drive(winnerSocket);
    await sleep(600);

    record("L1", "an agent who declined the offer stops receiving the booking's feed",
      leaked.length === 0,
      `offerReceived=${!!offered} joinedRoom=${JSON.stringify(join)} eventsAfterDecline=${leaked.length}` +
      (leaked.length ? " ← the declining agent is still watching the winner's GPS" : ""));
  }

  /* ═══ L2: an agent replaced by reassignment must lose the room ═══ */
  {
    const customer = await newCustomer();
    const first = await newVerifiedAgent(admin, { offsetLat: 0.02 });
    const booking = await makeBooking(customer);

    await call(`/admin/bookings/${booking.id}/assign`, {
      method: "PATCH", token: admin, body: { agentId: first.id },
    });

    const firstSocket = await connect(first.token);
    const join = await joinBooking(firstSocket, booking.id);

    const leaked = [];
    firstSocket.on("agent_location_update", (p) => { if (p.bookingId === booking.id) leaked.push(p); });
    firstSocket.on("booking_progress", (p) => { if (p.bookingId === booking.id) leaked.push(p); });

    // Admin moves the job to somebody else, who then drives to the customer.
    const second = await newVerifiedAgent(admin, { offsetLat: 0.017 });
    await call(`/admin/bookings/${booking.id}/assign`, {
      method: "PATCH", token: admin, body: { agentId: second.id },
    });

    const secondSocket = await connect(secondTokenOf(second));
    const drive = driver(0.017);
    await drive(secondSocket);
    await drive(secondSocket);
    await sleep(600);

    record("L2", "an agent replaced by reassignment stops receiving the booking's feed",
      leaked.length === 0,
      `joinedRoom=${JSON.stringify(join)} eventsAfterReassign=${leaked.length}` +
      (leaked.length ? " ← the replaced agent is still watching the new cleaner's GPS" : ""));
  }

  console.log("\n════════ SUMMARY ════════");
  for (const r of results) console.log(`${r.pass ? "🟢 PASS" : "🔴 LEAK"}  [${r.id}]`);
  const bad = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - bad}/${results.length} clean`);
  for (const s of open) s.disconnect();
  process.exit(bad ? 1 : 0);
}

const secondTokenOf = (a) => a.token;

main().catch((e) => {
  console.error("\ncrashed:", e);
  for (const s of open) s.disconnect();
  process.exit(1);
});
