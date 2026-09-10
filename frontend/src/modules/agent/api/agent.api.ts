import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@shared/lib/api";
import { useAgentSession } from "../store/sessionStore";
import type {
  Job,
  JobOffer,
  AgentProfile,
  AgentSummary,
  AreaAlert,
  AgentNotification,
  BankAccount,
  IfscBranch,
  WalletSummary,
  PayoutRequest,
} from "../types";

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

export function useSendSignupOtp() {
  return useMutation({
    mutationFn: (phone: string) =>
      apiFetch<{ sent: boolean }>("/auth/send-signup-otp", { method: "POST", body: { phone } }),
  });
}

export function useVerifyOtpCodeOnly() {
  return useMutation({
    mutationFn: (vars: { phone: string; code: string }) =>
      apiFetch<{ verified: boolean }>("/auth/verify-otp-code", { method: "POST", body: vars }),
  });
}

export function useVerifyOtp() {
  return useMutation({
    mutationFn: (vars: { phone: string; code: string }) =>
      apiFetch<{ token: string; user: AgentProfile }>("/auth/verify-otp", { method: "POST", body: vars }),
  });
}

export type AgentSignupBasicInput = {
  name: string;
  phone: string;
  city: string;
  area?: string;
  code: string;
};

export function useAgentSignupBasic() {
  return useMutation({
    mutationFn: (vars: AgentSignupBasicInput) =>
      apiFetch<{ token: string; user: AgentProfile }>("/auth/agent/signup-basic", { method: "POST", body: vars }),
  });
}

export type AgentSignupInput = {
  name: string;
  phone: string;
  city?: string;
  area?: string;
  aadharNumber: string;
  aadharFront: string;
  aadharBack: string;
};

export function useAgentSignup() {
  return useMutation({
    mutationFn: (vars: AgentSignupInput) =>
      apiFetch<{ token: string; user: AgentProfile; sent?: boolean }>("/auth/agent/signup", { method: "POST", body: vars }),
  });
}

/* ------------------------------- Queries --------------------------------- */

export function useAgentMe() {
  const authenticated = useAgentSession((s) => s.authenticated);
  return useQuery({ queryKey: meKey, queryFn: () => apiFetch<AgentProfile>("/auth/me"), enabled: authenticated });
}

export function useJobs() {
  const authenticated = useAgentSession((s) => s.authenticated);
  return useQuery({ queryKey: jobsKey, queryFn: () => apiFetch<Job[]>("/agent/jobs"), enabled: authenticated });
}

export function useSummary() {
  const authenticated = useAgentSession((s) => s.authenticated);
  return useQuery({ queryKey: summaryKey, queryFn: () => apiFetch<AgentSummary>("/agent/summary"), enabled: authenticated });
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
  return useJobMutation(
    (vars: {
      id: string;
      kind: "before" | "after";
      image?: string;
      action?: "add" | "remove";
      index?: number;
    }) =>
      apiFetch<Job>(`/agent/jobs/${vars.id}/photo`, {
        method: "POST",
        body: { kind: vars.kind, image: vars.image, action: vars.action, index: vars.index },
      }),
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

export const notificationsKey = ["agent", "notifications"] as const;

/**
 * The cleaner's notification feed.
 *
 * Polls on the same cadence as the customer's inbox. The socket already pushes
 * a "notification" event, but polling is the backstop that makes an unread
 * badge correct after the app has been backgrounded or the socket has dropped.
 */
export function useAgentNotifications() {
  const authenticated = useAgentSession((s) => s.authenticated);
  return useQuery({
    queryKey: notificationsKey,
    queryFn: () => apiFetch<AgentNotification[]>("/notifications"),
    enabled: authenticated,
    refetchInterval: 20_000,
  });
}

export function useMarkAgentNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ ok: boolean }>("/notifications/read", { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationsKey }),
  });
}

/** Register this device's push token so the agent gets offer pings when backgrounded. */
export function useRegisterToken() {
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch<{ registered: boolean }>("/notifications/register-token", { method: "POST", body: { token } }),
  });
}

export function useDeactivateAccount() {
  return useMutation({
    mutationFn: () => apiFetch<{ deactivated: boolean }>("/users/me/deactivate", { method: "POST" }),
  });
}

/* --------------------------- Bank account + payouts ----------------------- */

export const bankAccountKey = ["agent", "bank-account"] as const;
export const walletKey = ["agent", "wallet"] as const;

export function useBankAccount() {
  const authenticated = useAgentSession((s) => s.authenticated);
  return useQuery({
    queryKey: bankAccountKey,
    queryFn: () => apiFetch<BankAccount | null>("/agent/bank-account"),
    enabled: authenticated,
  });
}

export function useSaveBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      holderName: string;
      bankName: string;
      accountNumber: string;
      confirmAccountNumber: string;
      ifsc: string;
    }) => apiFetch<BankAccount>("/agent/bank-account", { method: "PUT", body: vars }),
    onSuccess: (account) => qc.setQueryData(bankAccountKey, account),
  });
}

/**
 * On-demand IFSC lookup — not a query hook, since it fires on blur/debounce
 * rather than being tied to a component's mount, and a failed/unknown code is
 * an expected outcome the caller handles inline rather than an error state.
 */
export function lookupIfsc(code: string): Promise<IfscBranch> {
  return apiFetch<IfscBranch>(`/agent/bank-account/ifsc/${encodeURIComponent(code)}`);
}

export function useWallet() {
  const authenticated = useAgentSession((s) => s.authenticated);
  return useQuery({
    queryKey: walletKey,
    queryFn: () => apiFetch<WalletSummary>("/agent/wallet"),
    enabled: authenticated,
  });
}

export function useRequestPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) =>
      apiFetch<PayoutRequest>("/agent/payout-requests", { method: "POST", body: { amount } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: walletKey }),
  });
}

/* -------------------------- Dispatch offers ------------------------------ */

/** The agent's current live offer (used to restore the popup after a reconnect). */
export function fetchCurrentOffer() {
  return apiFetch<JobOffer | null>("/agent/offers/current");
}

/** Accept an offer — first cleaner wins; a "no longer available" error means it was taken. */
export function acceptOffer(bookingId: string) {
  return apiFetch<Job>(`/agent/offers/${bookingId}/accept`, { method: "POST" });
}

/** Decline an offer — dispatch moves on to the next-nearest cleaner. */
export function declineOffer(bookingId: string) {
  return apiFetch<{ ok: boolean }>(`/agent/offers/${bookingId}/decline`, { method: "POST" });
}

/* ----------------------- Available jobs pool ----------------------------- */

export const availableJobsKey = ["agent", "available-jobs"] as const;

/**
 * Today's unclaimed bookings visible to all online verified agents.
 * Polls every 30s so the list stays fresh without a manual refresh.
 */
export function useAvailableJobs() {
  const authenticated = useAgentSession((s) => s.authenticated);
  return useQuery({
    queryKey: availableJobsKey,
    queryFn: () => apiFetch<Job[]>("/agent/available-jobs"),
    enabled: authenticated,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

/** Claim a job from the available pool — atomically self-assigns. */
export function useClaimJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) =>
      apiFetch<Job>(`/agent/jobs/${bookingId}/claim`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: jobsKey });
      void qc.invalidateQueries({ queryKey: summaryKey });
      void qc.invalidateQueries({ queryKey: availableJobsKey });
    },
  });
}
