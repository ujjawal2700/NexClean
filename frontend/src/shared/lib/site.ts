/** The public web address. Links meant to be shared always use it, even from inside the mobile app's web view. */
export const SITE_URL = "https://nexclean.in";

/**
 * A shareable referral invite. /referral is the one path the customer apps
 * claim (.well-known/assetlinks.json, apple-app-site-association), so on a
 * phone with NexClean installed it opens the app. The browser landing page
 * handles Android's Play Store fallback; other platforms use web sign-up.
 */
export function referralInviteUrl(code: string): string {
  return `${SITE_URL}/referral?code=${encodeURIComponent(code)}`;
}

export const CUSTOMER_ANDROID_PACKAGE = "com.nexclean.customer";

/** Play preserves this payload for the app's Install Referrer integration. */
export function customerPlayStoreUrl(code: string): string {
  const url = new URL("https://play.google.com/store/apps/details");
  url.searchParams.set("id", CUSTOMER_ANDROID_PACKAGE);
  url.searchParams.set("hl", "en_IN");
  if (code) {
    url.searchParams.set("referrer", new URLSearchParams({
      ref: code,
      code,
      deep_link: referralInviteUrl(code),
    }).toString());
  }
  return url.toString();
}

/** Explicit package routing also works when Android domain verification fails. */
export function referralAndroidIntentUrl(code: string): string {
  const invite = new URL(referralInviteUrl(code));
  return `intent://${invite.host}${invite.pathname}${invite.search}` +
    `#Intent;scheme=https;package=${CUSTOMER_ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(customerPlayStoreUrl(code))};end`;
}
