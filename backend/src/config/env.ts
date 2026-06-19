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
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  // Base64-encoded Firebase service-account JSON. When empty, push runs in
  // mock mode (logs instead of sending) so the engine is fully testable offline.
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ?? "",
  // Razorpay test/live keys. When empty, payments run in mock mode (no real
  // charge) so the booking-payment flow is testable without an account.
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  // Demo admin credentials (seeded on startup). Change for production.
  adminEmail: process.env.ADMIN_EMAIL ?? "admin@nexclean.com",
  adminPassword: process.env.ADMIN_PASSWORD ?? "admin123",
};

export const pushEnabled = env.firebaseServiceAccount.length > 0;
export const paymentsLive = env.razorpayKeyId.length > 0 && env.razorpayKeySecret.length > 0;

export const isProd = env.nodeEnv === "production";
