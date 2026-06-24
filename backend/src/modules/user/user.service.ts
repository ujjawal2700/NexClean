import crypto from "node:crypto";
import { User } from "./user.model";
import { ApiError } from "../../shared/utils/ApiError";
import type { VehicleType } from "../catalog/catalog.data";

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

export async function updateProfile(userId: string, name: string) {
  const user = await getUser(userId);
  user.name = name;
  await user.save();
  return user;
}

export async function addVehicle(
  userId: string,
  vehicle: { type: VehicleType; name: string; plate?: string },
) {
  const user = await getUser(userId);
  user.vehicles.push({ type: vehicle.type, name: vehicle.name, plate: vehicle.plate || "—" });
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
  return {
    referralCode,
    referralEarnings: user.referralEarnings,
    referredUsers: referredUsers.map((u) => ({
      id: u.id,
      name: u.name,
      joinedAt: u.get("createdAt"),
    })),
  };
}
