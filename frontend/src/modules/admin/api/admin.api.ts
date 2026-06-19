import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@shared/lib/api";
import { useAdminSession } from "../store/sessionStore";
import type {
  AdminStats,
  AdminBooking,
  AdminAgent,
  AdminPlan,
  Pricing,
  AlertSettings,
  TriggeredAlert,
  Campaign,
  AgentStatus,
} from "../types";

const keys = {
  stats: ["admin", "stats"] as const,
  bookings: ["admin", "bookings"] as const,
  agents: ["admin", "agents"] as const,
  pricing: ["admin", "pricing"] as const,
  plans: ["admin", "plans"] as const,
  campaigns: ["admin", "campaigns"] as const,
  settings: ["admin", "alert-settings"] as const,
  triggered: ["admin", "triggered"] as const,
};

function useAuthedQuery<T>(key: readonly unknown[], path: string) {
  const token = useAdminSession((s) => s.token);
  return useQuery({ queryKey: key, queryFn: () => apiFetch<T>(path), enabled: !!token });
}

/* -------------------------------- Auth ----------------------------------- */

export function useAdminLogin() {
  return useMutation({
    mutationFn: (vars: { email: string; password: string }) =>
      apiFetch<{ token: string; user: { name: string } }>("/auth/admin-login", {
        method: "POST",
        body: vars,
      }),
  });
}

/* ------------------------------- Queries --------------------------------- */

export const useStats = () => useAuthedQuery<AdminStats>(keys.stats, "/admin/stats");
export const useBookings = () => useAuthedQuery<AdminBooking[]>(keys.bookings, "/admin/bookings");
export const useAgents = () => useAuthedQuery<AdminAgent[]>(keys.agents, "/admin/agents");
export const usePricing = () => useAuthedQuery<Pricing>(keys.pricing, "/admin/pricing");
export const usePlans = () => useAuthedQuery<AdminPlan[]>(keys.plans, "/admin/plans");
export const useCampaigns = () => useAuthedQuery<Campaign[]>(keys.campaigns, "/admin/campaigns");
export const useAlertSettings = () => useAuthedQuery<AlertSettings>(keys.settings, "/area-alerts/settings");
export const useTriggered = () => useAuthedQuery<TriggeredAlert[]>(keys.triggered, "/area-alerts/triggered");

/* ------------------------------ Mutations -------------------------------- */

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<AdminBooking>(`/admin/bookings/${id}/cancel`, { method: "PATCH" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.bookings });
      qc.invalidateQueries({ queryKey: keys.stats });
    },
  });
}

export function useSetAgentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; status: AgentStatus }) =>
      apiFetch<AdminAgent>(`/admin/agents/${vars.id}/status`, { method: "PATCH", body: { status: vars.status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.agents }),
  });
}

export function useUpdatePricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Pricing>) => apiFetch<Pricing>("/admin/pricing", { method: "PUT", body: patch }),
    onSuccess: (data) => qc.setQueryData(keys.pricing, data),
  });
}

export function useUpdateAlertSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<AlertSettings>) =>
      apiFetch<AlertSettings>("/area-alerts/settings", { method: "PUT", body: patch }),
    onSuccess: (data) => qc.setQueryData(keys.settings, data),
  });
}

export function useSendCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { title: string; body: string; audience: string }) =>
      apiFetch<Campaign>("/admin/campaigns", { method: "POST", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.campaigns }),
  });
}
