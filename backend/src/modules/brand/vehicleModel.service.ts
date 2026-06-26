import { VehicleModel, type VehicleModelDoc } from "./vehicleModel.model";
import { VehicleBrand } from "./brand.model";
import { ApiError } from "../../shared/utils/ApiError";
import { isValidCategoryKey } from "../catalog/category.service";

function mapModel(m: VehicleModelDoc) {
  return { id: m.id, brand: String(m.brand), name: m.name, categoryKey: m.categoryKey, active: m.active };
}

async function getBrandOrThrow(brandId: string) {
  const brand = await VehicleBrand.findById(brandId);
  if (!brand) throw ApiError.notFound("Brand not found");
  return brand;
}

export async function listModelsForBrand(brandId: string) {
  await getBrandOrThrow(brandId);
  const models = await VehicleModel.find({ brand: brandId }).sort({ name: 1 });
  return models.map(mapModel);
}

/** Active models for a brand, for customer-facing pickers. */
export async function listActiveModelsForBrand(brandId: string) {
  const models = await VehicleModel.find({ brand: brandId, active: true }).sort({ name: 1 });
  return models.map(mapModel);
}

export async function createModel(brandId: string, input: { name: string; categoryKey: string }) {
  await getBrandOrThrow(brandId);
  if (!(await isValidCategoryKey(input.categoryKey))) throw ApiError.badRequest("Unknown vehicle category");

  const existing = await VehicleModel.findOne({ brand: brandId, name: input.name });
  if (existing) throw ApiError.badRequest("That model already exists under this brand");

  return mapModel(await VehicleModel.create({ brand: brandId, name: input.name, categoryKey: input.categoryKey }));
}

export async function updateModel(
  id: string,
  patch: { name?: string; categoryKey?: string; active?: boolean },
) {
  if (patch.categoryKey !== undefined && !(await isValidCategoryKey(patch.categoryKey))) {
    throw ApiError.badRequest("Unknown vehicle category");
  }
  const updated = await VehicleModel.findByIdAndUpdate(id, patch, { new: true });
  if (!updated) throw ApiError.notFound("Model not found");
  return mapModel(updated);
}

export async function deleteModel(id: string) {
  const deleted = await VehicleModel.findByIdAndDelete(id);
  if (!deleted) throw ApiError.notFound("Model not found");
}
