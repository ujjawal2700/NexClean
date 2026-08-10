/**
 * Adversarial / abuse-case probes against a THROWAWAY NexClean backend.
 * These target business-logic and auth weaknesses the functional suite
 * does not cover (payment replay, price tampering, auth bypass, brute force).
 *
 * Usage: API=http://127.0.0.1:4100/api node adversarial.mjs
 */
const API = process.env.API ?? "http://127.0.0.1:4100/api";
const DEMO_OTP = process.env.DEMO_OTP ?? "123456";

const results = [];
function record(id, title, status, detail) {
  results.push({ id, title, status, detail });
  const mark = status === "VULNERABLE" ? "🔴 VULNERABLE" : status === "OK" ? "🟢 OK" : "⚪️ INCONCLUSIVE";
  console.log(`\n${mark}  [${id}] ${title}\n    ${detail}`);
}

async function call(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body: json };
}

const freshPhone = () => "9" + Math.floor(100000000 + Math.random() * 899999999);

async function login(phone) {
  await call("/auth/send-otp", { method: "POST", body: { phone } });
  const r = await call("/auth/verify-otp", { method: "POST", body: { phone, code: DEMO_OTP } });
  return { token: r.body?.data?.token, userId: r.body?.data?.user?.id, raw: r };
}

function bookingPayload(packageId, extra = {}) {
  return {
    vehicleType: "hatchback",
    vehicleName: "Probe Car",
    packageId,
    date: new Date(Date.now() + 86400000).toISOString(),
    slot: "11:00 AM",
    addressLabel: "Home",
    addressLine: "1 Probe Street",
    ...extra,
  };
}

