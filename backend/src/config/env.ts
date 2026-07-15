import "dotenv/config";

/**
 * Typed, centralized environment configuration with dev-friendly defaults so
 * the server boots locally even before a real .env is provided.
 */
export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  mongoUri: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/nexclean",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "30d",
  otpExpiryMin: Number(process.env.OTP_EXPIRY_MIN ?? 5),
  demoOtp: process.env.DEMO_OTP ?? "123456",
  // Comma-separated CORS allow-list, normalized (trailing slashes stripped) so
  // a value like "https://app.vercel.app/" still matches the browser's Origin.
  clientOrigins: (process.env.CLIENT_ORIGIN ?? "http://localhost:5173,https://nexclean.in")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean),
  // Base64-encoded Firebase service-account JSON. When empty, push runs in
  // mock mode (logs instead of sending) so the engine is fully testable offline.
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ?? "",
  // Razorpay test/live keys. When empty, payments run in mock mode (no real
  // charge) so the booking-payment flow is testable without an account.
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  // Demo admin credentials (seeded on startup). Change for production.
  adminEmail: process.env.ADMIN_EMAIL ?? "superadmin@gmail.com",
  adminPassword: process.env.ADMIN_PASSWORD ?? "password123",
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
export const paymentsLive = env.razorpayKeyId.length > 0 && env.razorpayKeySecret.length > 0;
export const cloudinaryEnabled =
  env.cloudinaryCloudName.length > 0 &&
  env.cloudinaryApiKey.length > 0 &&
  env.cloudinaryApiSecret.length > 0;
export const smsEnabled =
  env.smsIndiaHubApiKey.length > 0 ||
  (env.smsIndiaHubUser.length > 0 && env.smsIndiaHubPassword.length > 0);

export const isProd = env.nodeEnv === "production";

