import { test, expect } from "../fixtures/base";
import { authHeader, createVerifiedOnlineAgent, loginAsAdmin, loginAsNewCustomer } from "../fixtures/api-client";

test("staff booking belongs to the customer and collection is explicit and cannot be repeated", async ({ request }) => {
  const admin = await loginAsAdmin(request);
  const customer = await loginAsNewCustomer(request);
  const headers = authHeader(admin.token);
  const options = await (await request.get("/admin/booking-options", { headers })).json();
  const categories = await (await request.get("/catalog/vehicle-categories")).json();
  const draft = { customerId: customer.userId, vehicleType: categories.data[0].key, vehicleName: "Staff Test Vehicle", packageId: options.data.packages[0].id, date: new Date(Date.now() + 86400000 * 2).toISOString(), slot: "11:00 AM", addressLabel: "Home", addressLine: "Staff booking test address" };
  expect((await request.post("/admin/bookings", { headers: authHeader(customer.token), data: draft })).status()).toBe(403);
  const quote = await request.post("/admin/bookings/quote", { headers, data: draft });
  expect(quote.ok()).toBeTruthy();
  const created = await request.post("/admin/bookings", { headers, data: { ...draft, price: 1, createdByName: "Forged" } });
  expect(created.status(), await created.text()).toBe(201);
  const booking = (await created.json()).data;
  expect(booking.bookingSource).toBe("staff");
  expect(booking.createdByName).not.toBe("Forged");
  const own = await request.get(`/bookings/${booking.id}`, { headers: authHeader(customer.token) });
  expect(own.ok()).toBeTruthy();
  expect((await own.json()).data.staffPayment).toMatchObject({ status: "created", amount: (await quote.json()).data.amount });
  // Finishing the service must not claim the employee has collected money.
  const agent = await createVerifiedOnlineAgent(request);
  const assigned = await request.patch(`/admin/bookings/${booking.id}/assign`, { headers, data: { agentId: agent.userId } });
  expect(assigned.ok(), await assigned.text()).toBeTruthy();
  const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  for (const kind of ["before", "after"]) {
    for (let i = 0; i < 4; i++) {
      const photo = await request.post(`/agent/jobs/${booking.id}/photo`, { headers: authHeader(agent.token), data: { kind, image } });
      expect(photo.ok(), await photo.text()).toBeTruthy();
    }
  }
  for (let i = 0; i < 4; i++) {
    const advance = await request.patch(`/agent/jobs/${booking.id}/advance`, { headers: authHeader(agent.token) });
    expect(advance.ok(), await advance.text()).toBeTruthy();
  }
  const completed = await request.get(`/bookings/${booking.id}`, { headers: authHeader(customer.token) });
  expect((await completed.json()).data).toMatchObject({ status: "completed", staffPayment: { status: "created" } });
  expect((await request.post(`/admin/bookings/${booking.id}/collect`, { headers, data: { method: "upi" } })).status()).toBe(400);
  const collected = await request.post(`/admin/bookings/${booking.id}/collect`, { headers, data: { method: "upi", reference: "UPI-STAFF-TEST" } });
  expect(collected.ok(), await collected.text()).toBeTruthy();
  expect((await collected.json()).data).toMatchObject({ status: "paid", collectionMethod: "upi", collectionReference: "UPI-STAFF-TEST", collectionChannel: "staff" });
  expect((await request.post(`/admin/bookings/${booking.id}/collect`, { headers, data: { method: "cash" } })).status()).toBe(400);
  const after = await request.get(`/bookings/${booking.id}`, { headers: authHeader(customer.token) });
  expect((await after.json()).data.staffPayment.status).toBe("paid");
});

test("staff lookup searches phone and name and returns saved customer details", async ({ request }) => {
  const admin = await loginAsAdmin(request);
  const customer = await loginAsNewCustomer(request);
  const headers = authHeader(admin.token);
  const detail = await (await request.get(`/admin/booking-customers/${customer.userId}`, { headers })).json();
  expect(detail.data.vehicles).toEqual(expect.any(Array));
  expect(detail.data.addresses).toEqual(expect.any(Array));
  for (const q of [detail.data.name, detail.data.phone]) {
    const result = await request.get(`/admin/booking-customers?q=${encodeURIComponent(q)}`, { headers });
    expect((await result.json()).data.some((c: { id: string }) => c.id === customer.userId)).toBeTruthy();
  }
});

test("booking employees can use lookup without customer-management permission; other employees cannot", async ({ request }) => {
  const admin = await loginAsAdmin(request);
  const customer = await loginAsNewCustomer(request);
  const headers = authHeader(admin.token);
  for (const allowed of [true, false]) {
    const suffix = `${Date.now()}-${allowed}`;
    const role = await request.post("/admin/roles", { headers, data: { name: `Booking Test ${suffix}`, permissions: allowed ? ["bookings"] : ["dashboard"] } });
    expect(role.ok()).toBeTruthy();
    const roleId = (await role.json()).data.id;
    const email = `booking-${suffix}@example.com`;
    const staff = await request.post("/admin/staff", { headers, data: { name: "Booking Employee", email, password: "test-password-123", adminRoleId: roleId } });
    expect(staff.ok(), await staff.text()).toBeTruthy();
    const login = await request.post("/auth/admin-login", { data: { email, password: "test-password-123" } });
    expect(login.ok()).toBeTruthy();
    const employeeHeaders = authHeader((await login.json()).data.token);
    const lookup = await request.get(`/admin/booking-customers/${customer.userId}`, { headers: employeeHeaders });
    expect(lookup.status()).toBe(allowed ? 200 : 403);
    const options = await request.get("/admin/booking-options", { headers: employeeHeaders });
    expect(options.status()).toBe(allowed ? 200 : 403);
    expect((await request.get(`/admin/customers/${customer.userId}`, { headers: employeeHeaders })).status()).toBe(403);
  }
});

test("staff booking applies the customer's discounts and validates coin redemption on the server", async ({ request }) => {
  const admin = await loginAsAdmin(request);
  const customer = await loginAsNewCustomer(request);
  const headers = authHeader(admin.token);
  const code = `STAFF${Date.now()}`;
  const coupon = await request.post("/admin/discount-codes", { headers, data: { code, type: "flat", value: 20 } });
  expect(coupon.ok(), await coupon.text()).toBeTruthy();
  const options = await (await request.get("/admin/booking-options", { headers })).json();
  const draft = { customerId: customer.userId, vehicleType: "hatchback", vehicleName: "Hyundai i20", vehiclePlate: "MP09AB1234", vehicleColor: "Blue", vehicleColorHex: "#1d4ed8", packageId: options.data.packages[0].id, date: new Date(Date.now() + 86400000 * 2).toISOString(), slot: "11:00 AM", addressLabel: "Home", addressLine: "402, Staff Test Society", discountCode: code, coinsToRedeem: 999999 };
  const preview = await request.post("/admin/bookings/quote", { headers, data: draft });
  expect(preview.ok(), await preview.text()).toBeTruthy();
  expect((await preview.json()).data).toMatchObject({ discountCode: code, discountAmount: 20, coinsRedeemed: 0 });
  const created = await request.post("/admin/bookings", { headers, data: draft });
  expect(created.status(), await created.text()).toBe(201);
  expect((await created.json()).data).toMatchObject({ discountCode: code, discountAmount: 20, coinsRedeemed: 0, vehicleColor: "Blue", vehicleColorHex: "#1d4ed8" });
});
