/** The public web address. Links meant to be shared always use it, even from inside the mobile app's web view. */
export const SITE_URL = "https://nexclean.in";

/**
 * A shareable referral invite. /referral is the one path the customer apps
 * claim (.well-known/assetlinks.json, apple-app-site-association), so on a
 * phone with NexClean installed it opens the app; anywhere else it opens
 * sign-up on the web with the code applied.
 */
export function referralInviteUrl(code: string): string {
  return `${SITE_URL}/referral?code=${encodeURIComponent(code)}`;
}
