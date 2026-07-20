import { create } from "zustand";
import { persist } from "zustand/middleware";
import { registerAuthToken } from "@shared/lib/api";
/** Holds the agent's JWT (persisted), separate from the customer session. */
export const useAgentSession = create()(persist((set) => ({
    token: null,
    setToken: (token) => set({ token }),
    clear: () => set({ token: null }),
}), { name: "nexclean-agent-session" }));
// Provide the agent token for requests made under /agent/*.
registerAuthToken("/agent", () => useAgentSession.getState().token);
