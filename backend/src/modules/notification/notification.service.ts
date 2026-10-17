import { Notification } from "./notification.model";
import { User } from "../user/user.model";
import { sendPush, type PushPayload } from "../../shared/services/fcm";
import { ApiError } from "../../shared/utils/ApiError";
import { emitToUser } from "../../shared/services/socket";

type NotifyInput = PushPayload & { type?: "booking" | "area_alert" | "system" | "coupon" };

/** Persist a notification for a user and push it to their devices. */
export async function notifyUser(userId: string, input: NotifyInput): Promise<void> {
  const user = await User.findById(userId);
  if (!user) return;

  const notif = await Notification.create({
    user: userId,
    type: input.type ?? "system",
    title: input.title,
    body: input.body,
    data: input.data ?? {},
  });

  // Emit real-time notification over WebSockets to all active user connections
  emitToUser(userId, "notification", notif);

  await sendPush(user.deviceTokens, input);
}

/**
 * Push to a user's devices WITHOUT persisting an in-app notification.
 * Used for ephemeral events (e.g. dispatch offers) that shouldn't clutter the feed.
 */
export async function pushToUser(userId: string, input: PushPayload): Promise<void> {
  const user = await User.findById(userId).select("deviceTokens");
  if (!user) return;

  // Emit real-time event via WebSockets (without the delivery hints).
  const { jobOffer: _jobOffer, ttlSeconds: _ttl, ...visible } = input;
  emitToUser(userId, "push_notification", visible);

  await sendPush(user.deviceTokens, input);
}

export async function registerToken(userId: string, token: string, deviceId: string, tokenVersion: number) {
  const user = await User.findById(userId).select("role status tokenVersion agentDeviceId");
  if (!user || user.status === "suspended" || (user.tokenVersion ?? 0) !== tokenVersion) {
    throw ApiError.unauthorized("Session expired. Please sign in again.");
  }
  const isAgent = user.role === "agent";
  if (isAgent && (user.agentDeviceId ?? "") !== deviceId) {
    throw ApiError.unauthorized("Session expired. Please sign in again.");
  }

  // A token belongs to one account. Validate first so a stale request cannot
  // remove another account's token before being rejected.
  await User.updateMany(
    { _id: { $ne: userId }, $or: [{ deviceTokens: token }, { "pushTokenDevices.token": token }] },
    { $pull: { deviceTokens: token, pushTokenDevices: { token } } },
  );
  // Recheck the session in the write: switching/logout can happen after the
  // middleware authenticates. Each agent registration also replaces legacy
  // and rotated tokens, because only one phone can hold the agent session.
  const result = await User.updateOne(
    { _id: userId, tokenVersion, status: { $ne: "suspended" }, ...(isAgent ? { agentDeviceId: user.agentDeviceId ?? null } : {}) },
    isAgent
      ? { $set: { deviceTokens: [token], pushTokenDevices: deviceId ? [{ token, deviceId }] : [] } }
      : { $addToSet: { deviceTokens: token, ...(deviceId ? { pushTokenDevices: { token, deviceId } } : {}) } },
  );
  if (!result.matchedCount) throw ApiError.unauthorized("Session expired. Please sign in again.");
}

export async function unregisterToken(userId: string, token: string) {
  await User.updateOne({ _id: userId }, { $pull: { deviceTokens: token, pushTokenDevices: { token } } });
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
