import { test, expect, type APIRequestContext } from "@playwright/test";
import {
  LEGAL_ACCEPTANCE,
  apiUrl,
  authHeader,
  freshPhone,
  loginAsAdmin,
  loginByPhone,
  submitAgentApplication,
  uniqueName,
} from "../../fixtures/api-client";
import { loginAdminUI, loginAgentUI, loginCustomerUI } from "../../fixtures/ui-helpers";
import { apiContext, mintTokenForPhone } from "../../fixtures/customer-e2e-helpers";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const CUSTOM_REVIEW = "Rahul-tested: great attention to the alloy wheels, thank you!";

/** A verified cleaner online alone at a random remote spot; returns their phone for the UI login. */
async function isolatedAgent(api: APIRequestContext) {
  const phone = freshPhone();
  const name = uniqueName("Review Cleaner");
  const lat = -5 + Math.random() * 4;
  const lng = -100 + Math.random() * 4;
  const signup = await submitAgentApplication(api, {
    data: {
      name,
      phone,
      city: "Indore",
      area: "Test Area",
      aadharNumber: "123456789012",
      aadharFront: TINY_PNG,
      aadharBack: TINY_PNG,
      ...LEGAL_ACCEPTANCE,
    },
  });
  if (!signup.ok()) throw new Error(`agent signup failed: ${await signup.text()}`);
  const agent = await loginByPhone(api, phone);
  const { token: adminToken } = await loginAsAdmin(api);
  await api.patch(apiUrl(`/admin/agents/${agent.userId}/status`), {
    headers: authHeader(adminToken),
    data: { status: "verified" },
  });
  await api.patch(apiUrl("/agent/online"), { headers: authHeader(agent.token), data: { online: true, lat, lng } });
  return { ...agent, phone, name, lat, lng };
}

/** A completed booking for a fresh customer, done by an isolated cleaner. */
async function seedCompletedBooking() {
  const api = await apiContext();
  const agent = await isolatedAgent(api);
  const customerPhone = freshPhone();
  const { token } = await mintTokenForPhone(api, customerPhone);
  const packageId = (await (await api.get(apiUrl("/catalog/packages"))).json()).data[0].id;
  const created = await api.post(apiUrl("/bookings"), {
    headers: authHeader(token),
    data: {
      vehicleType: "hatchback",
      vehicleName: "Hyundai i20",
      packageId,
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      slot: "11:00 AM",
      addressLabel: "Home",
      addressLine: "7 Review Lane",
      lat: agent.lat,
      lng: agent.lng,
    },
  });
  const bookingId: string = (await created.json()).data.id;
  for (let i = 0; i < 40; i++) {
    const body = await (await api.get(apiUrl("/agent/offers/current"), { headers: authHeader(agent.token) })).json();
    if (body.data?.bookingId === bookingId) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  await api.post(apiUrl(`/agent/offers/${bookingId}/accept`), { headers: authHeader(agent.token) });
  for (const kind of ["before", "after"] as const) {
    for (let i = 0; i < 4; i++) {
      await api.post(apiUrl(`/agent/jobs/${bookingId}/photo`), { headers: authHeader(agent.token), data: { kind, image: TINY_PNG } });
    }
  }
  for (let i = 0; i < 4; i++) await api.patch(apiUrl(`/agent/jobs/${bookingId}/advance`), { headers: authHeader(agent.token) });
  await api.dispose();
  return { bookingId, customerPhone, agent };
}

test("customer rates a completed service (suggested + custom review); cleaner and admin see it", async ({ page }) => {
  test.setTimeout(120_000);
  const { bookingId, customerPhone, agent } = await seedCompletedBooking();
  const agentFirst = agent.name.split(" ")[0];

  // ── Customer ────────────────────────────────────────────────────────────
  await loginCustomerUI(page, customerPhone);
  await page.goto("/app/bookings");
  await page.getByRole("button", { name: "Completed" }).click().catch(() => {});
  await page.getByTestId(`rate-${bookingId}`).click();
  await expect(page).toHaveURL(new RegExp(`/app/bookings/${bookingId}\\?rate=1`));

  const card = page.getByTestId("rate-service-card");
  await expect(card).toBeVisible();
  await expect(page.getByTestId("booking-photos")).toContainText("before (4)");
  const suggestBtn = card.getByRole("button", { name: "Suggest review" });
  await expect(suggestBtn).toBeDisabled();
  await expect(card.getByRole("button", { name: "Submit review" })).toBeDisabled();

  await card.getByRole("radio", { name: /^4 stars/ }).click();
  await expect(card).toContainText("Very good");
  await suggestBtn.click();
  const box = card.getByLabel(/Your review/);
  const first = await box.inputValue();
  expect(first.length).toBeGreaterThan(20);
  expect(first).toContain(agentFirst);
  await card.getByRole("button", { name: "Another suggestion" }).click();
  expect(await box.inputValue()).not.toBe(first);

  // The customer can always write their own.
  await box.fill(CUSTOM_REVIEW);
  await card.getByRole("button", { name: "Submit review" }).click();
  const yours = page.getByTestId("your-review-card");
  await expect(yours).toBeVisible();
  await expect(yours).toContainText(CUSTOM_REVIEW);
  await expect(card).toHaveCount(0);

  await page.goto("/app/bookings");
  await expect(page.getByTestId(`rated-${bookingId}`)).toContainText("4");

  // ── Cleaner ─────────────────────────────────────────────────────────────
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: 22.7196, longitude: 75.8577 });
  await loginAgentUI(page, agent.phone);
  await page.goto("/agent/reviews");
  await expect(page.getByTestId("reviews-count")).toHaveText("1 review");
  await expect(page.getByTestId("reviews-average")).toHaveText("4.0");
  await expect(page.getByTestId("review-item")).toContainText(CUSTOM_REVIEW);

  // ── Admin ───────────────────────────────────────────────────────────────
  await loginAdminUI(page);
  await page.goto(`/admin/agents/${agent.userId}`);
  const section = page.getByTestId("agent-reviews-section");
  await expect(section.getByTestId("review-item")).toContainText(CUSTOM_REVIEW);
  await expect(page.getByTestId("agent-rating-count")).toHaveText("1 review");
  await expect(page.getByTestId(`history-rating-${bookingId}`)).toContainText("4");

  await page.goto(`/admin/bookings/${bookingId}`);
  await expect(page.getByTestId("booking-review")).toContainText(CUSTOM_REVIEW);
  await expect(page.getByTestId("booking-review")).toContainText("4/5");
  await expect(page.getByTestId("timeline-reviewed")).toBeVisible();
});

test("the completion popup's stars open the booking with that rating picked", async ({ page }) => {
  test.setTimeout(120_000);
  const { bookingId, customerPhone } = await seedCompletedBooking();
  await loginCustomerUI(page, customerPhone);
  // Same URL the popup's 5th star navigates to.
  await page.goto(`/app/bookings/${bookingId}?rating=5`);
  const card = page.getByTestId("rate-service-card");
  await expect(card.getByRole("radio", { name: /^5 stars/ })).toHaveAttribute("aria-checked", "true");
  await expect(card).toContainText("Excellent");
  await expect(card.getByRole("button", { name: "Submit review" })).toBeEnabled();
  // Rating without any text is allowed.
  await card.getByRole("button", { name: "Submit review" }).click();
  await expect(page.getByTestId("your-review-card")).toContainText("No written review.");
});
