import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { requireAuth } from "../../shared/middleware/auth";
import { validateBody } from "../../shared/middleware/validate";
import { createOrderSchema, verifyPaymentSchema } from "./payment.validation";
import * as controller from "./payment.controller";

export const paymentRouter = Router();

paymentRouter.use(requireAuth);

paymentRouter.post("/order", validateBody(createOrderSchema), asyncHandler(controller.createOrder));
paymentRouter.post("/verify", validateBody(verifyPaymentSchema), asyncHandler(controller.verify));
