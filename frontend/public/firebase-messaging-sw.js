/*
 * NexClean — Firebase Cloud Messaging background handler.
 *
 * A service worker can't use the bundler, so Firebase is loaded from the
 * gstatic CDN (the same way the app loads Google Maps). The web config is
 * passed in the query string when the app registers this worker, so no build
 * step is needed. The worker stays completely inert until a config is provided.
 */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

const params = new URLSearchParams(self.location.search);
const config = {
  apiKey: params.get("apiKey") || undefined,
  authDomain: params.get("authDomain") || undefined,
  projectId: params.get("projectId") || undefined,
  storageBucket: params.get("storageBucket") || undefined,
  messagingSenderId: params.get("messagingSenderId") || undefined,
  appId: params.get("appId") || undefined,
};

if (config.apiKey && config.projectId && config.messagingSenderId && config.appId) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const n = payload.notification || {};
    const data = payload.data || {};
    self.registration.showNotification(n.title || "NexClean", {
      body: n.body || "",
      icon: "/logo.png",
      badge: "/logo.png",
      data,
      // Collapse repeated updates for the same booking into one notification.
      tag: data.bookingId || undefined,
      renotify: !!data.bookingId,
      // A new job offer should demand attention.
      requireInteraction: data.kind === "offer",
    });
  });
}

// Where a notification's data should take the viewer. Mirrors
// frontend/src/shared/lib/notificationLink.ts — this file runs outside the
// bundler (a service worker can't import it), so the logic is duplicated
// rather than shared. Keep the two in sync.
function resolveNotificationPath(data) {
  if (!data) return null;
  if (data.url) return data.url;
  if (data.bookingId) {
    return data.role === "agent" ? `/agent/jobs/${data.bookingId}` : `/app/track/${data.bookingId}`;
  }
  return null;
}

// Deep-link into the right booking screen when a push is tapped: focus (and
// navigate) an already-open tab if there is one, otherwise open a new one
// straight at the target instead of the app root.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = resolveNotificationPath(event.notification.data);
  const target = path ? new URL(path, self.location.origin).href : self.location.origin;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if (path && "navigate" in client) client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});
