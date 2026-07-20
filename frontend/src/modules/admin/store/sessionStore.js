import { create } from "zustand";
import { persist } from "zustand/middleware";
import { registerAuthToken } from "@shared/lib/api";
/** Holds the admin's JWT (persisted), separate from customer/agent sessions. */
export const useAdminSession = create()(persist((set) => ({
    token: null,
    name: "Admin",
    permissions: [],
    setSession: (token, name, permissions) => set({ token, name, permissions }),
    clear: () => set({ token: null, name: "Admin", permissions: [] }),
}), { name: "nexclean-admin-session" }));
// Provide the admin token for requests made under /admin/*.
registerAuthToken("/admin", () => useAdminSession.getState().token);
