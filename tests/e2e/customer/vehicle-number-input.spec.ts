import { test, expect } from "@playwright/test";

for (const screen of ["booking", "garage"] as const) {
  test(`${screen}: vehicle letters survive composition and editing in the middle`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem("nexclean-session", JSON.stringify({ state: { authenticated: true, guest: false }, version: 0 }));
      localStorage.setItem("nexclean-cookie-consent", JSON.stringify({ version: 1, necessary: true, functional: false }));
    });
    await page.route("**/api/**", route => {
      const path = new URL(route.request().url()).pathname;
      if (!path.startsWith("/api/")) return route.continue();
      const data = path === "/api/auth/me"
        ? { id: "input-customer", name: "Test Customer", role: "customer", vehicles: [], addresses: [] }
        : path === "/api/catalog/vehicle-categories"
          ? [{ id: "suv", key: "suv", label: "SUV", basePrice: 200, active: true }]
          : path === "/api/config/public" ? {} : [];
      return route.fulfill({ json: { success: true, data } });
    });
    await page.route("https://maps.googleapis.com/**", route => route.abort());
    await page.goto(screen === "booking" ? "/app/book" : "/app/profile/vehicles");
    if (screen === "garage") await page.getByRole("button", { name: "Add vehicle" }).click();
    await page.getByRole("button", { name: "Can't find your car? Enter it manually" }).click();
    await page.getByPlaceholder("e.g. Hyundai").fill("Tata");
    await page.getByPlaceholder("e.g. Creta").fill("Nexon");
    await page.locator("select").selectOption("suv");

    const plate = page.getByRole("textbox", { name: "Vehicle number" });
    await plate.focus();
    // Model a keyboard's uncommitted composing text. React must not rewrite it.
    await plate.evaluate((input: HTMLInputElement) => {
      input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "mp");
      input.dispatchEvent(new InputEvent("input", { bubbles: true, data: "mp", inputType: "insertCompositionText", isComposing: true }));
    });
    await expect(plate).toHaveValue("mp");
    await plate.dispatchEvent("compositionend", { data: "mp" });
    await plate.pressSequentially("09xy4321");
    await expect(plate).toHaveValue("mp09xy4321");
    await plate.evaluate((input: HTMLInputElement) => input.setSelectionRange(4, 4));
    await plate.pressSequentially("a");
    await expect(plate).toHaveValue("mp09axy4321");
    expect(await plate.evaluate((input: HTMLInputElement) => input.selectionStart)).toBe(5);
    await plate.blur();
    await expect(plate).toHaveValue("MP09AXY4321");
  });
}
