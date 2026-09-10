/**
 * Time helpers shared by the peak-hours config and everything that gates on it.
 *
 * Everything here works in *minutes since midnight* (0–1439) and in a named IANA
 * timezone, never in the server's local zone. The server may well run in UTC
 * while the business runs in Asia/Kolkata, and a peak window of 08:00–12:00 has
 * to mean 08:00–12:00 *to the customer*, not to the datacenter.
 */

/** "HH:MM" in 24h form, e.g. "08:00", "17:30". */
export const HHMM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Index matches JS `Date.getDay()` — 0 = Sunday. */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function isWeekdayIndex(v: unknown): v is WeekdayIndex {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 6;
}

/** "08:00" → 480. Returns null when the string isn't a valid 24h time. */
export function parseHHMM(value: string): number | null {
  const m = HHMM_PATTERN.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 480 → "08:00". */
export function formatHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Parse a booking slot label ("08:00 AM", "02:00 PM") to minutes since midnight.
 *
 * These come from shared/slots.ts TIME_SLOTS and are already validated at the
 * request boundary, but this stays defensive and returns null on anything it
 * can't parse rather than yielding a NaN that would silently make every
 * comparison false (and so silently hand out a discount that should be gated).
 */
export function parseSlotToMinutes(slot: string): number | null {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(slot.trim());
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const meridiem = m[3].toUpperCase();
  if (hour < 1 || hour > 12 || minute > 59) return null;
  if (meridiem === "AM") {
    if (hour === 12) hour = 0; // 12:xx AM is 00:xx
  } else if (hour !== 12) {
    hour += 12; // 12:xx PM stays 12:xx
  }
  return hour * 60 + minute;
}

/** 480 → "08:00 AM". Mirrors the TIME_SLOTS label shape for user-facing copy. */
export function formatMinutesAsSlotLabel(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const meridiem = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${meridiem}`;
}

/** True when `timezone` is an IANA zone this runtime actually knows. */
export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The weekday a given instant falls on *in the supplied timezone*.
 *
 * This matters more than it looks. Booking dates arrive as ISO datetimes and are
 * commonly UTC midnight for the day the customer tapped ("2026-08-16T00:00:00Z").
 * Read with the server's `getDay()` under a UTC-negative TZ that becomes the
 * 15th — a Saturday, not a Sunday — and a Sunday-only coupon would be rejected
 * for the exact customer it was built for. Resolving the weekday through
 * Intl in the business timezone keeps "Sunday" meaning Sunday in Kolkata.
 */
export function weekdayInTimezone(date: Date, timezone: string): WeekdayIndex {
  const short = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(date);
  const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
  // Intl always returns one of the seven; the fallback only guards a future
  // locale-data surprise rather than silently producing -1.
  return (index >= 0 ? index : date.getUTCDay()) as WeekdayIndex;
}

/** The calendar date (Y/M/D) an instant falls on in `timezone`. */
export function calendarPartsInTimezone(
  date: Date,
  timezone: string,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Minutes since midnight that an instant falls on in `timezone`. */
export function minutesOfDayInTimezone(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // "24" shows up at midnight in some ICU versions under hour12:false.
  const hour = get("hour") % 24;
  return hour * 60 + get("minute");
}
