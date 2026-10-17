import { Otp } from "./otp.model";
import { User } from "../user/user.model";
import { creditRefereeWelcome } from "../promotions/referral.service";
import { generateUniqueReferralCode } from "../user/user.service";
import { emailEnabled, env, isProd } from "../../config/env";
import { ApiError } from "../../shared/utils/ApiError";
import { isSuperAdmin } from "../../shared/utils/superAdmin";
import { signToken, signDeviceSwitchTicket, verifyDeviceSwitchTicket, type Role } from "../../shared/utils/jwt";
import { endUserSessions } from "../../shared/services/socket";
import { isRealPushToken } from "../user/presence";
import { generateOtp } from "../../shared/utils/otp";
import type { CustomerSignupInput, AgentSignupInput, AgentSignupBasicInput } from "./auth.validation";
import { LEGAL_DOCUMENT_VERSION } from "../../shared/legalDocuments";
import { verifyPassword, hashPassword } from "../../shared/utils/crypto";
import { sendSmsOtp } from "../../shared/services/sms";
import { sendAdminPasswordResetEmail } from "../../shared/services/email";
import { uploadImage } from "../../shared/utils/cloudinary";

/** Where a signup came from, used purely for referral-abuse detection. */
export type SignupOrigin = { ip?: string; deviceId?: string; userAgent?: string };

function legalConsent(source: "customer_signup" | "agent_signup", origin: SignupOrigin) {
  return {
    privacyPolicyVersion: LEGAL_DOCUMENT_VERSION,
    termsVersion: LEGAL_DOCUMENT_VERSION,
    acceptedAt: new Date(),
    source,
    ipAddress: (origin.ip ?? "").trim(),
    userAgent: (origin.userAgent ?? "").slice(0, 500),
  };
}

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

/**
 * Send an OTP for login, verifying first that a user exists with this phone.
 * With `role: "agent"` the account must also be an agent's — checked here so
 * the agent app can say so before an OTP is spent, not after the code is typed.
 */
