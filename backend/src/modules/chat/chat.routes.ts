import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { requireAuth, requireRole } from "../../shared/middleware/auth";
import * as chatController from "./chat.controller";

export const chatRouter = Router();

// Require authentication for all chat routes
chatRouter.use(requireAuth);

// Global Support Config endpoints
chatRouter.get("/config", asyncHandler(chatController.getSupportConfigCtl));
chatRouter.patch("/config", requireRole("admin"), asyncHandler(chatController.updateSupportConfigCtl));

// Tickets endpoints
chatRouter.get("/tickets", asyncHandler(chatController.listTicketsCtl));
chatRouter.post("/tickets", asyncHandler(chatController.createTicketCtl));
chatRouter.patch("/tickets/:ticketId/close", asyncHandler(chatController.closeTicketCtl));
chatRouter.patch("/tickets/:ticketId/reopen", asyncHandler(chatController.reopenTicketCtl));

// Messages endpoints
chatRouter.get("/tickets/:ticketId/messages", asyncHandler(chatController.listMessagesCtl));
chatRouter.post("/tickets/:ticketId/messages", asyncHandler(chatController.createMessageCtl));
