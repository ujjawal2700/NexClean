import type { Request, Response } from "express";
import { ok } from "../../shared/utils/apiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import * as chatService from "./chat.service";

export async function getSupportConfigCtl(_req: Request, res: Response): Promise<Response> {
  const config = await chatService.getSupportConfig();
  return ok(res, config);
}

export async function updateSupportConfigCtl(req: Request, res: Response): Promise<Response> {
  const { manualSupportStatus } = req.body;
  if (!["auto", "online", "offline"].includes(manualSupportStatus)) {
    throw ApiError.badRequest("Invalid manualSupportStatus. Must be: auto, online, offline");
  }
  const config = await chatService.updateSupportConfig(manualSupportStatus);
  return ok(res, config, "Support status updated successfully");
}

export async function listTicketsCtl(req: Request, res: Response): Promise<Response> {
  const tickets = await chatService.listTickets(req.userId!, req.userRole!);
  return ok(res, tickets);
}

export async function createTicketCtl(req: Request, res: Response): Promise<Response> {
  const { subject } = req.body;
  const ticket = await chatService.createTicket(req.userId!, subject);
  return ok(res, ticket, "Support ticket created/retrieved successfully");
}

export async function closeTicketCtl(req: Request, res: Response): Promise<Response> {
  const { ticketId } = req.params;
  const ticket = await chatService.closeTicket(String(ticketId || ""), req.userId!, req.userRole);
  return ok(res, ticket, "Ticket closed successfully");
}

export async function reopenTicketCtl(req: Request, res: Response): Promise<Response> {
  const { ticketId } = req.params;
  const ticket = await chatService.reopenTicket(String(ticketId || ""), req.userId!, req.userRole);
  return ok(res, ticket, "Ticket reopened successfully");
}

export async function listMessagesCtl(req: Request, res: Response): Promise<Response> {
  const { ticketId } = req.params;
  const messages = await chatService.listMessages(String(ticketId || ""), req.userId!, req.userRole);
  return ok(res, messages);
}

export async function createMessageCtl(req: Request, res: Response): Promise<Response> {
  const { ticketId } = req.params;
  const { text } = req.body;
  if (!text || !text.trim()) {
    throw ApiError.badRequest("Message text is required");
  }
  
  const senderType = req.userRole === "admin" ? "staff" : "customer";
  const message = await chatService.saveMessage(
    String(ticketId || ""),
    req.userId!,
    senderType,
    text.trim(),
    req.userRole,
  );
  return ok(res, message, "Message sent successfully");
}
