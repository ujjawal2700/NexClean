import type { Request, Response } from "express";
import { ok, created } from "../../shared/utils/apiResponse";
import * as service from "./payment.service";

export async function createOrder(req: Request, res: Response): Promise<Response> {
  const order = await service.createOrder(req.userId!, req.body);
  return ok(res, order);
}

export async function verify(req: Request, res: Response): Promise<Response> {
  const booking = await service.verifyAndBook(req.userId!, req.body);
  return created(res, booking, "Payment confirmed");
}

export async function preview(req: Request, res: Response): Promise<Response> {
  const result = await service.previewAmount(req.body);
  return ok(res, result);
}
