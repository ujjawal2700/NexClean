import { Pricing } from "./pricing.model";
import { ApiError } from "../../shared/utils/ApiError";
import { BASE_PRICE, PACKAGES, isVehicleType, type VehicleType } from "../catalog/catalog.data";

type PricingDoc = {
  base: Record<string, number>;
  packages: { id: string; name: string; factor: number }[];
};

/** Get the pricing doc, seeding it from the static catalog on first access. */
export async function getPricing() {
  const existing = await Pricing.findOne();
  if (existing) return existing;
  return Pricing.create({
    base: { ...BASE_PRICE },
    packages: PACKAGES.map((p) => ({ id: p.id, name: p.name, factor: p.factor })),
  });
}

export async function updatePricing(patch: Partial<PricingDoc>) {
  const doc = await getPricing();
  if (patch.base) doc.set("base", { ...(doc.base as Record<string, number>), ...patch.base });
  if (patch.packages) doc.set("packages", patch.packages);
  await doc.save();
  return doc;
}

/** Authoritative price for a vehicle + package, from the live pricing doc. */
export async function getPrice(vehicleType: string, packageId: string): Promise<number> {
  if (!isVehicleType(vehicleType)) throw ApiError.badRequest("Unknown vehicle type");
  const doc = await getPricing();
  const base = (doc.base as Record<string, number>)[vehicleType as VehicleType];
  const pkg = (doc.packages as { id: string; factor: number }[]).find((p) => p.id === packageId);
  if (base == null || !pkg) throw ApiError.badRequest("Unknown package or vehicle");
  return Math.round((base * pkg.factor) / 10) * 10;
}
