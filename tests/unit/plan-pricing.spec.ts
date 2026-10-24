import { test, expect } from "@playwright/test";
import { calculatePlanPrices } from "../../backend/src/modules/catalog/plan-pricing";

test("calculates each category from its actual package price and the entered discount", () => {
  expect(calculatePlanPrices({ hatchback: 300, sedan: 400, custom: 500 }, 1, 4, 20))
    .toEqual({ hatchback: 960, sedan: 1280, custom: 1600 });
  expect(calculatePlanPrices({ hatchback: 300 }, 1, 4, 40)).toEqual({ hatchback: 720 });
});

test("rounds individual wash prices like bookings before applying a fractional discount", () => {
  expect(calculatePlanPrices({ hatchback: 299 }, 1.5, 3, 12.5).hatchback).toBe(1181.25);
});

test("supports zero and full discounts", () => {
  expect(calculatePlanPrices({ hatchback: 300 }, 1, 4, 0)).toEqual({ hatchback: 1200 });
  expect(calculatePlanPrices({ hatchback: 300 }, 1, 4, 100)).toEqual({ hatchback: 0 });
});

for (const count of [0, -1, 1.5, Infinity, NaN]) {
  test(`rejects invalid monthly wash count ${count}`, () => {
    expect(() => calculatePlanPrices({ hatchback: 300 }, 1, count, 20)).toThrow(/positive whole number/);
  });
}
for (const discount of [-1, 101, Infinity, NaN]) {
  test(`rejects invalid discount ${discount}`, () => {
    expect(() => calculatePlanPrices({ hatchback: 300 }, 1, 4, discount)).toThrow(/between 0 and 100/);
  });
}

test("rejects missing or invalid pricing instead of creating free category prices", () => {
  expect(() => calculatePlanPrices({}, 1, 4, 20)).toThrow();
  for (const value of [0, -10, NaN, Infinity, 1]) {
    expect(() => calculatePlanPrices({ hatchback: value }, 1, 4, 20)).toThrow();
  }
  for (const factor of [0, -1, NaN, Infinity]) {
    expect(() => calculatePlanPrices({ hatchback: 300 }, factor, 4, 20)).toThrow();
  }
});
