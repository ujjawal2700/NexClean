import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { requireAuth } from "../../shared/middleware/auth";
import { validateBody } from "../../shared/middleware/validate";
import { updateProfileSchema, addVehicleSchema, addAddressSchema } from "./user.validation";
import * as userController from "./user.controller";

export const userRouter = Router();

// All user routes require authentication
userRouter.use(requireAuth);

userRouter.patch("/me", validateBody(updateProfileSchema), asyncHandler(userController.updateProfile));

userRouter.post("/me/vehicles", validateBody(addVehicleSchema), asyncHandler(userController.addVehicle));
userRouter.delete("/me/vehicles/:id", asyncHandler(userController.removeVehicle));

userRouter.post("/me/addresses", validateBody(addAddressSchema), asyncHandler(userController.addAddress));
userRouter.delete("/me/addresses/:id", asyncHandler(userController.removeAddress));
