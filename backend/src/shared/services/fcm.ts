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
/** What a failure code usually means, so the log says what to fix. */
const PUSH_FAILURE_HINTS: Record<string, string> = {
  "messaging/third-party-auth-error":
    "iPhone pushes need an APNs Authentication Key uploaded in Firebase → Project settings → Cloud Messaging → Apple app configuration",
  "messaging/mismatched-credential":
    "this token belongs to a different Firebase project than FIREBASE_SERVICE_ACCOUNT_BASE64",
  "messaging/sender-id-mismatch":
    "this token belongs to a different Firebase project than FIREBASE_SERVICE_ACCOUNT_BASE64",
};

/** Drop a push that can't be delivered within a day — it would only arrive stale. */
const PUSH_TTL_SECONDS = 24 * 60 * 60;

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
      // Web push delivery hints. Without Urgency "high" a phone in battery
      // saver (Android Doze, iOS Low Power) may hold the push back or drop it,
      // which is how some customers saw an area alert only in the app. TTL
      // keeps an undeliverable push from arriving hours late and stale.
      webpush: {
        headers: { Urgency: "high", TTL: String(PUSH_TTL_SECONDS) },
        notification: { icon: "/logo.png", badge: "/logo.png" },
      },
      // Native iPhone app (FCM → APNs). An alert push at priority 10 with a
      // sound is shown immediately; without "sound" iOS delivers it silently.
      apns: {
        headers: { "apns-priority": "10", "apns-push-type": "alert" },
        payload: { aps: { sound: "default" } },
      },
      // Native Android app.
      android: { priority: "high", notification: { sound: "default" } },
    });

    // Clean up ONLY truly dead FCM tokens (do NOT delete synthetic tokens)
    if (res.responses && res.responses.length > 0) {
      const invalidTokens: string[] = [];
      res.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const code = resp.error.code;
          // Every other failure used to vanish silently, leaving no way to tell
          // why a customer didn't get a push. Token tail only — never the whole token.
          console.warn(
            `✗ push to …${realFcmTokens[idx].slice(-8)} failed: ${code ?? "unknown"} ${resp.error.message ?? ""}` +
              (PUSH_FAILURE_HINTS[code ?? ""] ? ` — ${PUSH_FAILURE_HINTS[code ?? ""]}` : ""),
          );
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

