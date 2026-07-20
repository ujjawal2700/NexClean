import { env, pushEnabled } from "../../config/env";
import { User } from "../../modules/user/user.model";

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

// Loosely typed to avoid a hard compile-time dependency on firebase-admin
// when push is running in mock mode.
let messaging: {
  sendEachForMulticast: (msg: unknown) => Promise<{
    successCount: number;
    responses: Array<{ success: boolean; error?: { code?: string; message?: string } }>;
  }>;
} | null = null;
let initialized = false;

async function getMessaging() {
  if (initialized) return messaging;
  initialized = true;
  if (!pushEnabled) return null;

  try {
    const admin = await import("firebase-admin");
    const json = JSON.parse(Buffer.from(env.firebaseServiceAccount, "base64").toString("utf8"));
    const app = admin.apps.length ? admin.app() : admin.initializeApp({ credential: admin.credential.cert(json) });
    messaging = admin.messaging(app) as unknown as typeof messaging;
    console.log("✓ Firebase Cloud Messaging initialized");
  } catch (err) {
    console.error("✗ FCM init failed, falling back to mock mode:", (err as Error).message);
    messaging = null;
  }
  return messaging;
}

/**
 * Send a push to a set of device tokens.
 * In mock mode (no Firebase creds) it logs the message and reports success,
 * so the whole Smart Area Alert flow is testable without external services.
 */
export async function sendPush(tokens: string[], payload: PushPayload): Promise<{ sent: number; mocked: boolean }> {
  // Deduplicate tokens array to prevent sending duplicate notifications to the same device
  const valid = Array.from(new Set(tokens.filter(Boolean)));
  const m = await getMessaging();

  if (!m || valid.length === 0) {
    console.log(`📣 [push:mock] "${payload.title}" → ${valid.length} device(s): ${payload.body}`);
    return { sent: valid.length, mocked: true };
  }

  const res = await m.sendEachForMulticast({
    tokens: valid,
    notification: { title: payload.title, body: payload.body },
    data: payload.data ?? {},
  });

  // Clean up invalid or unregistered tokens from DB
  if (res.responses && res.responses.length > 0) {
    const invalidTokens: string[] = [];
    res.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        const code = resp.error.code;
        if (
          code === "messaging/invalid-registration-token" ||
          code === "messaging/registration-token-not-registered"
        ) {
          invalidTokens.push(valid[idx]);
        }
      }
    });

    if (invalidTokens.length > 0) {
      User.updateMany({ deviceTokens: { $in: invalidTokens } }, { $pullAll: { deviceTokens: invalidTokens } }).catch(
        (err) => console.error("Failed to clean up invalid FCM tokens:", err)
      );
    }
  }

  return { sent: res.successCount, mocked: false };
}

