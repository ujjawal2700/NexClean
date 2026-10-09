import { env, pushEnabled } from "../../config/env";
import { User } from "../../modules/user/user.model";

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  /**
   * A new job for a cleaner. Sent on the dedicated "job_offers" Android channel
   * with the "job_offer" ringtone — the store app creates that channel with its
   * own sound and importance; until it does, Android falls back to the default
   * channel and sound, so the push is still shown.
   */
  jobOffer?: boolean;
  /** Drop the push if it can't be delivered within this many seconds. */
  ttlSeconds?: number;
};

// Loosely typed to avoid a hard compile-time dependency on firebase-admin
// when push is running in mock mode.
type MessagingClient = {
  sendEachForMulticast: (msg: unknown) => Promise<{
    successCount: number;
    responses: Array<{ success: boolean; error?: { code?: string; message?: string } }>;
  }>;
};
let messaging: MessagingClient | null = null;
let initialization: Promise<MessagingClient | null> | null = null;

function getMessaging() {
  // Concurrent sends must await the same initialization. Returning the still
  // null client during dynamic imports silently treated real pushes as mocks.
  return initialization ??= initializeMessaging();
}

async function initializeMessaging() {
  if (!pushEnabled) return null;

  try {
    const { getApps, getApp, initializeApp, cert } = await import("firebase-admin/app");
    const { getMessaging: messagingForApp } = await import("firebase-admin/messaging");
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

    const app = getApps().length ? getApp() : initializeApp({ credential: cert(json) });
    messaging = messagingForApp(app) as unknown as typeof messaging;
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

  const ttl = payload.ttlSeconds ?? PUSH_TTL_SECONDS;
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
        headers: { Urgency: "high", TTL: String(ttl) },
        notification: {
          icon: "/logo.png",
          badge: "/logo.png",
          ...(payload.jobOffer ? { requireInteraction: true, vibrate: [600, 250, 600, 250, 600] } : {}),
        },
      },
      // Native iPhone app (FCM → APNs). An alert push at priority 10 with a
      // sound is shown immediately; without "sound" iOS delivers it silently.
      apns: {
        headers: {
          "apns-priority": "10",
          "apns-push-type": "alert",
          "apns-expiration": String(Math.floor(Date.now() / 1000) + ttl),
        },
        payload: {
          aps: payload.jobOffer
            ? // Time-sensitive breaks through Focus modes; needs the
              // Time Sensitive Notifications capability in the iOS app.
              { sound: "job_offer.caf", "interruption-level": "time-sensitive" }
            : { sound: "default" },
        },
      },
      // Native Android app. High priority wakes a phone in Doze, including
      // when the app has been swiped away from recents.
      android: {
        priority: "high",
        ttl: ttl * 1000,
        notification: payload.jobOffer
          ? { channelId: "job_offers", sound: "job_offer", priority: "max", visibility: "public", defaultVibrateTimings: false, vibrateTimingsMillis: [0, 600, 250, 600, 250, 600] }
          : { sound: "default" },
      },
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

