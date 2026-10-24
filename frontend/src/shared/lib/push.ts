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
const NATIVE_KEY = "nexclean-native-push-token";

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
  // A temporary CDN failure must not disable token retrieval until reload.
  sdkPromise = sdkPromise.catch((error) => {
    sdkPromise = null;
    throw error;
  });
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
  // The store app's token must win over a browser token or placeholder,
  // including when the native bridge fires while runtime config is loading.
  const preferredToken = () => localStorage.getItem(NATIVE_KEY) || fallback;
  const nativeToken = localStorage.getItem(NATIVE_KEY);
  if (nativeToken) return nativeToken;
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
    saveDeviceToken(preferredToken());
    return preferredToken();
  }

  if (Notification.permission === "denied") {
    saveDeviceToken(preferredToken());
    return preferredToken();
  }

  if (Notification.permission !== "granted" && !options?.requestPermission) {
    saveDeviceToken(preferredToken());
    return preferredToken();
  }

  try {
    let permission: NotificationPermission = Notification.permission;
    if (permission !== "granted" && options?.requestPermission) {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      saveDeviceToken(preferredToken());
      return preferredToken();
    }

    const firebase = await loadFirebaseSdk();
    if (!firebase.apps.length) firebase.initializeApp(config);
    const messaging = firebase.messaging();

    // Register the background worker, handing it the config via query string.
    const swUrl = `/firebase-messaging-sw.js?${new URLSearchParams(config as Record<string, string>).toString()}`;
    const registration = await navigator.serviceWorker.register(swUrl);

    const token: string = await messaging.getToken({ vapidKey, serviceWorkerRegistration: registration });
    const finalToken = localStorage.getItem(NATIVE_KEY) || token || fallback;

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
    saveDeviceToken(preferredToken());
    return preferredToken();
  }
}

export function getStoredDeviceToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY) || getOrCreateDeviceToken();
}

export function clearStoredDeviceToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  localStorage.removeItem(NATIVE_KEY);
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

/**
 * Ask for notification permission. Call this FIRST in a tap handler, before
 * any `await`: Safari only shows the prompt when it is requested directly from
 * the user's gesture, and an awaited network call in between (getPushToken
 * reads the runtime config first) uses that gesture up, so iOS silently denied
 * the request. Chrome is lenient about this, which is why Android worked.
 */
export function requestPushPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isPushSupported()) return Promise.resolve("unsupported");
  if (Notification.permission !== "default") return Promise.resolve(Notification.permission);
  return Notification.requestPermission();
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS reports itself as a Mac; touch support tells them apart.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * True on an iPhone/iPad browsing in Safari (or any iOS browser tab): iOS only
 * offers web push to a site opened from the Home Screen, so the way to get
 * notifications there is "Share → Add to Home Screen", not a permission prompt.
 */
export function needsHomeScreenForPush(): boolean {
  return isIos() && !isStandalone();
}

/**
 * Bridge for the store apps (Flutter web view). Web push doesn't exist inside
 * an app's web view on iOS, so the app gets its own native FCM token (with
 * APNs) and hands it to the page:
 *
 *   window.registerNativePushToken("<fcm token>")
 *
 * Call it once the page has loaded and again whenever the token refreshes. It
 * saves the token (so the next sign-in registers it too) and, if someone is
 * signed in, registers it for them right away. Resolves true when registered.
 *
 * Before this, the page only registered once at load, using whatever token
 * happened to be saved already — an app that saved its token a moment later
 * left the account with a placeholder, and the server had nothing to send to.
 */
export function installNativePushBridge(register: (token: string) => Promise<unknown>): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { registerNativePushToken?: (token: string) => Promise<boolean> };
  w.registerNativePushToken = async (token: string) => {
    const t = typeof token === "string" ? token.trim() : "";
    if (t.length < 8 || t.startsWith("web-")) return false;
    localStorage.setItem(NATIVE_KEY, t);
    saveDeviceToken(t);
    try {
      await register(t);
      // Lets an open screen refresh what it shows about push (e.g. the
      // cleaner's "notifications are off" warning).
      window.dispatchEvent(new Event("nexclean:push-registered"));
      return true;
    } catch {
      // Not signed in yet — the saved token is registered on sign-in.
      return false;
    }
  };
  window.dispatchEvent(new Event("nexclean:push-bridge-ready"));
}
