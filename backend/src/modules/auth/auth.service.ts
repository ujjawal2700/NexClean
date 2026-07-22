import { Otp } from "./otp.model";
import { User } from "../user/user.model";
import { creditRefereeWelcome } from "../promotions/referral.service";
import { generateUniqueReferralCode } from "../user/user.service";
import { env } from "../../config/env";
import { ApiError } from "../../shared/utils/ApiError";
import { signToken, type Role } from "../../shared/utils/jwt";
import { generateOtp } from "../../shared/utils/otp";
import type { CustomerSignupInput, AgentSignupInput, AgentSignupBasicInput } from "./auth.validation";
import { verifyPassword, hashPassword } from "../../shared/utils/crypto";

import { sendSmsOtp } from "../../shared/services/sms";

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

  // Dispatch OTP via SMS service (SMSINDIAHUB)
  await sendSmsOtp(phone, code);

  return { sent: true };
}

/** Send an OTP for signup, verifying first that no user already exists with this phone. */
export async function sendSignupOtp(rawPhone: string): Promise<{ sent: boolean }> {
  const phone = normalize(rawPhone);
  const existing = await User.findOne({ phone });
  if (existing) {
    throw ApiError.badRequest("A user already exists with this mobile number. Please log in.");
  }
  return sendOtp(phone);
}

/** Verify an OTP code without creating/upserting a User record. */
export async function verifyOtpCodeOnly(rawPhone: string, code: string): Promise<{ verified: boolean }> {
  const phone = normalize(rawPhone);
  await verifyOtpCode(phone, code);
  return { verified: true };
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

  if (user.status === "suspended") {
    throw ApiError.forbidden("ACCOUNT_DEACTIVATED: Your account is deactivated. Please contact customer support for assistance.");
  }

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

  // New user gets their welcome coins immediately. The referrer is credited
  // later, once this user reaches their first qualifying milestone.
  if (referrer) {
    await creditRefereeWelcome(user.id, referrer.id);
  }

  return sendOtp(phone);
}

/** Register a new agent account with KYC documents (pending admin review) after OTP verification. */
export async function agentSignup(input: AgentSignupInput) {
  const phone = normalize(input.phone);
  let user = await User.findOne({ phone });
  
  if (user) {
    if (user.agentStatus !== "unverified") {
      throw ApiError.badRequest("An account with this number already exists. Please log in.");
    }
    user.aadharNumber = input.aadharNumber;
    user.aadharFrontUrl = input.aadharFront;
    user.aadharBackUrl = input.aadharBack;
    user.agentStatus = "pending";
    await user.save();
  } else {
    user = await User.create({
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
  }

  const token = signToken(user.id, "agent");
  return { token, user, sent: true };
}

/** Create an unverified agent account immediately after OTP verification during signup basic step. */
export async function agentSignupBasic(input: AgentSignupBasicInput) {
  const phone = normalize(input.phone);
  await verifyOtpCode(phone, input.code);

  const existing = await User.findOne({ phone });
  if (existing) {
    throw ApiError.badRequest("An account with this number already exists. Please log in.");
  }

  const user = await User.create({
    phone,
    name: input.name,
    role: "agent",
    area: input.area,
    online: false,
    agentStatus: "unverified",
  });

  const token = signToken(user.id, "agent");
  return { token, user };
}

/** Email + password login for the admin console (verifies against database password). */
export async function adminLogin(email: string, password: string) {
  const emailLower = email.trim().toLowerCase();
  const isSuperAdminEmail = emailLower === env.adminEmail.toLowerCase();

  // 1. Find user in MongoDB by email or superadmin handle
  let user = await User.findOne({
    $or: [
      { email: emailLower, role: "admin" },
      { phone: `admin:${emailLower}`, role: "admin" },
    ],
  }).populate("adminRoleId");

  // 2. If Super Admin logging in for the first time before record exists, seed user
  if (!user && isSuperAdminEmail) {
    user = await User.create({
      phone: `admin:${emailLower}`,
      name: "Admin",
      email: emailLower,
      role: "admin",
      password: hashPassword(env.adminPassword),
    });
  }

  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  // 3. Verify password against DB hash or env fallback
  let isMatch = false;
  if (user.password) {
    isMatch = verifyPassword(password, user.password);
  } else if (isSuperAdminEmail) {
    isMatch = password === env.adminPassword;
    if (isMatch) {
      user.password = hashPassword(password);
      await user.save();
    }
  }

  if (!isMatch) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  if (user.status === "suspended") {
    throw ApiError.forbidden("This account has been suspended. Contact support for help.");
  }

  const token = signToken(user.id, "admin");
  const isSuper = isSuperAdminEmail || user.phone === `admin:${env.adminEmail}` || !user.adminRoleId;
  const role = user.adminRoleId as any;
  const permissions = isSuper ? ["*"] : role ? role.permissions : [];

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      permissions,
    },
  };
}


export async function getMe(userId: string) {
  const user = await User.findById(userId).populate("adminRoleId");
  if (!user) throw ApiError.notFound("User not found");

  let permissions: string[] = [];
  if (user.role === "admin") {
    if (user.phone === `admin:${env.adminEmail}` || !user.adminRoleId) {
      permissions = ["*"];
    } else {
      const role = user.adminRoleId as any;
      permissions = role ? role.permissions : [];
    }
  }

  return {
    ...user.toJSON(),
    permissions,
  };
}
