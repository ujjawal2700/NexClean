/**
 * Live-tracking socket probes.
 *
 * The Playwright API suite proves the REST snapshot is correct and correctly
 * gated, but the feature people actually experience is the socket stream: a
 * cleaner's GPS fix arriving on the customer's map a second later. None of that
 * is reachable over HTTP, so it is exercised here instead.
 *
 * What each probe pins down:
 *   T1  a customer joined to their booking receives the cleaner's fixes
 *   T2  a stranger is refused the room outright (no fix ever reaches them)
 *   T3  fixes stop once the job leaves the trackable window
 *   T4  a physically impossible jump is discarded, not relayed
 *   T5  job-status changes reach the customer as booking_progress
 *   T6  admins receive fleet-wide location updates without joining rooms
 *
 * Run against a throwaway backend only:
 *   API=http://127.0.0.1:4111/api node tracking-realtime.mjs
 */
import { io } from "../backend/node_modules/socket.io-client/build/esm/index.js";

const API = process.env.API ?? "http://127.0.0.1:4111/api";
const SOCKET = API.replace(/\/api\/?$/, "");
const DEMO_OTP = process.env.DEMO_OTP ?? "123456";
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "superadmin@gmail.com";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "password123";

const NEAR_LAT = 22.7196;
const NEAR_LNG = 75.8577;

const FAKE_AADHAR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const results = [];
function record(id, title, pass, detail) {
  results.push({ id, pass });
  console.log(`\n${pass ? "🟢 PASS  " : "🔴 FAIL  "} [${id}] ${title}\n    ${detail}`);
}

async function call(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, ok: res.ok, data: json?.data, message: json?.message };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Drives the fixture cleaner toward the booking one plausible step at a time.
 *
 * The server rejects any pair of fixes implying more than 150 km/h, so a probe
 * that jumps its agent around is testing the spoof guard rather than the relay
 * it means to test. 0.0001 degrees of latitude is roughly 11 m; paced at 1.1 s
 * apart that is about 36 km/h, and the gap also clears the 1 s broadcast
 * throttle so every step is actually sent.
 */
function makeDriver(startOffset) {
  let offset = startOffset;
  return async function step(socket, { heading = 180 } = {}) {
    offset -= 0.0001;
    socket.emit("agent_location", { lat: NEAR_LAT + offset, lng: NEAR_LNG, heading });
    await sleep(1100);
    return NEAR_LAT + offset;
  };
}
const freshPhone = () => "9" + Math.floor(100000000 + Math.random() * 899999999);

function uniqueName(prefix) {
  let n = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  let suffix = "";
  while (n > 0) {
    suffix = String.fromCharCode(97 + (n % 26)) + suffix;
    n = Math.floor(n / 26);
  }
  return `${prefix} ${suffix}`;
}

/* ------------------------------- actors ---------------------------------- */

async function newCustomer() {
  const phone = freshPhone();
  await call("/auth/send-otp", { method: "POST", body: { phone } });
  const res = await call("/auth/verify-otp", { method: "POST", body: { phone, code: DEMO_OTP } });
  return { token: res.data.token, id: res.data.user.id, phone };
}

async function adminToken() {
  const res = await call("/auth/admin-login", {
    method: "POST",
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  return res.data.token;
}

async function newVerifiedAgent(admin) {
  const phone = freshPhone();
  await call("/auth/agent/signup", {
    method: "POST",
    body: {
      name: uniqueName("Realtime Agent"),
      phone,
      area: "Test Zone",
      aadharNumber: "123456789012",
      aadharFront: FAKE_AADHAR,
      aadharBack: FAKE_AADHAR,
    },
  });
  const verify = await call("/auth/verify-otp", { method: "POST", body: { phone, code: DEMO_OTP } });
  await call(`/admin/agents/${verify.data.user.id}/status`, {
    method: "PATCH",
    token: admin,
    body: { status: "verified" },
  });
  return { token: verify.data.token, id: verify.data.user.id };
}

async function bookingFor(customer) {
  const pkgs = await call("/catalog/packages");
  const res = await call("/bookings", {
    method: "POST",
    token: customer.token,
    body: {
      vehicleType: "hatchback",
      vehicleName: "Realtime Car",
      packageId: pkgs.data[0].id,
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      slot: "11:00 AM",
      addressLabel: "Home",
      addressLine: "1 Realtime Street",
      lat: NEAR_LAT,
      lng: NEAR_LNG,
    },
  });
  if (!res.ok) throw new Error(`booking creation failed: ${res.message}`);
  return res.data;
}

/* ------------------------------- sockets --------------------------------- */

function connect(token) {
  const socket = io(SOCKET, { transports: ["websocket"], auth: { token } });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("socket connect timed out")), 8000);
    socket.on("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on("connect_error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function joinBooking(socket, bookingId) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: "join timed out" }), 5000);
    socket.emit("join_booking", bookingId, (res) => {
      clearTimeout(timer);
      resolve(res ?? { ok: false, error: "no ack" });
    });
  });
}

/** Collect every event of a given name until the window closes. */
function collect(socket, event) {
  const seen = [];
  socket.on(event, (payload) => seen.push(payload));
  return seen;
}

/* -------------------------------- probes --------------------------------- */

const open = [];
function track(socket) {
  open.push(socket);
  return socket;
}

