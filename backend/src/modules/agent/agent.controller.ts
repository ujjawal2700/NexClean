import type { Request, Response } from "express";
import { z } from "zod";
import { ok } from "../../shared/utils/apiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import * as service from "./agent.service";
import * as dispatch from "../dispatch/dispatch.service";
import * as bankAccountService from "../user/bankAccount.service";
import * as payoutRequestService from "../payout/payoutRequest.service";

export async function jobs(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listJobs(req.userId!));
}

export async function summary(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.summary(req.userId!));
}

export async function advance(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.advanceStatus(req.userId!, String(req.params.id)), "Status updated");
}

const photoSchema = z.object({
  kind: z.enum(["before", "after"]),
  // Base64 data URL captured on the cleaner's device. Optional so older clients
  // that only flip the flag keep working.
  image: z.string().min(1).optional(),
  action: z.enum(["add", "remove"]).optional(),
  index: z.number().int().min(0).optional(),
});
export async function photo(req: Request, res: Response): Promise<Response> {
  const parsed = photoSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("kind must be 'before' or 'after'");
  const job = await service.setPhoto(req.userId!, String(req.params.id), parsed.data.kind, {
    image: parsed.data.image,
    action: parsed.data.action,
    index: parsed.data.index,
  });
  return ok(res, job, parsed.data.action === "remove" ? "Photo removed" : "Photo added");
}

const coordsSchema = z.object({ lat: z.number(), lng: z.number() }).partial();

const onlineSchema = z
  .object({ online: z.boolean() })
  .merge(coordsSchema);
export async function online(req: Request, res: Response): Promise<Response> {
  const parsed = onlineSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("online must be a boolean");
  const { online, lat, lng } = parsed.data;
  return ok(res, await service.setOnline(req.userId!, online, { lat, lng }));
}

export async function heartbeat(req: Request, res: Response): Promise<Response> {
  const parsed = coordsSchema.safeParse(req.body ?? {});
  const coords = parsed.success ? parsed.data : undefined;
  return ok(res, await service.heartbeat(req.userId!, coords));
}

/* ------------------------------ Dispatch offers -------------------------- */

export async function currentOffer(req: Request, res: Response): Promise<Response> {
  return ok(res, await dispatch.getOfferForAgent(req.userId!));
}

export async function acceptOffer(req: Request, res: Response): Promise<Response> {
  return ok(res, await dispatch.acceptOffer(req.userId!, String(req.params.id)), "Job accepted");
}

export async function declineOffer(req: Request, res: Response): Promise<Response> {
  return ok(res, await dispatch.declineOffer(req.userId!, String(req.params.id)));
}

const notifySchema = z.object({ society: z.string().min(1) });
export async function notifyArea(req: Request, res: Response): Promise<Response> {
  const parsed = notifySchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("society is required");
  const record = await service.notifyArea(req.userId!, parsed.data.society);
  return ok(res, record, `Alert sent to ${record.sentCount} nearby customer(s)`);
}

/** GET /agent/available-jobs — today's unclaimed jobs the agent can pick up. */
export async function availableJobs(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listAvailableJobs(req.userId!));
}

/** POST /agent/jobs/:id/claim — agent self-assigns from the available pool. */
export async function claimJob(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.claimJob(req.userId!, String(req.params.id)), "Job claimed");
}

/* --------------------------- Bank account + payouts ------------------------ */

/** GET /agent/bank-account — the agent's own saved payout account, or null. */
export async function bankAccount(req: Request, res: Response): Promise<Response> {
  return ok(res, await bankAccountService.getBankAccount(req.userId!));
}

/** GET /agent/bank-account/ifsc/:code — live lookup while typing, before saving. */
export async function ifscLookup(req: Request, res: Response): Promise<Response> {
  return ok(res, await bankAccountService.verifyIfsc(String(req.params.code)));
}

const bankAccountSchema = z.object({
  holderName: z.string().min(1),
  bankName: z.string().min(1),
  accountNumber: z.string().min(1),
  confirmAccountNumber: z.string().min(1),
  ifsc: z.string().min(1),
});

/** PUT /agent/bank-account — validate + save where payouts should be sent. */
export async function saveBankAccount(req: Request, res: Response): Promise<Response> {
  const parsed = bankAccountSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Fill in every bank account field");
  return ok(res, await bankAccountService.saveBankAccount(req.userId!, parsed.data), "Bank account saved");
}

/** GET /agent/wallet — earned/reserved/available balance + this agent's request history. */
export async function wallet(req: Request, res: Response): Promise<Response> {
  return ok(res, await payoutRequestService.getWalletSummary(req.userId!));
}

const payoutRequestSchema = z.object({ amount: z.coerce.number().positive() });

/** POST /agent/payout-requests — ask to cash out part of the available balance. */
export async function requestPayout(req: Request, res: Response): Promise<Response> {
  const parsed = payoutRequestSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("Enter a valid amount");
  return ok(res, await payoutRequestService.createPayoutRequest(req.userId!, parsed.data.amount), "Payout requested");
}
