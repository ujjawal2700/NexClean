import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { requireRole } from "../../shared/middleware/auth";
import * as controller from "./agent.controller";

export const agentRouter = Router();

agentRouter.use(requireRole("agent"));

agentRouter.get("/jobs", asyncHandler(controller.jobs));
agentRouter.get("/summary", asyncHandler(controller.summary));
agentRouter.patch("/jobs/:id/advance", asyncHandler(controller.advance));
agentRouter.post("/jobs/:id/photo", asyncHandler(controller.photo));
agentRouter.patch("/online", asyncHandler(controller.online));
agentRouter.patch("/heartbeat", asyncHandler(controller.heartbeat));
agentRouter.post("/notify-area", asyncHandler(controller.notifyArea));

// Real-time dispatch offers
agentRouter.get("/offers/current", asyncHandler(controller.currentOffer));
agentRouter.post("/offers/:id/accept", asyncHandler(controller.acceptOffer));
agentRouter.post("/offers/:id/decline", asyncHandler(controller.declineOffer));

// Available jobs pool (for agents who were offline during dispatch)
agentRouter.get("/available-jobs", asyncHandler(controller.availableJobs));
agentRouter.post("/jobs/:id/claim", asyncHandler(controller.claimJob));

// Bank account + payout requests
agentRouter.get("/bank-account", asyncHandler(controller.bankAccount));
agentRouter.get("/bank-account/ifsc/:code", asyncHandler(controller.ifscLookup));
agentRouter.put("/bank-account", asyncHandler(controller.saveBankAccount));
agentRouter.get("/wallet", asyncHandler(controller.wallet));
agentRouter.post("/payout-requests", asyncHandler(controller.requestPayout));
