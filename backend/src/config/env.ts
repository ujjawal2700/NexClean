import "dotenv/config";

/**
 * Typed, centralized environment configuration with dev-friendly defaults so
 * the server boots locally even before a real .env is provided.
 */
export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  mongoUri: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/nexclean",
  // Redis backs the Socket.IO adapter so real-time events (dispatch offers,
  // chat, notifications) reach clients connected to any PM2 cluster worker,
  // not just the one that emitted them. Unset in single-instance/dev mode.
  redisUrl: process.env.REDIS_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "30d",
  otpExpiryMin: Number(process.env.OTP_EXPIRY_MIN ?? 5),
  demoOtp: process.env.DEMO_OTP ?? "123456",
  // Comma-separated CORS allow-list, normalized (trailing slashes stripped) so
  // a value like "https://app.vercel.app/" still matches the browser's Origin.
  // Production domains are always included so a blank/misconfigured
  // CLIENT_ORIGIN on the host (e.g. Render) can't lock out the live site —
  // `??` alone doesn't catch an env var set to "", which previously resolved
  // to an empty allow-list and blocked every origin.
  clientOrigins: Array.from(
    new Set(
      [
        ...(process.env.CLIENT_ORIGIN ?? "").split(","),
        "http://localhost:5173",
        "https://nexclean.in",
        "https://www.nexclean.in",
      ]
        .map((s) => s.trim().replace(/\/+$/, ""))
        .filter(Boolean),
    ),
  ),
  // Base64-encoded Firebase service-account JSON. When empty, push runs in
  // mock mode (logs instead of sending) so the engine is fully testable offline.
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ?? "",
  // Razorpay keys. Only consulted when PAYMENTS_ONLINE is explicitly enabled.
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  // Collection mode. The product today is pay-to-cleaner: the customer confirms
  // a booking in the app and hands cash to the cleaner after the service (see
  // the "Pay to cleaner …" button in BookingFlow). Online checkout stays behind
  // this opt-in flag. It is a DELIBERATE flag rather than "are Razorpay keys
  // present?" — inferring it from key presence silently switched the server
  // into online mode while the client still sent no payment fields, and every
  // booking failed with "Missing payment confirmation fields".
  paymentsOnline: (process.env.PAYMENTS_ONLINE ?? "").toLowerCase() === "true",
  // Demo admin credentials (seeded on startup). Change for production.
  adminEmail: process.env.ADMIN_EMAIL ?? "superadmin@gmail.com",
  adminPassword: process.env.ADMIN_PASSWORD ?? "password123",
  // Escape hatch for a production-flagged host that is still a demo: keeps the
  // DEMO_OTP master code and the default admin password working. It exists
  // because OTP is the only login path for customers and cleaners, so a
  // deployment without a working SMS provider has no other way in.
  //
  // While this is on, ANYONE who knows the demo code can sign in as ANY phone
  // number. It must be removed before real customers are onboarded — see
  // assertProductionConfig(), which prints that warning on every boot.
  allowDemoLogin: (process.env.ALLOW_DEMO_LOGIN ?? "").toLowerCase() === "true",
  // Cloudinary credentials for media upload
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  // SMSIndiaHub Integration Settings
  smsIndiaHubUser: process.env.SMS_INDIA_HUB_USER ?? "",
  smsIndiaHubPassword: process.env.SMS_INDIA_HUB_PASSWORD ?? "",
  smsIndiaHubApiKey: process.env.SMS_INDIA_HUB_API_KEY ?? "",
  smsIndiaHubSenderId: process.env.SMS_INDIA_HUB_SENDER_ID ?? "",
  smsIndiaHubEntityId: process.env.SMS_INDIA_HUB_ENTITY_ID ?? "",
  smsIndiaHubTemplateId: process.env.SMS_INDIA_HUB_TEMPLATE_ID ?? "",
  smsIndiaHubGwid: process.env.SMS_INDIA_HUB_GWID ?? "2",
  smsIndiaHubTemplate: process.env.SMS_INDIA_HUB_TEMPLATE ?? "Welcome to the NexClean powered by Appzeto.Your OTP for registration is {{otp}}.BGADEC",
};

