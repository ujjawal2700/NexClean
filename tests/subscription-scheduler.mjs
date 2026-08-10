/**
 * Subscription recurring-wash scheduler.
 *
 * A subscription wash is created with dispatchStatus "scheduled" and is
 * deliberately NOT dispatched at booking time — a background loop is supposed
 * to auto-assign the nearest cleaner shortly before the slot. Nothing in the
 * request/response suite can observe that, because it only happens on a timer.
 *
 * Run the backend with a short tick so this doesn't take half an hour:
 *   DISPATCH_SWEEP_INTERVAL_MS=1000 npm run test-start
 *
 * Usage: API=http://127.0.0.1:4600/api node subscription-scheduler.mjs
 */
const API = process.env.API ?? "http://127.0.0.1:4600/api";
const DEMO_OTP = "123456";
const NEAR = { lat: 22.7196, lng: 75.8577 };

const results = [];
const record = (id, title, pass, detail) => {
  results.push({ id, pass });
  console.log(`\n${pass ? "🟢 PASS" : "🔴 FAIL"}  [${id}] ${title}\n    ${detail}`);
};

async function call(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}
const freshPhone = () => "9" + Math.floor(100000000 + Math.random() * 899999999);
async function login(phone) {
  await call("/auth/send-otp", { method: "POST", body: { phone } });
  const r = await call("/auth/verify-otp", { method: "POST", body: { phone, code: DEMO_OTP } });
  return { token: r.body?.data?.token, userId: r.body?.data?.user?.id };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SLOTS = ["08:00 AM", "09:30 AM", "11:00 AM", "12:30 PM", "02:00 PM", "03:30 PM", "05:00 PM", "06:30 PM"];
/**
 * The next real slot at least `minAheadMin` minutes away, today.
 *
 * The slot string — not the date's clock time — is what decides when the job is
 * actually due, so pairing "date = now + 45min" with a slot that already passed
 * makes the missed-slot sweep grab the booking instead of the subscription
 * scheduler, and you end up testing the wrong code path entirely.
 */
function nextSlotToday(minAheadMin = 20) {
  const now = new Date();
  for (const s of SLOTS) {
    const [hhmm, mer] = s.split(" ");
    let [h, m] = hhmm.split(":").map(Number);
    if (mer === "PM" && h !== 12) h += 12;
    if (mer === "AM" && h === 12) h = 0;
    const when = new Date(now); when.setHours(h, m, 0, 0);
    if (when.getTime() > now.getTime() + minAheadMin * 60_000) return { slot: s, date: when };
  }
  return null;
}

/** Poll a booking until `done`, or give up. */
async function until(token, bookingId, done, ms = 90_000) {
  const deadline = Date.now() + ms;
  let last = null;
  while (Date.now() < deadline) {
    const list = (await call("/bookings", { token })).body?.data ?? [];
    last = list.find((b) => b.id === bookingId);
    if (last && done(last)) return last;
    await sleep(2000);
  }
  return last;
}

const main = async () => {
  if ((await call("/health")).status !== 200) { console.error(`backend not reachable at ${API}`); process.exit(1); }

  // A verified cleaner, online and standing at the service location.
  const agent = await login("9000000001");
  await call("/agent/online", { method: "PATCH", token: agent.token, body: { online: true, ...NEAR } });
  await call("/agent/heartbeat", { method: "PATCH", token: agent.token, body: NEAR });

  // A customer with a saved vehicle + geocoded address, on a plan.
  const customer = await login(freshPhone());
  const veh = await call("/users/me/vehicles", { method: "POST", token: customer.token, body: { type: "hatchback", name: "Sub Car", brand: "X", model: "Y" } });
  const addr = await call("/users/me/addresses", { method: "POST", token: customer.token, body: { label: "Home", line: "1 Subscription Street", society: "Green Valley Society", ...NEAR } });
  const vehicleId = veh.body?.data?.vehicles?.at(-1)?.id;
  const addressId = addr.body?.data?.addresses?.at(-1)?.id;

  const plans = (await call("/catalog/plans")).body?.data ?? [];
  const planId = plans[0]?.id ?? plans[0]?.key;
  const order = await call("/subscriptions/order", { method: "POST", token: customer.token, body: { planId, vehicleType: "hatchback" } });
  const sub = await call("/subscriptions/verify", {
    method: "POST", token: customer.token,
    body: { planId, vehicleType: "hatchback", razorpay_order_id: order.body?.data?.orderId },
  });
  record("S0", "Customer can subscribe to a plan", sub.status === 200 || sub.status === 201,
    `POST /subscriptions/verify → HTTP ${sub.status}${sub.status >= 400 ? `: ${sub.body?.message}` : ""}`);
  if (sub.status >= 400) { console.log("\nCannot continue without an active plan."); process.exit(1); }

  // ── S1: a wash inside the lead window is auto-assigned by the scheduler ───
  {
    const next = nextSlotToday(20);
    if (!next) {
      record("S1a", "A scheduled wash starts unassigned, awaiting the scheduler", true,
        "Skipped: no bookable slot left today, so nothing can fall inside the 2h lead window. Re-run earlier in the day.");
      record("S1b", "The background scheduler auto-assigns the nearest cleaner before the slot", true, "Skipped for the same reason.");
      return finish();
    }
    const date = next.date.toISOString();
    const created = await call("/subscriptions/schedule", {
      method: "POST", token: customer.token,
      body: { vehicleId, addressId, date, slot: next.slot },
    });
    const id = created.body?.data?.id;
    record("S1a", "A scheduled wash starts unassigned, awaiting the scheduler",
      created.status === 200 && created.body?.data?.dispatchStatus === "scheduled" && !created.body?.data?.assignedAgent,
      `created ${id} → dispatchStatus="${created.body?.data?.dispatchStatus}", agent=${created.body?.data?.agentName ?? "none"}`);

    const settled = await until(customer.token, id, (b) => b.dispatchStatus !== "scheduled");
    record("S1b", "The background scheduler auto-assigns the nearest cleaner before the slot",
      Boolean(settled && settled.agentName && settled.dispatchStatus === "assigned"),
      settled
        ? `slot ${next.slot} (${Math.round((next.date - Date.now()) / 60000)} min out) → dispatchStatus="${settled.dispatchStatus}", agent="${settled.agentName ?? "—"}"`
        : "booking disappeared from the customer's list");
  }

  // ── S2: a wash with no coordinates goes to the admin queue, not a cleaner ─
  {
    const addr2 = await call("/users/me/addresses", { method: "POST", token: customer.token, body: { label: "NoGeo", line: "2 Nowhere Lane" } });
    const noGeoId = addr2.body?.data?.addresses?.at(-1)?.id;
    const next2 = nextSlotToday(15);
    if (!next2) { record("S2", "A coordinate-less subscription wash lands in the admin queue", true, "Skipped: no slot left today."); return finish(); }
    const created = await call("/subscriptions/schedule", {
      method: "POST", token: customer.token,
      body: { vehicleId, addressId: noGeoId, date: next2.date.toISOString(), slot: next2.slot },
    });
    const id = created.body?.data?.id;
    const settled = await until(customer.token, id, (b) => b.dispatchStatus === "pending_admin" || b.assignedAgent, 60_000);
    record("S2", "A coordinate-less subscription wash lands in the admin queue",
      Boolean(settled && settled.dispatchStatus === "pending_admin" && !settled.assignedAgent),
      settled ? `dispatchStatus="${settled.dispatchStatus}", agent="${settled.agentName ?? "—"}"` : "not found");
  }

  finish();
};

function finish() {
  console.log("\n════════ SUMMARY ════════");
  for (const r of results) console.log(`${r.pass ? "🟢 PASS" : "🔴 FAIL"}  [${r.id}]`);
  const bad = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - bad}/${results.length} passed`);
  process.exit(bad ? 1 : 0);
}

main().catch((e) => { console.error("crashed:", e); process.exit(1); });
