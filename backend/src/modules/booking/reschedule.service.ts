import {
  getOffPeakHoursConfig,
  isOffPeakSlotWithConfig,
  describeWindowsForDay,
} from "../promotions/offPeakHours.service";
import {
  weekdayInTimezone,
  calendarPartsInTimezone,
  minutesOfDayInTimezone,
  parseSlotToMinutes,
} from "../../shared/timeWindows";
import { ApiError } from "../../shared/utils/ApiError";
import { getLeadMinutes } from "../../shared/slots";

/**
 * The single place that decides what moving a booking to another slot costs.
 *
 * Every caller goes through here — the customer reschedule endpoint, the admin
 * one, the subscription wash flow, and the automatic missed-slot sweep. Keeping
 * one function is the point: the coupon gate nearly drifted between normal codes
 * and special coupons before it was pulled into one helper, and this rule has
 * four callers instead of two.
 *
 * The rule it encodes:
 *
 *   booked at full price            → moves anywhere, free
 *   booked off-peak, no subsidy     → moves anywhere, free
 *   booked off-peak WITH subsidy    → free into another off-peak slot,
 *                                     costs (subsidy + fee) into a peak slot
 *   moved by the system             → always free, never the customer's doing
 *
 * A booking made at full price in a peak slot was never subsidised, so it
 * carries no lock. Only a subsidised booking does.
 */

/** Just enough of a booking to price a move — keeps this callable from tests and any caller. */
export type ReschedulableBooking = {
  price: number;
  offPeakLocked?: boolean;
  offPeakDiscountAmount?: number;
  isSubscriptionWash?: boolean;
};

/** How many times a customer may move one booking before support has to step in. */
export const MAX_CUSTOMER_RESCHEDULES = 3;

/** Human phrasing for the admin-set booking notice, e.g. "an hour", "30 minutes". */
function describeLead(minutes: number): string {
  if (minutes === 60) return "an hour";
  if (minutes % 60 === 0) return `${minutes / 60} hours`;
  return `${minutes} minutes`;
}

export type RescheduleQuote = {
  /** Is the destination slot inside a configured off-peak window? */
  targetIsOffPeak: boolean;
  /** True when the customer has to pay before the move can be committed. */
  requiresPayment: boolean;
  /**
   * Free by policy rather than by circumstance — a system-initiated move or a
   * plan-covered subscription wash. Distinguished from an ordinary free move so
   * callers can say *why* nothing is owed.
   */
  exempt: boolean;
  /** The off-peak subsidy being taken back, in rupees. */
  reclaim: number;
  /** The flat platform charge for the upgrade, in rupees. */
  fee: number;
  /** What the customer owes to complete this move. */
  totalDue: number;
  /**
   * What `booking.price` becomes if the move goes ahead — the service value,
   * with the subsidy added back. The fee is deliberately NOT in here: payout is
   * a percentage of `price`, so folding the fee in would hand the cleaner a cut
   * of a platform charge for identical work.
   */
  newPrice: number;
  /** Human-readable explanation, shown to the customer or the admin. */
  reason: string;
};

function freeQuote(
  booking: ReschedulableBooking,
  targetIsOffPeak: boolean,
  reason: string,
  exempt = false,
): RescheduleQuote {
  return {
    targetIsOffPeak,
    requiresPayment: false,
    exempt,
    reclaim: 0,
    fee: 0,
    totalDue: 0,
    newPrice: booking.price,
    reason,
  };
}

/**
 * Everything that must be true before a customer may move a booking at all,
 * independent of what it costs. Throws with a message the customer can act on.
 *
 * Kept separate from evaluateReschedule so the quote endpoint can price a move
 * the customer is only considering, while the commit endpoint enforces the same
 * gate a second time — a quote is advisory, and the state can change between
 * seeing a price and accepting it.
 */
export function assertCustomerMayReschedule(
  booking: {
    status: string;
    jobStatus?: string;
    customerRescheduleCount?: number;
    isSubscriptionWash?: boolean;
  },
  newSlotStart: Date,
): void {
  if (booking.status !== "upcoming") {
    throw ApiError.badRequest("Only upcoming bookings can be rescheduled");
  }
  // Once a cleaner is on the way the slot is being worked; moving it would
  // strand them at an address the customer has already left.
  if (booking.jobStatus && booking.jobStatus !== "assigned") {
    throw ApiError.badRequest("Your cleaner is already on the way — call support to change this booking");
  }
  if ((booking.customerRescheduleCount ?? 0) >= MAX_CUSTOMER_RESCHEDULES) {
    throw ApiError.badRequest(
      `This booking has already been moved ${MAX_CUSTOMER_RESCHEDULES} times — call support to change it again`,
    );
  }
  if (Number.isNaN(newSlotStart.getTime())) {
    throw ApiError.badRequest("Pick a valid date and time slot");
  }
}