async function main() {
  const admin = await adminToken();

  /* --- shared setup: a customer with an assigned, trackable booking ------- */
  const customer = await newCustomer();
  const booking = await bookingFor(customer);
  const agent = await newVerifiedAgent(admin);

  await call("/agent/online", {
    method: "PATCH",
    token: agent.token,
    body: { online: true, lat: NEAR_LAT + 0.02, lng: NEAR_LNG },
  });
  const assigned = await call(`/admin/bookings/${booking.id}/assign`, {
    method: "PATCH",
    token: admin,
    body: { agentId: agent.id },
  });
  if (!assigned.ok) throw new Error(`assign failed: ${assigned.message}`);

  const customerSocket = track(await connect(customer.token));
  const agentSocket = track(await connect(agent.token));
  const adminSocket = track(await connect(admin));

  /* --- T1: the customer receives the cleaner's live fixes ----------------- */
  const join = await joinBooking(customerSocket, booking.id);
  const fixes = collect(customerSocket, "agent_location_update");

  // Three steps rather than one: a single fix could be a fluke of the initial
  // state, while a sequence proves the stream keeps flowing past the throttle.
  const drive = makeDriver(0.02);
  await drive(agentSocket);
  await drive(agentSocket);
  await drive(agentSocket);

  const relayed = fixes.filter((f) => f.bookingId === booking.id);
  record(
    "T1",
    "customer joined to their booking receives the cleaner's GPS fixes",
    join.ok === true && relayed.length >= 3 && typeof relayed[0].lat === "number",
    `join=${JSON.stringify(join)} fixes=${relayed.length} first=${
      relayed[0] ? `${relayed[0].lat.toFixed(4)},${relayed[0].lng.toFixed(4)} heading=${relayed[0].heading}` : "none"
    }`,
  );

  /* --- T2: a stranger is refused the room -------------------------------- */
  const stranger = await newCustomer();
  const strangerSocket = track(await connect(stranger.token));
  const strangerJoin = await joinBooking(strangerSocket, booking.id);
  const strangerFixes = collect(strangerSocket, "agent_location_update");

  await drive(agentSocket);

  record(
    "T2",
    "a customer who does not own the booking is refused the room and receives nothing",
    strangerJoin.ok === false && strangerFixes.length === 0,
    `join=${JSON.stringify(strangerJoin)} leakedFixes=${strangerFixes.length}`,
  );

  /* --- T6: admins get fleet updates without joining any room ------------- */
  const adminFixes = collect(adminSocket, "agent_location_update");
  await drive(agentSocket);
  record(
    "T6",
    "admins receive fleet-wide fixes naming the affected bookings, with no room join",
    adminFixes.length >= 1 && (adminFixes.at(-1)?.bookingIds ?? []).includes(booking.id),
    `fixes=${adminFixes.length} bookingIds=${JSON.stringify(adminFixes.at(-1)?.bookingIds ?? [])}`,
  );

  /* --- T4: an impossible jump is discarded ------------------------------- */
  const beforeJump = fixes.length;
  // ~1500 km away, moments after a fix a few metres from here.
  agentSocket.emit("agent_location", { lat: NEAR_LAT + 13, lng: NEAR_LNG + 5 });
  await sleep(1100);
  const jumped = fixes.slice(beforeJump).some((f) => f.lat > NEAR_LAT + 5);
  record(
    "T4",
    "a physically impossible GPS jump is discarded rather than relayed",
    !jumped,
    jumped ? "a teleported fix reached the customer" : "the spoofed fix was dropped at the server",
  );

  /* --- T5: job-status changes reach the customer -------------------------- */
  const progress = collect(customerSocket, "booking_progress");
  const adv = await call(`/agent/jobs/${booking.id}/advance`, { method: "PATCH", token: agent.token });
  await sleep(800);
  record(
    "T5",
    "advancing the job pushes booking_progress to the watching customer",
    adv.ok && progress.some((p) => p.bookingId === booking.id && p.jobStatus === "enroute"),
    `advance=${adv.status} events=${JSON.stringify(progress.map((p) => p.jobStatus))}`,
  );

  /* --- T3: the stream stops once the job leaves the trackable window ------ */
  const advance = () => call(`/agent/jobs/${booking.id}/advance`, { method: "PATCH", token: agent.token });
  const upload = async (kind) => {
    for (let i = 0; i < 4; i++) {
      await call(`/agent/jobs/${booking.id}/photo`, { method: "POST", token: agent.token, body: { kind, image: FAKE_AADHAR } });
    }
  };

  // T5 already moved this job to 'enroute'. Photos gate two of the remaining
  // transitions: four 'before' shots to leave 'arrived', four 'after' shots to
  // leave 'in_progress' — so they cannot all be uploaded at the end.
  await advance(); // enroute → arrived
  await upload("before");
  await advance(); // arrived → in_progress
  await upload("after");
  const completed = await advance(); // in_progress → completed
  await sleep(600);

  const beforeComplete = fixes.length;
  await drive(agentSocket);
  await drive(agentSocket);
  const afterComplete = fixes.length;

  record(
    "T3",
    "a completed job stops streaming the cleaner's position to the customer",
    completed.ok && afterComplete === beforeComplete,
    `complete=${completed.status} fixesAfterCompletion=${afterComplete - beforeComplete}`,
  );

  /* ------------------------------- summary ------------------------------- */
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${"─".repeat(66)}`);
  console.log(`${results.length - failed.length}/${results.length} probes passed`);
  if (failed.length) {
    console.log(`Failed: ${failed.map((f) => f.id).join(", ")}`);
  }
  console.log("─".repeat(66));

  for (const s of open) s.disconnect();
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error("\n🔴 probe run crashed:", err);
  for (const s of open) s.disconnect();
  process.exit(1);
});
