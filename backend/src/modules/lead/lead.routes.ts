import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { createLead } from "./lead.controller";

export const leadRouter = Router();

/** Public endpoint — anyone can submit a lead. */
leadRouter.post("/", asyncHandler(createLead));
