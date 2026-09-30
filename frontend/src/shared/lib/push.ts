/**
 * Device push token for a browser.
 *
 * When the runtime Firebase web config + VAPID public key are provided, this
 * returns a real Firebase Cloud Messaging web token (registering the background service
 * worker and requesting notification permission along the way), so the backend
 * can deliver real OS-level pushes.
 *
 * When Firebase isn't configured it falls back to a stable synthetic token so
 * the app keeps working in mock mode (the backend logs pushes instead of
 * sending them) — nothing breaks either way.
 */

import { getPublicRuntimeConfig, type FirebasePublicConfig } from "./runtimeConfig";

const KEY = "nexclean-device-token";

/** A stable per-device synthetic token (fallback / mock mode). */
export function getOrCreateDeviceToken(): string {
  let token = localStorage.getItem(KEY);
  if (!token) {
    token = `web-${crypto.randomUUID()}`;
    localStorage.setItem(KEY, token);
  }
  return token;
}

// Firebase compat SDK is loaded lazily from the CDN, and only when configured.
let sdkPromise: Promise<any> | null = null;
function loadFirebaseSdk(): Promise<any> {
  if (sdkPromise) return sdkPromise;
  const loadScript = (src: string) =>
    new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });

  sdkPromise = (async () => {
    const w = window as any;
    if (!w.firebase?.messaging) {
      await loadScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
      await loadScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");
    }
    return (window as any).firebase;
  })();
  return sdkPromise;
}

let foregroundBound = false;

export function saveDeviceToken(token: string): void {
  if (typeof window === "undefined" || !token) return;
  try {
    localStorage.setItem(KEY, token);
  } catch (err) {
    console.warn("Failed to save device token to localStorage:", err);
  }
}

/**
 * Resolve a push token to register with the backend. Prefers a real FCM token;
 * falls back to the synthetic token if Firebase isn't configured, permission is
 * denied, or anything goes wrong.
 */
export async function getPushToken(options?: { requestPermission?: boolean }): Promise<string> {
  const fallback = getOrCreateDeviceToken();
  const { firebase } = await getPublicRuntimeConfig();
  const config: Omit<FirebasePublicConfig, "vapidKey"> | null = firebase
    ? {
        apiKey: firebase.apiKey,
        authDomain: firebase.authDomain,
        projectId: firebase.projectId,
        storageBucket: firebase.storageBucket,
        messagingSenderId: firebase.messagingSenderId,
        appId: firebase.appId,
      }
    : null;
  const vapidKey = firebase?.vapidKey;

  if (
    !config ||
    !vapidKey ||
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    typeof Notification === "undefined"
  ) {
    saveDeviceToken(fallback);
    return fallback;
  }

  if (Notification.permission === "denied") {
    saveDeviceToken(fallback);
    return fallback;
  }

  if (Notification.permission !== "granted" && !options?.requestPermission) {
    saveDeviceToken(fallback);
    return fallback;
  }

  try {
    let permission: NotificationPermission = Notification.permission;
    if (permission !== "granted" && options?.requestPermission) {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      saveDeviceToken(fallback);
      return fallback;
    }

    const firebase = await loadFirebaseSdk();
    if (!firebase.apps.length) firebase.initializeApp(config);
    const messaging = firebase.messaging();

    // Register the background worker, handing it the config via query string.
    const swUrl = `/firebase-messaging-sw.js?${new URLSearchParams(config as Record<string, string>).toString()}`;
    const registration = await navigator.serviceWorker.register(swUrl);

    const token: string = await messaging.getToken({ vapidKey, serviceWorkerRegistration: registration });
    const finalToken = token || fallback;

    // Persist active FCM / device token to localStorage so local storage and DB stay in sync
    saveDeviceToken(finalToken);

    // Show foreground messages while the app is open (bind once).
    if (!foregroundBound) {
      foregroundBound = true;
      messaging.onMessage((payload: any) => {
        const n = payload?.notification;
        if (n && Notification.permission === "granted") {
          const data = payload.data || {};
          // Shown through the service worker registration, not `new
          // Notification()`: Android Chrome throws on that constructor, and it
          // rendered without the app icon everywhere else. Same options as the
          // background handler in firebase-messaging-sw.js so both look alike;
          // the worker's notificationclick handler does the deep link.
          registration
            .showNotification(n.title || "NexClean", {
              body: n.body || "",
              icon: "/logo.png",
              badge: "/logo.png",
              data,
              tag: data.bookingId || undefined,
              renotify: !!data.bookingId,
              requireInteraction: data.kind === "offer",
              vibrate: data.kind === "offer" ? [600, 250, 600, 250, 600] : undefined,
            } as NotificationOptions)
            .catch(() => {
              /* notification blocked or worker gone — the in-app feed still has it */
            });
        }
      });
    }

    return finalToken;
  } catch (err) {
    console.info("FCM token retrieval note:", err);
    saveDeviceToken(fallback);
    return fallback;
  }
}

export function getStoredDeviceToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY) || getOrCreateDeviceToken();
}

export function clearStoredDeviceToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

export async function isFirebaseConfigured(): Promise<boolean> {
  return Boolean((await getPublicRuntimeConfig()).firebase);
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof Notification !== "undefined"
  );
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}
