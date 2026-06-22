import { Plan } from "./plan.model";
import { ApiError } from "../../shared/utils/ApiError";
import { PLANS, type PlanPrices } from "./catalog.data";

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

export async function createPlan(input: { name: string; prices: PlanPrices; washesPerMonth: number }) {
  await ensureSeeded();
  const id = slugify(input.name);
  if (!id) throw ApiError.badRequest("Invalid plan name");
  const existing = await Plan.findById(id);
  if (existing) throw ApiError.badRequest("A plan with that name already exists");
  return Plan.create({ _id: id, ...input, active: true });
}

export async function updatePlan(
  id: string,
  patch: { name?: string; prices?: PlanPrices; washesPerMonth?: number; active?: boolean },
) {
  const plan = await Plan.findByIdAndUpdate(id, patch, { new: true });
  if (!plan) throw ApiError.notFound("Plan not found");
  return plan;
}

export async function deletePlan(id: string) {
  const plan = await Plan.findByIdAndDelete(id);
  if (!plan) throw ApiError.notFound("Plan not found");
}
