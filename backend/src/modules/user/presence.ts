/**
 * When a cleaner counts as available for work.
 *
 * Online is the cleaner's own switch, and nothing else. It used to also need a
 * heartbeat from the open app in the last 75 seconds, so swiping the app away
 * quietly took a cleaner out of dispatch and they stopped getting jobs they
 * had said they wanted. Now an online cleaner keeps getting offers (by push
 * when the app is closed) until they go offline themselves — or until a run of
 * unanswered offers shows the phone isn't reachable (see dispatch's missed-
 * offer limit), which is what keeps a switched-off phone from stalling jobs.
 */
export function isAgentLive(agent: { online?: boolean | null }): boolean {
  return agent.online === true;
}

/** The app checked in this recently, so an offer reaches it over the live socket. */
export const AGENT_APP_ACTIVE_MS = 75_000;

/** A token FCM can actually deliver to — not the "web-…" placeholder used when push is unavailable. */
export function isRealPushToken(token: string): boolean {
  return !!token && !token.startsWith("web-");
}

/**
 * Online cleaners an offer can actually reach: their app is open right now, or
 * their phone has a real push token for when it's closed. Online alone isn't
 * enough — a cleaner left "online" on a phone that can't get pushes would take
 * every nearby offer and sit on it until it timed out, and the cleaner who
 * could have answered never saw it.
 */
export function reachableAgentFilter(now = Date.now()) {
  return {
    online: true,
    $or: [
      { lastSeenAt: { $gte: new Date(now - AGENT_APP_ACTIVE_MS) } },
      { deviceTokens: { $elemMatch: { $not: /^web-/ } } },
    ],
  };
}
