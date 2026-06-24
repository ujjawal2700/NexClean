import { User } from "./user.model";
import { ApiError } from "../../shared/utils/ApiError";
import type { VehicleType } from "../catalog/catalog.data";

async function getUser(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  return user;
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
  const referredUsers = await User.find({ referredBy: userId }).sort({ createdAt: -1 });
  return {
    referralCode: user.referralCode,
    referralEarnings: user.referralEarnings,
    referredUsers: referredUsers.map((u) => ({
      id: u.id,
      name: u.name,
      joinedAt: u.get("createdAt"),
    })),
  };
}
