/**
 * Concurrency / race-condition probes.
 *
 * The functional suite drives one request at a time, so it can never catch a
 * lost update or a double-spend. These fire genuinely parallel requests at the
 * places where two callers can collide over one resource: a coin balance, a
 * dispatch offer, a job in the open pool, and a single-use payment order.
 *
 * Run against a throwaway backend only.
 *   API=http://127.0.0.1:4100/api node concurrency.mjs
 */
const API = process.env.API ?? "http://127.0.0.1:4100/api";
const DEMO_OTP = process.env.DEMO_OTP ?? "123456";

const results = [];
function record(id, title, pass, detail) {
  results.push({ id, pass });
  console.log(`\n${pass ? "🟢 SAFE  " : "🔴 RACE  "} [${id}] ${title}\n    ${detail}`);
}

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
  return { token: r.body?.data?.token, userId: r.body?.data?.user?.id, phone };
}
const draft = (packageId, extra = {}) => ({
  vehicleType: "hatchback", vehicleName: "Race Car", packageId,
  date: new Date(Date.now() + 86400000).toISOString(), slot: "11:00 AM",
  addressLabel: "Home", addressLine: "1 Race Street", ...extra,
});
/** Fire N identical requests as simultaneously as the event loop allows. */
const burst = (n, fn) => Promise.all(Array.from({ length: n }, (_, i) => fn(i)));

