import type { Request, Response } from "express";
import { ok, created } from "../../shared/utils/apiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import * as service from "./internalMessage.service";

export async function contacts(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listContacts(req.userId!));
}

export async function conversations(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listConversations(req.userId!));
}

export async function startConversation(req: Request, res: Response): Promise<Response> {
  const recipientId = typeof req.body?.recipientId === "string" ? req.body.recipientId : "";
  if (!recipientId) throw ApiError.badRequest("Recipient is required");
  return created(res, await service.getOrCreateConversation(req.userId!, recipientId), "Conversation ready");
}

export async function messages(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listMessages(String(req.params.conversationId ?? ""), req.userId!));
}

export async function send(req: Request, res: Response): Promise<Response> {
  const { text, image } = req.body ?? {};
  return created(
    res,
    await service.sendMessage(String(req.params.conversationId ?? ""), req.userId!, text, image),
    "Message sent",
  );
}
