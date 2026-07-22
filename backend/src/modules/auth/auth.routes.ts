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
  agentSignupBasicSchema,
} from "./auth.validation";
import * as authController from "./auth.controller";

export const authRouter = Router();

authRouter.post("/send-otp", validateBody(sendOtpSchema), asyncHandler(authController.sendOtp));
authRouter.post("/send-signup-otp", validateBody(sendOtpSchema), asyncHandler(authController.sendSignupOtp));
authRouter.post("/verify-otp-code", validateBody(verifyOtpSchema), asyncHandler(authController.verifyOtpCodeOnly));
authRouter.post("/verify-otp", validateBody(verifyOtpSchema), asyncHandler(authController.verifyOtp));
authRouter.post("/admin-login", validateBody(adminLoginSchema), asyncHandler(authController.adminLogin));
authRouter.post(
  "/customer/signup",
  validateBody(customerSignupSchema),
  asyncHandler(authController.customerSignup),
);
authRouter.post("/agent/signup", validateBody(agentSignupSchema), asyncHandler(authController.agentSignup));
authRouter.post(
  "/agent/signup-basic",
  validateBody(agentSignupBasicSchema),
  asyncHandler(authController.agentSignupBasic),
);
authRouter.get("/me", requireAuth, asyncHandler(authController.me));
