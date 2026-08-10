/**
 * Volume / load test.
 *
 * The functional suite proves correctness one request at a time and the
 * concurrency probes prove correctness under a handful of simultaneous writes.
 * Neither says anything about behaviour under sustained traffic, which is the
 * gap this closes: how the API holds up with many concurrent clients, whether
 * latency stays usable, and whether anything degrades or errors under pressure.
 *
 * Run against a throwaway backend only:
 *   API=http://127.0.0.1:4000/api node volume.mjs
 *   API=... DURATION=30 CONCURRENCY=50 node volume.mjs
 */
const API = process.env.API ?? "http://127.0.0.1:4000/api";
const DEMO_OTP = process.env.DEMO_OTP ?? "123456";
const DURATION_S = Number(process.env.DURATION ?? 20);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 30);

async function call(path, { method = "GET", token, body } = {}) {
  const started = performance.now();
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    // Drain the body so the socket is released.
    await res.text();
    return { ms: performance.now() - started, status: res.status };
  } catch (e) {
    return { ms: performance.now() - started, status: 0, err: e.message };
  }
}

const freshPhone = () => "9" + Math.floor(100000000 + Math.random() * 899999999);
async function login(phone) {
  await call("/auth/send-otp", { method: "POST", body: { phone } });
  const res = await fetch(`${API}/auth/verify-otp`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone, code: DEMO_OTP }),
  });
  return (await res.json())?.data?.token;
}

function stats(samples) {
  if (!samples.length) return null;
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

/** Hammer one scenario with `workers` concurrent loops for `seconds`. */
async function scenario(name, seconds, workers, fn) {
  const latencies = [];
  const codes = new Map();
  const deadline = Date.now() + seconds * 1000;
  let errors = 0;

  const worker = async () => {
    while (Date.now() < deadline) {
      const r = await fn();
      latencies.push(r.ms);
      codes.set(r.status, (codes.get(r.status) ?? 0) + 1);
      if (r.status === 0 || r.status >= 500) errors++;
    }
  };
  const t0 = performance.now();
  await Promise.all(Array.from({ length: workers }, worker));
  const elapsed = (performance.now() - t0) / 1000;

  const st = stats(latencies);
  const rps = (latencies.length / elapsed).toFixed(1);
  const codeStr = [...codes.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}×${n}`).join(" ");
  const bad = errors > 0 || (st?.p95 ?? 0) > 1000;

  console.log(`\n${bad ? "🔴" : "🟢"} ${name}`);
  console.log(`    ${latencies.length} requests in ${elapsed.toFixed(1)}s → ${rps} req/s across ${workers} concurrent clients`);
  console.log(`    latency ms: p50 ${st.p50}  p95 ${st.p95}  p99 ${st.p99}  max ${st.max}`);
  console.log(`    responses: ${codeStr}${errors ? `   ⚠️ ${errors} server errors/timeouts` : "   no 5xx, no dropped connections"}`);
  return { name, rps: +rps, ...st, errors };
}

const main = async () => {
  const health = await call("/health");
  if (health.status !== 200) { console.error(`backend not reachable at ${API}`); process.exit(1); }

  console.log(`Volume test → ${API}`);
  console.log(`${CONCURRENCY} concurrent clients, ${DURATION_S}s per scenario\n${"─".repeat(64)}`);

  const token = await login(freshPhone());
  const pkgs = (await (await fetch(`${API}/catalog/packages`)).json())?.data ?? [];
  const packageId = pkgs[0]?.id;

  const results = [];

  // 1. The public catalog — every visitor hits this, and it's cacheable work.
  results.push(await scenario("Public catalog read  GET /catalog/packages", DURATION_S, CONCURRENCY,
    () => call("/catalog/packages")));

  // 2. An authenticated read — exercises the per-request auth lookup added for
  //    token revocation, which is the change most likely to cost throughput.
  results.push(await scenario("Authenticated read   GET /bookings", DURATION_S, CONCURRENCY,
    () => call("/bookings", { token })));

  // 3. A write path — booking creation runs pricing, coin checks and dispatch.
  results.push(await scenario("Write + dispatch     POST /bookings", DURATION_S, Math.max(5, Math.floor(CONCURRENCY / 3)),
    () => call("/bookings", { method: "POST", token, body: {
      vehicleType: "hatchback", vehicleName: "Load Test", packageId,
      date: new Date(Date.now() + 86400000).toISOString(), slot: "11:00 AM",
      addressLabel: "Home", addressLine: "1 Load Street",
    } })));

  // 4. The heaviest admin aggregate, which scans bookings/agents/payments.
  const admin = await (await fetch(`${API}/auth/admin-login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "superadmin@gmail.com", password: "password123" }),
  })).json();
  results.push(await scenario("Admin aggregate      GET /admin/stats", DURATION_S, Math.max(5, Math.floor(CONCURRENCY / 3)),
    () => call("/admin/stats", { token: admin?.data?.token })));

  console.log(`\n${"─".repeat(64)}\nSUMMARY`);
  for (const r of results) {
    console.log(`  ${r.name.padEnd(42)} ${String(r.rps).padStart(7)} req/s   p95 ${String(r.p95).padStart(7)}ms   ${r.errors ? `🔴 ${r.errors} errors` : "🟢 clean"}`);
  }
  const failed = results.filter((r) => r.errors > 0);
  console.log(failed.length ? `\n🔴 ${failed.length} scenario(s) produced server errors` : `\n🟢 No server errors under load in any scenario.`);
  process.exit(failed.length ? 1 : 0);
};

main().catch((e) => { console.error("crashed:", e); process.exit(1); });
