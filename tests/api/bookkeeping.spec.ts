import { test, expect } from "../fixtures/base";
import { request as pwRequest, type APIRequestContext } from "@playwright/test";
import {
  apiUrl,
  authHeader,
  createVerifiedOnlineAgent,
  loginAsAdmin,
  loginAsNewCustomer,
} from "../fixtures/api-client";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function getConfig(request: APIRequestContext, admin: string): Promise<Json> {
  return (await (await request.get(apiUrl("/admin/bookkeeping/config"), { headers: authHeader(admin) })).json()).data;
}
async function putConfig(request: APIRequestContext, admin: string, body: Json) {
  return request.put(apiUrl("/admin/bookkeeping/config"), { headers: authHeader(admin), data: body });
}

async function packageId(request: APIRequestContext) {
  return (await (await request.get(apiUrl("/catalog/packages"))).json()).data[0].id as string;
}

function bookingBody(pkg: string, extra: Json = {}) {
  return {
    vehicleType: "hatchback",
    vehicleName: "Ledger Car",
    packageId: pkg,
    date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    slot: "11:00 AM",
    addressLabel: "Home",
    addressLine: "1 Ledger Lane",
    ...extra,
  };
}

async function book(request: APIRequestContext, token: string, pkg: string, extra: Json = {}): Promise<Json> {
  const res = await request.post(apiUrl("/bookings"), { headers: authHeader(token), data: bookingBody(pkg, extra) });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).data;
}

