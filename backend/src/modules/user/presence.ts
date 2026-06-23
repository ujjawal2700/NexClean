/** An agent counts as "live" only if they've toggled online AND sent a heartbeat recently. */
export const AGENT_STALE_MS = 75_000;

export function agentLiveSince(): Date {
  return new Date(Date.now() - AGENT_STALE_MS);
}

export function isAgentLive(agent: { online?: boolean | null; lastSeenAt?: Date | string | null }): boolean {
  if (!agent.online || !agent.lastSeenAt) return false;
  return new Date(agent.lastSeenAt).getTime() >= agentLiveSince().getTime();
}
