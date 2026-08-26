import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiFetch, registerAuthToken } from "@shared/lib/api";

type SessionState = {
  authenticated: boolean;
  /** Browsing without an account: dashboard + plans only, everything else asks for login. */
  guest: boolean;
  /** In-memory only; never persisted. See the note below. */
  token: string | null;
  setToken: (token: string) => void;
  startGuest: () => void;
  clear: () => void;
};

/**
 * The JWT itself is NOT persisted any more — it lives in an httpOnly cookie the
 * browser attaches automatically, where injected script cannot read it. What we
 * keep here is `authenticated`, a non-sensitive flag so route guards and query
 * `enabled:` checks survive a refresh. `token` is kept in memory only, as a
 * fallback for sessions established before the cookie migration.
 *
 * `guest` is the "skip login" browse mode. It is deliberately NOT a form of
 * authentication: no request is ever made with it, it only unlocks the two
 * read-only screens (dashboard, plans) in the route guard.
 */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      authenticated: false,
      guest: false,
      token: null,
      setToken: (token) => {
        // Enforce single-role: log out the agent session before activating customer.
        localStorage.removeItem("nexclean-agent-session");
        set({ token, authenticated: true, guest: false });
      },
      startGuest: () => set({ token: null, authenticated: false, guest: true }),
      clear: () => {
        // Ending the session has to reach the server now: the credential is an
        // httpOnly cookie, so clearing local state alone would leave a usable
        // session behind. Fire-and-forget — the UI shouldn't wait to log out.
        void apiFetch("/auth/logout", { method: "POST", body: { role: "customer" } }).catch(() => {});
        set({ token: null, authenticated: false, guest: false });
      },
    }),
    {
      name: "nexclean-session",
      partialize: (s) => ({ authenticated: s.authenticated, guest: s.guest }),
    },
  ),
);

/** True when the visitor skipped login — browsing, but not signed in. */
export function useIsGuest() {
  return useSessionStore((s) => s.guest && !s.authenticated);
}

// Legacy bearer fallback for requests made under /app/*.
registerAuthToken("/app", () => useSessionStore.getState().token, "customer");