export const pushEnabled = env.firebaseServiceAccount.length > 0;
/** True only when online checkout is explicitly switched on AND keys exist. */
export const paymentsLive =
  env.paymentsOnline && env.razorpayKeyId.length > 0 && env.razorpayKeySecret.length > 0;
export const cloudinaryEnabled =
  env.cloudinaryCloudName.length > 0 &&
  env.cloudinaryApiKey.length > 0 &&
  env.cloudinaryApiSecret.length > 0;
export const smsEnabled =
  env.nodeEnv !== "test" &&
  (env.smsIndiaHubApiKey.length > 0 ||
    (env.smsIndiaHubUser.length > 0 && env.smsIndiaHubPassword.length > 0));

export const isProd = env.nodeEnv === "production";

/**
 * Include stack traces in API error responses. Opt-in and never on in
 * production, so the setting can't be inherited by accident from a NODE_ENV
 * that was left at "development" on a live host.
 */
export const debugErrors = !isProd && (process.env.DEBUG_ERRORS ?? "").toLowerCase() === "true";

/**
 * Values that must never reach production still carrying their dev fallback.
 *
 * `demoWaivable` marks the ones ALLOW_DEMO_LOGIN may downgrade to a warning.
 * JWT_SECRET is not among them: a known signing key lets anyone mint a token
 * for any account, including admin, which no demo convenience justifies.
 */
const INSECURE_DEFAULTS: Array<[label: string, value: string, bad: string, demoWaivable: boolean]> = [
  ["JWT_SECRET", env.jwtSecret, "dev-secret-change-me", false],
  ["ADMIN_PASSWORD", env.adminPassword, "password123", true],
];

/**
 * Refuse to boot a production server that is still using development
 * fallbacks. Previously a missing JWT_SECRET silently resolved to
 * "dev-secret-change-me", which makes every token in the system forgeable by
 * anyone who has read this repository — a startup crash is far safer than a
 * server that looks healthy while accepting counterfeit tokens.
 */
export function assertProductionConfig(): void {
  if (!isProd) return;

  const problems: string[] = [];
  const waived: string[] = [];

  for (const [label, value, bad, demoWaivable] of INSECURE_DEFAULTS) {
    if (!value || value === bad) {
      const msg = `${label} is unset or still the development default`;
      if (demoWaivable && env.allowDemoLogin) waived.push(msg);
      else problems.push(msg);
    }
  }
  // A demo code that bypasses OTP for EVERY phone number must never ship.
  if (env.demoOtp) {
    const msg = "DEMO_OTP is set — it accepts any phone number";
    if (env.allowDemoLogin) waived.push(msg);
    else problems.push(`${msg} and must be empty in production`);
  }
  if (env.paymentsOnline && (!env.razorpayKeyId || !env.razorpayKeySecret)) {
    problems.push("PAYMENTS_ONLINE=true but RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are missing");
  }
  if (env.paymentsOnline && env.razorpayKeyId.startsWith("rzp_test_")) {
    problems.push("RAZORPAY_KEY_ID is a TEST key — live payments would never be captured");
  }

  if (problems.length) {
    throw new Error(
      `Refusing to start in production with an unsafe configuration:\n  - ${problems.join("\n  - ")}`,
    );
  }

  // Loud on every boot, deliberately. A demo bypass that runs quietly is one
  // that survives into the real launch because nobody remembered it was there.
  if (waived.length) {
    console.warn(
      `\n⚠️  ALLOW_DEMO_LOGIN=true — this production server is running with demo credentials:\n  - ${waived.join(
        "\n  - ",
      )}\n   Anyone who knows the demo code can sign in as any phone number.\n   Remove ALLOW_DEMO_LOGIN before onboarding real customers.\n`,
    );
  }
}

