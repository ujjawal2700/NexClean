import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiFetch, registerAuthToken } from "@shared/lib/api";

type SessionState = {
  authenticated: boolean;
  /** In-memory only; never persisted. See the note below. */
  token: string | null;
  name: string;
  permissions: string[];
  setSession: (token: string, name: string, permissions: string[]) => void;
  clear: () => void;
};

/**
 * The JWT itself is NOT persisted any more — it lives in an httpOnly cookie the
 * browser attaches automatically, where injected script cannot read it. What we
 * keep here is `authenticated`, a non-sensitive flag so route guards and query
 * `enabled:` checks survive a refresh. `token` is kept in memory only, as a
 * fallback for sessions established before the cookie migration.
 */
export const useAdminSession = create<SessionState>()(
  persist(
    (set) => ({
      authenticated: false,
      token: null,
      name: "Admin",
      permissions: [],
      setSession: (token, name, permissions) => set({ token, name, permissions, authenticated: true }),
      clear: () => {
        // Ending the session has to reach the server now: the credential is an
        // httpOnly cookie, so clearing local state alone would leave a usable
        // session behind. Fire-and-forget — the UI shouldn't wait to log out.
        void apiFetch("/auth/logout", { method: "POST", body: { role: "admin" } }).catch(() => {});
        set({ token: null, name: "Admin", permissions: [], authenticated: false });
      },
    }),
    {
      name: "nexclean-admin-session",
      // Name and permissions are display data, not credentials, so they persist.
      partialize: (s) => ({ authenticated: s.authenticated, name: s.name, permissions: s.permissions }),
    },
  ),
);

// Legacy bearer fallback for requests made under /admin/*.
registerAuthToken("/admin", () => useAdminSession.getState().token, "admin");
