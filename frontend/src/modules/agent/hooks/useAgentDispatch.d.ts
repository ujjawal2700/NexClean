import type { JobOffer } from "../types";
export type AgentDispatch = {
    offer: JobOffer | null;
    accept: () => Promise<void>;
    decline: () => Promise<void>;
    accepting: boolean;
    error: string | null;
    /** Whether we're actively streaming GPS (agent online + permission granted). */
    locating: boolean;
};
/**
 * Connects the agent's real-time dispatch channel:
 *  - streams live GPS while online (for nearest-agent ranking)
 *  - receives job offers over the socket + restores any live offer on reconnect
 *  - exposes accept/decline actions
 *
 * Mounted once in AgentLayout so the popup shows over any page.
 */
export declare function useAgentDispatch(): AgentDispatch;
