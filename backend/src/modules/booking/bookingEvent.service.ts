import { Types } from "mongoose";
import { BookingEvent, type BookingEventType } from "./bookingEvent.model";
import { Booking } from "./booking.model";
import { User } from "../user/user.model";
import { ensureInvoiceForBooking, refreshInvoice } from "../bookkeeping/invoice.service";

export type BookingEventInput = {
  type: BookingEventType;
  /** Any id-like value (string, ObjectId, populated ref id); stringified on write. */
  agentId?: { toString(): string } | null;
  agentName?: string | null;
  actor?: "customer" | "agent" | "admin" | "system";
  actorName?: string | null;
  reason?: string | null;
  meta?: Record<string, unknown>;
  at?: Date;
};

/**
 * Record one step in a booking's history. Never throws and never blocks the
 * caller's flow: the timeline is a record of what happened, so failing to
 * write it must not undo or delay the thing that happened.
 */
export function logBookingEvent(bookingId: { toString(): string }, event: BookingEventInput): void {
  const agentId = event.agentId ? String(event.agentId) : null;
  void BookingEvent.create({
    booking: bookingId,
    type: event.type,
    at: event.at ?? new Date(),
    agent: agentId && Types.ObjectId.isValid(agentId) ? new Types.ObjectId(agentId) : null,
    agentName: event.agentName ?? "",
    actor: event.actor ?? "system",
    actorName: event.actorName ?? "",
    reason: event.reason ?? "",
    meta: event.meta,
  }).catch((err) => console.error(`booking event "${event.type}" failed:`, (err as Error).message));
  // Every path that cancels, completes or moves a booking logs it here, so this
  // is the one place that keeps the booking's invoice in step.
  if (event.type === "created") {
    // The one place an invoice is issued, so two code paths can never race
    // for the same booking and burn an invoice number (GST invoice series
    // should run without gaps).
    void ensureInvoiceForBooking(String(bookingId)).catch((err) =>
      console.error("invoice generation failed:", (err as Error).message),
    );
  } else if (INVOICE_EVENTS.has(event.type)) {
    refreshInvoice(String(bookingId));
  }
}

const INVOICE_EVENTS = new Set<BookingEventType>(["cancelled", "completed", "rescheduled"]);

/** An admin's display name for the timeline ("Admin" when unknown). */
export async function adminName(adminId?: string | null): Promise<string> {
  if (!adminId || !Types.ObjectId.isValid(adminId)) return "Admin";
  const admin = await User.findById(adminId).select("name email").lean();
  return admin?.name || admin?.email || "Admin";
}

export type TimelineEntry = {
  id: string;
  type: BookingEventType;
  at: string | null;
  agent: { id: string; name: string } | null;
  actor: "customer" | "agent" | "admin" | "system";
  actorName: string;
  reason: string;
  meta?: Record<string, unknown>;
  /** True for entries rebuilt from a booking made before the timeline existed. */
  derived?: boolean;
};

/**
 * The full timeline for one booking, oldest first. Bookings created before
 * event logging shipped have no events, so their history is rebuilt from the
 * timestamps the booking itself kept (created, assigned, started, completed,
 * cleaner releases). Declines on those old bookings were stored without a
 * time, so they're listed but undated.
 */
export async function getBookingTimeline(bookingId: string): Promise<TimelineEntry[]> {
  const events = await BookingEvent.find({ booking: bookingId }).sort({ at: 1, _id: 1 }).lean();
  // Fill in names for events that only stored the agent id.
  const missing = events.filter((e) => e.agent && !e.agentName).map((e) => e.agent);
  const names = new Map<string, string>();
  if (missing.length) {
    const users = await User.find({ _id: { $in: missing } }).select("name").lean();
    users.forEach((u) => names.set(String(u._id), u.name ?? ""));
  }
  const entries: TimelineEntry[] = events.map((e) => ({
    id: String(e._id),
    type: e.type as BookingEventType,
    at: e.at ? new Date(e.at).toISOString() : null,
    agent: e.agent ? { id: String(e.agent), name: e.agentName || names.get(String(e.agent)) || "Cleaner" } : null,
    actor: (e.actor ?? "system") as TimelineEntry["actor"],
    actorName: e.actorName ?? "",
    reason: e.reason ?? "",
    meta: (e.meta as Record<string, unknown> | undefined) ?? undefined,
  }));
  if (entries.length > 0) return entries;
  return deriveLegacyTimeline(bookingId);
}

async function deriveLegacyTimeline(bookingId: string): Promise<TimelineEntry[]> {
  const b = await Booking.findById(bookingId).populate("user", "name").lean();
  if (!b) return [];
  const out: TimelineEntry[] = [];
  const push = (e: Omit<TimelineEntry, "id" | "derived">) =>
    out.push({ ...e, id: `derived-${out.length}`, derived: true });
  const customerName = (b.user as unknown as { name?: string } | null)?.name ?? b.customerName ?? "Customer";

  push({
    type: "created",
    at: b.createdAt ? new Date(b.createdAt).toISOString() : null,
    agent: null,
    actor: b.isSubscriptionWash ? "system" : "customer",
    actorName: b.isSubscriptionWash ? "" : customerName,
    reason: "",
  });

  const declined = (b.declinedAgents ?? []).map(String);
  const released = new Set((b.agentReleases ?? []).map((r) => String(r.agent)));
  const declineOnly = declined.filter((id) => !released.has(id));
  if (declineOnly.length) {
    const users = await User.find({ _id: { $in: declineOnly } }).select("name").lean();
    const byId = new Map(users.map((u) => [String(u._id), u.name ?? "Cleaner"]));
    declineOnly.forEach((id) =>
      push({ type: "declined", at: null, agent: { id, name: byId.get(id) ?? "Cleaner" }, actor: "agent", actorName: "", reason: "" }),
    );
  }

  (b.agentReleases ?? []).forEach((r) =>
    push({
      type: "released",
      at: r.at ? new Date(r.at).toISOString() : null,
      agent: { id: String(r.agent), name: r.agentName || "Cleaner" },
      actor: "agent",
      actorName: r.agentName || "",
      reason: r.reason ?? "",
    }),
  );

  const agent = b.assignedAgent ? { id: String(b.assignedAgent), name: b.agentName || "Cleaner" } : null;
  if (b.assignedAt && agent) {
    push({ type: "accepted", at: new Date(b.assignedAt).toISOString(), agent, actor: "agent", actorName: agent.name, reason: "" });
  }
  if (b.jobStartedAt) {
    push({ type: "started", at: new Date(b.jobStartedAt).toISOString(), agent, actor: "agent", actorName: agent?.name ?? "", reason: "" });
  }
  if (b.jobCompletedAt || b.status === "completed") {
    push({
      type: "completed",
      at: b.jobCompletedAt ? new Date(b.jobCompletedAt).toISOString() : null,
      agent,
      actor: "agent",
      actorName: agent?.name ?? "",
      reason: "",
    });
  }
  if (b.status === "cancelled") {
    push({ type: "cancelled", at: b.updatedAt ? new Date(b.updatedAt).toISOString() : null, agent: null, actor: "system", actorName: "", reason: "" });
  }

  // Dated entries in order; undated declines stay right after "created".
  const [first, ...rest] = out;
  const undated = rest.filter((e) => !e.at);
  const dated = rest.filter((e) => e.at).sort((x, y) => (x.at! < y.at! ? -1 : 1));
  return [first, ...undated, ...dated];
}
