import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@shared/lib/api";
import { useAgentSession } from "../store/sessionStore";
import type { Job, AgentProfile, AgentSummary, AreaAlert } from "../types";

export const meKey = ["agent", "me"] as const;
export const jobsKey = ["agent", "jobs"] as const;
export const summaryKey = ["agent", "summary"] as const;

/* -------------------------------- Auth ----------------------------------- */

export function useSendOtp() {
  return useMutation({
    mutationFn: (phone: string) =>
      apiFetch<{ sent: boolean }>("/auth/send-otp", { method: "POST", body: { phone } }),
  });
}

export function useVerifyOtp() {
  return useMutation({
    mutationFn: (vars: { phone: string; code: string }) =>
      apiFetch<{ token: string; user: AgentProfile }>("/auth/verify-otp", { method: "POST", body: vars }),
  });
}

export type AgentSignupInput = {
  name: string;
  phone: string;
  area: string;
  aadharNumber: string;
  aadharFront: string;
  aadharBack: string;
};

export function useAgentSignup() {
  return useMutation({
    mutationFn: (vars: AgentSignupInput) =>
      apiFetch<{ sent: boolean }>("/auth/agent/signup", { method: "POST", body: vars }),
  });
}

/* ------------------------------- Queries --------------------------------- */

export function useAgentMe() {
  const token = useAgentSession((s) => s.token);
  return useQuery({ queryKey: meKey, queryFn: () => apiFetch<AgentProfile>("/auth/me"), enabled: !!token });
}

export function useJobs() {
  const token = useAgentSession((s) => s.token);
  return useQuery({ queryKey: jobsKey, queryFn: () => apiFetch<Job[]>("/agent/jobs"), enabled: !!token });
}

export function useSummary() {
  const token = useAgentSession((s) => s.token);
  return useQuery({ queryKey: summaryKey, queryFn: () => apiFetch<AgentSummary>("/agent/summary"), enabled: !!token });
}

/* ------------------------------ Mutations -------------------------------- */

function useJobMutation<TVars>(fn: (vars: TVars) => Promise<Job>) {
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
  return useJobMutation((id: string) => apiFetch<Job>(`/agent/jobs/${id}/advance`, { method: "PATCH" }));
}

export function useJobPhoto() {
  return useJobMutation((vars: { id: string; kind: "before" | "after" }) =>
    apiFetch<Job>(`/agent/jobs/${vars.id}/photo`, { method: "POST", body: { kind: vars.kind } }),
  );
}

export function useToggleOnline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (online: boolean) =>
      apiFetch<AgentProfile>("/agent/online", { method: "PATCH", body: { online } }),
    onSuccess: (user) => qc.setQueryData(meKey, user),
  });
}

/** Pings the backend so the admin's "online" badge reflects real, live activity (see AgentLayout). */
export function useHeartbeat() {
  return useMutation({
    mutationFn: () => apiFetch<AgentProfile>("/agent/heartbeat", { method: "PATCH" }),
  });
}

export function useUpdateName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiFetch<AgentProfile>("/users/me", { method: "PATCH", body: { name } }),
    onSuccess: (user) => qc.setQueryData(meKey, user),
  });
}

export function useNotifyArea() {
  return useMutation({
    mutationFn: (society: string) =>
      apiFetch<AreaAlert>("/agent/notify-area", { method: "POST", body: { society } }),
  });
}
