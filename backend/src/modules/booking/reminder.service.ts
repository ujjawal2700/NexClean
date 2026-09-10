import { Booking, type BookingDocument } from "./booking.model";
import { notifyUser } from "../notification/notification.service";
import { getSlotTimeRange } from "../dispatch/slotScheduler.service";

/** Pre-service reminder windows, each keyed by the marker stored in `remindersSent`. */
const REMINDER_WINDOWS: Array<{
  code: string;
  ms: number;
  title: string;
  body: (b: BookingDocument) => string;
}> = [
  {
    code: "60m",
    ms: 60 * 60 * 1000,
    title: "⏰ Service in 1 hour",
    body: (b) =>
      `Your ${b.packageName} for the ${b.vehicleName} is scheduled at ${b.slot} today. Please keep your vehicle accessible.`,
  },
  {
    code: "30m",
    ms: 30 * 60 * 1000,
    title: "⏰ Service in 30 minutes",
    body: (b) => `Your ${b.packageName} starts at ${b.slot} — just half an hour to go.`,
  },
  {
    code: "5m",
    ms: 5 * 60 * 1000,
    title: "⏰ Service starting soon",
    body: (b) => `Your cleaner should be with you in about 5 minutes for the ${b.packageName}.`,
  },
];

/**
 * How much slack a check gets past a window's exact due instant before it
 * counts as missed rather than sent late. Wider than the sweep's tick
 * interval so one slow/skipped tick can't drop a reminder, but well under
 * the ~25 minute gap between windows so a single late tick can never fire
 * two of them in the same pass.
 */
const REMINDER_GRACE_MS = 6 * 60 * 1000;

/**
 * Fire pre-service reminder pushes for upcoming bookings whose slot has just
 * entered a reminder window (60 / 30 / 5 minutes before start).
 *
 * Runs off the dispatch worker's existing tick rather than its own timer —
 * one background loop already polls Mongo on an interval, and starting a
 * second one for this would just be a duplicate poller for no benefit.
 * `remindersSent` makes each window idempotent, so re-running this on every
 * tick (rather than trying to schedule exact fire times) is safe.
 */
export async function runBookingReminders(): Promise<void> {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  // A booking's `date` is a day marker, not the exact slot time, so the
  // window has to be wide enough to catch a late-night slot on a day that
  // technically starts "tomorrow" relative to `now`.
  const horizon = new Date(now + 25 * 60 * 60 * 1000);

  const candidates = await Booking.find({
    status: "upcoming",
    date: { $gte: todayStart, $lte: horizon },
  }).select("date slot packageName vehicleName remindersSent user");

  for (const b of candidates) {
    const { start } = getSlotTimeRange(b.date, b.slot);
    const msUntilStart = start.getTime() - now;
    if (msUntilStart <= 0) continue; // slot has already started — nothing left to remind about

    const sent = new Set(b.remindersSent ?? []);
    for (const window of REMINDER_WINDOWS) {
      if (sent.has(window.code)) continue;

      // >= 0 once the window has opened (now is within `window.ms` of start);
      // grows as time passes, so it also measures how late this check is.
      const dueSince = window.ms - msUntilStart;
      if (dueSince < 0 || dueSince > REMINDER_GRACE_MS) continue;

      await notifyUser(String(b.user), {
        type: "booking",
        title: window.title,
        body: window.body(b),
        data: { bookingId: String(b._id), url: `/app/track/${b._id}` },
      }).catch((err) => console.error("booking reminder failed:", (err as Error).message));

      // $addToSet directly on the DB rather than saving the whole document —
      // this loop only touched a projected subset of fields, and re-saving
      // that would silently blank out everything else on the booking.
      await Booking.updateOne({ _id: b._id }, { $addToSet: { remindersSent: window.code } });
    }
  }
}
