import { Router } from "express";
import { customerInvoice } from "../bookkeeping/bookkeeping.controller";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { requireAuth } from "../../shared/middleware/auth";
import { validateBody } from "../../shared/middleware/validate";
import { createBookingSchema, rescheduleBookingSchema } from "./booking.validation";
import * as bookingController from "./booking.controller";

export const bookingRouter = Router();

bookingRouter.use(requireAuth);

bookingRouter.get("/", asyncHandler(bookingController.list));
bookingRouter.post("/", validateBody(createBookingSchema), asyncHandler(bookingController.create));
bookingRouter.get("/:id", asyncHandler(bookingController.detail));
bookingRouter.get("/:id/invoice", asyncHandler(customerInvoice));
bookingRouter.post("/:id/review", asyncHandler(bookingController.review));
bookingRouter.patch("/:id/cancel", asyncHandler(bookingController.cancel));
bookingRouter.post(
  "/:id/reschedule/preview",
  validateBody(rescheduleBookingSchema),
  asyncHandler(bookingController.reschedulePreview),
);
bookingRouter.post(
  "/:id/reschedule/order",
  validateBody(rescheduleBookingSchema),
  asyncHandler(bookingController.rescheduleOrder),
);
bookingRouter.patch(
  "/:id/reschedule",
  validateBody(rescheduleBookingSchema),
  asyncHandler(bookingController.reschedule),
);
