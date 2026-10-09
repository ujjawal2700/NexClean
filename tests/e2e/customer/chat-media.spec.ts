import { test, expect } from "@playwright/test";
import { loginCustomerUI } from "../../fixtures/ui-helpers";
import { PNG_PHOTO, JPEG_PHOTO, GIF_PHOTO } from "../../fixtures/chat-photos";

for (const [format, photo] of [["png", PNG_PHOTO], ["jpeg", JPEG_PHOTO], ["gif", GIF_PHOTO]]) {
  test(`${format} photo is uploaded as WebP in a fullscreen conversation`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 899 });
    await loginCustomerUI(page);
    await page.goto("/app/help");
    await page.getByTestId("support-topic-payment").click();
    const chat = page.getByTestId("support-chat");
    await expect(chat).toBeVisible();
    const box = await chat.boundingBox();
    expect(box?.x).toBe(0); expect(box?.y).toBe(0);
    expect(box?.width).toBe(375); expect(box?.height).toBe(899);
    await expect(page.getByRole("button", { name: "Camera", exact: true })).toBeVisible();
    await expect(page.getByLabel("Take photo", { exact: true })).toHaveAttribute("capture", "environment");
    const input = format === "jpeg" ? page.getByLabel("Take photo", { exact: true }) : page.getByLabel("Choose photo", { exact: true });
    await input.setInputFiles({ name: `issue.${format}`, mimeType: `image/${format}`, buffer: Buffer.from(photo, "base64") });
    await expect(page.getByAltText("Selected photo")).toBeVisible();
    await page.route("**/chat/tickets/*/messages", async (route) => {
      if (route.request().method() === "POST") await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });
    const sent = page.waitForRequest((r) => r.url().includes("/messages") && r.method() === "POST");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText("Uploading…", { exact: true })).toBeVisible();
    if (format === "png") await page.screenshot({ path: testInfo.outputPath("uploading.png") });
    const body = (await sent).postDataJSON();
    expect(body.image).toMatch(/^data:image\/webp;base64,/);
    await expect(page.getByAltText("Shared photo", { exact: true })).toBeVisible();
    await expect(page.getByTestId("pending-photo")).toHaveCount(0);
    if (format === "png") await page.screenshot({ path: testInfo.outputPath("conversation.png") });
    await page.getByRole("button", { name: "View photo" }).click();
    await expect(page.getByRole("dialog", { name: "Photo viewer" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 375, height: 430 });
    await expect(page.getByRole("button", { name: "Attach photo" })).toBeInViewport();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(chat).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  });
}

test("failed photo upload keeps the photo and caption available for retry", async ({ page }) => {
  await loginCustomerUI(page);
  await page.goto("/app/help");
  await page.getByTestId("support-topic-payment").click();
  await page.getByLabel("Choose photo", { exact: true }).setInputFiles({ name: "issue.png", mimeType: "image/png", buffer: Buffer.from(PNG_PHOTO, "base64") });
  await page.getByRole("textbox", { name: "Message" }).fill("The wash was incomplete");
  let reject = true;
  await page.route("**/chat/tickets/*/messages", async (r) => {
    if (reject && r.request().method() === "POST") {
      reject = false;
      return r.fulfill({ status: 400, json: { success: false, message: "Photo upload failed. Please try again." } });
    }
    return r.continue();
  });
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Photo upload failed");
  await expect(page.getByAltText("Selected photo")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue("The wash was incomplete");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByAltText("Shared photo", { exact: true })).toBeVisible();
});
