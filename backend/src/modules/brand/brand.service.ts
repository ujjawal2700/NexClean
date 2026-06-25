import { VehicleBrand, type VehicleBrandDoc } from "./brand.model";
import { ApiError } from "../../shared/utils/ApiError";
import type { VehicleType } from "../catalog/catalog.data";

function mapBrand(b: VehicleBrandDoc) {
  return { id: b.id, name: b.name, vehicleType: b.vehicleType, active: b.active, models: b.models };
}

export async function listBrands(vehicleType?: VehicleType) {
  const brands = await VehicleBrand.find(vehicleType ? { vehicleType } : {}).sort({ vehicleType: 1, name: 1 });
  return brands.map(mapBrand);
}

/** Active brands for a vehicle type, for customer-facing pickers. */
export async function listActiveBrands(vehicleType: VehicleType) {
  const brands = await VehicleBrand.find({ vehicleType, active: true }).sort({ name: 1 });
  return brands.map(mapBrand);
}

export async function createBrand(input: { name: string; vehicleType: VehicleType }) {
  const existing = await VehicleBrand.findOne({ name: input.name, vehicleType: input.vehicleType });
  if (existing) throw ApiError.badRequest("A brand with that name already exists for this vehicle type");
  return mapBrand(await VehicleBrand.create(input));
}

export async function updateBrand(
  id: string,
  patch: { name?: string; vehicleType?: VehicleType; active?: boolean },
) {
  const brand = await VehicleBrand.findByIdAndUpdate(id, patch, { new: true });
  if (!brand) throw ApiError.notFound("Brand not found");
  return mapBrand(brand);
}

export async function deleteBrand(id: string) {
  const brand = await VehicleBrand.findByIdAndDelete(id);
  if (!brand) throw ApiError.notFound("Brand not found");
}

export async function addModel(id: string, modelName: string) {
  const brand = await VehicleBrand.findById(id);
  if (!brand) throw ApiError.notFound("Brand not found");
  const exists = brand.models.some((m) => m.toLowerCase() === modelName.toLowerCase());
  if (exists) throw ApiError.badRequest("That model already exists under this brand");
  brand.models.push(modelName);
  await brand.save();
  return mapBrand(brand);
}

export async function removeModel(id: string, modelName: string) {
  const brand = await VehicleBrand.findById(id);
  if (!brand) throw ApiError.notFound("Brand not found");
  brand.models = brand.models.filter((m) => m !== modelName);
  await brand.save();
  return mapBrand(brand);
}
