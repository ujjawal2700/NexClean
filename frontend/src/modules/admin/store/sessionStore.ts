import { create } from "zustand";
import { persist } from "zustand/middleware";
import { registerAuthToken } from "@shared/lib/api";

type SessionState = {
  token: string | null;
  name: string;
  setSession: (token: string, name: string) => void;
  clear: () => void;
};

/** Holds the admin's JWT (persisted), separate from customer/agent sessions. */
export const useAdminSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      name: "Admin",
      setSession: (token, name) => set({ token, name }),
      clear: () => set({ token: null }),
    }),
    { name: "nexclean-admin-session" },
  ),
);

// Provide the admin token for requests made under /admin/*.
registerAuthToken("/admin", () => useAdminSession.getState().token);