/**
 * Minutes from now until `slot` starts on the calendar day `date` falls on,
 * both read in the business timezone (Admin → Off-Peak Hours). The server may
 * run in UTC, so the server-local clock can't be used: "12:30 PM" has to mean
 * 12:30 PM to the customer. Negative once the slot has started.
 */
async function minutesUntilSlot(date: Date, slot: string): Promise<number | null> {
  const slotMinutes = parseSlotToMinutes(slot);
  if (slotMinutes == null || Number.isNaN(date.getTime())) return null;
  const { timezone } = await getOffPeakHoursConfig();
  const now = new Date();
  const day = calendarPartsInTimezone(date, timezone);
  const today = calendarPartsInTimezone(now, timezone);
  const dayDiff = Math.round(
    (Date.UTC(day.year, day.month - 1, day.day) - Date.UTC(today.year, today.month - 1, today.day)) / 86_400_000,
  );
  return dayDiff * 24 * 60 + slotMinutes - minutesOfDayInTimezone(now, timezone);
}

/**
 * Enforces the admin-set booking notice (Admin → Time Slots): a slot must start
 * at least that many minutes from now to be booked or rescheduled into. The
 * customer app's picker hides those slots already; this is the server's copy of
 * the rule, so a picker left open too long, an old app or a direct API call
 * can't put a job into dispatch that no cleaner can reach in time.
 */
export async function assertSlotHasNotice(date: Date, slot: string): Promise<void> {
  const minutesAway = await minutesUntilSlot(date, slot);
  if (minutesAway == null) throw ApiError.badRequest("Pick a valid date and time slot");
  const leadMinutes = getLeadMinutes();
  if (minutesAway < leadMinutes) {
    throw ApiError.badRequest(
      leadMinutes > 0
        ? `That slot is too soon — pick one at least ${describeLead(leadMinutes)} from now`
        : "That slot has already started — please pick a later one",
    );
  }
}

export async function evaluateReschedule(
  booking: ReschedulableBooking,
  newDate: Date,
  newSlot: string,
  options: { systemInitiated?: boolean } = {},
): Promise<RescheduleQuote> {
  const config = await getOffPeakHoursConfig();
  const targetIsOffPeak = isOffPeakSlotWithConfig(config, newDate, newSlot);

  // The sweep moves overdue bookings on the customer's behalf; charging them for
  // a slot they did not choose would be indefensible.
  if (options.systemInitiated) {
    return freeQuote(booking, targetIsOffPeak, "Moved automatically — no charge", true);
  }

  // Plan-covered, never off-peak-discounted, so there is nothing to reclaim.
  if (booking.isSubscriptionWash) {
    return freeQuote(booking, targetIsOffPeak, "Included in your plan", true);
  }

  const reclaim = booking.offPeakLocked ? Math.max(0, booking.offPeakDiscountAmount ?? 0) : 0;

  if (reclaim === 0) {
    return freeQuote(booking, targetIsOffPeak, "No charge for this change");
  }

  if (targetIsOffPeak) {
    return freeQuote(booking, true, "Still an off-peak slot — no charge");
  }

  // Subsidised booking heading into a peak slot: take the discount back and add
  // the upgrade fee.
  const fee = Math.max(0, config.peakUpgradeFee ?? 0);
  const day = weekdayInTimezone(newDate, config.timezone);
  return {
    targetIsOffPeak: false,
    requiresPayment: true,
    exempt: false,
    reclaim,
    fee,
    totalDue: reclaim + fee,
    newPrice: booking.price + reclaim,
    reason:
      `${newSlot} is a peak slot, and this booking was discounted for being off-peak. ` +
      `Moving it means paying back the ₹${reclaim} discount plus a ₹${fee} change fee. ` +
      `${describeWindowsForDay(config, day)} — moving to one of those is free.`,
  };
}
