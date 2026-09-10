import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { requireAuth } from "../../shared/middleware/auth";
import { validateBody } from "../../shared/middleware/validate";
import {
  updateProfileSchema,
  changePasswordSchema,
  addVehicleSchema,
  addAddressSchema,
  updateAddressSchema,
  requestPhoneChangeSchema,
  confirmPhoneChangeSchema,
} from "./user.validation";
import * as userController from "./user.controller";

export const userRouter = Router();

// All user routes require authentication
userRouter.use(requireAuth);

userRouter.patch("/me", validateBody(updateProfileSchema), asyncHandler(userController.updateProfile));
userRouter.patch("/me/password", validateBody(changePasswordSchema), asyncHandler(userController.updatePasswordWithOtp));
userRouter.post("/me/logout-all", asyncHandler(userController.logoutEverywhere));
userRouter.post("/me/deactivate", asyncHandler(userController.deactivateAccount));


userRouter.post(
  "/me/phone/request-otp",
  validateBody(requestPhoneChangeSchema),
  asyncHandler(userController.requestPhoneChange),
);
userRouter.post(
  "/me/phone/confirm",
  validateBody(confirmPhoneChangeSchema),
  asyncHandler(userController.confirmPhoneChange),
);

userRouter.post("/me/vehicles", validateBody(addVehicleSchema), asyncHandler(userController.addVehicle));
userRouter.delete("/me/vehicles/:id", asyncHandler(userController.removeVehicle));

userRouter.post("/me/addresses", validateBody(addAddressSchema), asyncHandler(userController.addAddress));
userRouter.patch("/me/addresses/:id", validateBody(updateAddressSchema), asyncHandler(userController.updateAddress));
userRouter.delete("/me/addresses/:id", asyncHandler(userController.removeAddress));

userRouter.get("/me/referrals", asyncHandler(userController.getReferralSummary));