const main = async () => {
  const health = await call("/health");
  if (health.status !== 200) {
    console.error(`Backend not reachable at ${API}`);
    process.exit(1);
  }

  const pkgs = (await call("/catalog/packages")).body?.data ?? [];
  if (!pkgs.length) { console.error("No packages seeded — aborting."); process.exit(1); }
  const sorted = [...pkgs].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  const cheap = sorted[0];
  const pricey = sorted[sorted.length - 1];
  console.log(`Using packages: cheap=${cheap.id}(${cheap.name}) pricey=${pricey.id}(${pricey.name})`);

  const victim = await login(freshPhone());
  const attacker = await login(freshPhone());

  // ── A1: universal demo OTP accepts ANY phone number ──────────────────────
  {
    const phone = freshPhone();
    const r = await call("/auth/verify-otp", { method: "POST", body: { phone, code: DEMO_OTP } });
    const gotToken = Boolean(r.body?.data?.token);
    record("A1", "Universal DEMO_OTP master code logs in as any phone",
      gotToken ? "VULNERABLE" : "OK",
      gotToken
        ? `verify-otp for never-registered ${phone} with code "${DEMO_OTP}" returned HTTP ${r.status} and a valid JWT — no OTP was ever requested for this number.`
        : `Rejected with HTTP ${r.status}.`);
  }

  // ── A2: OTP brute force is unlimited ─────────────────────────────────────
  {
    const phone = freshPhone();
    await call("/auth/send-otp", { method: "POST", body: { phone } });
    let attempts = 0, blocked = false;
    for (let i = 0; i < 60; i++) {
      const r = await call("/auth/verify-otp", { method: "POST", body: { phone, code: String(200000 + i) } });
      attempts++;
      if (r.status === 429 || /too many|locked|attempt/i.test(r.body?.message ?? "")) { blocked = true; break; }
    }
    record("A2", "OTP verification has no attempt limit / lockout",
      blocked ? "OK" : "VULNERABLE",
      blocked
        ? `Blocked after ${attempts} wrong codes.`
        : `${attempts} consecutive wrong OTP codes accepted for grading with no lockout, no 429, no attempt counter. A 6-digit code is brute-forceable.`);
  }

  // ── A3: send-otp has no rate limit (SMS cost / flooding) ─────────────────
  {
    const phone = freshPhone();
    let sent = 0, blocked = false;
    for (let i = 0; i < 30; i++) {
      const r = await call("/auth/send-otp", { method: "POST", body: { phone } });
      if (r.status === 429) { blocked = true; break; }
      if (r.status === 200) sent++;
    }
    record("A3", "send-otp has no rate limit (SMS billing abuse)",
      blocked ? "OK" : "VULNERABLE",
      blocked ? "Rate limited." :
        `${sent} OTP sends accepted for one number in a tight loop with no throttling. With a live SMS provider each call bills real money.`);
  }

  // ── A4: admin-login brute force ──────────────────────────────────────────
  {
    let tries = 0, blocked = false;
    for (let i = 0; i < 30; i++) {
      const r = await call("/auth/admin-login", { method: "POST", body: { email: "superadmin@gmail.com", password: `wrong${i}` } });
      tries++;
      if (r.status === 429) { blocked = true; break; }
    }
    record("A4", "Admin login has no brute-force protection",
      blocked ? "OK" : "VULNERABLE",
      blocked ? "Rate limited." : `${tries} failed admin password attempts with no throttling or lockout.`);
  }

  // ── B1: booking without any payment ──────────────────────────────────────
  {
    const r = await call("/bookings", { method: "POST", token: attacker.token, body: bookingPayload(pricey.id) });
    const madeIt = r.status === 201 && r.body?.data?.id;
    record("B1", "POST /bookings creates a confirmed booking with no payment",
      madeIt ? "VULNERABLE" : "OK",
      madeIt
        ? `Created booking ${r.body.data.id} for "${pricey.name}" at ₹${r.body.data.price} via HTTP ${r.status} — no payment order, no Razorpay verification. The web client only calls /payments/verify, so this route is an unused but publicly reachable free-booking path.`
        : `HTTP ${r.status}: ${r.body?.message}`);
  }

  // ── B2: payment order replay — one payment, many bookings ────────────────
  {
    const order = await call("/payments/order", { method: "POST", token: attacker.token, body: { booking: bookingPayload(pricey.id) } });
    const orderId = order.body?.data?.orderId;
    const ids = [];
    for (let i = 0; i < 3; i++) {
      const v = await call("/payments/verify", {
        method: "POST", token: attacker.token,
        body: { booking: bookingPayload(pricey.id), razorpay_order_id: orderId, razorpay_payment_id: "pay_probe", razorpay_signature: "sig_probe" },
      });
      if (v.status === 201 && v.body?.data?.id) ids.push(v.body.data.id);
    }
    record("B2", "Payment order can be replayed for unlimited bookings",
      ids.length > 1 ? "VULNERABLE" : "OK",
      ids.length > 1
        ? `Single order ${orderId} redeemed ${ids.length} times, creating bookings ${ids.join(", ")}. verifyAndBook() never marks the order consumed nor checks whether it already has a booking.`
        : `Only ${ids.length} booking created from a replayed order.`);
  }

  // ── B3: price tampering between /order and /verify ───────────────────────
  {
    const order = await call("/payments/order", { method: "POST", token: attacker.token, body: { booking: bookingPayload(cheap.id) } });
    const paidAmount = order.body?.data?.amount;
    const orderId = order.body?.data?.orderId;
    const v = await call("/payments/verify", {
      method: "POST", token: attacker.token,
      body: { booking: bookingPayload(pricey.id), razorpay_order_id: orderId, razorpay_payment_id: "pay_probe", razorpay_signature: "sig_probe" },
    });
    const got = v.body?.data;
    const tampered = v.status === 201 && got && got.price > paidAmount;
    record("B3", "Booking payload can be swapped between /order and /verify",
      tampered ? "VULNERABLE" : "OK",
      tampered
        ? `Ordered "${cheap.name}" (order amount ₹${paidAmount}) then verified with "${pricey.name}" — got booking ${got.id} worth ₹${got.price}. verifyAndBook() recomputes the price from the NEW payload and never compares it to the amount actually charged on the order.`
        : `Order ₹${paidAmount} → booking ₹${got?.price} (HTTP ${v.status}).`);
  }

  // ── C1: role escalation — customer token on admin endpoint ───────────────
  {
    const r = await call("/admin/customers", { token: attacker.token });
    record("C1", "Customer JWT rejected on admin routes",
      r.status === 403 || r.status === 401 ? "OK" : "VULNERABLE",
      `GET /admin/customers with a customer token → HTTP ${r.status}.`);
  }

  // ── C2: suspended account keeps working with an already-issued JWT ───────
  {
    const admin = await call("/auth/admin-login", { method: "POST", body: { email: "superadmin@gmail.com", password: "password123" } });
    const adminToken = admin.body?.data?.token;
    const before = await call("/users/me", { token: victim.token });
    const susp = await call(`/admin/customers/${victim.userId}/status`, { method: "PATCH", token: adminToken, body: { status: "suspended" } });
    const after = await call("/users/me", { token: victim.token });
    const stillWorks = before.status === 200 && susp.status === 200 && after.status === 200;
    record("C2", "Suspended user's existing JWT is still accepted",
      stillWorks ? "VULNERABLE" : "OK",
      stillWorks
        ? `Customer suspended by admin (HTTP ${susp.status}), yet their previously issued token still returns HTTP 200 on /users/me. Suspension is only enforced at OTP login; tokens live 30 days with no revocation/status recheck.`
        : `After suspension /users/me → HTTP ${after.status} (suspend call was HTTP ${susp.status}).`);
  }

  // ── D1: coin redemption abuse ────────────────────────────────────────────
  {
    const huge = await call("/payments/preview", { method: "POST", token: attacker.token, body: { vehicleType: "hatchback", packageId: pricey.id, coinsToRedeem: 99999999 } });
    const d = huge.body?.data;
    const freeRide = huge.status === 200 && d && d.price <= 0;
    record("D1", "Redeeming more coins than owned cannot zero out the price",
      freeRide ? "VULNERABLE" : "OK",
      freeRide
        ? `preview with coinsToRedeem=99999999 returned price ₹${d.price}.`
        : `Clamped correctly: price ₹${d?.price} with coinsRedeemed=${d?.coinsRedeemed} (HTTP ${huge.status}).`);
  }

  // ── D2: self-referral ────────────────────────────────────────────────────
  {
    const me = await call("/users/me", { token: attacker.token });
    const myCode = me.body?.data?.referralCode;
    let detail, status;
    if (!myCode) { status = "INCONCLUSIVE"; detail = "Could not read own referral code."; }
    else {
      const phone = freshPhone();
      const r = await call("/auth/customer-signup", { method: "POST", body: { name: "Self Referrer", phone, referralCode: myCode } });
      status = r.status === 200 ? "INCONCLUSIVE" : "OK";
      detail = r.status === 200
        ? `A new account accepted referral code ${myCode}. Self-referral by one person with two numbers is not blocked by device/identity checks — coin-farming risk is business-policy dependent.`
        : `HTTP ${r.status}: ${r.body?.message}`;
    }
    record("D2", "Referral code reuse / self-referral farming", status, detail);
  }

  // ── E1: negative coin value rejected by schema ───────────────────────────
  {
    const r = await call("/payments/preview", { method: "POST", token: attacker.token, body: { vehicleType: "hatchback", packageId: cheap.id, coinsToRedeem: -5000 } });
    record("E1", "Negative coinsToRedeem rejected",
      r.status === 400 ? "OK" : "VULNERABLE",
      `coinsToRedeem=-5000 → HTTP ${r.status}: ${r.body?.message ?? JSON.stringify(r.body?.data)}`);
  }

  // ── E2: unknown/inactive package ─────────────────────────────────────────
  {
    const r = await call("/bookings", { method: "POST", token: attacker.token, body: bookingPayload("000000000000000000000000") });
    record("E2", "Unknown packageId handled cleanly (no 500)",
      r.status >= 500 ? "VULNERABLE" : "OK",
      `Unknown packageId → HTTP ${r.status}: ${r.body?.message}`);
  }

  console.log("\n\n════════ SUMMARY ════════");
  for (const r of results) console.log(`${r.status.padEnd(13)} [${r.id}] ${r.title}`);
  const vulns = results.filter((r) => r.status === "VULNERABLE").length;
  console.log(`\n${vulns} vulnerable / ${results.length} probes`);
};

main().catch((e) => { console.error("Probe run crashed:", e); process.exit(1); });
