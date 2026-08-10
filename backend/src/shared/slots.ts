/**
 * The bookable time slots, and the server-side source of truth for them.
 *
 * `slot` used to be validated as nothing more than a non-empty string, so any
 * free text ("3:00 AM - 4:00 AM (not a real slot)") was accepted and stored on
 * the booking. That matters beyond tidiness: getSlotTimeRange() parses this
 * exact "hh:mm AM/PM" shape to decide when a job is overdue, and an unparseable
 * slot yields NaN times that quietly break the missed-slot sweep.
 *
 * NOTE: frontend/src/modules/customer/data/catalog.ts holds the same list for
 * rendering the picker. Keep the two in step — this one is authoritative, and
 * a slot the client offers but the server rejects will surface as a 400.
 */
export const TIME_SLOTS = [
  "08:00 AM",
  "09:30 AM",
  "11:00 AM",
  "12:30 PM",
  "02:00 PM",
  "03:30 PM",
  "05:00 PM",
  "06:30 PM",
] as const;

export type TimeSlot = (typeof TIME_SLOTS)[number];

export function isValidSlot(slot: unknown): slot is TimeSlot {
  return typeof slot === "string" && (TIME_SLOTS as readonly string[]).includes(slot);
}

/** Human-readable list for error messages. */
export const SLOT_LIST = TIME_SLOTS.join(", ");
