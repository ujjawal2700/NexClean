import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@shared/lib/api";
import { useAgentSession } from "../store/sessionStore";
export const meKey = ["agent", "me"];
export const jobsKey = ["agent", "jobs"];
export const summaryKey = ["agent", "summary"];
/* -------------------------------- Auth ----------------------------------- */
export function useSendOtp() {
    return useMutation({
        mutationFn: (phone) => apiFetch("/auth/send-otp", { method: "POST", body: { phone } }),
    });
}
export function useVerifyOtp() {
    return useMutation({
        mutationFn: (vars) => apiFetch("/auth/verify-otp", { method: "POST", body: vars }),
    });
}
export function useAgentSignup() {
    return useMutation({
        mutationFn: (vars) => apiFetch("/auth/agent/signup", { method: "POST", body: vars }),
    });
}
/* ------------------------------- Queries --------------------------------- */
export function useAgentMe() {
    const token = useAgentSession((s) => s.token);
    return useQuery({ queryKey: meKey, queryFn: () => apiFetch("/auth/me"), enabled: !!token });
}
export function useJobs() {
    const token = useAgentSession((s) => s.token);
    return useQuery({ queryKey: jobsKey, queryFn: () => apiFetch("/agent/jobs"), enabled: !!token });
}
export function useSummary() {
    const token = useAgentSession((s) => s.token);
    return useQuery({ queryKey: summaryKey, queryFn: () => apiFetch("/agent/summary"), enabled: !!token });
}
/* ------------------------------ Mutations -------------------------------- */
function useJobMutation(fn) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: fn,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: jobsKey });
            qc.invalidateQueries({ queryKey: summaryKey });
        },
    });
}
export function useAdvanceJob() {
    return useJobMutation((id) => apiFetch(`/agent/jobs/${id}/advance`, { method: "PATCH" }));
}
export function useJobPhoto() {
    return useJobMutation((vars) => apiFetch(`/agent/jobs/${vars.id}/photo`, { method: "POST", body: { kind: vars.kind } }));
}
export function useToggleOnline() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (online) => apiFetch("/agent/online", { method: "PATCH", body: { online } }),
        onSuccess: (user) => qc.setQueryData(meKey, user),
    });
}
/** Pings the backend so the admin's "online" badge reflects real, live activity (see AgentLayout). */
export function useHeartbeat() {
    return useMutation({
        mutationFn: () => apiFetch("/agent/heartbeat", { method: "PATCH" }),
    });
}
export function useUpdateName() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (name) => apiFetch("/users/me", { method: "PATCH", body: { name } }),
        onSuccess: (user) => qc.setQueryData(meKey, user),
    });
}
export function useNotifyArea() {
    return useMutation({
        mutationFn: (society) => apiFetch("/agent/notify-area", { method: "POST", body: { society } }),
    });
}
/** Register this device's push token so the agent gets offer pings when backgrounded. */
export function useRegisterToken() {
    return useMutation({
        mutationFn: (token) => apiFetch("/notifications/register-token", { method: "POST", body: { token } }),
    });
}
export function useDeactivateAccount() {
    return useMutation({
        mutationFn: () => apiFetch("/users/me/deactivate", { method: "POST" }),
    });
}
/* -------------------------- Dispatch offers ------------------------------ */
/** The agent's current live offer (used to restore the popup after a reconnect). */
export function fetchCurrentOffer() {
    return apiFetch("/agent/offers/current");
}
/** Accept an offer — first cleaner wins; a "no longer available" error means it was taken. */
export function acceptOffer(bookingId) {
    return apiFetch(`/agent/offers/${bookingId}/accept`, { method: "POST" });
}
/** Decline an offer — dispatch moves on to the next-nearest cleaner. */
export function declineOffer(bookingId) {
    return apiFetch(`/agent/offers/${bookingId}/decline`, { method: "POST" });
}
