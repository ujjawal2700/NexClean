import { VehicleCategory, type VehicleCategoryDoc } from "./category.model";
import { ApiError } from "../../shared/utils/ApiError";
import { VEHICLE_TYPES } from "./catalog.data";
import { getPricing, updatePricing } from "../pricing/pricing.service";
import { listPlans, updatePlan } from "./plan.service";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const LABEL: Record<string, string> = {
  hatchback: "Hatchback",
  sedan: "Sedan",
  suv: "SUV",
  luxury: "Luxury",
  premium: "Premium",
};

/** Seed the 5 original categories on first use, matching the legacy static catalog. */
async function ensureSeeded(): Promise<void> {
  const count = await VehicleCategory.estimatedDocumentCount();
  if (count > 0) return;
  await VehicleCategory.insertMany(
    VEHICLE_TYPES.map((key, i) => ({ name: LABEL[key] ?? key, key, sortOrder: i, active: true })),
  );
}

function mapCategory(c: VehicleCategoryDoc, basePrice?: Record<string, number>) {
  return {
    id: c.id,
    name: c.name,
    key: c.key,
    sortOrder: c.sortOrder,
    active: c.active,
    basePrice: basePrice?.[c.key] ?? 0,
  };
}

/** All categories (admin view), including inactive ones. */
export async function listCategories() {
  await ensureSeeded();
  const [categories, pricingDoc] = await Promise.all([
    VehicleCategory.find().sort({ sortOrder: 1, name: 1 }),
    getPricing(),
  ]);
  const base = pricingDoc.base as Record<string, number>;
  return categories.map((c) => mapCategory(c, base));
}

/** Active categories only, for customer-facing pickers. */
export async function listActiveCategories() {
  await ensureSeeded();
  const [categories, pricingDoc] = await Promise.all([
    VehicleCategory.find({ active: true }).sort({ sortOrder: 1, name: 1 }),
    getPricing(),
  ]);
  const base = pricingDoc.base as Record<string, number>;
  return categories.map((c) => mapCategory(c, base));
}

export async function isValidCategoryKey(key: string): Promise<boolean> {
  await ensureSeeded();
  return (await VehicleCategory.exists({ key, active: true })) != null;
}

export async function createCategory(input: { name: string; basePrice: number }) {
  await ensureSeeded();
  const key = slugify(input.name);
  if (!key) throw ApiError.badRequest("Invalid category name");
  const existing = await VehicleCategory.findOne({ key });
  if (existing) throw ApiError.badRequest("A category with that name already exists");

  const maxSort = await VehicleCategory.findOne().sort({ sortOrder: -1 }).select("sortOrder");
  const category = await VehicleCategory.create({
    name: input.name,
    key,
    sortOrder: (maxSort?.sortOrder ?? -1) + 1,
    active: true,
  });

  // Wire the new category's base price into the live pricing doc and give
  // every existing plan a default price for it, so nothing downstream
  // (booking, plans list) breaks for lacking a price on this new key.
  await updatePricing({ base: { [key]: input.basePrice } });
  const plans = await listPlans();
  await Promise.all(
    plans.map((p) =>
      updatePlan(p.id as string, { prices: { ...(p.prices as Record<string, number>), [key]: input.basePrice } }),
    ),
  );

  return mapCategory(category, { [key]: input.basePrice });
}

export async function updateCategory(
  id: string,
  patch: { name?: string; basePrice?: number; active?: boolean; sortOrder?: number },
) {
  const category = await VehicleCategory.findById(id);
  if (!category) throw ApiError.notFound("Category not found");

  if (patch.name !== undefined) category.name = patch.name;
  if (patch.active !== undefined) category.active = patch.active;
  if (patch.sortOrder !== undefined) category.sortOrder = patch.sortOrder;
  await category.save();

  if (patch.basePrice !== undefined) {
    await updatePricing({ base: { [category.key]: patch.basePrice } });
  }

  const pricingDoc = await getPricing();
  return mapCategory(category, pricingDoc.base as Record<string, number>);
}

export async function deleteCategory(id: string) {
  const category = await VehicleCategory.findByIdAndDelete(id);
  if (!category) throw ApiError.notFound("Category not found");
}