export async function sendLoginOtp(
  rawPhone: string,
  role?: "customer" | "agent",
): Promise<{ sent: boolean }> {
  const phone = normalize(rawPhone);
  const existing = await User.findOne({ phone });
  if (!existing) {
    throw ApiError.notFound("NOT_REGISTERED: This mobile number is not registered. Kindly sign up first.");
  }
  if (role === "agent" && existing.role !== "agent") {
    throw ApiError.badRequest(
      "NOT_AN_AGENT: This number belongs to a customer account. Use a different number to sign up as an agent.",
    );
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

/** The OTP was right, but this cleaner is signed in on another phone — ask before taking over. */
export type DeviceSwitchRequired = { deviceSwitchRequired: true; switchTicket: string };

/**
 * Verify an OTP and return a JWT + the user. Rejects unregistered users.
 *
 * A cleaner may be signed in on one phone at a time. Logging in from a
 * different install returns a switch ticket instead of a session; the app
 * asks the cleaner to confirm, then exchanges it via confirmAgentDeviceSwitch.
 */
export async function verifyOtp(
  rawPhone: string,
  code: string,
  deviceId = "",
): Promise<{ token: string; user: InstanceType<typeof User> } | DeviceSwitchRequired> {
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

  if (user.role === "agent") {
    if (user.agentDeviceId && user.agentDeviceId !== deviceId) {
      return {
        deviceSwitchRequired: true,
        switchTicket: signDeviceSwitchTicket(user.id, deviceId, user.tokenVersion ?? 0),
      };
    }
    if (deviceId && user.agentDeviceId !== deviceId) {
      user.agentDeviceId = deviceId;
      await user.save();
    }
  }

  const token = signToken(user.id, user.role as Role, user.tokenVersion ?? 0);
  return { token, user };
}

/**
 * The cleaner confirmed "log in here and sign the other phone out". Bumping
 * tokenVersion kills every session issued before now, on every device; the
 * live sockets are told and cut so the old phone reacts at once instead of on
 * its next request. The new session is minted at the new version.
 */
export async function confirmAgentDeviceSwitch(ticket: string, deviceId = "") {
  const claims = verifyDeviceSwitchTicket(ticket);
  if (!claims || claims.dev !== deviceId) {
    throw ApiError.badRequest("This login request has expired. Please sign in again.");
  }
  // Revoke every push registration with the old session, including legacy
  // tokens with no device mapping. The new phone re-registers its saved token
  // after login; an unattributed token must never keep a signed-out phone ringing.
  const user = await User.findOneAndUpdate(
    { _id: claims.sub, role: "agent", status: { $ne: "suspended" }, tokenVersion: claims.ver },
    {
      $inc: { tokenVersion: 1 },
      $set: { agentDeviceId: deviceId || null, online: false, deviceTokens: [], pushTokenDevices: [] },
    },
    { new: true },
  );
  if (!user) throw ApiError.badRequest("This login request has expired. Please sign in again.");

  void endUserSessions(user.id, "session_replaced", user.tokenVersion ?? 0);
  const token = signToken(user.id, "agent", user.tokenVersion ?? 0);
  return { token, user };
}

/**
 * Forget this install as the cleaner's signed-in phone on a deliberate logout,
 * so their next login elsewhere doesn't ask to sign out a phone that already
 * signed itself out. Only the current session on that same install counts.
 */
export async function releaseAgentDevice(
  userId: string,
  tokenVersion: number,
): Promise<void> {
  // Revoke the session and all registrations atomically. Native tokens may
  // rotate or never reach localStorage, so client tokens are not authoritative.
  // A replaced session matches nothing and cannot sign the new phone out.
  const user = await User.findOneAndUpdate(
    { _id: userId, role: "agent", tokenVersion },
    {
      $inc: { tokenVersion: 1 },
      $set: { online: false, agentDeviceId: null, deviceTokens: [], pushTokenDevices: [] },
    },
    { new: true },
  );
  if (user) await endUserSessions(user.id, "session_replaced", user.tokenVersion ?? 0);
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

/**
 * Pre-signup check behind the "Verify" button. Applies the same rules signup
 * does, so a code that passes here won't be refused a step later. Returns only
 * the referrer's first name and last initial — enough for the new customer to
 * recognise who invited them, without the endpoint becoming a way to look up
 * full names by guessing codes.
 */
export async function checkReferralCode(rawCode: string, rawPhone?: string) {
  const referralCode = rawCode.trim().toUpperCase();
  const referrer = await User.findOne({ referralCode }).select("name phone").lean();
  if (!referrer) throw ApiError.badRequest("Invalid referral code");
  if (rawPhone && referrer.phone === normalize(rawPhone)) {
    throw ApiError.badRequest("You can't use your own referral code");
  }
  const [first = "", ...rest] = (referrer.name ?? "").trim().split(/\s+/);
  const lastInitial = rest.length ? ` ${rest[rest.length - 1][0].toUpperCase()}.` : "";
  return { valid: true, referrerName: `${first}${lastInitial}` || "a NexClean customer" };
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
    legalConsent: legalConsent("customer_signup", origin),
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

/**
 * The KYC step of cleaner signup, for the signed-in cleaner only.
 *
 * The account comes from the session, never from the phone number in the
 * body. This used to look the account up by phone with no proof of owning it:
 * anyone who knew a new applicant's number could overwrite their KYC and be
 * handed a session for their account, and an unknown number got a brand-new
 * account without an OTP. Accounts are now created only by signup-basic,
 * which checks the OTP; this step just completes one.
 */
export async function agentSignup(userId: string, input: AgentSignupInput, origin: SignupOrigin = {}) {
  const user = await User.findOne({ _id: userId, role: "agent" });
  if (!user) throw ApiError.unauthorized("Please verify your phone number first.");
  if (user.agentStatus !== "unverified" && user.agentStatus !== "pending") {
    throw ApiError.badRequest("Your application has already been reviewed. Please log in.");
  }
  if (!user.legalConsent && (!input.privacyAccepted || !input.termsAccepted)) {
    throw ApiError.badRequest("Please accept the Privacy Policy and Terms & Conditions");
  }

  const [aadharFrontUrl, aadharBackUrl] = await Promise.all([
    uploadImage(input.aadharFront, { folder: "nexclean/kyc" }),
    uploadImage(input.aadharBack, { folder: "nexclean/kyc" }),
  ]);

  user.aadharNumber = input.aadharNumber;
  user.aadharFrontUrl = aadharFrontUrl;
  user.aadharBackUrl = aadharBackUrl;
  user.agentStatus = "pending";
  // The KYC step re-submits the details form, so a cleaner who corrected
  // their name or location between the two steps gets the corrected value.
  if (input.name) user.name = input.name;
  if (input.city) user.city = input.city;
  if (input.area) user.area = input.area;
  if (!user.legalConsent) {
    user.legalConsent = legalConsent("agent_signup", origin);
  }
  if (origin.deviceId && !user.agentDeviceId) user.agentDeviceId = origin.deviceId;
  await user.save();

  const token = signToken(user.id, "agent", user.tokenVersion ?? 0);
  return { token, user, sent: true };
}

/** Create an unverified agent account immediately after OTP verification during signup basic step. */
export async function agentSignupBasic(input: AgentSignupBasicInput, origin: SignupOrigin = {}) {
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
    legalConsent: legalConsent("agent_signup", origin),
    agentDeviceId: origin.deviceId || null,
  });

  const token = signToken(user.id, "agent", user.tokenVersion ?? 0);
  return { token, user };
}

/** Email + password login for the admin console (verifies against database password). */
export async function adminLogin(email: string, password: string) {
  const emailLower = email.trim().toLowerCase();
  const isSuperAdminEmail = emailLower === env.adminEmail.toLowerCase();

  // Login identity is the account's current email. The synthetic phone value
  // is an internal immutable super-admin marker, never a second login alias —
  // otherwise an old email would keep working after the admin changed it.
  let user = await User.findOne({ email: emailLower, role: "admin" }).populate("adminRoleId");

  // 2. If Super Admin logging in for the first time before record exists, seed user
  if (!user && isSuperAdminEmail) {
    const designated = await User.findOne({ phone: `admin:${env.adminEmail}`, role: "admin" });
    // A designated record with another email means the owner changed their
    // login email. Do not silently recreate the old environment credential.
    if (!designated) {
      user = await User.create({
        phone: `admin:${emailLower}`,
        name: "Admin",
        email: emailLower,
        role: "admin",
        password: hashPassword(env.adminPassword),
      });
    }
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

const adminResetKey = (email: string) => `admin-password-reset:${email.trim().toLowerCase()}`;

/** Always returns the same response so the endpoint cannot enumerate admin accounts. */
export async function requestAdminPasswordReset(rawEmail: string): Promise<{ accepted: true }> {
  const email = rawEmail.trim().toLowerCase();
  // Fail uniformly before account lookup when delivery is not configured, so
  // the difference cannot be used to discover which addresses are admins.
  if (isProd && !emailEnabled) {
    throw ApiError.serviceUnavailable("Password-reset email is temporarily unavailable");
  }
  const user = await User.findOne({ email, role: "admin", status: { $ne: "suspended" } });
  if (!user) return { accepted: true };

  const code = generateOtp();
  const key = adminResetKey(email);
  const expiresAt = new Date(Date.now() + env.otpExpiryMin * 60 * 1000);
  await Otp.findOneAndUpdate(
    { phone: key },
    { phone: key, code, expiresAt, attempts: 0 },
    { upsert: true, new: true },
  );

  try {
    await sendAdminPasswordResetEmail(email, code);
  } catch (error) {
    await Otp.deleteOne({ phone: key });
    // Keep the public response indistinguishable from a request for an unknown
    // email. Provider diagnostics are logged server-side by the mail service.
    console.error("[email] Admin password-reset delivery failed", error);
  }
  return { accepted: true };
}

export async function resetAdminPassword(
  rawEmail: string,
  code: string,
  newPassword: string,
): Promise<{ reset: true }> {
  const email = rawEmail.trim().toLowerCase();
  const user = await User.findOne({ email, role: "admin", status: { $ne: "suspended" } });
  if (!user) throw ApiError.badRequest("Invalid or expired reset code");

  try {
    await verifyOtpCode(adminResetKey(email), code);
  } catch {
    throw ApiError.badRequest("Invalid or expired reset code");
  }

  user.password = hashPassword(newPassword);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();
  return { reset: true };
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
    // Whether a push can reach this account with the app closed. The tokens
    // themselves never leave the server; the app only needs the yes/no.
    pushReady: (user.deviceTokens ?? []).some(isRealPushToken),
  };
}
