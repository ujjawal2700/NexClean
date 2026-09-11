import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { requireAuth } from "../../shared/middleware/auth";
import { createLead, requestArea } from "./lead.controller";

export const leadRouter = Router();

/** Public endpoint — anyone can submit a lead. */
leadRouter.post("/", asyncHandler(createLead));

/** Authenticated — an existing customer requesting coverage for their area. */
leadRouter.post("/area-request", requireAuth, asyncHandler(requestArea));
