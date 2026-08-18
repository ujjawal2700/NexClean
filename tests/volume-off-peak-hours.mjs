/**
 * Volume / load test for the off-peak-hours feature.
 *
 * Two questions this answers that the functional suite cannot:
 *
 *  1. COST. Every off-peak-only coupon validation now reads the off-peak config
 *     from Mongo, on a path (checkout pricing) that already ran several queries.
 *     This measures whether that extra read shows up as latency under sustained
 *     concurrent checkouts.
 *
 *  2. CORRECTNESS UNDER PRESSURE. A gate that holds one request at a time but
 *     leaks under concurrency is worse than no gate. Every scenario here asserts
 *     the *expected* status on every single response, so an off-peak request
 *     that succeeds even once is reported as a correctness violation — not
 *     averaged away into a latency percentile.
 *
 * Run against a throwaway backend only:
 *   API=http://127.0.0.1:4000/api node volume-off-peak-hours.mjs
 *   API=... DURATION=30 CONCURRENCY=50 node volume-off-peak-hours.mjs
 */
const API = process.env.API ?? "http://127.0.0.1:4000/api";
const DEMO_OTP = process.env.DEMO_OTP ?? "123456";
const DURATION_S = Number(process.env.DURATION ?? 15);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 30);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "superadmin@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "password123";

const IST = "Asia/Kolkata";
const DISCOUNTED_SLOT = "11:00 AM"; // 660 min — inside the 10:00–12:00 window below
const FULL_PRICE_SLOT = "05:00 PM"; // 1020 min — outside it

async function call(path, { method = "GET", token, body } = {}) {
  const started = performance.now();
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text(); // drain so the socket is released
    return { ms: performance.now() - started, status: res.status, text };
  } catch (e) {
    return { ms: performance.now() - started, status: 0, err: e.message, text: "" };
  }
}

const freshPhone = () => "9" + Math.floor(100000000 + Math.random() * 899999999);

async function login(phone) {
  await call("/auth/send-otp", { method: "POST", body: { phone } });
  const res = await call("/auth/verify-otp", { method: "POST", body: { phone, code: DEMO_OTP } });
  return JSON.parse(res.text || "{}")?.data?.token;
}

