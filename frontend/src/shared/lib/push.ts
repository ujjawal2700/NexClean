/**
 * Returns a stable per-device push token, persisted in localStorage.
 *
 * Real FCM web tokens require the Firebase web SDK + a service worker + a VAPID
 * key. Until that's configured we mint a synthetic token so the backend's
 * Smart Area Alert engine can target this device (it sends in mock/log mode).
 * Swap this for getToken(messaging, { vapidKey }) when Firebase is wired up.
 */
const KEY = "nexclean-device-token";

export function getOrCreateDeviceToken(): string {
  let token = localStorage.getItem(KEY);
  if (!token) {
    token = `web-${crypto.randomUUID()}`;
    localStorage.setItem(KEY, token);
  }
  return token;
}
