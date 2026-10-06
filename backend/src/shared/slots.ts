/**
 * The bookable time slots, and the server-side source of truth for them.
 *
 * `slot` used to be validated as nothing more than a non-empty string, so any
 * free text ("3:00 AM - 4:00 AM (not a real slot)") was accepted and stored on
 * the booking. That matters beyond tidiness: getSlotTimeRange() parses this
 * exact "hh:mm AM/PM" shape to decide when a job is overdue, and an unparseable
 * slot yields NaN times that quietly break the missed-slot sweep.
 *
 * The live list is admin-managed (Admin → Time Slots, persisted in SlotConfig).
 * It is held here as a synchronous cache because the request validators are
 * synchronous Zod schemas; dispatch/slotConfig.service keeps it filled from the
 * database on every instance. This module deliberately imports nothing — an
 * earlier version imported the service from here and the service imported
 * this, a cycle that left the defaults undefined depending on load order.
 *
 * Customers fetch the live list from GET /catalog/time-slots; the copy in
 * frontend/src/modules/customer/data/catalog.ts is only an offline fallback.
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

/** The most an admin may configure — every 30 minutes around the clock. */
export const MAX_SLOTS = 48;

/**
 * Minimum notice, in minutes, between "now" and the start of a slot a customer
 * may book or reschedule into today. Admin-managed alongside the slot list.
 */
export const DEFAULT_LEAD_MINUTES = 60;
/** Upper bound for the notice — a full day. */
export const MAX_LEAD_MINUTES = 24 * 60;

const SLOT_RE = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;

let liveSlots: string[] = [...TIME_SLOTS];
let liveLeadMinutes = DEFAULT_LEAD_MINUTES;

/** "08:00 AM" → 480. Returns -1 for anything that is not a real 12-hour time. */
export function slotToMinutes(slot: string): number {
  const match = slot.trim().match(SLOT_RE);
  if (!match) return -1;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 1 || hours > 12 || minutes > 59) return -1;
  const pm = match[3].toUpperCase() === "PM";
  if (hours === 12) hours = 0;
  return (pm ? hours + 12 : hours) * 60 + minutes;
}

/** "8:00 am" → "08:00 AM", the one shape stored on bookings. */
export function normalizeSlot(slot: string): string {
  const match = slot.trim().match(SLOT_RE);
  if (!match) return slot.trim();
  return `${match[1].padStart(2, "0")}:${match[2]} ${match[3].toUpperCase()}`;
}

/** The slots customers can book right now, in chronological order. */
export function getLiveSlots(): readonly string[] {
  return liveSlots;
}

/** Called by slotConfig.service only — after a save or a database refresh. */
export function setLiveSlots(slots: readonly string[]): void {
  liveSlots = slots.length > 0 ? [...slots] : [...TIME_SLOTS];
}

/** The current minimum booking notice, in minutes. */
export function getLeadMinutes(): number {
  return liveLeadMinutes;
}

/** Called by slotConfig.service only — after a save or a database refresh. */
export function setLeadMinutes(minutes: number | null | undefined): void {
  liveLeadMinutes =
    typeof minutes === "number" && Number.isFinite(minutes) && minutes >= 0
      ? Math.min(Math.round(minutes), MAX_LEAD_MINUTES)
      : DEFAULT_LEAD_MINUTES;
}

export function isValidSlot(slot: unknown): slot is string {
  return typeof slot === "string" && liveSlots.includes(slot);
}

/** Human-readable list for error messages. */
export function slotList(): string {
  return liveSlots.join(", ");
}
