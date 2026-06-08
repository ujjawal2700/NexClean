import type { Request, Response } from "express";
import { ok, created } from "../../shared/utils/apiResponse";
import * as bookingService from "./booking.service";

export async function list(req: Request, res: Response): Promise<Response> {
  const bookings = await bookingService.listBookings(req.userId!);
  return ok(res, bookings);
}

export async function create(req: Request, res: Response): Promise<Response> {
  const booking = await bookingService.createBooking(req.userId!, req.body);
  return created(res, booking, "Booking confirmed");
}

export async function cancel(req: Request, res: Response): Promise<Response> {
  const booking = await bookingService.cancelBooking(req.userId!, String(req.params.id));
  return ok(res, booking, "Booking cancelled");
}
