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
