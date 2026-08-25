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
import { sendOtpLimiter, verifyOtpLimiter, adminLoginLimiter } from "../../shared/middleware/rateLimit";
import * as authController from "./auth.controller";

export const authRouter = Router();

authRouter.post("/send-otp", sendOtpLimiter, validateBody(sendOtpSchema), asyncHandler(authController.sendOtp));
authRouter.post("/send-signup-otp", sendOtpLimiter, validateBody(sendOtpSchema), asyncHandler(authController.sendSignupOtp));
authRouter.post("/send-login-otp", sendOtpLimiter, validateBody(sendOtpSchema), asyncHandler(authController.sendLoginOtp));
authRouter.post("/verify-otp-code", verifyOtpLimiter, validateBody(verifyOtpSchema), asyncHandler(authController.verifyOtpCodeOnly));
authRouter.post("/verify-otp", verifyOtpLimiter, validateBody(verifyOtpSchema), asyncHandler(authController.verifyOtp));
authRouter.post("/admin-login", adminLoginLimiter, validateBody(adminLoginSchema), asyncHandler(authController.adminLogin));
authRouter.post(
  "/customer/signup",
  sendOtpLimiter,
  validateBody(customerSignupSchema),
  asyncHandler(authController.customerSignup),
);
authRouter.post("/agent/signup", validateBody(agentSignupSchema), asyncHandler(authController.agentSignup));
authRouter.post(
  "/agent/signup-basic",
  sendOtpLimiter,
  validateBody(agentSignupBasicSchema),
  asyncHandler(authController.agentSignupBasic),
);
authRouter.post("/logout", asyncHandler(authController.logout));
authRouter.get("/me", requireAuth, asyncHandler(authController.me));
