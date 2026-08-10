import type { Request, Response } from "express";
import { ok, created } from "../../shared/utils/apiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import { paymentsLive } from "../../config/env";
import * as bookingService from "./booking.service";

export async function list(req: Request, res: Response): Promise<Response> {
  const bookings = await bookingService.listBookings(req.userId!);
  return ok(res, bookings);
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
