/**
 * Verifies the P0/P1 fixes against a backend running in PRODUCTION +
 * PAYMENTS_ONLINE mode — the configuration where the payment-integrity bugs
 * were actually exploitable.
 *
 * Expects the server started with:
 *   NODE_ENV=production PAYMENTS_ONLINE=true RAZORPAY_KEY_SECRET=livesecret
 *   DEMO_OTP="" MONGODB_URI=...nexclean-online PORT=4300
 */
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const API = process.env.API ?? "http://127.0.0.1:4300/api";
const MONGO = process.env.MONGO ?? "mongodb://127.0.0.1:27017/nexclean-online";
const RZP_SECRET = process.env.RZP_SECRET ?? "livesecret";

const results = [];
function check(id, title, pass, detail) {
  results.push({ id, pass });
  console.log(`\n${pass ? "🟢 FIXED  " : "🔴 STILL BROKEN"} [${id}] ${title}\n    ${detail}`);
}

async function call(path, { method = "GET", token, body, origin } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(origin ? { origin } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}

const freshPhone = () => "9" + Math.floor(100000000 + Math.random() * 899999999);
const sign = (orderId, paymentId) =>
  crypto.createHmac("sha256", RZP_SECRET).update(`${orderId}|${paymentId}`).digest("hex");

/** Run a snippet against the test DB via mongosh (avoids needing the driver here). */
function mongo(js) {
  return execFileSync("mongosh", ["--quiet", MONGO, "--eval", js], { encoding: "utf8" }).trim();
}

/** Real OTP login (no demo code in production) — read the code straight from Mongo. */
async function login(phone) {
  await call("/auth/send-otp", { method: "POST", body: { phone } });
  const code = mongo(`print(db.otps.findOne({phone:"${phone}"}).code)`);
  const r = await call("/auth/verify-otp", { method: "POST", body: { phone, code } });
  return { token: r.body?.data?.token, userId: r.body?.data?.user?.id };
}

const bookingDraft = (packageId, extra = {}) => ({
  vehicleType: "hatchback", vehicleName: "Verify Car", packageId,
  date: new Date(Date.now() + 86400000).toISOString(), slot: "11:00 AM",
  addressLabel: "Home", addressLine: "1 Verify Street", ...extra,
});

const main = async () => {
  const user = await login(freshPhone());
  if (!user.token) { console.error("login failed — is the server up in production mode?"); process.exit(1); }

  const pkgs = (await call("/catalog/packages")).body?.data ?? [];
  const sorted = [...pkgs].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  const cheap = sorted[0], pricey = sorted[sorted.length - 1];

  // Seed an order directly (fake Razorpay keys can't reach the real API).
  function seedOrder(draft, amount) {
    const orderId = `order_verify_${crypto.randomBytes(6).toString("hex")}`;
    mongo(
      `db.payments.insertOne({user:ObjectId("${user.userId}"),orderId:"${orderId}",amount:${amount},` +
      `currency:"INR",status:"created",booking:null,bookingDraft:${JSON.stringify(draft)},` +
      `refundAmount:0,settlementStatus:"pending",createdAt:new Date(),updatedAt:new Date(),__v:0})`,
    );
    return orderId;
  }

  // ── P0-4: demo OTP must be dead in production ────────────────────────────
  {
    const r = await call("/auth/verify-otp", { method: "POST", body: { phone: freshPhone(), code: "123456" } });
    check("P0-4", "DEMO_OTP no longer logs in as any phone",
      r.status !== 200, `verify-otp with "123456" → HTTP ${r.status}: ${r.body?.message}`);
  }

  // ── P0-2: order replay ───────────────────────────────────────────────────
  {
    const orderId = seedOrder(bookingDraft(pricey.id), pricey.price);
    const sig = sign(orderId, "pay_verify");
    const first = await call("/payments/verify", { method: "POST", token: user.token,
      body: { booking: bookingDraft(pricey.id), razorpay_order_id: orderId, razorpay_payment_id: "pay_verify", razorpay_signature: sig } });
    const replay = await call("/payments/verify", { method: "POST", token: user.token,
      body: { booking: bookingDraft(pricey.id), razorpay_order_id: orderId, razorpay_payment_id: "pay_verify", razorpay_signature: sig } });
    check("P0-2", "A paid order cannot be replayed into a second booking",
      first.status === 201 && replay.status !== 201,
      `first verify → HTTP ${first.status} (booking ${first.body?.data?.id}); identical replay → HTTP ${replay.status}: ${replay.body?.message}`);
  }

  // ── P0-3: price tampering ────────────────────────────────────────────────
  {
    const orderId = seedOrder(bookingDraft(cheap.id), cheap.price);
    const sig = sign(orderId, "pay_tamper");
    const r = await call("/payments/verify", { method: "POST", token: user.token,
      body: { booking: bookingDraft(pricey.id), razorpay_order_id: orderId, razorpay_payment_id: "pay_tamper", razorpay_signature: sig } });
    const got = r.body?.data;
    check("P0-3", "Swapping the booking payload at verify no longer works",
      r.status === 201 && got?.packageName === cheap.name,
      `ordered "${cheap.name}" (₹${cheap.price}), verified with "${pricey.name}" → got "${got?.packageName}" at ₹${got?.price}`);
  }

  // ── P0-1: free-booking route closed in online mode ───────────────────────
  {
    const r = await call("/bookings", { method: "POST", token: user.token, body: bookingDraft(pricey.id) });
    check("P0-1", "Direct POST /bookings is closed when online payments are on",
      r.status !== 201, `POST /bookings → HTTP ${r.status}: ${r.body?.message}`);
  }

  // ── P0-5: support-ticket IDOR ────────────────────────────────────────────
  {
    const victim = await login(freshPhone());
    const attacker = await login(freshPhone());
    const t = await call("/chat/tickets", { method: "POST", token: victim.token, body: { subject: "Private" } });
    const id = t.body?.data?._id ?? t.body?.data?.id;
    await call(`/chat/tickets/${id}/messages`, { method: "POST", token: victim.token, body: { text: "card 4242 double charged" } });
    const read = await call(`/chat/tickets/${id}/messages`, { token: attacker.token });
    const write = await call(`/chat/tickets/${id}/messages`, { method: "POST", token: attacker.token, body: { text: "injected" } });
    const close = await call(`/chat/tickets/${id}/close`, { method: "PATCH", token: attacker.token });
    check("P0-5", "Another user's support ticket is unreachable",
      read.status !== 200 && write.status !== 200 && close.status !== 200,
      `attacker read → ${read.status}, write → ${write.status}, close → ${close.status}`);
  }

  // ── P1-2: suspension revokes an existing token ───────────────────────────
  {
    const victim = await login(freshPhone());
    const admin = (await call("/auth/admin-login", { method: "POST", body: { email: "superadmin@gmail.com", password: "a-strong-admin-password" } })).body?.data?.token;
    const before = await call("/bookings", { token: victim.token });
    await call(`/admin/customers/${victim.userId}/status`, { method: "PATCH", token: admin, body: { status: "suspended" } });
    const after = await call("/bookings", { token: victim.token });
    check("P1-2", "Suspending an account invalidates its existing token",
      before.status === 200 && after.status !== 200,
      `before → HTTP ${before.status}, after suspension → HTTP ${after.status}: ${after.body?.message}`);
  }

  // ── P1-4: error mapping + no stack leakage ───────────────────────────────
  {
    const bad = await call("/bookings/not-a-valid-objectid/cancel", { method: "PATCH", token: user.token });
    check("P1-4", "Malformed id returns 400 with no stack trace",
      bad.status === 400 && !bad.body?.stack,
      `PATCH /bookings/not-a-valid-objectid/cancel → HTTP ${bad.status}, stackLeaked=${Boolean(bad.body?.stack)}`);
  }

  // ── P1-7: past-dated bookings ────────────────────────────────────────────
  {
    const orderId = seedOrder(bookingDraft(cheap.id, { date: new Date(Date.now() - 30 * 86400000).toISOString() }), cheap.price);
    const r = await call("/payments/verify", { method: "POST", token: user.token,
      body: { booking: bookingDraft(cheap.id, { date: new Date(Date.now() - 30 * 86400000).toISOString() }), razorpay_order_id: orderId, razorpay_payment_id: "pay_past", razorpay_signature: sign(orderId, "pay_past") } });
    check("P1-7", "A booking dated in the past is rejected",
      r.status !== 201, `30-days-ago booking → HTTP ${r.status}: ${r.body?.message ?? JSON.stringify(r.body?.details)}`);
  }

  // ── P1-1: rate limiting is live outside the test env ─────────────────────
  {
    let blocked = false, n = 0;
    for (let i = 0; i < 25; i++) {
      const r = await call("/auth/admin-login", { method: "POST", body: { email: "superadmin@gmail.com", password: `wrong${i}` } });
      n++;
      if (r.status === 429) { blocked = true; break; }
    }
    check("P1-1", "Admin login is rate limited", blocked, `429 after ${n} failed attempts`);
  }

  // ── P2: unicode names ────────────────────────────────────────────────────
  {
    const r = await call("/users/me", { method: "PATCH", token: user.token, body: { name: "जॉन कुमार", email: "a@b.com" } });
    const r2 = await call("/users/me", { method: "PATCH", token: user.token, body: { name: "Agent 007", email: "a@b.com" } });
    check("P2-name", "Devanagari names accepted, digits still rejected",
      r.status === 200 && r2.status === 400, `"जॉन कुमार" → ${r.status}, "Agent 007" → ${r2.status}`);
  }

  console.log("\n════════ SUMMARY ════════");
  for (const r of results) console.log(`${r.pass ? "🟢 FIXED       " : "🔴 STILL BROKEN"} [${r.id}]`);
  const bad = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - bad}/${results.length} verified fixed`);
  process.exit(bad ? 1 : 0);
};

main().catch((e) => { console.error("verification crashed:", e); process.exit(1); });
