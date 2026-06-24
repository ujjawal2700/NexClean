import { Otp } from "./otp.model";
import { User } from "../user/user.model";
import { ReferralCampaign } from "../promotions/referralCampaign.model";
import { generateUniqueReferralCode } from "../user/user.service";
import { env } from "../../config/env";
import { ApiError } from "../../shared/utils/ApiError";
import { signToken, type Role } from "../../shared/utils/jwt";
import { generateOtp } from "../../shared/utils/otp";
import type { CustomerSignupInput, AgentSignupInput } from "./auth.validation";

/** Normalize a phone string to a consistent stored form. */
export function normalize(phone: string): string {
  return phone.replace(/\s+/g, "");
}

/** Validate + consume an OTP for a phone, without touching the User collection. */
export async function verifyOtpCode(rawPhone: string, code: string): Promise<void> {
  const phone = normalize(rawPhone);
  const isDemo = code === env.demoOtp;

  if (!isDemo) {
    const record = await Otp.findOne({ phone });
    if (!record) throw ApiError.badRequest("Request a new code");
    if (record.expiresAt.getTime() < Date.now()) throw ApiError.badRequest("Code expired");
    if (record.code !== code) throw ApiError.badRequest("Incorrect code");
  }

  await Otp.deleteOne({ phone });
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
  await verifyOtpCode(phone, code);

  const user = await User.findOneAndUpdate(
    { phone },
    { $setOnInsert: { phone, name: "NexClean Member", role: "customer" } },
    { upsert: true, new: true },
  );

  // Cover accounts created via OTP-only login (no customerSignup) or from before referral codes existed.
  if (user.role === "customer" && !user.referralCode) {
    user.referralCode = await generateUniqueReferralCode(user.name);
    await user.save();
  }

  const token = signToken(user.id, user.role as Role);
  return { token, user };
}

/** Register a new customer account, then send the verification OTP. */
export async function customerSignup(input: CustomerSignupInput) {
  const phone = normalize(input.phone);
  const existing = await User.findOne({ phone });
  if (existing) throw ApiError.badRequest("An account with this number already exists. Please log in.");

  const referralCode = input.referralCode?.trim().toUpperCase();
  const referrer = referralCode ? await User.findOne({ referralCode }) : null;
  if (referralCode && !referrer) throw ApiError.badRequest("Invalid referral code");

  const ownReferralCode = await generateUniqueReferralCode(input.name);

  const user = await User.create({
    phone,
    name: input.name,
    email: input.email ?? "",
    role: "customer",
    referralCode: ownReferralCode,
    referredBy: referrer?.id ?? null,
  });

  // Credit both sides from the first active referral campaign (if one exists).
  if (referrer) {
    const campaign = await ReferralCampaign.findOne({ active: true }).sort({ createdAt: -1 });
    if (campaign) {
      await User.findByIdAndUpdate(referrer.id, { $inc: { referralEarnings: campaign.referrerReward } });
      await User.findByIdAndUpdate(user.id, { $inc: { referralEarnings: campaign.refereeReward } });
    }
  }

  return sendOtp(phone);
}

/** Register a new agent account with KYC documents (pending admin review), then send the OTP. */
export async function agentSignup(input: AgentSignupInput) {
  const phone = normalize(input.phone);
  const existing = await User.findOne({ phone });
  if (existing) throw ApiError.badRequest("An account with this number already exists. Please log in.");

  await User.create({
    phone,
    name: input.name,
    role: "agent",
    area: input.area,
    online: false,
    agentStatus: "pending",
    aadharNumber: input.aadharNumber,
    aadharFrontUrl: input.aadharFront,
    aadharBackUrl: input.aadharBack,
  });

  return sendOtp(phone);
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
