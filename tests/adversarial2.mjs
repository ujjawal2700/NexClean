/** Follow-up probes for C2 (suspended-token revocation) and D2 (self-referral), using real endpoints. */
const API = process.env.API ?? "http://127.0.0.1:4100/api";
const DEMO_OTP = "123456";

async function call(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
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

const main = async () => {
  const admin = (await call("/auth/admin-login", { method: "POST", body: { email: "superadmin@gmail.com", password: "password123" } })).body?.data?.token;

  // C2 — does an already-issued JWT keep working after the account is suspended?
  const victim = await login(freshPhone());
  const before = await call("/bookings", { token: victim.token });
  const susp = await call(`/admin/customers/${victim.userId}/status`, { method: "PATCH", token: admin, body: { status: "suspended" } });
  const after = await call("/bookings", { token: victim.token });
  const relogin = await call("/auth/verify-otp", { method: "POST", body: { phone: "x", code: DEMO_OTP } });
  console.log(`\n[C2] suspended-account token revocation`);
  console.log(`   before suspend : GET /bookings -> ${before.status}`);
  console.log(`   suspend call   : PATCH /admin/customers/:id/status -> ${susp.status}`);
  console.log(`   after suspend  : GET /bookings -> ${after.status}`);
  console.log(`   => ${before.status === 200 && susp.status === 200 && after.status === 200
    ? "🔴 VULNERABLE: token still fully valid after suspension (no revocation; 30-day JWT)."
    : "🟢 OK / inconclusive"}`);

  // D2 — can a brand-new account redeem the referral code of an account you also control?
  const referrer = await login(freshPhone());
  const summary = await call("/users/me/referrals", { token: referrer.token });
  const code = summary.body?.data?.referralCode ?? summary.body?.data?.code;
  console.log(`\n[D2] self-referral farming`);
  console.log(`   referrer code  : ${code ?? "(unreadable) " + JSON.stringify(summary.body?.data)?.slice(0, 200)}`);
  if (code) {
    const r = await call("/auth/customer/signup", { method: "POST", body: { name: "Self Referrer", phone: freshPhone(), referralCode: code } });
    console.log(`   signup w/ code : ${r.status} ${r.body?.message ?? ""}`);
    const w = await call("/wallet", { token: referrer.token });
    console.log(`   referrer wallet: ${JSON.stringify(w.body?.data)}`);
    // A 404 means the probe is pointed at a route that no longer exists — that
    // is a broken probe, not a passing one. Say so loudly, because the previous
    // `status !== 200` test reported a stale URL as "🟢 rejected" for months.
    const accepted = r.status >= 200 && r.status < 300;
    console.log(`   => ${
      r.status === 404
        ? "🔧 PROBE BROKEN — signup route not found; this probe proved nothing."
        : accepted
          ? "⚠️  Accepted — no device/identity guard against one person farming with multiple numbers (business-policy call)."
          : "🟢 rejected"}`);
  }
};
main().catch((e) => { console.error(e); process.exit(1); });
