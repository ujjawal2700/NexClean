import { Booking } from "../booking/booking.model";
import { getOffPeakHoursConfig } from "./offPeakHours.service";
import { TIME_SLOTS } from "../../shared/slots";
import { ApiError } from "../../shared/utils/ApiError";
import { formatHHMM, parseSlotToMinutes, WEEKDAY_NAMES, type WeekdayIndex } from "../../shared/timeWindows";

/**
 * Propose off-peak windows from booking history.
 *
 * The admin keeps full manual control; this only fills the editor in. It never
 * writes the config — pricing should not change because a job ran, and an admin
 * ought to see the numbers a proposal is built on before agreeing to it.
 *
 * Method: count bookings per (weekday, slot) over a lookback, take each
 * weekday's median, and mark slots at or below `median × sensitivity` as quiet.
 * Adjacent quiet slots merge into one window.
 *
 * Per weekday rather than globally, because Sunday's quietest hour is still
 * busier than Tuesday's busiest. A single global threshold would discount all of
 * Tuesday and none of Sunday, which is not the question being asked.
 */

/** Slots are exactly 90 minutes apart, so a slot's window runs to the next one's start. */
const SLOT_MINUTES = 90;

export type DemandCell = {
  day: WeekdayIndex;
  slot: string;
  count: number;
  /** Whether this cell is proposed as off-peak. */
  offPeak: boolean;
};

export type DaySummary = {
  day: WeekdayIndex;
  label: string;
  total: number;
  median: number;
  /** False when the weekday has too little history to classify honestly. */
  enoughData: boolean;
};

export type SuggestionResult = {
  lookbackWeeks: number;
  sensitivity: number;
  minSamplesPerDay: number;
  totalBookings: number;
  /** Bookings left out because they were themselves won by an off-peak discount. */
  excludedDiscounted: number;
  days: DaySummary[];
  grid: DemandCell[];
  windows: { day: WeekdayIndex; start: string; end: string; label: string }[];
};

export type SuggestOptions = {
  lookbackWeeks?: number;
  sensitivity?: number;
  minSamplesPerDay?: number;
};

const DEFAULTS = { lookbackWeeks: 12, sensitivity: 1, minSamplesPerDay: 10 };

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Counts per (weekday, slot), read in the business timezone. */
async function demandCounts(
  since: Date,
  timezone: string,
  excludeDiscounted: boolean,
): Promise<Map<string, number>> {
  const match: Record<string, unknown> = { status: "completed", date: { $gte: since } };
  // The feedback-loop guard: a slot that is busy *because* we discounted it is
  // not evidence of demand at full price. Counting those would reclassify it as
  // peak, remove the discount, and send it quiet again — the classification
  // oscillates and customers watch prices flap.
  if (excludeDiscounted) match.offPeakLocked = { $ne: true };

  const rows = await Booking.aggregate<{ _id: { day: number; slot: string }; count: number }>([
    { $match: match },
    {
      $group: {
        // $dayOfWeek is 1..7 with 1 = Sunday; the timezone option is what keeps
        // this agreeing with isOffPeakSlot's weekday.
        _id: { day: { $dayOfWeek: { date: "$date", timezone } }, slot: "$slot" },
        count: { $sum: 1 },
      },
    },
  ]);

  const counts = new Map<string, number>();
  for (const row of rows) {
    const day = row._id.day - 1; // → 0 = Sunday
    counts.set(`${day}|${row._id.slot}`, row.count);
  }
  return counts;
}

/** Merge a weekday's quiet slots into contiguous windows on slot boundaries. */
function windowsForQuietSlots(day: WeekdayIndex, quietSlots: string[]) {
  const minutes = quietSlots
    .map((s) => parseSlotToMinutes(s))
    .filter((m): m is number => m !== null)
    .sort((a, b) => a - b);

  const windows: { day: WeekdayIndex; start: string; end: string; label: string }[] = [];
  let runStart: number | null = null;
  let runEnd: number | null = null;

  for (const start of minutes) {
    if (runStart === null || runEnd === null) {
      runStart = start;
      runEnd = start + SLOT_MINUTES;
      continue;
    }
    // Slots sit exactly SLOT_MINUTES apart, so a gap means the run is broken.
    if (start === runEnd) {
      runEnd = start + SLOT_MINUTES;
    } else {
      windows.push({ day, start: formatHHMM(runStart), end: formatHHMM(runEnd), label: "Suggested" });
      runStart = start;
      runEnd = start + SLOT_MINUTES;
    }
  }
  if (runStart !== null && runEnd !== null) {
    windows.push({ day, start: formatHHMM(runStart), end: formatHHMM(runEnd), label: "Suggested" });
  }
  return windows;
}

export async function suggestOffPeakWindows(options: SuggestOptions = {}): Promise<SuggestionResult> {
  const lookbackWeeks = options.lookbackWeeks ?? DEFAULTS.lookbackWeeks;
  const sensitivity = options.sensitivity ?? DEFAULTS.sensitivity;
  const minSamplesPerDay = options.minSamplesPerDay ?? DEFAULTS.minSamplesPerDay;

  if (!Number.isFinite(lookbackWeeks) || lookbackWeeks < 1 || lookbackWeeks > 104) {
    throw ApiError.badRequest("Lookback must be between 1 and 104 weeks");
  }
  if (!Number.isFinite(sensitivity) || sensitivity <= 0 || sensitivity > 3) {
    throw ApiError.badRequest("Sensitivity must be between 0 and 3");
  }
  if (!Number.isFinite(minSamplesPerDay) || minSamplesPerDay < 0) {
    throw ApiError.badRequest("Minimum sample size cannot be negative");
  }

  const { timezone } = await getOffPeakHoursConfig();
  const since = new Date(Date.now() - lookbackWeeks * 7 * 24 * 60 * 60 * 1000);

  const [counts, countsIncludingDiscounted] = await Promise.all([
    demandCounts(since, timezone, true),
    demandCounts(since, timezone, false),
  ]);

  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  const totalBookings = sum(counts);
  const excludedDiscounted = sum(countsIncludingDiscounted) - totalBookings;

  const grid: DemandCell[] = [];
  const days: DaySummary[] = [];
  const windows: SuggestionResult["windows"] = [];

  for (let day = 0 as WeekdayIndex; day <= 6; day = (day + 1) as WeekdayIndex) {
    const dayCounts = TIME_SLOTS.map((slot) => counts.get(`${day}|${slot}`) ?? 0);
    const total = dayCounts.reduce((a, b) => a + b, 0);
    const dayMedian = median(dayCounts);
    // Below the minimum, the medians are noise and the feature would
    // confidently discount a slot on the strength of two data points.
    const enoughData = total >= minSamplesPerDay;
    const threshold = dayMedian * sensitivity;

    const quietSlots: string[] = [];
    TIME_SLOTS.forEach((slot, i) => {
      const count = dayCounts[i];
      const offPeak = enoughData && count <= threshold;
      if (offPeak) quietSlots.push(slot);
      grid.push({ day, slot, count, offPeak });
    });

    days.push({ day, label: WEEKDAY_NAMES[day], total, median: dayMedian, enoughData });
    windows.push(...windowsForQuietSlots(day, quietSlots));
  }

  return {
    lookbackWeeks,
    sensitivity,
    minSamplesPerDay,
    totalBookings,
    excludedDiscounted,
    days,
    grid,
    windows,
  };
}
