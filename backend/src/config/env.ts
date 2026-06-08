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
};

export const isProd = env.nodeEnv === "production";
