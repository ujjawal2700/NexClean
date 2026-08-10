import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiFetch, registerAuthToken } from "@shared/lib/api";

type SessionState = {
  authenticated: boolean;
  /** In-memory only; never persisted. See the note below. */
  token: string | null;
  setToken: (token: string) => void;
  clear: () => void;
};

/**
 * The JWT itself is NOT persisted any more — it lives in an httpOnly cookie the
 * browser attaches automatically, where injected script cannot read it. What we
 * keep here is `authenticated`, a non-sensitive flag so route guards and query
 * `enabled:` checks survive a refresh. `token` is kept in memory only, as a
 * fallback for sessions established before the cookie migration.
 */
export const useAgentSession = create<SessionState>()(
  persist(
    (set) => ({
      authenticated: false,
      token: null,
      setToken: (token) => {
        // Enforce single-role: log out the customer session before activating agent.
        localStorage.removeItem("nexclean-session");
        set({ token, authenticated: true });
      },
      clear: () => {
        // Ending the session has to reach the server now: the credential is an
        // httpOnly cookie, so clearing local state alone would leave a usable
        // session behind. Fire-and-forget — the UI shouldn't wait to log out.
        void apiFetch("/auth/logout", { method: "POST", body: { role: "agent" } }).catch(() => {});
        set({ token: null, authenticated: false });
      },
    }),
    {
      name: "nexclean-agent-session",
      partialize: (s) => ({ authenticated: s.authenticated }),
    },
  ),
);

// Legacy bearer fallback for requests made under /agent/*.
registerAuthToken("/agent", () => useAgentSession.getState().token, "agent");
