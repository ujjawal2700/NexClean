import type { Request, Response } from "express";
import { ok, created } from "../../shared/utils/apiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import { paymentsLive } from "../../config/env";
import { z } from "zod";
import * as bookingService from "./booking.service";
import { submitReview, MAX_REVIEW_LENGTH } from "../review/review.service";

const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(["all", "upcoming", "completed", "cancelled"]).default("all"),
});

/**
 * Without `page`: the bounded working set (upcoming + recent) the dashboard,
 * tracking and help screens use. With `page`: one page of the full history
 * for My bookings — `{ items, page, limit, total, hasMore, counts }`.
 */
export async function list(req: Request, res: Response): Promise<Response> {
  if (req.query.page === undefined) {
    return ok(res, await bookingService.listBookings(req.userId!));
  }
  const parsed = pageQuerySchema.safeParse(req.query);
  if (!parsed.success) throw ApiError.badRequest("Invalid page, limit or status");
  return ok(res, await bookingService.listBookingsPage(req.userId!, parsed.data));
}

export async function detail(req: Request, res: Response): Promise<Response> {
  return ok(res, await bookingService.getOwnBooking(req.userId!, String(req.params.id)));
}

const reviewSchema = z.object({
  rating: z.number().int().min(1, "Pick 1 to 5 stars").max(5, "Pick 1 to 5 stars"),
  comment: z.string().trim().max(MAX_REVIEW_LENGTH, `Keep your review under ${MAX_REVIEW_LENGTH} characters`).optional(),
});

/** The customer rates the cleaner who did a completed booking. */
export async function review(req: Request, res: Response): Promise<Response> {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid review");
  return created(res, await submitReview(req.userId!, String(req.params.id), parsed.data), "Thanks for your review!");
}

/**
 * Direct booking creation. Valid in pay-to-cleaner mode, where there is no
 * prepayment to bypass — the cleaner collects cash on completion.
 *
 * Once online checkout is enabled this route WOULD be a free-booking bypass
 * (it takes no order id and no signature), so it is closed off in that mode and
 * customers must go through /payments/verify.
 */
export async function create(req: Request, res: Response): Promise<Response> {
  if (paymentsLive) {
    throw ApiError.badRequest("Bookings must be created through the payment flow");
  }
  const booking = await bookingService.createBooking(req.userId!, req.body);
  return created(res, booking, "Booking confirmed");
}

export async function cancel(req: Request, res: Response): Promise<Response> {
  const booking = await bookingService.cancelBooking(req.userId!, String(req.params.id));
  return ok(res, booking, "Booking cancelled");
}

/** What moving this booking would cost. Read-only — nothing is changed. */
export async function reschedulePreview(req: Request, res: Response): Promise<Response> {
  const quote = await bookingService.previewReschedule(req.userId!, String(req.params.id), req.body);
  return ok(res, quote);
}

/** Open a gateway order for an upcharge the customer wants to pay now. */
export async function rescheduleOrder(req: Request, res: Response): Promise<Response> {
  const order = await bookingService.createRescheduleUpgradeOrder(
    req.userId!,
    String(req.params.id),
    req.body,
  );
  return ok(res, order);
}

export async function reschedule(req: Request, res: Response): Promise<Response> {
  const { booking, quote } = await bookingService.rescheduleOwnBooking(
    req.userId!,
    String(req.params.id),
    req.body,
  );
  return ok(
    res,
    booking,
    quote.requiresPayment
      ? `Booking moved. ₹${quote.totalDue} has been added to what you pay your cleaner.`
      : "Booking moved",
  );
}
