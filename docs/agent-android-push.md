# Agent Android background push handoff

The Flutter/Android project for the Play Store app is maintained separately and is not in this repository. Website changes alone cannot confirm or repair its Firebase setup. Foreground Socket.IO offers are independent of FCM and do not demonstrate that background push works.

## Existing server contract

The backend sends Firebase notification + data messages, Android priority `high`, and a TTL matching each job offer's remaining lifetime. Job alerts request Android channel `job_offers` and sound `job_offer`. Standard notifications use the default sound. Keep the agent online during tests; closing the app does not intentionally take the agent offline.

The native app must obtain its Firebase Messaging registration token and pass it into the loaded WebView:

```javascript
await window.registerNativePushToken(nativeFcmToken)
```

The argument must be the native Firebase Messaging token, never a local UUID, APNs token, or a `web-` placeholder. Use JSON encoding when injecting the token into JavaScript. The function returns `true` after backend registration succeeds. If it returns `false` before sign-in, retry after sign-in. Register the current token on page load and token refresh; the page emits `nexclean:push-bridge-ready` when it can accept it. Native code must explicitly handle that event or resend on WebView navigation/app resume. Tokens may rotate after reinstall, restore, or app-data clearing.

## Checks for the Android developer

1. Confirm the release app's application ID and `google-services.json` belong to the same Firebase project as the backend service account. Do not send the service-account private key to the app.
2. Initialize Firebase before obtaining `FirebaseMessaging.instance.getToken()`. Log registration success/failure without logging the full token. Subscribe to `onTokenRefresh` and send refreshed tokens to the WebView bridge.
3. Declare `android.permission.POST_NOTIFICATIONS` and request notification permission at runtime on Android 13+. Browser `Notification.permission` in the WebView does not establish native permission.
4. Create the `job_offers` Android notification channel with high importance before offers arrive. Package the `job_offer` sound under Android's raw resources. Verify the channel is not muted in system settings. Configure a valid default notification channel as well.
5. For notification + data messages, Android normally displays the notification while the app is backgrounded. Do not depend on WebView JavaScript or a foreground `onMessage` callback to display it. If implementing data-only/custom background handling, register Flutter's top-level background handler with `@pragma('vm:entry-point')` and initialize Firebase in that handler.
6. Handle `getInitialMessage()` and `onMessageOpenedApp` to open the URL/booking in the notification data when tapped.

## Device test to isolate the failing layer

1. Use a Play Store release build on a physical Android phone with notification permission enabled. Sign in as an agent and confirm the native bridge registration returns `true`.
2. Obtain the native FCM token privately from the developer's device tooling. Send a Firebase Console test notification directly to that token with the app backgrounded. If this fails, investigate native configuration, permission, channels, and device restrictions before changing dispatch.
3. Send a standard notification through NexClean with the app foregrounded, backgrounded, screen locked, and normally removed from recents. Verify notification display and tap routing separately.
4. Repeat with an actual job offer while the agent is online and the offer is still valid. Offer pushes intentionally expire quickly; use a standard notification to distinguish delayed delivery from offer expiry.
5. Review backend logs for `Firebase Cloud Messaging initialized`, `push:mock`, and per-token Firebase failures. `push:mock` means no real notification was sent. Sender/project mismatch and expired tokens have different fixes.
6. Repeat after signing out/in and after reinstalling to check registration and token rotation. Android Settings > Force stop is distinct from normal dismissal: Firebase documents that messages resume after manually reopening a force-stopped app.

A successful backend FCM send means Firebase accepted the message, not proof of display on the device. End-to-end acceptance requires the physical-device tests above.

References:
- https://firebase.google.com/docs/cloud-messaging/flutter/receive-messages
- https://firebase.google.com/docs/cloud-messaging/flutter/get-started
- https://firebase.google.com/docs/cloud-messaging/android/get-started
- https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages
