type SessionState = {
    token: string | null;
    name: string;
    permissions: string[];
    setSession: (token: string, name: string, permissions: string[]) => void;
    clear: () => void;
};
/** Holds the admin's JWT (persisted), separate from customer/agent sessions. */
export declare const useAdminSession: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<SessionState>, "setState" | "persist"> & {
    setState(partial: SessionState | Partial<SessionState> | ((state: SessionState) => SessionState | Partial<SessionState>), replace?: false | undefined): unknown;
    setState(state: SessionState | ((state: SessionState) => SessionState), replace: true): unknown;
    persist: {
        setOptions: (options: Partial<import("zustand/middleware").PersistOptions<SessionState, SessionState, unknown>>) => void;
        clearStorage: () => void;
        rehydrate: () => Promise<void> | void;
        hasHydrated: () => boolean;
        onHydrate: (fn: (state: SessionState) => void) => () => void;
        onFinishHydration: (fn: (state: SessionState) => void) => () => void;
        getOptions: () => Partial<import("zustand/middleware").PersistOptions<SessionState, SessionState, unknown>>;
    };
}>;
export {};
