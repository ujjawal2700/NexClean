import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { requireAuth } from "../../shared/middleware/auth";
import { validateBody } from "../../shared/middleware/validate";
import { createBookingSchema } from "./booking.validation";
import * as bookingController from "./booking.controller";

export const bookingRouter = Router();

bookingRouter.use(requireAuth);

bookingRouter.get("/", asyncHandler(bookingController.list));
bookingRouter.post("/", validateBody(createBookingSchema), asyncHandler(bookingController.create));
bookingRouter.patch("/:id/cancel", asyncHandler(bookingController.cancel));
