import { Otp } from "./otp.model";
import { User } from "../user/user.model";
import { env } from "../../config/env";
import { ApiError } from "../../shared/utils/ApiError";
import { signToken, type Role } from "../../shared/utils/jwt";
import { generateOtp } from "../../shared/utils/otp";

/** Normalize a phone string to a consistent stored form. */
function normalize(phone: string): string {
  return phone.replace(/\s+/g, "");
}

/**
 * Create + "send" an OTP. In this build the code is logged to the server
 * console (no SMS provider yet); the demo code from env also always works.
 */
export async function sendOtp(rawPhone: string): Promise<{ sent: boolean }> {
  const phone = normalize(rawPhone);
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + env.otpExpiryMin * 60 * 1000);

  await Otp.findOneAndUpdate(
    { phone },
    { phone, code, expiresAt, attempts: 0 },
    { upsert: true, new: true },
  );

  console.log(`📲 OTP for ${phone}: ${code} (demo ${env.demoOtp} also works)`);
  return { sent: true };
}

/** Verify an OTP, upsert the user, and return a JWT + the user. */
export async function verifyOtp(rawPhone: string, code: string) {
  const phone = normalize(rawPhone);
  const isDemo = code === env.demoOtp;

  if (!isDemo) {
    const record = await Otp.findOne({ phone });
    if (!record) throw ApiError.badRequest("Request a new code");
    if (record.expiresAt.getTime() < Date.now()) throw ApiError.badRequest("Code expired");
    if (record.code !== code) throw ApiError.badRequest("Incorrect code");
  }

  await Otp.deleteOne({ phone });

  const user = await User.findOneAndUpdate(
    { phone },
    { $setOnInsert: { phone, name: "NexClean Member", role: "customer" } },
    { upsert: true, new: true },
  );

  const token = signToken(user.id, user.role as Role);
  return { token, user };
}

/** Email + password login for the admin console (seeded demo credentials). */
export async function adminLogin(email: string, password: string) {
  if (email.trim().toLowerCase() !== env.adminEmail.toLowerCase() || password !== env.adminPassword) {
    throw ApiError.unauthorized("Invalid email or password");
  }
  const user = await User.findOneAndUpdate(
    { phone: `admin:${env.adminEmail}` },
    { $setOnInsert: { phone: `admin:${env.adminEmail}`, name: "Admin", role: "admin" } },
    { upsert: true, new: true },
  );
  const token = signToken(user.id, "admin");
  return { token, user };
}

export async function getMe(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  return user;
}
