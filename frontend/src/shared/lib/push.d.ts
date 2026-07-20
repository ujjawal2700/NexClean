/**
 * Device push token for a browser.
 *
 * When the VITE_FIREBASE_* web config + VAPID key are provided, this returns a
 * real Firebase Cloud Messaging web token (registering the background service
 * worker and requesting notification permission along the way), so the backend
 * can deliver real OS-level pushes.
 *
 * When Firebase isn't configured it falls back to a stable synthetic token so
 * the app keeps working in mock mode (the backend logs pushes instead of
 * sending them) — nothing breaks either way.
 */
/** A stable per-device synthetic token (fallback / mock mode). */
export declare function getOrCreateDeviceToken(): string;
export declare function saveDeviceToken(token: string): void;
/**
 * Resolve a push token to register with the backend. Prefers a real FCM token;
 * falls back to the synthetic token if Firebase isn't configured, permission is
 * denied, or anything goes wrong.
 */
export declare function getPushToken(): Promise<string>;
export declare function getStoredDeviceToken(): string | null;
export declare function clearStoredDeviceToken(): void;
