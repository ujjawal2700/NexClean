import { Plan } from "./plan.model";
import { ApiError } from "../../shared/utils/ApiError";
import { PLANS } from "./catalog.data";

/** Seed the Plan collection from the static catalog on first access (one-time migration). */
async function ensureSeeded() {
  const count = await Plan.estimatedDocumentCount();
  if (count > 0) return;
  await Plan.insertMany(
    PLANS.map((p) => ({ _id: p.id, name: p.name, price: p.price, washesPerMonth: p.washesPerMonth, active: true })),
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

export async function createPlan(input: { name: string; price: number; washesPerMonth: number }) {
  await ensureSeeded();
  const id = slugify(input.name);
  if (!id) throw ApiError.badRequest("Invalid plan name");
  const existing = await Plan.findById(id);
  if (existing) throw ApiError.badRequest("A plan with that name already exists");
  return Plan.create({ _id: id, ...input, active: true });
}

export async function updatePlan(
  id: string,
  patch: { name?: string; price?: number; washesPerMonth?: number; active?: boolean },
) {
  const plan = await Plan.findByIdAndUpdate(id, patch, { new: true });
  if (!plan) throw ApiError.notFound("Plan not found");
  return plan;
}

export async function deletePlan(id: string) {
  const plan = await Plan.findByIdAndDelete(id);
  if (!plan) throw ApiError.notFound("Plan not found");
}
