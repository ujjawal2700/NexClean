import { Types } from "mongoose";
import { Booking, type BookingDocument } from "../booking/booking.model";
import { notifyUser, pushToUser } from "../notification/notification.service";
import { emitToUser, emitToAdmins } from "../../shared/services/socket";
import { offerNext, emitDispatchUpdate } from "./dispatch.service";
// Re-exported for backwards compatibility. The list itself lives in
// shared/slots.ts — a second copy here could drift from the one the booking
// validator enforces, and this module is what decides when a job is overdue.
import { TIME_SLOTS as SLOTS } from "../../shared/slots";
import { RescheduleConfig } from "./rescheduleConfig.model";
import { getOffPeakHoursConfig, isOffPeakSlotWithConfig } from "../promotions/offPeakHours.service";

export const TIME_SLOTS: readonly string[] = SLOTS;

/**
 * Sweep settings, persisted. These were module-level `let`s until they were
 * found reverting on every deploy — see rescheduleConfig.model for the story.
 * The returned shape is unchanged so existing callers and the admin endpoints
 * keep working; only the storage moved.
 */
export async function getRescheduleConfig(): Promise<{
  rescheduleBufferMinutes: number;
  maxConsecutiveDaysLimit: number;
}> {
  const existing = await RescheduleConfig.findById("global");
  const doc = existing ?? (await createGlobalConfig());
  return {
    rescheduleBufferMinutes: doc.bufferMinutes,
    maxConsecutiveDaysLimit: doc.maxDaysLimit,
  };
}

async function createGlobalConfig() {
  try {
    return await RescheduleConfig.create({ _id: "global" });
  } catch (err) {
    // Concurrent first-hits race to insert the same _id; the loser reads.
    const raced = await RescheduleConfig.findById("global");
    if (raced) return raced;
    throw err;
  }
}

