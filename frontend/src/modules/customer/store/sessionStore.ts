import { create } from "zustand";
import { persist } from "zustand/middleware";
import { registerAuthToken } from "@shared/lib/api";

type SessionState = {
  token: string | null;
  setToken: (token: string) => void;
  clear: () => void;
};

/** Holds the customer's JWT (persisted). The API client reads the token from here. */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => set({ token }),
      clear: () => set({ token: null }),
    }),
    { name: "nexclean-session" },
  ),
);

// Provide the customer token for requests made under /app/*.
registerAuthToken("/app", () => useSessionStore.getState().token);
