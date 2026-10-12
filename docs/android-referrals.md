# Customer Android referral integration

Web changes are implemented in `frontend/src/modules/landing/pages/ReferralLink.tsx` and `frontend/src/shared/lib/site.ts`. The Android/Flutter project is not present in this repository; these native requirements still need implementation or verification before the journey can be considered complete.

## Existing installed app

Register verified HTTPS App Links for `https://nexclean.in/referral` and `/referral/CODE` in the exported launcher activity:

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="nexclean.in" android:pathPrefix="/referral" />
</intent-filter>
```

The public `https://nexclean.in/.well-known/assetlinks.json` serves HTTP 200 and JSON and declares `com.nexclean.customer`. Its fingerprint must match the **Play App Signing certificate**, not only the upload certificate. Compare it with Play Console > App integrity. Do not replace it with a guessed certificate.

Handle both the launch URI and links received while the app is already running. Accept the code from query `code`, legacy query `ref`, or the `/referral/CODE` path. Normalize it with trim + uppercase. Load `https://nexclean.in/app/signup?ref=ENCODED_CODE` in the customer WebView. Loading signup directly avoids sending the installed app back through browser/store routing.

If the WebView loads `/referral` itself instead, identify it before page JavaScript executes with an existing `NexCleanShare` JavaScript channel, a user agent containing `NexClean`, or a document-start injection of `window.NexCleanApp = true`. Do not inject the flag after page load: the store redirect can already have happened.

## New install

The Play Store URL now contains an encoded `referrer` payload. Read it using the native Google Play Install Referrer API on first launch; do not expect browser localStorage to be available in the app WebView.

After decoding the outer Play Store parameter, the payload is a query string:

```text
ref=AISHA42&code=AISHA42&deep_link=https%3A%2F%2Fnexclean.in%2Freferral%3Fcode%3DAISHA42
```

Parse the query string, take `ref` (or `code`), persist the pending code, and load `/app/signup?ref=AISHA42`. A directly clicked referral should take precedence over an older install referral. Keep the pending code if signup is interrupted, and clear it after signup completes. An unsupported or unavailable referrer must leave ordinary signup usable. The backend remains responsible for validating referral eligibility.

Google references:
- https://developer.android.com/training/app-links
- https://developer.android.com/google/play/installreferrer
- https://developer.chrome.com/docs/android/intents

## Device validation

1. Install the Play-distributed build and tap a shared `/referral?code=CODE` link from a messaging app. Test a closed app and an already-running app; both should open signup with the code.
2. Uninstall the app, tap the same invite, install from its Play Store fallback, and launch. The Install Referrer integration should prefill the original code.
3. Repeat with `/referral/CODE`, an invalid code, a cancelled install, and a browser that blocks automatic app launches. Explicit Open/Install buttons remain available when a browser blocks redirects.
4. Check verification using `adb shell pm get-app-links com.nexclean.customer`. On a test device, reset and reverify if needed with `adb shell pm verify-app-links --re-verify com.nexclean.customer`.

Website deployment and a native app release are separate steps. Browser automation validates routing/encoding, but does not prove Android verification or referral delivery after a real Play installation.
