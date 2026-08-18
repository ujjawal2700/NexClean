import type { APIRequestContext } from "@playwright/test";
import { authHeader } from "./api-client";

/**
 * Cancel the bookings a spec created, so they stop loading the dispatch pipeline.
 *
 * Every booking made through the app enters real-time dispatch and sits in
 * "searching", holding offer cycles and geo queries until something assigns it.
 * They are never assigned in most specs, so each one is permanent background
 * load on a shared database — and run-all.sh already documents that the suite
 * degrades once enough of them pile up.
 *
 * That degradation is not theoretical: adding the reschedule specs pushed a full
 * run from ~9 to ~16 minutes and timed out four unrelated admin screens on
 * `loginAdminUI`, purely because the backend was busy. Cancelling takes them out
 * of both the dispatch queue and the missed-slot sweep.
 *
 * Matched on `vehicleName` because every spec already stamps its bookings with a
 * distinctive one, and that avoids threading ids through every test.
 */
export async function cancelTestBookings(
  request: APIRequestContext,
  adminToken: string,
  vehicleName: string,
): Promise<number> {
  const res = await request.get("/admin/bookings", { headers: authHeader(adminToken) });
  if (!res.ok()) return 0;

  const rows = (await res.json()).data as Array<{ id: string; vehicleName: string; status: string }>;
  const mine = rows.filter((b) => b.vehicleName === vehicleName && b.status !== "cancelled");

  let cancelled = 0;
  for (const booking of mine) {
    const done = await request.patch(`/admin/bookings/${booking.id}/cancel`, {
      headers: authHeader(adminToken),
    });
    if (done.ok()) cancelled++;
  }
  return cancelled;
}
