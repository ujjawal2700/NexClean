import type { Job, JobOffer, AgentProfile, AgentSummary, AreaAlert } from "../types";
export declare const meKey: readonly ["agent", "me"];
export declare const jobsKey: readonly ["agent", "jobs"];
export declare const summaryKey: readonly ["agent", "summary"];
export declare function useSendOtp(): import("@tanstack/react-query").UseMutationResult<{
    sent: boolean;
}, Error, string, unknown>;
export declare function useVerifyOtp(): import("@tanstack/react-query").UseMutationResult<{
    token: string;
    user: AgentProfile;
}, Error, {
    phone: string;
    code: string;
}, unknown>;
export type AgentSignupInput = {
    name: string;
    phone: string;
    area: string;
    aadharNumber: string;
    aadharFront: string;
    aadharBack: string;
};
export declare function useAgentSignup(): import("@tanstack/react-query").UseMutationResult<{
    sent: boolean;
}, Error, AgentSignupInput, unknown>;
export declare function useAgentMe(): import("@tanstack/react-query").UseQueryResult<NoInfer<AgentProfile>, Error>;
export declare function useJobs(): import("@tanstack/react-query").UseQueryResult<NoInfer<Job[]>, Error>;
export declare function useSummary(): import("@tanstack/react-query").UseQueryResult<NoInfer<AgentSummary>, Error>;
export declare function useAdvanceJob(): import("@tanstack/react-query").UseMutationResult<Job, Error, string, unknown>;
export declare function useJobPhoto(): import("@tanstack/react-query").UseMutationResult<Job, Error, {
    id: string;
    kind: "before" | "after";
}, unknown>;
export declare function useToggleOnline(): import("@tanstack/react-query").UseMutationResult<AgentProfile, Error, boolean, unknown>;
/** Pings the backend so the admin's "online" badge reflects real, live activity (see AgentLayout). */
export declare function useHeartbeat(): import("@tanstack/react-query").UseMutationResult<AgentProfile, Error, void, unknown>;
export declare function useUpdateName(): import("@tanstack/react-query").UseMutationResult<AgentProfile, Error, string, unknown>;
export declare function useNotifyArea(): import("@tanstack/react-query").UseMutationResult<AreaAlert, Error, string, unknown>;
/** Register this device's push token so the agent gets offer pings when backgrounded. */
export declare function useRegisterToken(): import("@tanstack/react-query").UseMutationResult<{
    registered: boolean;
}, Error, string, unknown>;
export declare function useDeactivateAccount(): import("@tanstack/react-query").UseMutationResult<{
    deactivated: boolean;
}, Error, void, unknown>;
/** The agent's current live offer (used to restore the popup after a reconnect). */
export declare function fetchCurrentOffer(): Promise<JobOffer | null>;
/** Accept an offer — first cleaner wins; a "no longer available" error means it was taken. */
export declare function acceptOffer(bookingId: string): Promise<Job>;
/** Decline an offer — dispatch moves on to the next-nearest cleaner. */
export declare function declineOffer(bookingId: string): Promise<{
    ok: boolean;
}>;
