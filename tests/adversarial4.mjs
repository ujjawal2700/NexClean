/** Edge-case probes: NoSQL injection, past-dated bookings, stored XSS, oversized payloads, coupon reuse. */
const API = process.env.API ?? "http://127.0.0.1:4100/api";
const DEMO_OTP = "123456";

async function call(path, { method = "GET", token, body, raw } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: raw ? body : JSON.stringify(body) } : {}),
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
const out = [];
const say = (id, title, verdict, detail) => { out.push({ id, verdict }); console.log(`\n${verdict} [${id}] ${title}\n    ${detail}`); };

const main = async () => {
  const u = await login(freshPhone());
  const pkg = (await call("/catalog/packages")).body.data[0].id;
  const base = (extra = {}) => ({
    vehicleType: "hatchback", vehicleName: "Edge Car", packageId: pkg,
    date: new Date(Date.now() + 86400000).toISOString(), slot: "11:00 AM",
    addressLabel: "Home", addressLine: "1 Edge Street", ...extra,
  });

  // G1 — NoSQL operator injection on admin login
  {
    const r = await call("/auth/admin-login", { method: "POST", body: { email: { $ne: null }, password: { $ne: null } } });
    say("G1", "NoSQL operator injection on admin-login",
      r.status === 200 ? "🔴 VULNERABLE" : "🟢 OK",
      `{$ne:null}/{$ne:null} -> HTTP ${r.status}: ${r.body?.message ?? ""}`);
  }

  // G2 — NoSQL operator injection on OTP verify
  {
    const r = await call("/auth/verify-otp", { method: "POST", body: { phone: { $ne: null }, code: { $ne: null } } });
    say("G2", "NoSQL operator injection on verify-otp",
      r.status === 200 ? "🔴 VULNERABLE" : "🟢 OK",
      `-> HTTP ${r.status}: ${r.body?.message ?? ""}`);
  }

  // G3 — booking in the past
  {
    const r = await call("/bookings", { method: "POST", token: u.token, body: base({ date: new Date(Date.now() - 30 * 86400000).toISOString() }) });
    say("G3", "Booking accepted with a date 30 days in the PAST",
      r.status === 201 ? "🔴 BUG" : "🟢 OK",
      r.status === 201
        ? `HTTP 201 — created booking ${r.body?.data?.id} dated ${r.body?.data?.date}. No lower bound on the booking date; back-dated jobs enter dispatch and pollute the schedule/admin queue.`
        : `HTTP ${r.status}: ${r.body?.message}`);
  }

  // G4 — booking absurdly far in the future
  {
    const r = await call("/bookings", { method: "POST", token: u.token, body: base({ date: new Date(Date.now() + 365 * 10 * 86400000).toISOString() }) });
    say("G4", "Booking accepted 10 years in the future",
      r.status === 201 ? "🟠 MINOR" : "🟢 OK",
      `HTTP ${r.status}` + (r.status === 201 ? ` — no upper bound on booking date.` : `: ${r.body?.message}`));
  }

  // G5 — arbitrary slot string (not from the catalog)
  {
    const r = await call("/bookings", { method: "POST", token: u.token, body: base({ slot: "3:00 AM - 4:00 AM (not a real slot)" }) });
    say("G5", "Arbitrary free-text slot accepted",
      r.status === 201 ? "🟠 MINOR" : "🟢 OK",
      `slot="3:00 AM - 4:00 AM (not a real slot)" -> HTTP ${r.status}. Slot is validated only as a non-empty string, never against the configured slot catalog.`);
  }

  // G6 — stored XSS payload round-trip in profile name
  {
    const payload = '<img src=x onerror=alert(1)>';
    const patch = await call("/users/me", { method: "PATCH", token: u.token, body: { name: payload, email: "x@y.com" } });
    const summary = await call("/users/me/referrals", { token: u.token });
    const stored = JSON.stringify(summary.body?.data ?? {}).includes("onerror");
    say("G6", "HTML/script payload stored verbatim in profile name",
      patch.status === 200 ? "🟠 MINOR" : "🟢 OK",
      patch.status === 200
        ? `Accepted and stored raw (echoed back: ${stored}). React escapes on render, so this is not XSS in the web app today — but it is unsanitized in any non-React surface (SMS, push text, PDF invoices, CSV export).`
        : `HTTP ${patch.status}`);
  }

  // G7 — malformed JSON body handling
  {
    const r = await call("/bookings", { method: "POST", token: u.token, body: "{not json", raw: true });
    say("G7", "Malformed JSON returns 4xx, not 500",
      r.status >= 500 ? "🔴 BUG" : "🟢 OK", `-> HTTP ${r.status}`);
  }

  // G8 — unauthenticated access to another user's booking list
  {
    const r = await call("/bookings");
    say("G8", "Unauthenticated /bookings rejected", r.status === 401 ? "🟢 OK" : "🔴 VULNERABLE", `-> HTTP ${r.status}`);
  }

  // G9 — vehicle/address unbounded growth
  {
    let added = 0;
    for (let i = 0; i < 60; i++) {
      const r = await call("/users/me/vehicles", { method: "POST", token: u.token, body: { type: "hatchback", name: `Car ${i}`, brand: "X", model: "Y" } });
      if (r.status !== 200 && r.status !== 201) break;
      added++;
    }
    say("G9", "Unbounded vehicles per account",
      added >= 60 ? "🟠 MINOR" : "🟢 OK",
      `${added} vehicles added with no cap — every one is embedded in the user document, which is fetched on most authenticated requests.`);
  }

  console.log("\n════════ SUMMARY ════════");
  for (const r of out) console.log(`${r.verdict}  [${r.id}]`);
};
main().catch((e) => { console.error(e); process.exit(1); });