async function invoiceFor(request: APIRequestContext, token: string, bookingId: string): Promise<Json> {
  // Issued asynchronously right after the booking is created.
  for (let i = 0; i < 20; i++) {
    const res = await request.get(apiUrl(`/bookings/${bookingId}/invoice`), { headers: authHeader(token) });
    if (res.ok()) return (await res.json()).data;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("invoice never became available");
}

const round2 = (n: number) => Math.round(n * 100) / 100;

test.describe("Bookkeeping: GST at checkout and invoices", () => {
  let original: Json;
  test.beforeAll(async ({ request }) => {
    const { token } = await loginAsAdmin(request);
    original = await getConfig(request, token);
  });
  test.afterEach(async ({ request }) => {
    // Every test edits the one global settings document — always put it back.
    const { token } = await loginAsAdmin(request);
    await putConfig(request, token, { tax: original.tax, invoice: original.invoice, template: original.template, business: original.business });
  });

  test("with GST off nothing changes: payable equals price and the invoice carries no tax", async ({ request }) => {
    const { token: admin } = await loginAsAdmin(request);
    expect((await putConfig(request, admin, { tax: { enabled: false } })).ok()).toBeTruthy();
    expect((await (await request.get(apiUrl("/catalog/tax"))).json()).data.enabled).toBe(false);

    const { token } = await loginAsNewCustomer(request);
    const pkg = await packageId(request);
    const preview = (await (await request.post(apiUrl("/payments/preview"), { headers: authHeader(token), data: { vehicleType: "hatchback", packageId: pkg } })).json()).data;
    expect(preview.payable).toBe(preview.price);
    expect(preview.tax.taxAmount).toBe(0);

    const b = await book(request, token, pkg);
    expect(b.taxAmount).toBe(0);
    expect(b.payableAmount).toBe(b.price);
    const { invoice } = await invoiceFor(request, token, b.id);
    expect(invoice.total).toBe(b.price);
    expect(invoice.taxAmount).toBe(0);
    expect(invoice.status).toBe("issued");
  });

  test("GST on (intra-state): CGST + SGST added on top, quote = charge = booking = invoice, payouts untouched", async ({ request }) => {
    const { token: admin } = await loginAsAdmin(request);
    const save = await putConfig(request, admin, {
      tax: { enabled: true, rate: 18, supplyType: "intra", label: "GST", sacCode: "998729" },
      business: { legalName: "NexClean Services Pvt Ltd", gstin: "23ABCDE1234F1Z5", state: "Madhya Pradesh", stateCode: "23" },
    });
    expect(save.ok(), await save.text()).toBeTruthy();
    expect((await (await request.get(apiUrl("/catalog/tax"))).json()).data).toMatchObject({ enabled: true, rate: 18, supplyType: "intra" });

    const { token } = await loginAsNewCustomer(request);
    const pkg = await packageId(request);

    const preview = (await (await request.post(apiUrl("/payments/preview"), { headers: authHeader(token), data: { vehicleType: "hatchback", packageId: pkg } })).json()).data;
    const P = preview.price;
    const half = round2((P * 18) / 200);
    expect(preview.tax).toMatchObject({ taxRate: 18, cgstAmount: half, sgstAmount: half, igstAmount: 0, taxableAmount: P });
    expect(preview.payable).toBe(Math.round(P + 2 * half));
    expect(Number.isInteger(preview.payable)).toBe(true);
    expect(round2(P + preview.tax.taxAmount + preview.tax.roundOff)).toBe(preview.payable);

    // The order is for the taxed total; a stale quote (the pre-GST price) is refused.
    const stale = await request.post(apiUrl("/payments/order"), {
      headers: authHeader(token),
      data: { booking: bookingBody(pkg), expectedAmount: P },
    });
    expect(stale.status()).toBe(409);
    const order = await request.post(apiUrl("/payments/order"), {
      headers: authHeader(token),
      data: { booking: bookingBody(pkg), expectedAmount: preview.payable },
    });
    expect(order.ok(), await order.text()).toBeTruthy();
    expect((await order.json()).data.amount).toBe(preview.payable);

    // Booking snapshots the tax; price stays the pre-tax service value.
    const b = await book(request, token, pkg);
    expect(b.price).toBe(P);
    expect(b).toMatchObject({ taxableAmount: P, taxRate: 18, cgstAmount: half, sgstAmount: half, payableAmount: preview.payable });

    // Invoice mirrors it, with the seller details snapshotted.
    const { invoice, template } = await invoiceFor(request, token, b.id);
    expect(invoice.invoiceNumber).toMatch(/^[A-Z0-9-]+\/\d{4}-\d{2}\/\d{5}$/);
    expect(invoice).toMatchObject({ taxableAmount: P, cgstAmount: half, sgstAmount: half, taxAmount: 2 * half, total: preview.payable, status: "issued" });
    expect(invoice.lines[0]).toMatchObject({ kind: "service", sac: "998729", amount: P });
    expect(invoice.seller).toMatchObject({ legalName: "NexClean Services Pvt Ltd", gstin: "23ABCDE1234F1Z5" });
    expect(template.title).toBeTruthy();

    // Admin booking detail shows the same breakdown.
    const detail = (await (await request.get(apiUrl(`/admin/bookings/${b.id}`), { headers: authHeader(admin) })).json()).data;
    expect(detail).toMatchObject({ taxableAmount: P, cgstAmount: half, sgstAmount: half, totalAmount: preview.payable });

    // Another customer can't see it.
    const { token: other } = await loginAsNewCustomer(request);
    expect((await request.get(apiUrl(`/bookings/${b.id}/invoice`), { headers: authHeader(other) })).status()).toBe(404);
  });

  test("inter-state supply charges IGST instead", async ({ request }) => {
    const { token: admin } = await loginAsAdmin(request);
    await putConfig(request, admin, { tax: { enabled: true, rate: 12, supplyType: "inter" } });
    const { token } = await loginAsNewCustomer(request);
    const b = await book(request, token, await packageId(request));
    expect(b.cgstAmount).toBe(0);
    expect(b.sgstAmount).toBe(0);
    expect(b.igstAmount).toBe(round2((b.price * 12) / 100));
    const { invoice } = await invoiceFor(request, token, b.id);
    expect(invoice).toMatchObject({ supplyType: "inter", igstAmount: b.igstAmount, taxRate: 12 });
  });

  test("invoice numbers are unique and sequential; a new prefix applies to new invoices", async ({ request }) => {
    const { token: admin } = await loginAsAdmin(request);
    const prefix = `T${Date.now().toString(36).slice(-5).toUpperCase()}`;
    expect((await putConfig(request, admin, { invoice: { prefix, numberPadding: 6 } })).ok()).toBeTruthy();
    const { token } = await loginAsNewCustomer(request);
    const pkg = await packageId(request);
    const seq = (n: string) => Number(n.split("/").pop());

    // Race it on purpose: right after each booking is created (when the
    // server is issuing its invoice in the background), fire five invoice
    // requests at once. Every one must get the same number, and no number
    // may be skipped across bookings.
    const numbers: string[] = [];
    for (let i = 0; i < 4; i++) {
      const b = await book(request, token, pkg);
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          request.get(apiUrl(`/bookings/${b.id}/invoice`), { headers: authHeader(token) }).then((r) => r.json()),
        ),
      );
      const got = new Set(results.map((r) => r.data.invoice.invoiceNumber));
      expect(got.size, `booking ${i} got ${[...got].join(", ")}`).toBe(1);
      numbers.push([...got][0]);
    }
    expect(numbers[0].startsWith(`${prefix}/`)).toBe(true);
    expect(numbers[0]).toMatch(/\/\d{6}$/);
    for (let i = 1; i < numbers.length; i++) {
      expect(seq(numbers[i]), numbers.join(" → ")).toBe(seq(numbers[i - 1]) + 1);
    }
  });

  test("invoice status follows the booking: cancelled, and paid on completion", async ({ request }) => {
    test.setTimeout(90_000);
    const { token } = await loginAsNewCustomer(request);
    const pkg = await packageId(request);

    const c = await book(request, token, pkg);
    await invoiceFor(request, token, c.id);
    expect((await request.patch(apiUrl(`/bookings/${c.id}/cancel`), { headers: authHeader(token) })).ok()).toBeTruthy();
    let status = "";
    for (let i = 0; i < 20 && status !== "cancelled"; i++) {
      status = (await invoiceFor(request, token, c.id)).invoice.status;
      if (status !== "cancelled") await new Promise((r) => setTimeout(r, 150));
    }
    expect(status).toBe("cancelled");

    // Completion: an isolated cleaner takes and finishes the job.
    const lat = 5 + Math.random() * 4;
    const lng = 60 + Math.random() * 4;
    const agent = await createVerifiedOnlineAgent(request, { lat, lng });
    const done = await book(request, token, pkg, { lat, lng });
    for (let i = 0; i < 40; i++) {
      const body = await (await request.get(apiUrl("/agent/offers/current"), { headers: authHeader(agent.token) })).json();
      if (body.data?.bookingId === done.id) break;
      await new Promise((r) => setTimeout(r, 300));
    }
    expect((await request.post(apiUrl(`/agent/offers/${done.id}/accept`), { headers: authHeader(agent.token) })).ok()).toBeTruthy();
    for (const kind of ["before", "after"] as const) {
      for (let i = 0; i < 4; i++) {
        await request.post(apiUrl(`/agent/jobs/${done.id}/photo`), { headers: authHeader(agent.token), data: { kind, image: TINY_PNG } });
      }
    }
    for (let i = 0; i < 4; i++) await request.patch(apiUrl(`/agent/jobs/${done.id}/advance`), { headers: authHeader(agent.token) });
    expect((await invoiceFor(request, token, done.id)).invoice.status).toBe("paid");
  });

  test("admin edits bill-to, line wording and notes — never the amounts — and invalid input is refused", async ({ request }) => {
    const { token: admin } = await loginAsAdmin(request);
    const { token } = await loginAsNewCustomer(request);
    const b = await book(request, token, await packageId(request));
    const { invoice } = await invoiceFor(request, token, b.id);

    const list = (await (await request.get(apiUrl(`/admin/bookkeeping/invoices?q=${encodeURIComponent(invoice.invoiceNumber)}`), { headers: authHeader(admin) })).json()).data;
    expect(list.items.map((i: Json) => i.id)).toContain(invoice.id);

    const bad = await request.patch(apiUrl(`/admin/bookkeeping/invoices/${invoice.id}`), {
      headers: authHeader(admin),
      data: { billTo: { gstin: "NOT-A-GSTIN" } },
    });
    expect(bad.status()).toBe(400);

    const edit = await request.patch(apiUrl(`/admin/bookkeeping/invoices/${invoice.id}`), {
      headers: authHeader(admin),
      data: {
        billTo: { name: "Acme Fleet Pvt Ltd", gstin: "27aapfu0939f1zv", address: "Andheri East, Mumbai" },
        notes: "PO #4471",
        lines: [{ index: 0, description: "Fleet wash — hatchback" }],
        // Not editable: ignored.
        total: 1,
      },
    });
    expect(edit.ok(), await edit.text()).toBeTruthy();
    const edited = (await edit.json()).data.invoice;
    expect(edited.billTo).toMatchObject({ name: "Acme Fleet Pvt Ltd", gstin: "27AAPFU0939F1ZV" });
    expect(edited.notes).toBe("PO #4471");
    expect(edited.lines[0].description).toBe("Fleet wash — hatchback");
    expect(edited.total).toBe(invoice.total);
    expect(edited.revision).toBe(1);
    expect(edited.editedBy).not.toBe("");

    // The customer sees the corrected invoice, and a later refresh keeps the wording.
    const seen = (await invoiceFor(request, token, b.id)).invoice;
    expect(seen.billTo.name).toBe("Acme Fleet Pvt Ltd");
    expect(seen.lines[0].description).toBe("Fleet wash — hatchback");
  });

  test("template and settings are validated, saved and resettable", async ({ request }) => {
    const { token: admin } = await loginAsAdmin(request);
    for (const body of [
      { tax: { rate: 30 } },
      { template: { accentColor: "teal" } },
      { business: { gstin: "123" } },
      { invoice: { prefix: "bad prefix!" } },
    ]) {
      expect((await putConfig(request, admin, body)).status(), JSON.stringify(body)).toBe(400);
    }
    const save = await putConfig(request, admin, {
      template: { title: "Bill of Supply", accentColor: "#1d4ed8", showSignature: false, labels: { total: "Grand total" } },
    });
    expect(save.ok()).toBeTruthy();
    const cfg = (await save.json()).data;
    expect(cfg.template).toMatchObject({ title: "Bill of Supply", accentColor: "#1d4ed8", showSignature: false });
    expect(cfg.template.labels.total).toBe("Grand total");
    // Untouched labels kept.
    expect(cfg.template.labels.billTo).toBe(original.template.labels.billTo);

    const reset = (await (await request.post(apiUrl("/admin/bookkeeping/template/reset"), { headers: authHeader(admin) })).json()).data;
    expect(reset.template.title).toBe("Tax Invoice");
    expect(reset.template.labels.total).toBe("Total payable");
  });

  test("summary adds up the period's bookings, GST and refunds", async ({ request }) => {
    const { token: admin } = await loginAsAdmin(request);
    await putConfig(request, admin, { tax: { enabled: true, rate: 18, supplyType: "intra" } });
    // Exactly now: earlier tests' bookings were created only milliseconds ago.
    const from = new Date().toISOString();
    const { token } = await loginAsNewCustomer(request);
    const pkg = await packageId(request);
    const a = await book(request, token, pkg);
    const b = await book(request, token, pkg);
    const cancelled = await book(request, token, pkg);
    await request.patch(apiUrl(`/bookings/${cancelled.id}/cancel`), { headers: authHeader(token) });
    const to = new Date(Date.now() + 60_000).toISOString();

    const s = (await (await request.get(apiUrl(`/admin/bookkeeping/summary?from=${from}&to=${to}`), { headers: authHeader(admin) })).json()).data;
    expect(s.bookings).toBe(2);
    expect(s.cancelledBookings).toBe(1);
    expect(s.taxableValue).toBe(round2(a.price + b.price));
    expect(s.taxCollected).toBe(round2(a.taxAmount + b.taxAmount));
    expect(s.cgst).toBe(round2(a.cgstAmount + b.cgstAmount));
    expect(s.totalBilled).toBe(round2(a.payableAmount + b.payableAmount));
    expect(s.platformNet).toBe(s.taxableValue); // nothing completed yet → no payouts

    expect((await request.get(apiUrl(`/admin/bookkeeping/summary?from=${to}&to=${from}`), { headers: authHeader(admin) })).status()).toBe(400);
  });

  test("bookkeeping is admin-only", async ({ request }) => {
    const { token } = await loginAsNewCustomer(request);
    for (const path of ["/admin/bookkeeping/config", "/admin/bookkeeping/summary", "/admin/bookkeeping/invoices"]) {
      expect((await request.get(apiUrl(path), { headers: authHeader(token) })).status(), path).toBe(403);
    }
    const anon = await pwRequest.newContext();
    expect((await anon.get(apiUrl("/admin/bookkeeping/config"))).status()).toBe(401);
    // The public tax endpoint exposes the rate only — no business details.
    const pub = (await (await anon.get(apiUrl("/catalog/tax"))).json()).data;
    expect(Object.keys(pub).sort()).toEqual(["enabled", "label", "rate", "supplyType"]);
    await anon.dispose();
  });
});
