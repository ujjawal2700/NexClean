import { Plan } from "./plan.model";
import { ApiError } from "../../shared/utils/ApiError";
import { PLANS, type PlanPrices } from "./catalog.data";
import { getPricing } from "../pricing/pricing.service";
import { calculatePlanPrices } from "./plan-pricing";

/** Seed the Plan collection from the static catalog on first access, and backfill legacy docs. */
async function ensureSeeded() {
  const count = await Plan.estimatedDocumentCount();
  if (count === 0) {
    await Plan.insertMany(
      PLANS.map((p) => ({ _id: p.id, name: p.name, prices: p.prices, washesPerMonth: p.washesPerMonth, active: true })),
    );
    return;
  }
  // Backfill seed plans created before per-vehicle prices / washesPerMonth existed.
  const seedIds = PLANS.map((p) => p.id);
  const legacy = await Plan.find({
    _id: { $in: seedIds },
    $or: [{ prices: { $exists: false } }, { washesPerMonth: { $exists: false } }],
  }).select("_id");
  if (legacy.length === 0) return;
  await Promise.all(
    legacy.map((doc) => {
      const seed = PLANS.find((p) => p.id === String(doc._id));
      if (!seed) return null;
      return Plan.updateOne({ _id: seed.id }, { $set: { prices: seed.prices, washesPerMonth: seed.washesPerMonth } });
    }),
  );
}

export async function listPlans() {
  await ensureSeeded();
  return Plan.find().sort({ price: 1 });
}

export async function listActivePlans() {
  await ensureSeeded();
  return Plan.find({ active: true }).sort({ price: 1 });
}

export async function isValidActivePlan(id: string) {
  await ensureSeeded();
  return (await Plan.exists({ _id: id, active: true })) != null;
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export type PlanDetails = { tagline?: string; description?: string; keyPoints?: string[] };

export type CreatePlanInput = PlanDetails & {
  name: string;
  packageId: string;
  discountPercentage: number;
  washesPerMonth: number;
};
export type PlanPatch = Partial<CreatePlanInput> & { prices?: PlanPrices; active?: boolean };

async function pricedPlan(input: Omit<CreatePlanInput, "name">, requireActive = true) {
  const pricing = await getPricing();
  const pkg = pricing.packages.find((p) => p.id === input.packageId);
  if (!pkg || (requireActive && pkg.active === false)) {
    throw ApiError.badRequest("Select an active wash package from Pricing");
  }
  try {
    return calculatePlanPrices(pricing.base as Record<string, number>, pkg.factor!, input.washesPerMonth, input.discountPercentage);
  } catch (error) {
    throw ApiError.badRequest((error as Error).message);
  }
}

export async function createPlan(input: CreatePlanInput) {
  await ensureSeeded();
  const id = slugify(input.name);
  if (!id) throw ApiError.badRequest("Invalid plan name");
  const existing = await Plan.findById(id);
  if (existing) throw ApiError.badRequest("A plan with that name already exists");
  const prices = await pricedPlan(input);
  return Plan.create({ _id: id, ...input, prices, active: true });
}

export async function updatePlan(id: string, patch: PlanPatch) {
  const plan = await Plan.findById(id);
  if (!plan) throw ApiError.notFound("Plan not found");
  const packageId = patch.packageId ?? plan.packageId;
  const discountPercentage = patch.discountPercentage ?? plan.discountPercentage;
  const pricingChanged = patch.packageId !== undefined || patch.discountPercentage !== undefined ||
    patch.washesPerMonth !== undefined || patch.prices !== undefined;
  if (packageId && discountPercentage != null && pricingChanged) {
    patch.prices = await pricedPlan({
      packageId,
      discountPercentage,
      washesPerMonth: patch.washesPerMonth ?? plan.washesPerMonth,
    }, patch.packageId !== undefined);
  } else if (patch.packageId !== undefined || patch.discountPercentage !== undefined) {
    throw ApiError.badRequest("Wash package and discount percentage are required together");
  }
  plan.set(patch);
  await plan.save();
  return plan;
}

export async function deletePlan(id: string) {
  const plan = await Plan.findByIdAndDelete(id);
  if (!plan) throw ApiError.notFound("Plan not found");
}
