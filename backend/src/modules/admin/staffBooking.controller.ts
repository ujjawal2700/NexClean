import type { Request, Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { User } from "../user/user.model";
import { Booking } from "../booking/booking.model";
import { Payment } from "../payment/payment.model";
import { createBooking, computePrice } from "../booking/booking.service";
import { addAddressSchema } from "../user/user.validation";
import { addAddress } from "../user/user.service";
import { createBookingSchema } from "../booking/booking.validation";
import { getPricing } from "../pricing/pricing.service";
import { ApiError } from "../../shared/utils/ApiError";
import { ok, created } from "../../shared/utils/apiResponse";
import { refreshInvoice } from "../bookkeeping/invoice.service";
import { notifyUser } from "../notification/notification.service";

const id = z.string().refine(Types.ObjectId.isValid, "Invalid customer ID");
const draftSchema = createBookingSchema.extend({ customerId: id });
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw ApiError.badRequest(result.error.issues[0]?.message ?? "Invalid input");
  return result.data;
}
async function customer(customerId: string) {
  const user = await User.findOne({ _id: customerId, role: "customer", status: "active" }).select("name phone vehicles addresses coins");
  if (!user) throw ApiError.notFound("Active customer not found");
  return user;
}
export async function search(req: Request, res: Response) {
  const query = String(req.query.q ?? "").trim().slice(0, 80);
  if (query.length < 2) return ok(res, []);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const phone = query.replace(/\D/g, "");
  return ok(res, await User.find({ role: "customer", status: "active", $or: [
    { name: { $regex: escaped, $options: "i" } },
    { phone: { $regex: phone.length >= 2 ? phone : escaped, $options: "i" } },
  ] }).select("name phone").sort({ name: 1 }).limit(20));
}
export async function details(req: Request, res: Response) {
  return ok(res, await customer(parse(id, req.params.id)));
}
export async function options(_req: Request, res: Response) {
  const pricing = await getPricing();
  return ok(res, { packages: pricing.packages.filter(p => p.active !== false) });
}
export async function quote(req: Request, res: Response) {
  const input = parse(draftSchema, req.body);
  await customer(input.customerId);
  const price = await computePrice(input.customerId, input);
  return ok(res, { amount: price.tax.payableAmount, taxAmount: price.tax.taxAmount, basePrice: price.basePrice, discountCode: price.discountCodeLabel, discountAmount: price.discountAmount, coinsRedeemed: price.coinsRedeemed, coinDiscount: price.coinDiscount });
}
export async function create(req: Request, res: Response) {
  const input = parse(draftSchema, req.body);
  await customer(input.customerId);
  const actor = await User.findById(req.userId).select("name");
  return created(res, await createBooking(input.customerId, input, undefined, { id: req.userId!, name: actor?.name ?? "Staff" }), "Booking created — payment due to staff");
}
export async function collect(req: Request, res: Response) {
  const bookingId = parse(id, req.params.id);
  const input = parse(z.object({ method: z.enum(["cash", "upi"]), reference: z.string().trim().max(120).default("") }).refine(v => v.method !== "upi" || v.reference.length > 0, "Enter the UPI transaction reference"), req.body);
  const booking = await Booking.findOne({ _id: bookingId, bookingSource: "staff", status: { $ne: "cancelled" } });
  if (!booking) throw ApiError.badRequest("Only active staff bookings can collect payment");
  const actor = await User.findById(req.userId).select("name");
  const payment = await Payment.findOneAndUpdate({ booking: bookingId, kind: "booking", collectionChannel: "staff", status: "created" }, {
    $set: { status: "paid", collectedBy: req.userId, collectedByName: actor?.name ?? "Staff", collectedAt: new Date(), collectionMethod: input.method, collectionReference: input.reference },
  }, { new: true });
  if (!payment) throw ApiError.badRequest("Payment is already collected or unavailable");
  refreshInvoice(bookingId);
  void notifyUser(String(booking.user), { type: "booking", title: "Payment received", body: `₹${payment.amount} received by ${payment.collectedByName} for ${booking.packageName}.`, data: { bookingId } }).catch(() => {});
  return ok(res, payment, "Payment collected");
}

export async function saveAddress(req: Request, res: Response) {
  const customerId = parse(id, req.params.id);
  await customer(customerId);
  const user = await addAddress(customerId, parse(addAddressSchema, req.body));
  return created(res, user.addresses[user.addresses.length - 1], "Customer address saved");
}
