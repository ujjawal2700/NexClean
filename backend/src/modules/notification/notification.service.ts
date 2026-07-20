import { Notification } from "./notification.model";
import { User } from "../user/user.model";
import { sendPush, type PushPayload } from "../../shared/services/fcm";

type NotifyInput = PushPayload & { type?: "booking" | "area_alert" | "system" | "coupon" };

/** Persist a notification for a user and push it to their devices. */
export async function notifyUser(userId: string, input: NotifyInput): Promise<void> {
  const user = await User.findById(userId);
  if (!user) return;

  await Notification.create({
    user: userId,
    type: input.type ?? "system",
    title: input.title,
    body: input.body,
    data: input.data ?? {},
  });

  await sendPush(user.deviceTokens, input);
}

/**
 * Push to a user's devices WITHOUT persisting an in-app notification.
 * Used for ephemeral events (e.g. dispatch offers) that shouldn't clutter the feed.
 */
export async function pushToUser(userId: string, input: PushPayload): Promise<void> {
  const user = await User.findById(userId).select("deviceTokens");
  if (!user) return;
  await sendPush(user.deviceTokens, input);
}

export async function registerToken(userId: string, token: string) {
  // Ensure global token uniqueness across all users: pull from any existing user accounts first
  await User.updateMany({ deviceTokens: token }, { $pull: { deviceTokens: token } });
  // Add token to target user's deviceTokens array (deduplicated via $addToSet)
  await User.updateOne({ _id: userId }, { $addToSet: { deviceTokens: token } });
}

export async function unregisterToken(userId: string, token: string) {
  await User.updateOne({ _id: userId }, { $pull: { deviceTokens: token } });
}

export async function removeDeadTokens(tokens: string[]) {
  if (!tokens || tokens.length === 0) return;
  await User.updateMany({ deviceTokens: { $in: tokens } }, { $pullAll: { deviceTokens: tokens } });
}


export async function listForUser(userId: string) {
  return Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(50);
}

export async function markAllRead(userId: string) {
  await Notification.updateMany({ user: userId, read: false }, { read: true });
}
