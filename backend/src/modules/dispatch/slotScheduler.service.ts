import { Types } from "mongoose";
import { Booking, type BookingDocument } from "../booking/booking.model";
import { notifyUser, pushToUser } from "../notification/notification.service";
import { emitToUser, emitToAdmins } from "../../shared/services/socket";
import { offerNext, emitDispatchUpdate } from "./dispatch.service";

export const TIME_SLOTS = [
  "08:00 AM",
  "09:30 AM",
  "11:00 AM",
  "12:30 PM",
  "02:00 PM",
  "03:30 PM",
  "05:00 PM",
  "06:30 PM",
];

// Configurable defaults (can also be updated via Admin API)
let rescheduleBufferMinutes = 30;
let maxConsecutiveDaysLimit = 2;

export function getRescheduleConfig() {
  return { rescheduleBufferMinutes, maxConsecutiveDaysLimit };
}

export function updateRescheduleConfig(config: { bufferMinutes?: number; maxDaysLimit?: number }) {
  if (config.bufferMinutes !== undefined && config.bufferMinutes >= 0) {
    rescheduleBufferMinutes = config.bufferMinutes;
  }
  if (config.maxDaysLimit !== undefined && config.maxDaysLimit > 0) {
    maxConsecutiveDaysLimit = config.maxDaysLimit;
  }
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

    // Try finding next slot on same day if today
    if (!isPastDate) {
      for (let i = currentSlotIdx + 1; i < TIME_SLOTS.length; i++) {
        const candidateSlot = TIME_SLOTS[i];
        const { start: candidateStart } = getSlotTimeRange(bDate, candidateSlot);
        if (candidateStart.getTime() > now.getTime() + 15 * 60 * 1000) {
          nextSlot = candidateSlot;
          nextDate = bDate;
          break;
        }
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
