import { test, expect } from "@playwright/test";
import { Plan } from "../../backend/src/modules/catalog/plan.model";
import { Pricing } from "../../backend/src/modules/pricing/pricing.model";
import { createPlan, updatePlan } from "../../backend/src/modules/catalog/plan.service";

const pricing = { base: { hatchback: 300, suv: 500 }, packages: [{ id: "express", factor: 1, active: true }] };
const originals = { findById: Plan.findById, create: Plan.create, count: Plan.estimatedDocumentCount, find: Plan.find, pricing: Pricing.findOne };
let saved = false;
let record: any;

test.beforeEach(() => {
  saved = false;
  record = { name: "Basic", packageId: "express", discountPercentage: 20, washesPerMonth: 4, prices: { hatchback: 960, suv: 1600 },
    set(patch: unknown) { Object.assign(this, patch); }, async save() { saved = true; } };
  Plan.findById = (() => Promise.resolve(record)) as any;
  Pricing.findOne = (() => Promise.resolve(pricing)) as any;
  Plan.estimatedDocumentCount = (() => Promise.resolve(1)) as any;
  Plan.find = (() => ({ select: () => Promise.resolve([]) })) as any;
  Plan.create = ((input: unknown) => Promise.resolve(input)) as any;
});

test.afterEach(() => {
  Plan.findById = originals.findById;
  Plan.create = originals.create;
  Plan.estimatedDocumentCount = originals.count;
  Plan.find = originals.find;
  Pricing.findOne = originals.pricing;
});

test("create calculates prices on the server and persists the selected package and discount", async () => {
  record = null;
  const created = await createPlan({ name: "Basic", packageId: "express", washesPerMonth: 4, discountPercentage: 20 });
  expect(created).toMatchObject({ _id: "basic", packageId: "express", discountPercentage: 20, prices: { hatchback: 960, suv: 1600 } });
});

test("changing washes recalculates all prices and ignores a supplied price override", async () => {
  await updatePlan("basic", { washesPerMonth: 8, prices: { hatchback: 1 } });
  expect(saved).toBe(true);
  expect(record.prices).toEqual({ hatchback: 1920, suv: 3200 });
});

test("discount changes recalculate prices", async () => {
  await updatePlan("basic", { discountPercentage: 40 });
  expect(record.prices).toEqual({ hatchback: 720, suv: 1200 });
});

test("activation changes preserve existing prices", async () => {
  record.prices = { hatchback: 800 };
  await updatePlan("basic", { active: false });
  expect(record.prices).toEqual({ hatchback: 800 });
  expect(record.active).toBe(false);
});

test("legacy plan prices are preserved on metadata changes", async () => {
  delete record.packageId;
  delete record.discountPercentage;
  record.prices = { hatchback: 800 };
  await updatePlan("basic", { name: "Renamed" });
  expect(record.prices).toEqual({ hatchback: 800 });
});

test("rejects missing and inactive packages and invalid wash counts", async () => {
  await expect(updatePlan("basic", { packageId: "missing" })).rejects.toThrow(/active wash package/);
  await expect(updatePlan("basic", { washesPerMonth: -1 })).rejects.toThrow(/positive whole number/);
  const before = pricing.packages[0].active;
  try {
    pricing.packages[0].active = false;
    await expect(updatePlan("basic", { packageId: "express" })).rejects.toThrow(/active wash package/);
  } finally { pricing.packages[0].active = before; }
  expect(saved).toBe(false);
});
