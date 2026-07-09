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

// Focus the app (or open it) when a push is tapped.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    }),
  );
});
