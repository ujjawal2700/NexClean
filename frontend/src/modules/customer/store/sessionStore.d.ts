type SessionState = {
    token: string | null;
    setToken: (token: string) => void;
    clear: () => void;
};
/** Holds the customer's JWT (persisted). The API client reads the token from here. */
export declare const useSessionStore: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<SessionState>, "setState" | "persist"> & {
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
