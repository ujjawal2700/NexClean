import { test, expect, type APIRequestContext } from "../fixtures/base";
import { authHeader, loginAsAdmin, loginAsNewCustomer } from "../fixtures/api-client";

/**
 * Suggesting off-peak windows from booking history.
 *
 * These assert *invariants* rather than a fixed set of windows. The suite shares
 * one database and several other specs create and complete bookings, so any test
 * pinning exact counts would pass or fail depending on what ran before it. The
 * properties below hold no matter what else is in the table — which is also a
 * stronger statement about the algorithm than one hand-checked example.
 */

const SLOTS = [
  "08:00 AM",
  "09:30 AM",
  "11:00 AM",
  "12:30 PM",
  "02:00 PM",
  "03:30 PM",
  "05:00 PM",
  "06:30 PM",
];

type Cell = { day: number; slot: string; count: number; offPeak: boolean };
type DaySummary = { day: number; label: string; total: number; median: number; enoughData: boolean };
type Suggestion = {
  lookbackWeeks: number;
  sensitivity: number;
  minSamplesPerDay: number;
  totalBookings: number;
  excludedDiscounted: number;
  days: DaySummary[];
  grid: Cell[];
  windows: { day: number; start: string; end: string; label: string }[];
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const slotMinutes = (slot: string) => {
  const m = /^(\d{2}):(\d{2}) (AM|PM)$/.exec(slot)!;
  let hour = Number(m[1]);
  if (m[3] === "AM" && hour === 12) hour = 0;
  if (m[3] === "PM" && hour !== 12) hour += 12;
  return hour * 60 + Number(m[2]);
};

async function suggest(
  request: APIRequestContext,
  token: string,
  query = "?minSamples=0",
): Promise<Suggestion> {
  const res = await request.get(`/admin/off-peak-hours/suggest${query}`, { headers: authHeader(token) });
  expect(res.ok(), `suggest failed: ${await res.text()}`).toBeTruthy();
  return (await res.json()).data as Suggestion;
}

test.describe("Off-peak suggestions", () => {
  let adminToken = "";

  test.beforeAll(async ({ request }) => {
    adminToken = (await loginAsAdmin(request)).token;
  });

  test("requires admin auth", async ({ request }) => {
    const res = await request.get("/admin/off-peak-hours/suggest");
    expect(res.status()).toBe(401);
  });

  test("returns a full weekday × slot grid", async ({ request }) => {
    const result = await suggest(request, adminToken);

    expect(result.grid).toHaveLength(7 * SLOTS.length);
    expect(result.days).toHaveLength(7);
    for (let day = 0; day <= 6; day++) {
      for (const slot of SLOTS) {
        expect(
          result.grid.find((c) => c.day === day && c.slot === slot),
          `missing cell for day ${day} ${slot}`,
        ).toBeTruthy();
      }
    }
  });

  test("a slot is marked off-peak exactly when it sits at or below its weekday's median", async ({
    request,
  }) => {
    const result = await suggest(request, adminToken);

    for (const cell of result.grid) {
      const day = result.days.find((d) => d.day === cell.day)!;
      const expected = day.enoughData && cell.count <= day.median * result.sensitivity;
      expect(
        cell.offPeak,
        `day ${cell.day} ${cell.slot}: count ${cell.count}, median ${day.median} → expected offPeak=${expected}`,
      ).toBe(expected);
    }
  });

  test("the busiest slot of a day is never proposed as off-peak", async ({ request }) => {
    const result = await suggest(request, adminToken);

    for (const day of result.days) {
      const cells = result.grid.filter((c) => c.day === day.day);
      const busiest = Math.max(...cells.map((c) => c.count));
      // Only meaningful once a day has any spread at all.
      if (busiest === 0 || cells.every((c) => c.count === busiest)) continue;
      const busiestCells = cells.filter((c) => c.count === busiest);
      for (const cell of busiestCells) {
        expect(cell.offPeak, `${day.label} ${cell.slot} is the busiest slot and must be peak`).toBe(false);
      }
    }
  });

  test("proposed windows cover exactly the off-peak slots, on slot boundaries", async ({ request }) => {
    const result = await suggest(request, adminToken);

    for (const cell of result.grid) {
      const covering = result.windows.filter(
        (w) =>
          w.day === cell.day &&
          slotMinutes(cell.slot) >= toMinutes(w.start) &&
          slotMinutes(cell.slot) < toMinutes(w.end),
      );
      if (cell.offPeak) {
        expect(covering, `${cell.slot} is off-peak so exactly one window must cover it`).toHaveLength(1);
      } else {
        expect(covering, `${cell.slot} is peak and must not be covered`).toHaveLength(0);
      }
    }
  });

  test("windows never overlap and always end after they start", async ({ request }) => {
    const result = await suggest(request, adminToken);

    for (let day = 0; day <= 6; day++) {
      const dayWindows = result.windows
        .filter((w) => w.day === day)
        .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
      for (const w of dayWindows) {
        expect(toMinutes(w.end)).toBeGreaterThan(toMinutes(w.start));
      }
      for (let i = 1; i < dayWindows.length; i++) {
        expect(
          toMinutes(dayWindows[i].start),
          `windows overlap on day ${day}`,
        ).toBeGreaterThanOrEqual(toMinutes(dayWindows[i - 1].end));
      }
    }
  });

  test("the proposal is accepted by the config endpoint it is meant to fill", async ({ request }) => {
    const result = await suggest(request, adminToken);

    // Round-trip through the real validator: overlapping or malformed windows
    // would be rejected there, so this proves a suggestion is directly saveable.
    const applied = await request.put("/admin/off-peak-hours", {
      headers: authHeader(adminToken),
      data: { windows: result.windows },
    });
    expect(applied.ok(), `suggested windows were rejected: ${await applied.text()}`).toBeTruthy();

    await request.put("/admin/off-peak-hours", { headers: authHeader(adminToken), data: { windows: [] } });
  });

  test("suggesting never changes the stored config on its own", async ({ request }) => {
    await request.put("/admin/off-peak-hours", {
      headers: authHeader(adminToken),
      data: { windows: [{ day: 2, start: "09:00", end: "10:00", label: "Untouched" }] },
    });

    await suggest(request, adminToken);

    const after = (await (await request.get("/admin/off-peak-hours", { headers: authHeader(adminToken) })).json())
      .data as { windows: { label: string }[] };
    expect(after.windows).toHaveLength(1);
    expect(after.windows[0].label, "suggest must propose, never apply").toBe("Untouched");

    await request.put("/admin/off-peak-hours", { headers: authHeader(adminToken), data: { windows: [] } });
  });

  test("a weekday without enough history is left alone rather than guessed at", async ({ request }) => {
    // An impossibly high bar means no weekday qualifies, which is exactly the
    // cold-start case: propose nothing rather than discount on thin evidence.
    const result = await suggest(request, adminToken, "?minSamples=100000");

    expect(result.days.every((d) => !d.enoughData)).toBe(true);
    expect(result.grid.every((c) => !c.offPeak)).toBe(true);
    expect(result.windows).toHaveLength(0);
  });

  test("bookings won by an off-peak discount are excluded from the demand counts", async ({ request }) => {
    const before = await suggest(request, adminToken);

    // Configure a window, mint an off-peak code, book into it, and complete it.
    await request.put("/admin/off-peak-hours", {
      headers: authHeader(adminToken),
      data: {
        timezone: "Asia/Kolkata",
        active: true,
        windows: Array.from({ length: 7 }, (_, day) => ({ day, start: "10:00", end: "12:00" })),
      },
    });

    const code = `SUGGEST${Date.now()}`;
    await request.post("/admin/discount-codes", {
      headers: authHeader(adminToken),
      data: { code, type: "flat", value: 25, offPeakOnly: true },
    });

    const { token } = await loginAsNewCustomer(request);
    const packageId = (await (await request.get("/catalog/packages")).json()).data[0].id;
    const booked = await request.post("/payments/verify", {
      headers: authHeader(token),
      data: {
        booking: {
          vehicleType: "hatchback",
          vehicleName: "Suggest Test Car",
          packageId,
          date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          slot: "11:00 AM",
          addressLabel: "Home",
          addressLine: "1 Suggest Street",
          discountCode: code,
        },
      },
    });
    expect(booked.status()).toBe(201);
    const bookingId = (await booked.json()).data.id;

    await request.patch(`/admin/bookings/${bookingId}/status`, {
      headers: authHeader(adminToken),
      data: { status: "completed" },
    });

    const after = await suggest(request, adminToken);

    // The discounted booking must land in the excluded tally, not the demand one.
    expect(after.excludedDiscounted).toBe(before.excludedDiscounted + 1);
    expect(after.totalBookings).toBe(before.totalBookings);

    await request.put("/admin/off-peak-hours", { headers: authHeader(adminToken), data: { windows: [] } });
  });

  test("an undiscounted completed booking does count as demand", async ({ request }) => {
    const before = await suggest(request, adminToken);

    const { token } = await loginAsNewCustomer(request);
    const packageId = (await (await request.get("/catalog/packages")).json()).data[0].id;
    const booked = await request.post("/payments/verify", {
      headers: authHeader(token),
      data: {
        booking: {
          vehicleType: "hatchback",
          vehicleName: "Demand Test Car",
          packageId,
          date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          slot: "03:30 PM",
          addressLabel: "Home",
          addressLine: "1 Demand Street",
        },
      },
    });
    const bookingId = (await booked.json()).data.id;
    await request.patch(`/admin/bookings/${bookingId}/status`, {
      headers: authHeader(adminToken),
      data: { status: "completed" },
    });

    const after = await suggest(request, adminToken);
    expect(after.totalBookings).toBe(before.totalBookings + 1);
    expect(after.excludedDiscounted).toBe(before.excludedDiscounted);
  });

  test("rejects out-of-range options", async ({ request }) => {
    for (const query of ["?weeks=0", "?weeks=200", "?sensitivity=0", "?sensitivity=9", "?minSamples=-1"]) {
      const res = await request.get(`/admin/off-peak-hours/suggest${query}`, {
        headers: authHeader(adminToken),
      });
      expect(res.status(), `${query} should be rejected`).toBe(400);
    }
  });

  test("sensitivity widens what counts as quiet", async ({ request }) => {
    const strict = await suggest(request, adminToken, "?minSamples=0&sensitivity=0.5");
    const loose = await suggest(request, adminToken, "?minSamples=0&sensitivity=3");

    const quiet = (s: Suggestion) => s.grid.filter((c) => c.offPeak).length;
    expect(quiet(loose)).toBeGreaterThanOrEqual(quiet(strict));
  });
});
