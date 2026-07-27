import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsNewCustomer, authHeader } from "../fixtures/api-client";

const API_BASE = (process.env.API_BASE_URL ?? "http://127.0.0.1:4000/api").replace("localhost", "127.0.0.1");
function apiUrl(path: string): string {
  return path.startsWith("http") ? path.replace("localhost", "127.0.0.1") : `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

test.describe("Slot Rescheduling & Vehicle Categories API", () => {
  test("GET /catalog/vehicle-categories returns category list with imageUrl field", async ({ request }) => {
    const res = await request.get(apiUrl("/catalog/vehicle-categories"));
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    if (body.data.length > 0) {
      expect(body.data[0]).toHaveProperty("imageUrl");
    }
  });

  test("GET & PUT /admin/reschedule-config", async ({ request }) => {
    const { token } = await loginAsAdmin(request);
    const headers = authHeader(token);

    const getRes = await request.get(apiUrl("/admin/reschedule-config"), { headers });
    expect(getRes.ok()).toBeTruthy();
    const config = (await getRes.json()).data;
    expect(config).toHaveProperty("rescheduleBufferMinutes");
    expect(config).toHaveProperty("maxConsecutiveDaysLimit");

    const putRes = await request.put(apiUrl("/admin/reschedule-config"), {
      headers,
      data: { bufferMinutes: 45, maxDaysLimit: 2 },
    });
    expect(putRes.ok()).toBeTruthy();
    const updated = (await putRes.json()).data;
    expect(updated.rescheduleBufferMinutes).toBe(45);
    expect(updated.maxConsecutiveDaysLimit).toBe(2);
  });

  test("Admin PATCH /admin/bookings/:id/reschedule updates date & slot", async ({ request }) => {
    const { token: customerToken } = await loginAsNewCustomer(request);
    const { token: adminToken } = await loginAsAdmin(request);

    // 1. Customer creates a booking
    const todayStr = new Date().toISOString().split("T")[0];
    const createRes = await request.post(apiUrl("/subscription/preview-order"), {
      headers: authHeader(customerToken),
      data: {
        vehicleType: "sedan",
        vehicleName: "Honda City Test",
        packageId: "express",
        date: todayStr,
        slot: "08:00 AM",
        addressLabel: "Home",
        addressLine: "Test Address 123",
        society: "Green Acres",
      },
    });

    // Create a direct booking via /subscription or customer order
    const bookingRes = await request.post(apiUrl("/bookings"), {
      headers: authHeader(customerToken),
      data: {
        vehicleType: "sedan",
        vehicleName: "Honda City Test",
        packageId: "express",
        date: todayStr,
        slot: "08:00 AM",
        addressLabel: "Home",
        addressLine: "Test Address 123",
        society: "Green Acres",
      },
    });

    if (bookingRes.ok()) {
      const booking = (await bookingRes.json()).data;
      const bookingId = booking.id;

      // 2. Admin reschedules booking to tomorrow at 02:00 PM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowIso = tomorrow.toISOString().split("T")[0];

      const rescheduleRes = await request.patch(apiUrl(`/admin/bookings/${bookingId}/reschedule`), {
        headers: authHeader(adminToken),
        data: {
          date: tomorrowIso,
          slot: "02:00 PM",
        },
      });
      expect(rescheduleRes.ok()).toBeTruthy();
      const updatedBooking = (await rescheduleRes.json()).data;
      expect(updatedBooking.slot).toBe("02:00 PM");
    }
  });
});
