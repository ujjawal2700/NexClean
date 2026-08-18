import { OffPeakHoursConfig, type OffPeakHoursConfigDoc } from "./offPeakHours.model";
import { ApiError } from "../../shared/utils/ApiError";
import {
  WEEKDAY_NAMES,
  formatHHMM,
  isValidTimezone,
  parseHHMM,
  parseSlotToMinutes,
  weekdayInTimezone,
  type WeekdayIndex,
} from "../../shared/timeWindows";

export type OffPeakWindowInput = { day: number; start: string; end: string; label?: string };

export type NormalizedWindow = {
  day: WeekdayIndex;
  start: string;
  end: string;
  label: string;
  /** Derived, read-only conveniences for clients so they never re-parse "HH:MM". */
  startMinutes: number;
  endMinutes: number;
};

export type OffPeakHoursConfigView = {
  timezone: string;
  active: boolean;
  /** Flat charge for moving a subsidised off-peak booking into a peak slot. */
  peakUpgradeFee: number;
  windows: NormalizedWindow[];
};

/**
 * Validate and canonicalise a set of windows.
 *
 * Rules, and why each exists:
 *  - `end` must be strictly after `start`. A window that wraps midnight would be
 *    ambiguous about which weekday the post-midnight half belongs to, so instead
 *    of guessing we reject it and tell the admin to add two windows. No bookable
 *    slot falls after 18:30 anyway, so nothing real is lost.
 *  - Windows on the same day may not overlap. Overlaps aren't *wrong* for a pure
 *    "is it off-peak" test, but they make the admin screen lie about total
 *    discounted coverage and make edits unpredictable; rejecting keeps stored
 *    data honest.
 *  - Output is sorted by (day, start) so the admin UI and the API agree on order
 *    without either having to sort defensively.
 */
export function normalizeWindows(input: OffPeakWindowInput[]): NormalizedWindow[] {
  const normalized = input.map((w, i) => {
    const position = `Window ${i + 1}`;
    if (!Number.isInteger(w.day) || w.day < 0 || w.day > 6) {
      throw ApiError.badRequest(`${position}: day must be a weekday index from 0 (Sunday) to 6 (Saturday)`);
    }
    const startMinutes = parseHHMM(String(w.start ?? ""));
    const endMinutes = parseHHMM(String(w.end ?? ""));
    if (startMinutes === null) {
      throw ApiError.badRequest(`${position}: start must be a 24-hour time like "08:00"`);
    }
    if (endMinutes === null) {
      throw ApiError.badRequest(`${position}: end must be a 24-hour time like "12:00"`);
    }
    if (endMinutes <= startMinutes) {
      throw ApiError.badRequest(
        `${position} (${WEEKDAY_NAMES[w.day]} ${w.start}–${w.end}): end must be after start. ` +
          `To cover past midnight, add one window ending at 23:59 and another starting at 00:00 on the next day.`,
      );
    }
    return {
      day: w.day as WeekdayIndex,
      start: formatHHMM(startMinutes),
      end: formatHHMM(endMinutes),
      label: (w.label ?? "").trim(),
      startMinutes,
      endMinutes,
    };
  });

  normalized.sort((a, b) => (a.day === b.day ? a.startMinutes - b.startMinutes : a.day - b.day));

  for (let i = 1; i < normalized.length; i++) {
    const prev = normalized[i - 1];
    const cur = normalized[i];
    // Sorted, so an overlap can only ever be with the immediately preceding
    // window on the same day. Touching windows (10:00–12:00 then 12:00–14:00)
    // are allowed: end is exclusive, so they don't actually overlap.
    if (cur.day === prev.day && cur.startMinutes < prev.endMinutes) {
      throw ApiError.badRequest(
        `Overlapping off-peak windows on ${WEEKDAY_NAMES[cur.day]}: ` +
          `${prev.start}–${prev.end} overlaps ${cur.start}–${cur.end}. Merge them into one window.`,
      );
    }
  }

  return normalized;
}

function mapConfig(c: OffPeakHoursConfigDoc): OffPeakHoursConfigView {
  return {
    timezone: c.timezone,
    active: c.active,
    peakUpgradeFee: c.peakUpgradeFee ?? 0,
    // Re-normalising on read costs nothing and means a document written by an
    // older build (or by hand in the shell) still surfaces with the derived
    // minute fields the clients expect.
    windows: normalizeWindows(
      c.windows.map((w) => ({ day: w.day, start: w.start, end: w.end, label: w.label ?? "" })),
    ),
  };
}

/** Fetch the single global off-peak config, creating it with defaults on first access. */
export async function getOffPeakHoursConfigDoc(): Promise<OffPeakHoursConfigDoc> {
  const existing = await OffPeakHoursConfig.findById("global");
  if (existing) return existing;
  try {
    return await OffPeakHoursConfig.create({ _id: "global" });
  } catch (err) {
    // Two concurrent first-hits race to insert the same _id; the loser gets a
    // duplicate-key error and should just read what the winner wrote.
    const raced = await OffPeakHoursConfig.findById("global");
    if (raced) return raced;
    throw err;
  }
}

