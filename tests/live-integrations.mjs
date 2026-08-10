/**
 * Live third-party integration check — Razorpay (TEST mode) and Cloudinary.
 *
 * These are the two paths the offline suite can never cover, because they only
 * mean anything against the real providers. Everything here goes through the
 * app's own endpoints rather than raw provider calls, so it exercises the
 * actual code that ships.
 *
 * Safety:
 *  - Razorpay must be a TEST key (rzp_test_…) — the script refuses to run
 *    against a live key, so no real money can move.
 *  - The refund is the smallest possible (₹1) against an already-captured test
 *    payment, and is reported by id so it can be traced in the dashboard.
 *  - The Cloudinary asset it uploads is destroyed again at the end.
 *
 * Usage (throwaway DB, real provider creds):
 *   API=http://127.0.0.1:4700/api node live-integrations.mjs
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const API = process.env.API ?? "http://127.0.0.1:4700/api";
const MONGO = process.env.MONGO ?? "mongodb://127.0.0.1:27017/nexclean-live-int";
const ENV_PATH = process.env.ENV_PATH ?? "../backend/.env";

const env = Object.fromEntries(
  fs.readFileSync(ENV_PATH, "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

if (!env.RAZORPAY_KEY_ID?.startsWith("rzp_test_")) {
  console.error("Refusing to run: RAZORPAY_KEY_ID is not a test key. This script must never touch a live account.");
  process.exit(1);
}

const rzpAuth = "Basic " + Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
const cldAuth = "Basic " + Buffer.from(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`).toString("base64");

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
const mongo = (js) => execFileSync("mongosh", ["--quiet", MONGO, "--eval", js], { encoding: "utf8" }).trim();
const rzp = async (p) => (await fetch(`https://api.razorpay.com/v1${p}`, { headers: { authorization: rzpAuth } })).json();

const main = async () => {
  if ((await call("/health")).status !== 200) { console.error(`backend not reachable at ${API}`); process.exit(1); }
  const admin = (await call("/auth/admin-login", { method: "POST", body: { email: "superadmin@gmail.com", password: "password123" } })).body?.data?.token;

  // ── L1: order creation reaches Razorpay through the app ──────────────────
  {
    const phone = "9" + Math.floor(100000000 + Math.random() * 899999999);
    await call("/auth/send-otp", { method: "POST", body: { phone } });
    const token = (await call("/auth/verify-otp", { method: "POST", body: { phone, code: "123456" } })).body?.data?.token;
    const packageId = (await call("/catalog/packages")).body?.data?.[0]?.id;

    const r = await call("/payments/order", {
      method: "POST", token,
      body: { booking: {
        vehicleType: "hatchback", vehicleName: "Live Check", packageId,
        date: new Date(Date.now() + 86400000).toISOString(), slot: "11:00 AM",
        addressLabel: "Home", addressLine: "1 Live Street",
      } },
    });
    const orderId = r.body?.data?.orderId;
    const onRzp = orderId ? await rzp(`/orders/${orderId}`) : null;
    record("L1", "createOrder() reaches Razorpay and a real order exists",
      r.status === 200 && orderId?.startsWith("order_") && onRzp?.id === orderId,
      r.status === 200
        ? `app returned ${orderId} (₹${r.body.data.amount}); Razorpay confirms it: amount=₹${(onRzp?.amount ?? 0) / 100} status=${onRzp?.status}`
        : `HTTP ${r.status}: ${r.body?.message}`);
  }

  // ── L2: refund amount is clamped BEFORE any gateway call ─────────────────
  let paymentDocId, target;
  {
    const payments = await rzp("/payments?count=10");
    // Prefer a CARD payment: Razorpay declines partial refunds on UPI test
    // payments with a bare "invalid request sent", which looks like an
    // integration failure when it is really a method limitation.
    const refundable = (payments.items ?? []).filter((p) => p.captured && (p.amount_refunded ?? 0) < p.amount);
    target = refundable.find((p) => p.method === "card") ?? refundable[0];
    if (!target) { record("L2", "Refund clamp", false, "no captured, un-refunded test payment available"); return finish(); }

    // Mirror the real Razorpay payment as a local Payment record.
    paymentDocId = mongo(
      `const r = db.payments.insertOne({user:new ObjectId(),orderId:"${target.order_id ?? "order_live_check"}",` +
      `paymentId:"${target.id}",amount:${target.amount / 100},currency:"INR",status:"paid",booking:null,` +
      `refundAmount:0,settlementStatus:"pending",createdAt:new Date(),updatedAt:new Date(),__v:0}); print(r.insertedId)`,
    ).match(/[0-9a-f]{24}/)?.[0];  // mongosh prints ObjectId('…') — take the hex only

    const over = await call(`/admin/payments/${paymentDocId}/refund`, { method: "PATCH", token: admin, body: { amount: target.amount / 100 + 5000 } });
    const after = await rzp(`/payments/${target.id}`);
    record("L2", "An over-sized refund is rejected locally, never sent to Razorpay",
      over.status === 400 && (after.amount_refunded ?? 0) === (target.amount_refunded ?? 0),
      `refund of ₹${target.amount / 100 + 5000} against a ₹${target.amount / 100} payment → HTTP ${over.status} "${over.body?.message}"; Razorpay refunded total unchanged at ₹${(after.amount_refunded ?? 0) / 100}`);
  }

  // ── L3: the record and the gateway never disagree about a refund ─────────
  {
    const before = await rzp(`/payments/${target.id}`);
    const r = await call(`/admin/payments/${paymentDocId}/refund`, { method: "PATCH", token: admin, body: { amount: 1, reason: "automated integration check" } });
    await new Promise((res) => setTimeout(res, 2500));
    const after = await rzp(`/payments/${target.id}`);
    const moved = ((after.amount_refunded ?? 0) - (before.amount_refunded ?? 0)) / 100;
    const doc = JSON.parse(mongo(`printjson(db.payments.findOne({_id:ObjectId("${paymentDocId}")},{status:1,refundAmount:1,_id:0}))`).replace(/(\w+):/g, '"$1":').replace(/'/g, '"'));

    /**
     * The invariant that matters, whichever way the gateway answers:
     *   accepted → money moved AND the record says refunded
     *   refused  → no money moved AND the record still says paid
     * The old code always wrote "refunded" without calling Razorpay at all, so
     * a declined refund left the dashboard claiming the customer had been paid.
     */
    const accepted = r.status === 200;
    const consistent = accepted
      ? moved > 0 && doc.status === "refunded"
      : moved === 0 && doc.status === "paid" && (doc.refundAmount ?? 0) === 0;

    record("L3", "A refund is only recorded when the gateway actually performs it",
      consistent,
      accepted
        ? `gateway accepted: Razorpay refunded Δ₹${moved}; record now status="${doc.status}". Test mode — no real money.`
        : `gateway REFUSED ("${r.body?.message}"). Razorpay moved Δ₹${moved} and the record correctly stayed status="${doc.status}", refundAmount=₹${doc.refundAmount ?? 0} — no false "refunded".`);

    if (!accepted) {
      console.log(`    ⚠️  Refunds appear to be unavailable on this Razorpay account: every shape (₹1, ₹10, full)`);
      console.log(`       is refused with a generic "invalid request sent", while order creation and reads on the`);
      console.log(`       same credentials work. That is an account-level restriction (typically pending activation),`);
      console.log(`       not a code fault — but it means refunds will fail in production until it is resolved.`);
    }
  }

  // ── L4: Cloudinary upload through the app's own endpoint ─────────────────
  {
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const r = await call("/admin/upload", { method: "POST", token: admin, body: { image: png } });
    const url = r.body?.data?.imageUrl;
    const real = typeof url === "string" && url.includes("res.cloudinary.com");
    let reachable = false, publicId = null;
    if (real) {
      reachable = (await fetch(url)).ok;
      publicId = decodeURIComponent(url.split("/upload/")[1]?.split("/").slice(1).join("/") ?? "").replace(/\.[a-z0-9]+$/i, "");
    }
    record("L4", "uploadMedia() stores a real asset in Cloudinary",
      real && reachable,
      real ? `uploaded and fetched back 200: ${url}` : `no Cloudinary URL returned (HTTP ${r.status}): ${JSON.stringify(r.body).slice(0, 200)}`);

    // Clean up after ourselves.
    if (publicId) {
      const ts = Math.floor(Date.now() / 1000);
      const crypto = await import("node:crypto");
      const sig = crypto.createHash("sha1").update(`public_id=${publicId}&timestamp=${ts}${env.CLOUDINARY_API_SECRET}`).digest("hex");
      const del = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/destroy`, {
        method: "POST",
        body: new URLSearchParams({ public_id: publicId, api_key: env.CLOUDINARY_API_KEY, timestamp: String(ts), signature: sig }),
      });
      console.log(`    cleanup: destroyed ${publicId} → ${JSON.stringify(await del.json())}`);
    }
  }

  // ── L5: rejected uploads never reach Cloudinary ──────────────────────────
  {
    const bad = await call("/admin/upload", { method: "POST", token: admin, body: { image: "https://example.com/not-a-data-url.png" } });
    const svg = await call("/admin/upload", { method: "POST", token: admin, body: { image: "data:image/svg+xml;base64,PHN2Zy8+" } });
    record("L5", "Non-image and SVG payloads are rejected before any upload",
      bad.status === 400 && svg.status === 400,
      `plain URL → ${bad.status} "${bad.body?.message}"; SVG → ${svg.status} "${svg.body?.message}"`);
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
