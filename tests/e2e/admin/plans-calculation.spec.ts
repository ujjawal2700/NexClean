import { test, expect } from "@playwright/test";

// Entirely mocked: verifies the editor without touching a database or payment service.
test("plan prices update live and create/edit submit the calculation inputs", async ({ page }) => {
  const pricing = {
    base: { hatchback: 300, suv: 500 },
    packages: [
      { id: "express", name: "Express Wash", factor: 1, active: true },
      { id: "detail", name: "Detail Wash", factor: 1.5, active: true },
      { id: "inactive", name: "Inactive Wash", factor: 2, active: false },
    ],
  };
  const categories = [
    { id: "1", key: "hatchback", name: "Hatchback", active: true },
    { id: "2", key: "suv", name: "SUV", active: true },
  ];
  let plans: Record<string, unknown>[] = [];
  let submitted: Record<string, unknown> = {};
  await page.addInitScript(() => {
    localStorage.setItem("nexclean-admin-session", JSON.stringify({
      state: { authenticated: true, name: "Test Admin", permissions: ["plans"] }, version: 0,
    }));
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    let data: unknown = [];
    if (path.endsWith("/auth/me")) data = { name: "Test Admin", permissions: ["plans"] };
    if (path.endsWith("/plans/options")) data = { pricing, categories };
    if (/\/plans(?:\/basic)?$/.test(path)) {
      if (["POST", "PATCH"].includes(route.request().method())) {
        submitted = route.request().postDataJSON();
        const count = Number(submitted.washesPerMonth);
        const discount = Number(submitted.discountPercentage);
        const factor = pricing.packages.find((p) => p.id === submitted.packageId)!.factor;
        const prices = Object.fromEntries(Object.entries(pricing.base).map(([key, base]) => [key, base * factor * count * (1 - discount / 100)]));
        plans = [{ id: "basic", ...submitted, prices, price: Math.min(...Object.values(prices)), active: true, subscribers: 0 }];
        data = plans[0];
      } else data = plans;
    }
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto("/admin/plans");
  await page.getByRole("button", { name: "New plan" }).click();
  await expect(page.getByRole("button", { name: "Create plan" })).toBeDisabled();
  await page.getByLabel("Name", { exact: true }).fill("Basic");
  await page.getByLabel("Washes / month").fill("4");
  await page.getByLabel("Wash type").selectOption("express");
  await expect(page.getByRole("option", { name: "Inactive Wash" })).toHaveCount(0);
  await page.getByLabel("Discount (%)").fill("20");
  await expect(page.getByLabel("Hatchback monthly price")).toHaveText("₹960/mo");
  await expect(page.getByLabel("SUV monthly price")).toHaveText("₹1,600/mo");
  await page.getByLabel("Discount (%)").fill("40");
  await expect(page.getByLabel("Hatchback monthly price")).toHaveText("₹720/mo");
  await page.getByLabel("Discount (%)").fill("101");
  await expect(page.getByRole("button", { name: "Create plan" })).toBeDisabled();
  await page.getByLabel("Discount (%)").fill("20");
  await page.getByLabel("Tagline").fill("For city cars");
  await page.getByLabel("New key point").fill("Doorstep service");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel("Key point 1", { exact: true })).toHaveValue("Doorstep service");
  await page.getByRole("button", { name: "Create plan" }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  expect(submitted).toEqual({ name: "Basic", packageId: "express", washesPerMonth: 4, discountPercentage: 20, tagline: "For city cars", description: "", keyPoints: ["Doorstep service"] });

  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Wash type")).toHaveValue("express");
  await expect(page.getByLabel("Tagline")).toHaveValue("For city cars");
  await expect(page.getByLabel("Discount (%)")).toHaveValue("20");
  await page.getByLabel("Washes / month").fill("8");
  await expect(page.getByLabel("Hatchback monthly price")).toHaveText("₹1,920/mo");
  await page.getByLabel("Wash type").selectOption("detail");
  await expect(page.getByLabel("Hatchback monthly price")).toHaveText("₹2,880/mo");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Washes / month")).toHaveValue("4");
  await expect(page.getByLabel("Wash type")).toHaveValue("express");
  await page.getByLabel("Washes / month").fill("8");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("8/mo washes")).toBeVisible();
  expect(submitted.washesPerMonth).toBe(8);
  expect(submitted).not.toHaveProperty("prices");
});
