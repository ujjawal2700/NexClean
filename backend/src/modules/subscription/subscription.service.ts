import { User } from "../user/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { isValidActivePlan } from "../catalog/plan.service";

export async function isPlanId(value: string): Promise<boolean> {
  return isValidActivePlan(value);
}

export async function subscribe(userId: string, planId: string) {
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
