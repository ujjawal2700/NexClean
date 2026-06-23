import { VehicleBrand, type VehicleBrandDoc } from "./brand.model";
import { ApiError } from "../../shared/utils/ApiError";

function mapBrand(b: VehicleBrandDoc) {
  return { id: b.id, name: b.name, active: b.active, models: b.models };
}

export async function listBrands() {
  const brands = await VehicleBrand.find().sort({ name: 1 });
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
