import { Otp } from "./otp.model";
import { User } from "../user/user.model";
import { creditRefereeWelcome } from "../promotions/referral.service";
import { generateUniqueReferralCode } from "../user/user.service";
import { env, isProd } from "../../config/env";
import { ApiError } from "../../shared/utils/ApiError";
import { isSuperAdmin } from "../../shared/utils/superAdmin";
import { signToken, type Role } from "../../shared/utils/jwt";
import { generateOtp } from "../../shared/utils/otp";
import type { CustomerSignupInput, AgentSignupInput, AgentSignupBasicInput } from "./auth.validation";

/** Where a signup came from, used purely for referral-abuse detection. */
export type SignupOrigin = { ip?: string; deviceId?: string };
import { verifyPassword, hashPassword } from "../../shared/utils/crypto";

import { sendSmsOtp } from "../../shared/services/sms";

/** Normalize a phone string to a consistent stored form. */
export function normalize(phone: string): string {
  return phone.replace(/\s+/g, "");
}

/** Wrong codes allowed against a single OTP before it is burned. */
const MAX_OTP_ATTEMPTS = 5;

/** Validate + consume an OTP for a phone, without touching the User collection. */
export async function verifyOtpCode(rawPhone: string, code: string): Promise<void> {
  const phone = normalize(rawPhone);

  // The demo code short-circuits OTP for ANY phone number, so it is a master
  // password by definition. Outside production it is a convenience; inside it
  // requires ALLOW_DEMO_LOGIN, which assertProductionConfig() warns about on
  // every boot. Without SMS credentials this is the only way anyone can log in,
  // so a demo deployment needs it — a live one must not have it.
  if ((!isProd || env.allowDemoLogin) && env.demoOtp && code === env.demoOtp) {
    await Otp.deleteOne({ phone });
    return;
  }

  const record = await Otp.findOne({ phone });
  if (!record) throw ApiError.badRequest("Request a new code");
  if (record.expiresAt.getTime() < Date.now()) {
    await Otp.deleteOne({ phone });
    throw ApiError.badRequest("Code expired");
  }

  if (record.code !== code) {
    // Count the miss and burn the code once the budget is gone, so a 6-digit
    // secret can't be walked through exhaustively. `attempts` was already on
    // the model but nothing ever incremented it.
    const attempts = (record.attempts ?? 0) + 1;
    if (attempts >= MAX_OTP_ATTEMPTS) {
      await Otp.deleteOne({ phone });
      throw ApiError.badRequest("Too many incorrect attempts. Request a new code.");
    }
    await Otp.updateOne({ _id: record._id }, { $set: { attempts } });
    throw ApiError.badRequest("Incorrect code");
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

/** Send an OTP for login, verifying first that a user exists with this phone. */
export async function sendLoginOtp(rawPhone: string): Promise<{ sent: boolean }> {
  const phone = normalize(rawPhone);
  const existing = await User.findOne({ phone });
  if (!existing) {
    throw ApiError.notFound("NOT_REGISTERED: This mobile number is not registered. Kindly sign up first.");
  }
  if (existing.status === "suspended") {
    throw ApiError.forbidden("ACCOUNT_DEACTIVATED: Your account is deactivated. Please contact customer support for assistance.");
  }
  return sendOtp(phone);
}

/** Verify an OTP code without creating/upserting a User record. */
export async function verifyOtpCodeOnly(rawPhone: string, code: string): Promise<{ verified: boolean }> {
  const phone = normalize(rawPhone);
  await verifyOtpCode(phone, code);
  return { verified: true };
}

/** Verify an OTP and return a JWT + the user. Rejects unregistered users. */
export async function verifyOtp(rawPhone: string, code: string) {
  const phone = normalize(rawPhone);
  await verifyOtpCode(phone, code);

  const user = await User.findOne({ phone });
  if (!user) {
    throw ApiError.notFound("NOT_REGISTERED: This mobile number is not registered. Kindly sign up first.");
  }

  if (user.status === "suspended") {
    throw ApiError.forbidden("ACCOUNT_DEACTIVATED: Your account is deactivated. Please contact customer support for assistance.");
  }

  // Cover accounts created from before referral codes existed.
  if (user.role === "customer" && !user.referralCode) {
    user.referralCode = await generateUniqueReferralCode(user.name);
    await user.save();
  }

  const token = signToken(user.id, user.role as Role, user.tokenVersion ?? 0);
  return { token, user };
}

/**
 * How many referral-bonus signups one device/IP may claim before further ones
 * are treated as farming. Deliberately generous: a household or a society's
 * shared WiFi legitimately produces a handful.
 */
const REFERRAL_SIGNUPS_PER_ORIGIN = 3;
const REFERRAL_WINDOW_DAYS = 30;

/**
 * Has this device/IP already claimed its share of welcome bonuses?
 *
 * One person can always create several accounts — they only need more phone
 * numbers, and nothing on the internet can truly prevent that. What this stops
 * is doing it *profitably*: past the threshold the account is still created and
 * fully usable, but the welcome coins are withheld and the signup is flagged
 * for review. Blocking the signup itself would be wrong — Indian mobile
 * carriers put thousands of real customers behind one NAT address.
 */
async function isLikelyReferralFarming(ip: string, deviceId: string): Promise<boolean> {
  const since = new Date(Date.now() - REFERRAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const origins: Record<string, unknown>[] = [];
  if (deviceId) origins.push({ signupDeviceId: deviceId });
  if (ip) origins.push({ signupIp: ip });
  if (!origins.length) return false;

  const priorClaims = await User.countDocuments({
    $or: origins,
    referredBy: { $ne: null },
    createdAt: { $gte: since },
  });
  return priorClaims >= REFERRAL_SIGNUPS_PER_ORIGIN;
}

/** Register a new customer account, then send the verification OTP. */
export async function customerSignup(input: CustomerSignupInput, origin: SignupOrigin = {}) {
  const phone = normalize(input.phone);
  const existing = await User.findOne({ phone });
  if (existing) throw ApiError.badRequest("An account with this number already exists. Please log in.");

  const referralCode = input.referralCode?.trim().toUpperCase();
  const referrer = referralCode ? await User.findOne({ referralCode }) : null;
  if (referralCode && !referrer) throw ApiError.badRequest("Invalid referral code");

  const ip = (origin.ip ?? "").trim();
  const deviceId = (input.deviceId ?? origin.deviceId ?? "").trim();

  // You cannot refer yourself: the code must belong to someone else's account.
  if (referrer && referrer.phone === phone) {
    throw ApiError.badRequest("You can't use your own referral code");
  }

  const farming = referrer ? await isLikelyReferralFarming(ip, deviceId) : false;

  const ownReferralCode = await generateUniqueReferralCode(input.name);

  const user = await User.create({
    phone,
    name: input.name,
    email: input.email ?? "",
    role: "customer",
    referralCode: ownReferralCode,
    referredBy: referrer?.id ?? null,
    signupIp: ip,
    signupDeviceId: deviceId,
    referralFlagged: farming,
  });

  // New user gets their welcome coins immediately. The referrer is credited
  // later, once this user reaches their first qualifying milestone — and
  // maybeCreditReferrer() skips flagged accounts, so a farmed signup pays out
  // at neither end.
  if (referrer && !farming) {
    await creditRefereeWelcome(user.id, referrer.id);
  } else if (farming) {
    console.warn(
      `[referral] withheld welcome bonus for ${phone}: ${REFERRAL_SIGNUPS_PER_ORIGIN}+ referred signups already from device=${deviceId || "?"} ip=${ip || "?"}`,
    );
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
    // The KYC step re-submits the details form, so a cleaner who corrected
    // their location between the two steps gets the corrected value.
    if (input.city) user.city = input.city;
    if (input.area) user.area = input.area;
    await user.save();
  } else {
    user = await User.create({
      phone,
      name: input.name,
      role: "agent",
      city: input.city ?? "",
      area: input.area ?? "",
      online: false,
      agentStatus: "pending",
      aadharNumber: input.aadharNumber,
      aadharFrontUrl: input.aadharFront,
      aadharBackUrl: input.aadharBack,
    });
  }

  const token = signToken(user.id, "agent", user.tokenVersion ?? 0);
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
    city: input.city,
    area: input.area ?? "",
    online: false,
    agentStatus: "unverified",
  });

  const token = signToken(user.id, "agent", user.tokenVersion ?? 0);
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

  const token = signToken(user.id, "admin", user.tokenVersion ?? 0);
  const isSuper = isSuperAdminEmail || isSuperAdmin(user);
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
    if (isSuperAdmin(user)) {
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