function stats(samples) {
  if (!samples.length) return { n: 0, min: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  const s = [...samples].sort((a, b) => a - b);
  const at = (p) => s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
  return {
    n: s.length,
    min: +s[0].toFixed(1),
    p50: +at(50).toFixed(1),
    p95: +at(95).toFixed(1),
    p99: +at(99).toFixed(1),
    max: +s[s.length - 1].toFixed(1),
  };
}

/** ISO date `days` ahead. */
const daysFromNow = (days) => new Date(Date.now() + days * 86400000).toISOString();

/** Weekday index (0 = Sunday) of an ISO date in a zone — mirrors the server. */
function weekdayInZone(iso, timeZone = IST) {
  const short = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(new Date(iso));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
}

/**
 * Hammer one scenario with `workers` concurrent loops for `seconds`.
 * `expect` receives each response and returns true when it is correct; any
 * false is counted as a correctness violation and fails the run.
 */
async function scenario(name, seconds, workers, fn, expect) {
  const latencies = [];
  const codes = new Map();
  const deadline = Date.now() + seconds * 1000;
  let errors = 0;
  let violations = 0;
  let sampleViolation = null;

  const worker = async () => {
    while (Date.now() < deadline) {
      const r = await fn();
      latencies.push(r.ms);
      codes.set(r.status, (codes.get(r.status) ?? 0) + 1);
      if (r.status === 0 || r.status >= 500) errors++;
      if (expect && !expect(r)) {
        violations++;
        if (!sampleViolation) sampleViolation = `HTTP ${r.status} ${String(r.text).slice(0, 160)}`;
      }
    }
  };

  const t0 = performance.now();
  await Promise.all(Array.from({ length: workers }, worker));
  const elapsed = (performance.now() - t0) / 1000;

  const st = stats(latencies);
  const rps = (latencies.length / elapsed).toFixed(1);
  const codeStr = [...codes.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}×${n}`).join(" ");
  const bad = errors > 0 || violations > 0 || st.p95 > 1000;

  console.log(`\n${bad ? "🔴" : "🟢"} ${name}`);
  console.log(`    ${latencies.length} requests in ${elapsed.toFixed(1)}s → ${rps} req/s across ${workers} concurrent clients`);
  console.log(`    latency ms: p50 ${st.p50}  p95 ${st.p95}  p99 ${st.p99}  max ${st.max}`);
  console.log(`    responses: ${codeStr}${errors ? `   ⚠️ ${errors} server errors/timeouts` : "   no 5xx, no dropped connections"}`);
  if (violations) console.log(`    ❌ ${violations} WRONG outcomes — e.g. ${sampleViolation}`);
  else if (expect) console.log(`    ✅ every response had the expected outcome`);

  return { name, rps: +rps, ...st, errors, violations };
}

const main = async () => {
  const health = await call("/health");
  if (health.status !== 200) {
    console.error(`backend not reachable at ${API}`);
    process.exit(1);
  }

  console.log(`Off-peak-hours volume test → ${API}`);
  console.log(`${CONCURRENCY} concurrent clients, ${DURATION_S}s per scenario\n${"─".repeat(70)}`);

  // ---- Setup -------------------------------------------------------------
  const adminRes = await call("/auth/admin-login", {
    method: "POST",
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const adminToken = JSON.parse(adminRes.text || "{}")?.data?.token;
  if (!adminToken) {
    console.error("admin login failed — cannot configure off-peak hours");
    process.exit(1);
  }

  const token = await login(freshPhone());
  const pkgs = JSON.parse((await call("/catalog/packages")).text || "{}")?.data ?? [];
  const packageId = pkgs[0]?.id;
  if (!token || !packageId) {
    console.error("setup failed — missing customer token or package");
    process.exit(1);
  }

  const targetDate = daysFromNow(3);
  const targetDay = weekdayInZone(targetDate);

  // A window containing DISCOUNTED_SLOT but not FULL_PRICE_SLOT, on the target weekday.
  const configured = await call("/admin/off-peak-hours", {
    method: "PUT",
    token: adminToken,
    body: {
      timezone: IST,
      active: true,
      windows: [{ day: targetDay, start: "10:00", end: "12:00", label: "Load test window" }],
    },
  });
  if (configured.status !== 200) {
    console.error(`failed to configure off-peak hours: ${configured.status} ${configured.text}`);
    process.exit(1);
  }

  const offPeakCode = `LOADOFFPEAK${Date.now()}`;
  const created = await call("/admin/discount-codes", {
    method: "POST",
    token: adminToken,
    body: { code: offPeakCode, type: "flat", value: 25, offPeakOnly: true },
  });
  if (created.status !== 201) {
    console.error(`failed to create off-peak-only code: ${created.status} ${created.text}`);
    process.exit(1);
  }

  const quoteBody = (slot) => ({
    vehicleType: "hatchback",
    packageId,
    discountCode: offPeakCode,
    date: targetDate,
    slot,
  });

  const results = [];

  // 1. The public read the booking screen makes to flag discounted slots.
  results.push(
    await scenario(
      "Public off-peak config    GET /catalog/off-peak-hours",
      DURATION_S,
      CONCURRENCY,
      () => call("/catalog/off-peak-hours"),
      (r) => r.status === 200,
    ),
  );

  // 2. The hot path: an off-peak-only coupon quoted on an OFF-PEAK slot must always be
  //    granted. Any 400 here would mean the gate is rejecting valid redemptions
  //    under load — customers losing a discount they are entitled to.
  results.push(
    await scenario(
      "Off-peak coupon GRANTED   POST /payments/preview (off-peak slot)",
      DURATION_S,
      CONCURRENCY,
      () => call("/payments/preview", { method: "POST", token, body: quoteBody(DISCOUNTED_SLOT) }),
      (r) => r.status === 200 && JSON.parse(r.text || "{}")?.data?.discountAmount === 25,
    ),
  );

  // 3. The security-relevant inverse: an OFF-PEAK slot must always be refused.
  //    A single 200 here is a revenue leak, so it is counted as a violation
  //    rather than being smoothed into a percentile.
  results.push(
    await scenario(
      "Off-peak coupon REFUSED   POST /payments/preview (peak slot)",
      DURATION_S,
      CONCURRENCY,
      () => call("/payments/preview", { method: "POST", token, body: quoteBody(FULL_PRICE_SLOT) }),
      (r) => r.status === 400,
    ),
  );

  // 4. Config writes contend on one document (_id: "global"). This checks the
  //    upsert path doesn't deadlock or 5xx when several admins save at once.
  results.push(
    await scenario(
      "Config write         PUT /admin/off-peak-hours",
      Math.max(5, Math.floor(DURATION_S / 2)),
      Math.max(4, Math.floor(CONCURRENCY / 5)),
      () =>
        call("/admin/off-peak-hours", {
          method: "PUT",
          token: adminToken,
          body: {
            timezone: IST,
            active: true,
            windows: [{ day: targetDay, start: "10:00", end: "12:00", label: "Load test window" }],
          },
        }),
      (r) => r.status === 200,
    ),
  );

  // 5. The nastiest case: readers validating coupons while writers flip the
  //    config underneath them. Each response must still be internally
  //    consistent — either the discount was granted or it was cleanly refused,
  //    never a 500 and never a partially-applied price.
  const flipDeadline = Date.now() + DURATION_S * 1000;
  const flipper = (async () => {
    let on = true;
    while (Date.now() < flipDeadline) {
      on = !on;
      await call("/admin/off-peak-hours", { method: "PUT", token: adminToken, body: { active: on } });
      await new Promise((r) => setTimeout(r, 50));
    }
    // Leave it on so the assertion below is meaningful.
    await call("/admin/off-peak-hours", { method: "PUT", token: adminToken, body: { active: true } });
  })();

  results.push(
    await scenario(
      "Read during flips    POST /payments/preview (config toggling)",
      DURATION_S,
      CONCURRENCY,
      () => call("/payments/preview", { method: "POST", token, body: quoteBody(DISCOUNTED_SLOT) }),
      // Either outcome is legitimate depending on which side of a flip the read
      // landed — but it must be one of them, cleanly, with no server error and
      // no half-applied discount.
      (r) => {
        if (r.status === 400) return true;
        if (r.status !== 200) return false;
        const amount = JSON.parse(r.text || "{}")?.data?.discountAmount;
        return amount === 25;
      },
    ),
  );
  await flipper;

  // ---- Teardown ----------------------------------------------------------
  await call("/admin/off-peak-hours", {
    method: "PUT",
    token: adminToken,
    body: { timezone: IST, active: true, windows: [] },
  });

  console.log(`\n${"─".repeat(70)}\nSUMMARY`);
  for (const r of results) {
    const flag = r.errors || r.violations ? `🔴 ${r.errors} errors, ${r.violations} wrong` : "🟢 clean";
    console.log(
      `  ${r.name.padEnd(50)} ${String(r.rps).padStart(7)} req/s   p95 ${String(r.p95).padStart(6)}ms   ${flag}`,
    );
  }

  const failed = results.filter((r) => r.errors > 0 || r.violations > 0);
  if (failed.length) {
    console.log(`\n🔴 ${failed.length} scenario(s) failed (server errors or wrong outcomes)`);
  } else {
    console.log(`\n🟢 No server errors and no incorrect gate decisions under load.`);
  }
  process.exit(failed.length ? 1 : 0);
};

main().catch((e) => {
  console.error("crashed:", e);
  process.exit(1);
});
