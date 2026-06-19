import { Notification } from "./notification.model";
import { User } from "../user/user.model";
import { sendPush, type PushPayload } from "../../shared/services/fcm";

type NotifyInput = PushPayload & { type?: "booking" | "area_alert" | "system" };

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

export async function registerToken(userId: string, token: string) {
  await User.updateOne({ _id: userId }, { $addToSet: { deviceTokens: token } });
}

export async function listForUser(userId: string) {
  return Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(50);
}

export async function markAllRead(userId: string) {
  await Notification.updateMany({ user: userId, read: false }, { read: true });
}
