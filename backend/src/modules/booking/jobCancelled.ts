import { emitToUser } from "../../shared/services/socket";
import { notifyUser } from "../notification/notification.service";

/**
 * Tell the cleaner on a booking that it was cancelled — a live event so an open
 * job screen flips to "cancelled" at once, plus a push + in-app notification
 * for a phone that's locked or has the app in the background.
 *
 * Every cancellation path calls this. Admin cancellations used to tell only
 * the customer, so the cleaner's app kept showing the job until it was
 * refreshed — and a cleaner could set off for a job that no longer existed.
 */
export function tellAgentJobCancelled(
  agentId: string | null | undefined,
  booking: { _id: unknown; packageName: string; slot: string },
  by: "customer" | "admin",
): void {
  if (!agentId) return;
  const bookingId = String(booking._id);
  emitToUser(agentId, "job_cancelled", { bookingId });
  void notifyUser(agentId, {
    type: "booking",
    title: "❌ Job cancelled",
    body: `${booking.packageName} · ${booking.slot} was cancelled by ${by === "customer" ? "the customer" : "NexClean"}. You don't need to go.`,
    data: { bookingId, role: "agent" },
  }).catch((err) => console.error("cancel notification failed:", (err as Error).message));
}
