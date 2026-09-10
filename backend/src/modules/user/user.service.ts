import crypto from "node:crypto";
import { Types } from "mongoose";
import { User } from "./user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { normalize, sendOtp, verifyOtpCode } from "../auth/auth.service";
import { isValidCategoryKey } from "../catalog/category.service";
import { Booking } from "../booking/booking.model";
import { getReferralConfig } from "../promotions/referralConfig.service";


async function getUser(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  return user;
}

/** Generate a unique, shareable referral code (e.g. "RAVI4F2A"). */
export async function generateUniqueReferralCode(name: string): Promise<string> {
  const prefix = (name.replace(/[^a-zA-Z]/g, "").slice(0, 4) || "USER").toUpperCase().padEnd(4, "X");
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `${prefix}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    if (!(await User.findOne({ referralCode: code }))) return code;
  }
  throw new Error("Failed to generate a unique referral code");
}

/** Backfill a referral code for accounts created before this field existed (or via OTP-only login). */
async function ensureReferralCode(user: Awaited<ReturnType<typeof getUser>>) {
  if (user.referralCode) return user.referralCode;
  user.referralCode = await generateUniqueReferralCode(user.name);
  await user.save();
  return user.referralCode;
}

import { hashPassword } from "../../shared/utils/crypto";

export async function updateProfile(userId: string, updates: { name?: string; email?: string; phone?: string }) {
  const user = await getUser(userId);
  if (updates.name !== undefined) user.name = updates.name.trim();
  if (updates.email !== undefined) user.email = updates.email.trim();
  if (updates.phone !== undefined && updates.phone.trim() !== "") {
    const norm = normalize(updates.phone);
    if (user.phone !== norm) {
      const existing = await User.findOne({ phone: norm, _id: { $ne: userId } });
      if (existing) throw ApiError.badRequest("Mobile number already in use by another user");
      user.phone = norm;
    }
  }
  await user.save();
  return user;
}

export async function updatePasswordWithOtp(userId: string, input: { newPassword: string; code: string }) {
  const user = await getUser(userId);
  if (!user.phone || !user.phone.trim()) {
    throw ApiError.badRequest("Please add a phone number to your profile before changing your password.");
  }
  await verifyOtpCode(user.phone, input.code);
  user.password = hashPassword(input.newPassword);
  // Changing a password must end every other session — that is the whole point
  // of changing it after a suspected compromise.
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();
  return { success: true, message: "Password updated successfully" };
}


export async function deactivateUser(userId: string) {
  const user = await getUser(userId);
  user.status = "suspended";
  user.deviceTokens = [];
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();
  return { deactivated: true };
}

/**
 * Sign the account out on every device by invalidating all issued tokens.
 * Clearing the client's own storage only ends the session it can reach.
 */
export async function logoutEverywhere(userId: string) {
  const user = await getUser(userId);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  user.deviceTokens = [];
  await user.save();
  return { loggedOut: true };
}


/** Send an OTP to a new phone number, after confirming it's free to claim. */
export async function requestPhoneChange(userId: string, rawPhone: string) {
  const phone = normalize(rawPhone);
  const user = await getUser(userId);
  if (phone === user.phone) throw ApiError.badRequest("This is already your phone number");

  const existing = await User.findOne({ phone });
  if (existing) throw ApiError.badRequest("This phone number is already in use");

  return sendOtp(phone);
}

/** Verify the OTP for a new phone number and commit it as the user's login phone. */
export async function confirmPhoneChange(userId: string, rawPhone: string, code: string) {
  const phone = normalize(rawPhone);
  const user = await getUser(userId);

  const existing = await User.findOne({ phone });
  if (existing && existing.id !== user.id) throw ApiError.badRequest("This phone number is already in use");

  await verifyOtpCode(phone, code);

  user.phone = phone;
  await user.save();
  return user;
}

/** Per-account caps on the arrays embedded in the user document. */
const MAX_VEHICLES = 15;
const MAX_ADDRESSES = 15;

/**
 * Append to a capped embedded array in one atomic write.
 *
 * Reading the length, checking it, then saving the whole document is a
 * lost-update waiting to happen: 20 parallel adds each saw a length under the
 * cap and 17 of them landed. The filter `{ "<field>.<cap-1>": { $exists: false } }`
 * means "this array currently has fewer than <cap> entries", evaluated by the
 * server as part of the same update — so exactly the right number get through.
 */
async function pushCapped(
  userId: string,
  field: "vehicles" | "addresses",
  cap: number,
  doc: Record<string, unknown>,
): Promise<boolean> {
  const res = await User.updateOne(
    { _id: userId, [`${field}.${cap - 1}`]: { $exists: false } },
    { $push: { [field]: { _id: new Types.ObjectId(), ...doc } } },
  );
  return res.modifiedCount > 0;
}

export async function addVehicle(
  userId: string,
  vehicle: { type: string; name: string; brand?: string; model?: string; plate?: string },
) {
  if (!(await isValidCategoryKey(vehicle.type))) throw ApiError.badRequest("Unknown vehicle category");
  // Vehicles and addresses are embedded in the user document, which is loaded
  // on most authenticated requests — an uncapped list is a slow leak on every
  // one of them.
  const added = await pushCapped(userId, "vehicles", MAX_VEHICLES, {
    type: vehicle.type,
    name: vehicle.name,
    brand: vehicle.brand || "",
    model: vehicle.model || "",
    plate: vehicle.plate || "—",
  });
  if (!added) throw ApiError.badRequest(`You can save up to ${MAX_VEHICLES} vehicles`);
  return getUser(userId);
}

export async function removeVehicle(userId: string, vehicleId: string) {
  const user = await getUser(userId);
  user.vehicles.pull({ _id: vehicleId });
  await user.save();
  return user;
}

export async function addAddress(
  userId: string,
  address: { label: string; line: string; society?: string; lat?: number; lng?: number; placeId?: string },
) {
  const coordinates =
    typeof address.lat === "number" && typeof address.lng === "number"
      ? [address.lng, address.lat] // GeoJSON order
      : undefined;
  const added = await pushCapped(userId, "addresses", MAX_ADDRESSES, {
    label: address.label,
    line: address.line,
    society: address.society || "",
    ...(coordinates ? { coordinates } : {}),
    placeId: address.placeId || "",
  });
  if (!added) throw ApiError.badRequest(`You can save up to ${MAX_ADDRESSES} addresses`);
  return getUser(userId);
}

export async function updateAddress(
  userId: string,
  addressId: string,
  update: { label?: string; line?: string; society?: string; lat?: number; lng?: number; placeId?: string },
) {
  const user = await getUser(userId);
  const target = user.addresses.id(addressId);
  if (!target) throw ApiError.notFound("Address not found");

  if (update.label !== undefined) target.label = update.label;
  if (update.line !== undefined) target.line = update.line;
  if (update.society !== undefined) target.society = update.society;
  if (update.placeId !== undefined) target.placeId = update.placeId;
  if (typeof update.lat === "number" && typeof update.lng === "number") {
    target.coordinates = [update.lng, update.lat];
  }

  await user.save();
  return user;
}

export async function removeAddress(userId: string, addressId: string) {
  const user = await getUser(userId);
  user.addresses.pull({ _id: addressId });
  await user.save();
  return user;
}

export async function getReferralSummary(userId: string) {
  const user = await getUser(userId);
  const referralCode = await ensureReferralCode(user);
  const referredUsers = await User.find({ referredBy: userId }).sort({ createdAt: -1 });

  const config = await getReferralConfig();

  const enrichedUsers = await Promise.all(
    referredUsers.map(async (u) => {
      const bookingCount = await Booking.countDocuments({ user: u._id, status: "completed" });
      let status = "Joined";
      if (u.activePlan) {
        status = "Subscribed";
      } else if (bookingCount > 0) {
        status = "First Clean Done";
      }
      return {
        id: u.id,
        name: u.name,
        joinedAt: u.get("createdAt"),
        status,
      };
    })
  );

  return {
    referralCode,
    coins: user.coins,
    coinsPerRupee: config.coinsPerRupee,
    rewardAmount: config.referrerReward,
    refereeReward: config.refereeReward,
    programActive: config.active,
    referredUsers: enrichedUsers,
  };
}

