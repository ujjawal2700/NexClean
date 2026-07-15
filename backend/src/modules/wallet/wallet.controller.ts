import type { Request, Response } from "express";
import { ok } from "../../shared/utils/apiResponse";
import { getWallet } from "./wallet.service";

export async function wallet(req: Request, res: Response): Promise<Response> {
  return ok(res, await getWallet(req.userId!));
}
