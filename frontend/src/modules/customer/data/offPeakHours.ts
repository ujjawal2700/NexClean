import type { OffPeakHoursConfig, OffPeakWindow, WeekdayIndex } from "../types";

/**
 * Client-side mirror of the server's off-peak test, used only to *hint* which
 * slots are discounted in the picker. The server stays authoritative for whether a
 * coupon actually applies — this never gates anything, so a stale config here
 * can mislabel a chip but can never mis-price a booking.
 */

/** "08:00 AM" → 480 minutes past midnight; null when unparseable. */
export function parseSlotToMinutes(slot: string): number | null {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(slot.trim());
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  if (m[3].toUpperCase() === "AM") {
    if (hour === 12) hour = 0;
  } else if (hour !== 12) {
    hour += 12;
  }
  return hour * 60 + minute;
}

/** The weekday an instant falls on in `timezone` — matches the server's rule. */
export function weekdayInTimezone(date: Date, timezone: string): WeekdayIndex {
  try {
    const short = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(date);
    const i = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
    if (i >= 0) return i as WeekdayIndex;
  } catch {
    /* unknown zone — fall through to the browser's own reading */
  }
  return date.getDay() as WeekdayIndex;
}

/** Window membership is [start, end), matching the server. */
export function isOffPeakSlot(
  config: OffPeakHoursConfig | undefined,
  dateIso: string | null,
  slot: string | null,
): boolean {
  if (!config?.active || !config.windows.length || !dateIso || !slot) return false;
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return false;
  const minutes = parseSlotToMinutes(slot);
  if (minutes === null) return false;
  const day = weekdayInTimezone(date, config.timezone);
  return config.windows.some(
    (w) => w.day === day && minutes >= w.startMinutes && minutes < w.endMinutes,
  );
}

/** The windows configured for the weekday a date falls on, for explanatory copy. */
export function windowsForDate(
  config: OffPeakHoursConfig | undefined,
  dateIso: string | null,
): OffPeakWindow[] {
  if (!config?.active || !dateIso) return [];
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return [];
  const day = weekdayInTimezone(date, config.timezone);
  return config.windows.filter((w) => w.day === day);
}
