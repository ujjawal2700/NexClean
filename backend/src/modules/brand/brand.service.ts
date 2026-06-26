import { VehicleBrand, type VehicleBrandDoc } from "./brand.model";
import { VehicleModel } from "./vehicleModel.model";
import { ApiError } from "../../shared/utils/ApiError";

function mapBrand(b: VehicleBrandDoc) {
  return { id: b.id, name: b.name, active: b.active };
}

export async function listBrands() {
  const brands = await VehicleBrand.find().sort({ name: 1 });
  return brands.map(mapBrand);
}

/** Active brands, for customer-facing pickers. */
export async function listActiveBrands() {
  const brands = await VehicleBrand.find({ active: true }).sort({ name: 1 });
  return brands.map(mapBrand);
}

export async function createBrand(input: { name: string }) {
  const existing = await VehicleBrand.findOne({ name: input.name });
  if (existing) throw ApiError.badRequest("A brand with that name already exists");
  return mapBrand(await VehicleBrand.create({ name: input.name }));
}

export async function updateBrand(id: string, patch: { name?: string; active?: boolean }) {
  const brand = await VehicleBrand.findByIdAndUpdate(id, patch, { new: true });
  if (!brand) throw ApiError.notFound("Brand not found");
  return mapBrand(brand);
}

export async function deleteBrand(id: string) {
  const brand = await VehicleBrand.findByIdAndDelete(id);
  if (!brand) throw ApiError.notFound("Brand not found");
  await VehicleModel.deleteMany({ brand: id });
}