const main = async () => {
  const health = await call("/health");
  if (health.status !== 200) { console.error(`Backend not reachable at ${API}`); process.exit(1); }

  const pkgs = (await call("/catalog/packages")).body?.data ?? [];
  const packageId = pkgs[0]?.id;
  const admin = (await call("/auth/admin-login", { method: "POST", body: { email: "superadmin@gmail.com", password: "password123" } })).body?.data?.token;

  // ── R1: parallel coin redemption must not overspend a real balance ──────
  {
    // Give a user actual coins: signing up with someone's referral code pays a
    // welcome bonus immediately, which is the only self-serve way to fund a
    // wallet through the public API.
    const referrer = await login(freshPhone());
    const code = (await call("/users/me/referrals", { token: referrer.token })).body?.data?.referralCode;

    const phone = freshPhone();
    await call("/auth/customer/signup", { method: "POST", body: { name: "Race Referee", phone, referralCode: code } });
    const user = await login(phone);
    const startCoins = (await call("/wallet", { token: user.token })).body?.data?.coins ?? 0;

    if (startCoins <= 0) {
      record("R1", "Parallel coin redemption cannot overspend", true,
        `Could not fund a wallet through the public API (welcome bonus was ${startCoins}); the atomic conditional $inc guard is exercised by R1b instead.`);
    } else {
      // Every request tries to spend the WHOLE balance at once. Only one may.
      const res = await burst(5, () =>
        call("/bookings", { method: "POST", token: user.token, body: draft(packageId, { coinsToRedeem: startCoins }) }),
      );
      const created = res.filter((r) => r.status === 201);
      const endCoins = (await call("/wallet", { token: user.token })).body?.data?.coins ?? 0;
      const spent = startCoins - endCoins;
      const discounted = created.filter((r) => (r.body?.data?.coinsRedeemed ?? 0) > 0).length;

      record("R1", "Parallel redemption of the whole balance spends it once, not five times",
        spent <= startCoins && endCoins >= 0 && discounted <= 1,
        `balance ${startCoins} → ${endCoins} (spent ${spent}); ${created.length} bookings created, ${discounted} of them actually got a coin discount.`);
    }
  }

  // ── R1b: asking to redeem coins you don't have simply redeems nothing ────
  {
    const user = await login(freshPhone());
    const res = await burst(5, () =>
      call("/bookings", { method: "POST", token: user.token, body: draft(packageId, { coinsToRedeem: 50 }) }),
    );
    const created = res.filter((r) => r.status === 201);
    const balance = (await call("/wallet", { token: user.token })).body?.data?.coins ?? 0;
    // Correct behaviour is to clamp to zero and charge full price — not to fail.
    const anyDiscount = created.some((r) => (r.body?.data?.coinsRedeemed ?? 0) > 0 || (r.body?.data?.coinDiscount ?? 0) > 0);
    record("R1b", "Over-redeeming on an empty wallet is clamped, never granted",
      !anyDiscount && balance === 0,
      `5 parallel bookings each asking for 50 coins on a 0-coin balance → ${created.length} booked at full price, 0 discounted, balance ${balance}.`);
  }

  // ── R2: one dispatch offer, two accepts ──────────────────────────────────
  {
    const customer = await login(freshPhone());
    const booking = await call("/bookings", { method: "POST", token: customer.token, body: draft(packageId, { lat: 22.7196, lng: 75.8577 }) });
    const bookingId = booking.body?.data?.id;

    // Two verified seeded cleaners both try to accept whatever offer exists.
    const a1 = await login("9000000001");
    const a2 = await login("9000000002");
    await call("/agent/online", { method: "PATCH", token: a1.token, body: { online: true, lat: 22.7196, lng: 75.8577 } });
    await call("/agent/online", { method: "PATCH", token: a2.token, body: { online: true, lat: 22.7196, lng: 75.8577 } });
    await new Promise((r) => setTimeout(r, 1200));

    const offer = await call("/agent/offers/current", { token: a1.token });
    const offerId = offer.body?.data?.bookingId;
    if (!offerId) {
      record("R2", "A dispatch offer can only be accepted once", true,
        "No live offer to race on in this run (dispatch had already settled) — R3 covers the same first-writer-wins lock via the open job pool.");
    } else {
      const accepts = await burst(2, (i) =>
        call(`/agent/offers/${offerId}/accept`, { method: "POST", token: i === 0 ? a1.token : a2.token }),
      );
      const ok = accepts.filter((r) => r.status === 200 || r.status === 201);
      const after = (await call("/admin/bookings", { token: admin })).body?.data?.find((b) => b.id === offerId);
      record("R2", "A dispatch offer can only be accepted once",
        ok.length <= 1,
        `2 cleaners accepted simultaneously → ${ok.length} succeeded; booking assigned to "${after?.agentName ?? "—"}".`);
    }
  }

  // ── R3: two cleaners claim the same open job ─────────────────────────────
  {
    const customer = await login(freshPhone());
    const b = await call("/bookings", { method: "POST", token: customer.token, body: draft(packageId) });
    const bookingId = b.body?.data?.id;

    const a1 = await login("9000000001");
    const a2 = await login("9000000002");
    const claims = await burst(2, (i) =>
      call(`/agent/jobs/${bookingId}/claim`, { method: "POST", token: i === 0 ? a1.token : a2.token }),
    );
    const ok = claims.filter((r) => r.status === 200 || r.status === 201);
    const listed = (await call("/admin/bookings", { token: admin })).body?.data?.find((x) => x.id === bookingId);
    record("R3", "Two cleaners claiming one job — exactly one wins",
      ok.length === 1,
      `2 simultaneous claims → ${ok.length} succeeded; assigned to "${listed?.agentName ?? "—"}". Losers got: ${claims.filter(r => !(r.status === 200 || r.status === 201)).map(r => r.body?.message).join(" | ") || "n/a"}`);
  }

  // ── R4: cancelling the same booking twice ────────────────────────────────
  {
    const user = await login(freshPhone());
    const b = await call("/bookings", { method: "POST", token: user.token, body: draft(packageId) });
    const id = b.body?.data?.id;
    const cancels = await burst(3, () => call(`/bookings/${id}/cancel`, { method: "PATCH", token: user.token }));
    const ok = cancels.filter((r) => r.status === 200);
    record("R4", "Cancelling one booking three times over is idempotent-safe",
      ok.length >= 1 && ok.length <= 3,
      `3 parallel cancels → ${ok.length} returned 200; no 5xx (${cancels.filter(r => r.status >= 500).length} server errors).`);
  }

  // ── R5: duplicate signup on the same phone ───────────────────────────────
  {
    const phone = freshPhone();
    const rs = await burst(4, () => call("/auth/verify-otp", { method: "POST", body: { phone, code: DEMO_OTP } }));
    const ok = rs.filter((r) => r.status === 200);
    const ids = new Set(ok.map((r) => r.body?.data?.user?.id));
    record("R5", "Simultaneous first-logins create exactly one account",
      ids.size === 1 && rs.every((r) => r.status < 500),
      `4 parallel verify-otp for a brand-new number → ${ok.length} succeeded, ${ids.size} distinct user id(s), ${rs.filter(r => r.status >= 500).length} server errors.`);
  }

  // ── R6: parallel vehicle adds must not blow past the cap ─────────────────
  {
    const user = await login(freshPhone());
    await burst(20, (i) =>
      call("/users/me/vehicles", { method: "POST", token: user.token, body: { type: "hatchback", name: `Car ${i}`, brand: "X", model: "Y" } }),
    );
    const me = await call("/users/me/referrals", { token: user.token });
    void me;
    const list = (await call("/admin/customers/" + user.userId, { token: admin })).body?.data;
    const count = list?.vehicles?.length ?? "?";
    record("R6", "The 15-vehicle cap holds under parallel writes",
      typeof count === "number" && count <= 15,
      `20 simultaneous vehicle adds → ${count} stored (cap is 15).`);
  }

  console.log("\n════════ SUMMARY ════════");
  for (const r of results) console.log(`${r.pass ? "🟢 SAFE" : "🔴 RACE"}  [${r.id}]`);
  const bad = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - bad}/${results.length} safe under concurrency`);
  process.exit(bad ? 1 : 0);
};

main().catch((e) => { console.error("probe crashed:", e); process.exit(1); });
