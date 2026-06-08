import { User } from "../user/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { PLANS, type PlanId } from "../catalog/catalog.data";

export function isPlanId(value: string): value is PlanId {
  return PLANS.some((p) => p.id === value);
}

export async function subscribe(userId: string, planId: PlanId) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  user.activePlan = planId;
  await user.save();
  return user;
}

export async function unsubscribe(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  user.activePlan = null;
  await user.save();
  return user;
}