export async function updateRescheduleConfig(config: { bufferMinutes?: number; maxDaysLimit?: number }) {
  const update: Record<string, number> = {};
  if (config.bufferMinutes !== undefined && config.bufferMinutes >= 0) {
    update.bufferMinutes = Math.round(config.bufferMinutes);
  }
  if (config.maxDaysLimit !== undefined && config.maxDaysLimit > 0) {
    update.maxDaysLimit = Math.round(config.maxDaysLimit);
  }
  await RescheduleConfig.findByIdAndUpdate(
    "global",
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return getRescheduleConfig();
}

/** Parse a slot string like "05:00 PM" into [hour, minute] in 24h format. */
export function slotTo24h(slot: string): [number, number] {
  const [timePart, meridiem] = slot.split(" ");
  const [h, m] = timePart.split(":").map(Number);
  const hour = meridiem === "PM" && h !== 12 ? h + 12 : meridiem === "AM" && h === 12 ? 0 : h;
  return [hour, m];
}

/** Calculate exact slot start and end Date objects for a given booking date & slot. */
export function getSlotTimeRange(bookingDate: Date, slot: string): { start: Date; end: Date } {
  const [h, m] = slotTo24h(slot);
  const start = new Date(bookingDate);
  start.setHours(h, m, 0, 0);
  // Each slot defaults to 90 minutes
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  return { start, end };
}

function customerId(b: BookingDocument): string {
  const u = b.user as unknown as { _id?: unknown } | Types.ObjectId | null;
  return String((u as { _id?: unknown })?._id ?? u);
}

/**
 * Sweep for unassigned upcoming bookings whose slot time or date has passed,
 * auto-rescheduling them to the next available slot or next day.
 */
export async function sweepAndRescheduleMissedSlots(): Promise<{ processed: number; rescheduled: number }> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Read once per sweep rather than per booking — the settings cannot change
  // mid-pass, and a query per candidate would scale with the queue.
  const { rescheduleBufferMinutes, maxConsecutiveDaysLimit } = await getRescheduleConfig();

  // Find all unassigned upcoming bookings
  const candidateBookings = await Booking.find({
    status: "upcoming",
    assignedAgent: null,
    dispatchStatus: { $in: ["searching", "offered", "pending_admin", "scheduled"] },
  }).populate("user", "name");

  let processed = 0;
  let rescheduled = 0;

  for (const b of candidateBookings) {
    processed++;
    const bDate = new Date(b.date);
    const { end: slotEnd } = getSlotTimeRange(bDate, b.slot);
    const cutoffTime = new Date(slotEnd.getTime() + rescheduleBufferMinutes * 60 * 1000);

    const isPastDate = bDate.getTime() < todayStart.getTime();
    const isSlotPassed = now.getTime() > cutoffTime.getTime();

    if (!isPastDate && !isSlotPassed) {
      continue; // Slot hasn't expired yet
    }

    const currentRescheduleCount = b.rescheduleCount ?? 0;

    // Check if max retry limit reached (e.g. 2 consecutive days)
    if (currentRescheduleCount >= maxConsecutiveDaysLimit) {
      b.dispatchStatus = "pending_admin";
      b.currentOfferAgent = null;
      b.offerExpiresAt = null;
      await b.save();

      const cid = customerId(b);
      await notifyUser(cid, {
        type: "booking",
        title: "⚠️ Service Assignment Pending",
        body: `We are currently experiencing high demand. Our admin team is manually assigning a cleaner for your ${b.packageName}.`,
        data: { bookingId: String(b._id) },
      }).catch((err) => console.error("notify failed:", (err as Error).message));

      emitToAdmins("dispatch_pending", { bookingId: String(b._id) });
      emitDispatchUpdate();
      continue;
    }

    const currentSlotIdx = TIME_SLOTS.indexOf(b.slot);
    let nextSlot: string | null = null;
    let nextDate: Date | null = null;

    // Try finding next slot on same day if today.
    //
    // A booking discounted for being off-peak is moved *preferentially* into
    // another off-peak slot. The sweep never charges the customer (the move is
    // not their doing), so without this preference the system would quietly
    // hand out a peak slot at the off-peak price — the very leak the reschedule
    // rules exist to close, opened from the inside. Falls through to the next
    // available slot when no off-peak one is left, since delivering the service
    // matters more than protecting the margin on it.
    if (!isPastDate) {
      const laterSlots: string[] = [];
      for (let i = currentSlotIdx + 1; i < TIME_SLOTS.length; i++) {
        const candidateSlot = TIME_SLOTS[i];
        const { start: candidateStart } = getSlotTimeRange(bDate, candidateSlot);
        if (candidateStart.getTime() > now.getTime() + 15 * 60 * 1000) laterSlots.push(candidateSlot);
      }

      let preferred: string | undefined;
      if (b.offPeakLocked && laterSlots.length > 0) {
        const config = await getOffPeakHoursConfig();
        preferred = laterSlots.find((s) => isOffPeakSlotWithConfig(config, bDate, s));
      }

      const chosen = preferred ?? laterSlots[0];
      if (chosen) {
        nextSlot = chosen;
        nextDate = bDate;
      }
    }

    // If no slot on same day or past date, shift to tomorrow
    if (!nextSlot || !nextDate) {
      const tomorrow = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      nextDate = tomorrow;
      nextSlot = TIME_SLOTS[0]; // First slot of tomorrow (08:00 AM)
    }

    const prevSlot = b.slot;
    const isSameDayShift = nextDate.toDateString() === bDate.toDateString();

    // Update booking with new date & slot
    b.date = nextDate;
    b.slot = nextSlot;
    // New slot, new reminder windows — the ones already sent were for the old time.
    b.remindersSent = [];
    b.rescheduleCount = currentRescheduleCount + 1;
    b.lastRescheduledAt = new Date();
    b.autoRescheduled = true;
    b.dispatchStatus = "searching";
    b.currentOfferAgent = null;
    b.offerExpiresAt = null;
    b.set("declinedAgents", []);
    await b.save();
    rescheduled++;

    const cid = customerId(b);
    const dateFormatted = nextDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

    if (isSameDayShift) {
      await pushToUser(cid, {
        title: "🚗 Search Area Expanded",
        body: `No cleaner was immediately nearby for ${prevSlot}. We expanded our search radius and rescheduled your wash to ${nextSlot} today!`,
        data: { bookingId: String(b._id), kind: "rescheduled" },
      }).catch((err) => console.error("push failed:", (err as Error).message));

      await notifyUser(cid, {
        type: "booking",
        title: "🚗 Search Area Expanded",
        body: `No cleaner was available for ${prevSlot}. Search expanded & rescheduled to ${nextSlot} today.`,
        data: { bookingId: String(b._id) },
      }).catch((err) => console.error("notify failed:", (err as Error).message));
    } else {
      await pushToUser(cid, {
        title: "📅 Rescheduled to Tomorrow",
        body: `Cleaners were unavailable today. We've auto-rescheduled your ${b.packageName} to ${dateFormatted} at ${nextSlot}.`,
        data: { bookingId: String(b._id), kind: "rescheduled" },
      }).catch((err) => console.error("push failed:", (err as Error).message));

      await notifyUser(cid, {
        type: "booking",
        title: "📅 Rescheduled to Tomorrow",
        body: `Service rescheduled to ${dateFormatted} at ${nextSlot}.`,
        data: { bookingId: String(b._id) },
      }).catch((err) => console.error("notify failed:", (err as Error).message));
    }

    emitToUser(cid, "booking_updated", { bookingId: String(b._id), slot: nextSlot, date: nextDate });

    // Restart dispatch search pipeline for new slot
    void offerNext(String(b._id)).catch((err) => console.error("offerNext error on reschedule:", (err as Error).message));
  }

  if (rescheduled > 0) {
    emitDispatchUpdate();
  }

  return { processed, rescheduled };
}