export async function getOffPeakHoursConfig(): Promise<OffPeakHoursConfigView> {
  return mapConfig(await getOffPeakHoursConfigDoc());
}

export async function updateOffPeakHoursConfig(patch: {
  timezone?: string;
  windows?: OffPeakWindowInput[];
  active?: boolean;
  peakUpgradeFee?: number;
}): Promise<OffPeakHoursConfigView> {
  const update: Record<string, unknown> = {};

  if (patch.timezone !== undefined) {
    const tz = patch.timezone.trim();
    if (!isValidTimezone(tz)) {
      throw ApiError.badRequest(`"${tz}" is not a recognised IANA timezone (e.g. "Asia/Kolkata")`);
    }
    update.timezone = tz;
  }
  if (patch.windows !== undefined) {
    // Strip the derived fields — only the canonical strings are persisted.
    update.windows = normalizeWindows(patch.windows).map((w) => ({
      day: w.day,
      start: w.start,
      end: w.end,
      label: w.label,
    }));
  }
  if (patch.active !== undefined) update.active = patch.active;
  if (patch.peakUpgradeFee !== undefined) {
    if (!Number.isFinite(patch.peakUpgradeFee) || patch.peakUpgradeFee < 0) {
      throw ApiError.badRequest("The peak upgrade fee cannot be negative");
    }
    // Rupees, not paise — the whole pricing surface deals in whole rupees.
    update.peakUpgradeFee = Math.round(patch.peakUpgradeFee);
  }

  const config = await OffPeakHoursConfig.findByIdAndUpdate(
    "global",
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return mapConfig(config!);
}

/**
 * Does `slot` on `date` fall inside a configured off-peak (discounted) window?
 *
 * The weekday comes from the booking date read in the config timezone; the
 * time of day comes from the slot label, not from the date's clock component —
 * the date carries the day, the slot carries the hour, and mixing the two up is
 * exactly how this kind of check goes subtly wrong.
 *
 * Window membership is [start, end): a slot at exactly `end` is NOT off-peak, so
 * back-to-back windows can't both claim the same instant.
 */
export async function isOffPeakSlot(date: Date, slot: string): Promise<boolean> {
  const config = await getOffPeakHoursConfig();
  return isOffPeakSlotWithConfig(config, date, slot);
}

/** Pure form of isOffPeakSlot for callers that already hold the config (and for tests). */
export function isOffPeakSlotWithConfig(
  config: OffPeakHoursConfigView,
  date: Date,
  slot: string,
): boolean {
  if (!config.active || config.windows.length === 0) return false;
  if (Number.isNaN(date.getTime())) return false;

  const slotMinutes = parseSlotToMinutes(slot);
  // An unparseable slot must not count as off-peak — failing closed keeps a
  // malformed slot from quietly unlocking an off-peak discount.
  if (slotMinutes === null) return false;

  const day = weekdayInTimezone(date, config.timezone);
  return config.windows.some(
    (w) => w.day === day && slotMinutes >= w.startMinutes && slotMinutes < w.endMinutes,
  );
}

/**
 * One-read form used by the coupon gate: decides eligibility and, when the
 * answer is no, builds the explanation from the same config snapshot. Checking
 * and explaining separately would read the config twice per rejected coupon and
 * could, across those two reads, describe a config that no longer decided it.
 */
export async function evaluateOffPeakSlot(
  date: Date,
  slot: string,
): Promise<{ offPeak: boolean; reason: string }> {
  const config = await getOffPeakHoursConfig();
  if (isOffPeakSlotWithConfig(config, date, slot)) return { offPeak: true, reason: "" };
  return { offPeak: false, reason: rejectionMessageWithConfig(config, date, slot) };
}

/** Human-readable off-peak windows for one weekday, for error messages and UI copy. */
export function describeWindowsForDay(config: OffPeakHoursConfigView, day: WeekdayIndex): string {
  const forDay = config.windows.filter((w) => w.day === day);
  if (forDay.length === 0) return `${WEEKDAY_NAMES[day]} has no discounted hours`;
  return `${WEEKDAY_NAMES[day]} discounted hours: ${forDay.map((w) => `${w.start}–${w.end}`).join(", ")}`;
}

/**
 * The rejection message shown when an off-peak coupon is used on a peak slot.
 * Names the windows the customer could actually move to, rather than a generic
 * "not valid right now".
 */
export function rejectionMessageWithConfig(
  config: OffPeakHoursConfigView,
  date: Date,
  slot: string,
): string {
  if (!config.active) return "Off-peak discounts are currently paused";
  if (config.windows.length === 0) return "This coupon only works during off-peak hours, and none are configured yet";
  if (Number.isNaN(date.getTime())) return "This coupon only works during off-peak hours";
  const day = weekdayInTimezone(date, config.timezone);
  return `This coupon only works on off-peak slots. ${describeWindowsForDay(config, day)} (${config.timezone}). Your ${slot} slot is a peak slot.`;
}
