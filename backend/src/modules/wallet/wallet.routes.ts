import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { requireAuth } from "../../shared/middleware/auth";
import * as walletController from "./wallet.controller";

export const walletRouter = Router();

walletRouter.use(requireAuth);

walletRouter.get("/", asyncHandler(walletController.wallet));
