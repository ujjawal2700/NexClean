import crypto from "node:crypto";
import { User } from "./user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { normalize, sendOtp, verifyOtpCode } from "../auth/auth.service";
import { isValidCategoryKey } from "../catalog/category.service";
import { Booking } from "../booking/booking.model";
import { ReferralCampaign } from "../promotions/referralCampaign.model";


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

export async function updateProfile(userId: string, updates: { name?: string; email?: string }) {
  const user = await getUser(userId);
  if (updates.name !== undefined) user.name = updates.name;
  if (updates.email !== undefined) user.email = updates.email;
  await user.save();
  return user;
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

export async function addVehicle(
  userId: string,
  vehicle: { type: string; name: string; brand?: string; model?: string; plate?: string },
) {
  if (!(await isValidCategoryKey(vehicle.type))) throw ApiError.badRequest("Unknown vehicle category");
  const user = await getUser(userId);
  user.vehicles.push({
    type: vehicle.type,
    name: vehicle.name,
    brand: vehicle.brand || "",
    model: vehicle.model || "",
    plate: vehicle.plate || "—",
  });
  await user.save();
  return user;
}

export async function removeVehicle(userId: string, vehicleId: string) {
  const user = await getUser(userId);
  user.vehicles.pull({ _id: vehicleId });
  await user.save();
  return user;
}

export async function addAddress(
  userId: string,
  address: { label: string; line: string; society?: string },
) {
  const user = await getUser(userId);
  user.addresses.push({ label: address.label, line: address.line, society: address.society || "" });
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

  const campaign = await ReferralCampaign.findOne({ active: true }).sort({ createdAt: -1 });
  const rewardAmount = campaign ? campaign.referrerReward : 0;

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
    referralEarnings: user.referralEarnings,
    rewardAmount,
    referredUsers: enrichedUsers,
  };
}

