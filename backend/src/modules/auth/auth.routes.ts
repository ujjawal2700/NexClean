import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { validateBody } from "../../shared/middleware/validate";
import { requireAuth } from "../../shared/middleware/auth";
import {
  sendOtpSchema,
  verifyOtpSchema,
  adminLoginSchema,
  customerSignupSchema,
  agentSignupSchema,
} from "./auth.validation";
import * as authController from "./auth.controller";

export const authRouter = Router();

authRouter.post("/send-otp", validateBody(sendOtpSchema), asyncHandler(authController.sendOtp));
authRouter.post("/verify-otp", validateBody(verifyOtpSchema), asyncHandler(authController.verifyOtp));
authRouter.post("/admin-login", validateBody(adminLoginSchema), asyncHandler(authController.adminLogin));
authRouter.post(
  "/customer/signup",
  validateBody(customerSignupSchema),
  asyncHandler(authController.customerSignup),
);
authRouter.post("/agent/signup", validateBody(agentSignupSchema), asyncHandler(authController.agentSignup));
authRouter.get("/me", requireAuth, asyncHandler(authController.me));
