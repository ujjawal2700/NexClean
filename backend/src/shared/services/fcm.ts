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
    // tsconfig uses module: "nodenext", so tsc leaves this as a real ESM
    // dynamic import even in the CommonJS build. firebase-admin is CommonJS and
    // exposes `apps` as a getter, which cjs-module-lexer doesn't detect, so the
    // namespace object has no `apps` and `admin.apps.length` threw
    // "Cannot read properties of undefined (reading 'length')" in production —
    // silently disabling push. Everything real hangs off the default export.
    const ns = await import("firebase-admin");
    const admin = ((ns as unknown as { default?: typeof ns }).default ?? ns) as typeof ns;
    const raw = env.firebaseServiceAccount.trim().replace(/^['"]|['"]$/g, "");

    let json: any;
    try {
      // 1. Try parsing as base64-encoded JSON first
      const decoded = Buffer.from(raw, "base64").toString("utf8");
      if (decoded.trim().startsWith("{")) {
        json = JSON.parse(decoded);
      }
    } catch {
      /* ignore */
    }

    if (!json) {
      try {
        // 2. Try parsing as raw JSON string directly (in case raw JSON was pasted into .env)
        if (raw.trim().startsWith("{")) {
          json = JSON.parse(raw);
        }
      } catch {
        /* ignore */
      }
    }

    if (!json || typeof json !== "object" || !json.project_id) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 must contain valid Firebase service account JSON or base64 string");
    }

    const app = admin.apps.length ? admin.app() : admin.initializeApp({ credential: admin.credential.cert(json) });
    messaging = admin.messaging(app) as unknown as typeof messaging;
    console.log("✓ Firebase Cloud Messaging initialized for project:", json.project_id);
  } catch (err) {
    console.error("✗ FCM init failed, falling back to mock mode:", (err as Error).message);
    messaging = null;
  }
  return messaging;
}

export async function initFcm() {
  return getMessaging();
}

/**
 * Send a push to a set of device tokens.
 * In mock mode (no Firebase creds) it logs the message and reports success,
 * so the whole Smart Area Alert flow is testable without external services.
 */
export async function sendPush(tokens: string[], payload: PushPayload): Promise<{ sent: number; mocked: boolean }> {
  // Deduplicate tokens array
  const valid = Array.from(new Set(tokens.filter(Boolean)));
  
  // Separate real FCM tokens from synthetic/web fallback tokens
  const realFcmTokens = valid.filter((t) => !t.startsWith("web-"));
  const syntheticTokens = valid.filter((t) => t.startsWith("web-"));

  const m = await getMessaging();

  if (!m || realFcmTokens.length === 0) {
    console.log(`📣 [push:mock] "${payload.title}" → ${valid.length} device(s) (${syntheticTokens.length} synthetic): ${payload.body}`);
    return { sent: valid.length, mocked: true };
  }

  // Ensure all values in data payload are strings as required by Firebase Admin SDK
  const stringifiedData: Record<string, string> = {};
  if (payload.data) {
    for (const [key, val] of Object.entries(payload.data)) {
      if (val !== undefined && val !== null) {
        stringifiedData[key] = typeof val === "string" ? val : String(val);
      }
    }
  }

  try {
    const res = await m.sendEachForMulticast({
      tokens: realFcmTokens,
      notification: { title: payload.title, body: payload.body },
      data: stringifiedData,
    });

    // Clean up ONLY truly dead FCM tokens (do NOT delete synthetic tokens)
    if (res.responses && res.responses.length > 0) {
      const invalidTokens: string[] = [];
      res.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const code = resp.error.code;
          if (
            code === "messaging/invalid-registration-token" ||
            code === "messaging/registration-token-not-registered"
          ) {
            invalidTokens.push(realFcmTokens[idx]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        User.updateMany({ deviceTokens: { $in: invalidTokens } }, { $pullAll: { deviceTokens: invalidTokens } }).catch(
          (err) => console.error("Failed to clean up invalid FCM tokens:", err)
        );
      }
    }

    return { sent: res.successCount + syntheticTokens.length, mocked: false };
  } catch (err: any) {
    console.error("✗ Firebase sendEachForMulticast failed:", err?.message || err);
    return { sent: 0, mocked: false };
  }
}

