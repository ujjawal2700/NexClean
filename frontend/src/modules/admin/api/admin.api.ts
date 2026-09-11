import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@shared/lib/api";
import type { SiteContent } from "@shared/types/content";
import type { AgentLocationSnapshot } from "@shared/types/tracking";
import { useAdminSession } from "../store/sessionStore";
import type {
  AdminStats,
  AdminBooking,
  AdminBookingDetail,
  AdminAgent,
  AdminAgentDetail,
  AgentActivity,
  AdminPlan,
  PlanPrices,
  Pricing,
  AlertSettings,
  TriggeredAlert,
  Campaign,
  AgentStatus,
  AdminCustomer,
  AdminCustomerDetail,
  CustomerActivity,
  CustomerStatus,
  AdminPayment,
  PaymentStats,
  BookingStatus,
  ServiceCity,
  ServiceZone,
  VehicleCategory,
  VehicleBrand,
  VehicleModel,
  DiscountCode,
  SpecialCoupon,
  ReferralConfig,
  PayoutConfig,
  PromoBanner,
  BannerType,
  OffPeakHoursConfig,
  OffPeakSuggestion,
  OffPeakWindow,
  AdminReports,
  AudienceSizes,
  AudienceGroup,
  Lead,
  AdminReferralLog,
  AdminRole,
  AdminStaff,
  DispatchQueueItem,
  AssignableAgent,
  AdminPayoutRequest,
  PayoutRequestStatus,
} from "../types";


const keys = {
  stats: ["admin", "stats"] as const,
  bookings: ["admin", "bookings"] as const,
  booking: (id: string) => ["admin", "bookings", id] as const,
  agents: ["admin", "agents"] as const,
  agent: (id: string) => ["admin", "agents", id] as const,
  agentActivity: (id: string) => ["admin", "agents", id, "activity"] as const,
  agentLocation: (id: string) => ["admin", "agents", id, "location"] as const,
  pricing: ["admin", "pricing"] as const,
  plans: ["admin", "plans"] as const,
  campaigns: ["admin", "campaigns"] as const,
  settings: ["admin", "alert-settings"] as const,
  triggered: ["admin", "triggered"] as const,
  customers: ["admin", "customers"] as const,
  customer: (id: string) => ["admin", "customers", id] as const,
  customerActivity: (id: string) => ["admin", "customers", id, "activity"] as const,
  payments: ["admin", "payments"] as const,
  paymentStats: ["admin", "payments", "stats"] as const,
  cities: ["admin", "cities"] as const,
  zones: ["admin", "zones"] as const,
  vehicleCategories: ["admin", "vehicle-categories"] as const,
  vehicleBrands: ["admin", "vehicle-brands"] as const,
  vehicleModels: (brandId: string) => ["admin", "vehicle-brands", brandId, "models"] as const,
  discountCodes: ["admin", "discount-codes"] as const,
  specialCoupons: ["admin", "special-coupons"] as const,
  referralConfig: ["admin", "referral-config"] as const,
  offPeakHours: ["admin", "off-peak-hours"] as const,
  payoutConfig: ["admin", "payout-config"] as const,
  promoBanners: ["admin", "promo-banners"] as const,
  reports: ["admin", "reports"] as const,
  audienceSizes: ["admin", "campaigns", "audience-sizes"] as const,
  audienceGroups: ["admin", "campaigns", "audiences"] as const,
  content: ["admin", "content"] as const,
  leads: ["admin", "leads"] as const,
  referralLogs: ["admin", "referral-logs"] as const,
  roles: ["admin", "roles"] as const,
  staff: ["admin", "staff"] as const,
  dispatch: ["admin", "dispatch"] as const,
  assignable: (id: string) => ["admin", "bookings", id, "assignable"] as const,
  payoutRequests: (status?: string) => ["admin", "payout-requests", status ?? "all"] as const,
};


function useAuthedQuery<T>(
  key: readonly unknown[],
  path: string,
  opts?: { refetchInterval?: number | false; staleTime?: number; enabled?: boolean },
) {
  const authenticated = useAdminSession((s) => s.authenticated);
  return useQuery({
    queryKey: key,
    queryFn: () => apiFetch<T>(path),
    enabled: authenticated && (opts?.enabled ?? true),
    staleTime: opts?.staleTime ?? 30_000,
    refetchInterval: opts?.refetchInterval,
  });
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

export const useAdminMe = () => useAuthedQuery<{ id?: string; name: string; email?: string; phone?: string; permissions: string[] }>(["admin", "me"], "/auth/me");

/* ------------------------------- Queries --------------------------------- */

export const useStats = () => useAuthedQuery<AdminStats>(keys.stats, "/admin/stats", { refetchInterval: 20_000 });
export const useBookings = () => useAuthedQuery<AdminBooking[]>(keys.bookings, "/admin/bookings");
export const useAgents = () => useAuthedQuery<AdminAgent[]>(keys.agents, "/admin/agents", { refetchInterval: 20_000 });
export const useAgent = (id: string) => useAuthedQuery<AdminAgentDetail>(keys.agent(id), `/admin/agents/${id}`);
export const useAgentActivity = (id: string) =>
  useAuthedQuery<AgentActivity>(keys.agentActivity(id), `/admin/agents/${id}/activity`);
/** Polled only while the live-location view is actually open — no point streaming an idle agent's GPS into a closed modal. */
export const useAgentLocation = (id: string, enabled: boolean) =>
  useAuthedQuery<AgentLocationSnapshot>(keys.agentLocation(id), `/tracking/agents/${id}`, {
    enabled,
    staleTime: 0,
    refetchInterval: enabled ? 5_000 : false,
  });
export const usePricing = () => useAuthedQuery<Pricing>(keys.pricing, "/admin/pricing");
export const usePlans = () => useAuthedQuery<AdminPlan[]>(keys.plans, "/admin/plans");
export const useCampaigns = () => useAuthedQuery<Campaign[]>(keys.campaigns, "/admin/campaigns");
export const useAlertSettings = () => useAuthedQuery<AlertSettings>(keys.settings, "/area-alerts/settings");
export const useTriggered = () => useAuthedQuery<TriggeredAlert[]>(keys.triggered, "/area-alerts/triggered");
export type AgentInput = {
  name: string; phone: string; email?: string;
  city?: string; area?: string;
  agentStatus?: string; aadharNumber?: string;
};
export type CustomerInput = {
  name: string; phone: string; email?: string;
  status?: "active" | "suspended";
  address?: { label?: string; line?: string; society?: string };
  vehicle?: { type?: string; name?: string; plate?: string };
};

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AgentInput) => apiFetch<AdminAgent>("/admin/agents", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.agents }),
  });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string } & Partial<AgentInput>) => {
      const { id, ...body } = vars;
      return apiFetch<AdminAgent>(`/admin/agents/${id}`, { method: "PATCH", body });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: keys.agents });
      qc.invalidateQueries({ queryKey: keys.agent(vars.id) });
    },
  });
}

export type DeleteAgentOptions = {
  id: string;
  mode?: "agent_only" | "with_data" | "strict";
  force?: boolean;
};

export type DeleteCustomerOptions = {
  id: string;
  mode?: "customer_only" | "with_data" | "strict";
  force?: boolean;
};

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: string | DeleteAgentOptions) => {
      const id = typeof args === "string" ? args : args.id;
      const mode = typeof args === "object" ? (args.mode || (args.force ? "agent_only" : "strict")) : "strict";
      return apiFetch<{ deleted: boolean }>(`/admin/agents/${id}?mode=${mode}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.agents });
      qc.invalidateQueries({ queryKey: keys.bookings });
      qc.invalidateQueries({ queryKey: keys.payments });
      qc.invalidateQueries({ queryKey: keys.stats });
    },
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CustomerInput) => apiFetch<AdminCustomer>("/admin/customers", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.customers }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string } & Partial<CustomerInput>) => {
      const { id, ...body } = vars;
      return apiFetch<AdminCustomer>(`/admin/customers/${id}`, { method: "PATCH", body });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: keys.customers });
      qc.invalidateQueries({ queryKey: keys.customer(vars.id) });
    },
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: string | DeleteCustomerOptions) => {
      const id = typeof args === "string" ? args : args.id;
      const mode = typeof args === "object" ? (args.mode || (args.force ? "customer_only" : "strict")) : "strict";
      return apiFetch<{ deleted: boolean }>(`/admin/customers/${id}?mode=${mode}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.customers });
      qc.invalidateQueries({ queryKey: keys.bookings });
      qc.invalidateQueries({ queryKey: keys.payments });
      qc.invalidateQueries({ queryKey: keys.stats });
    },
  });
}

export const useCustomers = () => useAuthedQuery<AdminCustomer[]>(keys.customers, "/admin/customers");
/**
 * One booking in full. Polls while a cleaner is in the field so the status,
 * photos and payout stay current — the live position itself comes over the
 * socket via useLiveTracking, but everything around it is REST.
 */
export const useBookingDetail = (id: string, live = false) =>
  useAuthedQuery<AdminBookingDetail>(keys.booking(id), `/admin/bookings/${id}`, {
    refetchInterval: live ? 15000 : false,
  });
export const useCustomer = (id: string) =>
  useAuthedQuery<AdminCustomerDetail>(keys.customer(id), `/admin/customers/${id}`);
export const useCustomerActivity = (id: string) =>
  useAuthedQuery<CustomerActivity>(keys.customerActivity(id), `/admin/customers/${id}/activity`);
export const usePayments = () => useAuthedQuery<AdminPayment[]>(keys.payments, "/admin/payments");
export const usePaymentStats = () => useAuthedQuery<PaymentStats>(keys.paymentStats, "/admin/payments/stats");
export const useCities = () => useAuthedQuery<ServiceCity[]>(keys.cities, "/admin/cities");
export const useZones = () => useAuthedQuery<ServiceZone[]>(keys.zones, "/admin/zones");
export const useVehicleBrands = () => useAuthedQuery<VehicleBrand[]>(keys.vehicleBrands, "/admin/vehicle-brands");
export const useDiscountCodes = () => useAuthedQuery<DiscountCode[]>(keys.discountCodes, "/admin/discount-codes");
export const useSpecialCoupons = () => useAuthedQuery<SpecialCoupon[]>(keys.specialCoupons, "/admin/special-coupons");
export const useReferralConfig = () =>
  useAuthedQuery<ReferralConfig>(keys.referralConfig, "/admin/referral-config");
export const usePayoutConfig = () => useAuthedQuery<PayoutConfig>(keys.payoutConfig, "/admin/payout-config");
export const useOffPeakHours = () => useAuthedQuery<OffPeakHoursConfig>(keys.offPeakHours, "/admin/off-peak-hours");
export const usePromoBanners = () => useAuthedQuery<PromoBanner[]>(keys.promoBanners, "/admin/promo-banners");
export const useReports = () => useAuthedQuery<AdminReports>(keys.reports, "/admin/reports");
export const useContent = () => useAuthedQuery<SiteContent>(keys.content, "/admin/content");
export const useAudienceSizes = () =>
  useAuthedQuery<AudienceSizes>(keys.audienceSizes, "/admin/campaigns/audience-sizes");
/** Audience options come from the server so the picker can't drift from what it accepts. */
export const useAudienceGroups = () =>
  useAuthedQuery<AudienceGroup[]>(keys.audienceGroups, "/admin/campaigns/audiences");

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
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.agents });
      qc.invalidateQueries({ queryKey: keys.agent(vars.id) });
    },
  });
}

export function useSetCustomerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; status: CustomerStatus }) =>
      apiFetch<AdminCustomer>(`/admin/customers/${vars.id}/status`, { method: "PATCH", body: { status: vars.status } }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.customers });
      qc.invalidateQueries({ queryKey: keys.customer(vars.id) });
    },
  });
}

export function useUpdatePricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Pricing>) => apiFetch<Pricing>("/admin/pricing", { method: "PUT", body: patch }),
    onSuccess: (data) => qc.setQueryData(keys.pricing, data),
  });
}

export function useUpdateContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<SiteContent>) =>
      apiFetch<SiteContent>("/admin/content", { method: "PUT", body: patch }),
    onSuccess: (data) => qc.setQueryData(keys.content, data),
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

export function useSetBookingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; status: BookingStatus }) =>
      apiFetch<AdminBooking>(`/admin/bookings/${vars.id}/status`, { method: "PATCH", body: { status: vars.status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.bookings });
      qc.invalidateQueries({ queryKey: keys.stats });
    },
  });
}

export function useAssignBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; agentId: string }) =>
      apiFetch<AdminBooking>(`/admin/bookings/${vars.id}/assign`, { method: "PATCH", body: { agentId: vars.agentId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.bookings });
      qc.invalidateQueries({ queryKey: keys.dispatch });
    },
  });
}

export function useAutoAssignBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<AdminBooking>(`/admin/bookings/${id}/auto-assign`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.bookings });
      qc.invalidateQueries({ queryKey: keys.dispatch });
    },
  });
}

export function useAutoAssignAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ kicked: number; skipped: number }>("/admin/dispatch/auto-assign-all", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.bookings });
      qc.invalidateQueries({ queryKey: keys.dispatch });
    },
  });
}

/** What moving a booking would cost, from the shared rule engine. */
export type AdminRescheduleQuote = {
  targetIsOffPeak: boolean;
  requiresPayment: boolean;
  exempt: boolean;
  reclaim: number;
  fee: number;
  totalDue: number;
  newPrice: number;
  reason: string;
};

export function useRescheduleQuote() {
  return useMutation({
    mutationFn: (vars: { id: string; date: string; slot: string }) =>
      apiFetch<AdminRescheduleQuote>(`/admin/bookings/${vars.id}/reschedule/quote`, {
        method: "POST",
        body: { date: vars.date, slot: vars.slot },
      }),
  });
}

export function useRescheduleBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; date: string; slot: string; waiveUpgrade?: boolean }) =>
      apiFetch<AdminBooking>(`/admin/bookings/${vars.id}/reschedule`, {
        method: "PATCH",
        body: { date: vars.date, slot: vars.slot, waiveUpgrade: vars.waiveUpgrade },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.bookings });
      qc.invalidateQueries({ queryKey: keys.dispatch });
    },
  });
}

/* ------------------------------ Dispatch --------------------------------- */

/** Live dispatch queue (searching / offered / pending / scheduled). */
export const useDispatchQueue = () =>
  useAuthedQuery<DispatchQueueItem[]>(keys.dispatch, "/admin/dispatch/queue", { refetchInterval: 15_000 });

/** Cleaners assignable to a booking, ranked by distance. Fetched lazily when a picker opens. */
export function useAssignableAgents(bookingId: string | null) {
  const authenticated = useAdminSession((s) => s.authenticated);
  return useQuery({
    queryKey: bookingId ? keys.assignable(bookingId) : ["admin", "assignable", "none"],
    queryFn: () => apiFetch<AssignableAgent[]>(`/admin/bookings/${bookingId}/assignable-agents`),
    enabled: authenticated && !!bookingId,
  });
}

export function useRefundPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; amount?: number; reason?: string }) =>
      apiFetch<AdminPayment>(`/admin/payments/${vars.id}/refund`, {
        method: "PATCH",
        body: { amount: vars.amount, reason: vars.reason },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.payments });
      qc.invalidateQueries({ queryKey: keys.paymentStats });
    },
  });
}

export function useSettlePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<AdminPayment>(`/admin/payments/${id}/settle`, { method: "PATCH" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.payments });
      qc.invalidateQueries({ queryKey: keys.paymentStats });
    },
  });
}

/* --------------------------- Agent payout requests ------------------------- */

export const usePayoutRequests = (status?: PayoutRequestStatus | "all") =>
  useAuthedQuery<AdminPayoutRequest[]>(
    keys.payoutRequests(status === "all" ? undefined : status),
    status && status !== "all" ? `/admin/payout-requests?status=${status}` : "/admin/payout-requests",
    { refetchInterval: 20_000 },
  );

function invalidatePayoutRequests(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["admin", "payout-requests"] });
}

export function useApprovePayoutRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<AdminPayoutRequest>(`/admin/payout-requests/${id}/approve`, { method: "PATCH" }),
    onSuccess: () => invalidatePayoutRequests(qc),
  });
}

export function useRejectPayoutRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; reason?: string }) =>
      apiFetch<AdminPayoutRequest>(`/admin/payout-requests/${vars.id}/reject`, {
        method: "PATCH",
        body: { reason: vars.reason },
      }),
    onSuccess: () => invalidatePayoutRequests(qc),
  });
}

export function useMarkPayoutRequestPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; transactionRef?: string }) =>
      apiFetch<AdminPayoutRequest>(`/admin/payout-requests/${vars.id}/paid`, {
        method: "PATCH",
        body: { transactionRef: vars.transactionRef },
      }),
    onSuccess: () => invalidatePayoutRequests(qc),
  });
}

export function useUpdateAgentArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; area: string }) =>
      apiFetch<AdminAgent>(`/admin/agents/${vars.id}/area`, { method: "PATCH", body: { area: vars.area } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.agents }),
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; prices: PlanPrices; washesPerMonth: number }) =>
      apiFetch<AdminPlan>("/admin/plans", { method: "POST", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.plans }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; name?: string; prices?: PlanPrices; washesPerMonth?: number; active?: boolean }) =>
      apiFetch<AdminPlan>(`/admin/plans/${vars.id}`, { method: "PATCH", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.plans }),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/admin/plans/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.plans }),
  });
}

export function useCreateCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string }) => apiFetch<ServiceCity>("/admin/cities", { method: "POST", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.cities }),
  });
}

export function useUpdateCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; name?: string; active?: boolean }) =>
      apiFetch<ServiceCity>(`/admin/cities/${vars.id}`, { method: "PATCH", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.cities }),
  });
}

export function useDeleteCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/admin/cities/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.cities }),
  });
}

export const useZoneAgents = (zoneId: string | null) =>
  useAuthedQuery<AdminAgent[]>(["admin", "zones", zoneId ?? "", "agents"], `/admin/zones/${zoneId}/agents`, { enabled: !!zoneId });

export function useCreateZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      name: string;
      cityId?: string;
      color?: string;
      coordinates: [number, number][];
      active?: boolean;
    }) =>
      apiFetch<ServiceZone>("/admin/zones", { method: "POST", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.zones }),
  });
}

export function useUpdateZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      name?: string;
      active?: boolean;
      cityId?: string | null;
      color?: string;
      coordinates?: [number, number][];
    }) =>
      apiFetch<ServiceZone>(`/admin/zones/${vars.id}`, { method: "PATCH", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.zones }),
  });
}

export function useDeleteZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/admin/zones/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.zones }),
  });
}

/* ----------------------------- Vehicle categories -------------------------- */

export const useVehicleCategories = () =>
  useAuthedQuery<VehicleCategory[]>(keys.vehicleCategories, "/admin/vehicle-categories");

/** Looks up a category's display name by key; falls back to the raw key for historical/deleted categories. */
export function useCategoryLabel() {
  const { data: categories = [] } = useVehicleCategories();
  const byKey = new Map(categories.map((c) => [c.key, c.name]));
  return (key: string) => byKey.get(key) ?? key;
}

export function useCreateVehicleCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; basePrice: number; imageUrl?: string }) =>
      apiFetch<VehicleCategory>("/admin/vehicle-categories", { method: "POST", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.vehicleCategories }),
  });
}

export function useUpdateVehicleCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; name?: string; basePrice?: number; imageUrl?: string; active?: boolean; sortOrder?: number }) =>
      apiFetch<VehicleCategory>(`/admin/vehicle-categories/${vars.id}`, { method: "PATCH", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.vehicleCategories }),
  });
}

export function useDeleteVehicleCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/admin/vehicle-categories/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.vehicleCategories }),
  });
}

/* ------------------------------- Vehicle brands ---------------------------- */

export function useCreateVehicleBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string }) =>
      apiFetch<VehicleBrand>("/admin/vehicle-brands", { method: "POST", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.vehicleBrands }),
  });
}

export function useUpdateVehicleBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; name?: string; active?: boolean }) =>
      apiFetch<VehicleBrand>(`/admin/vehicle-brands/${vars.id}`, { method: "PATCH", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.vehicleBrands }),
  });
}

export function useDeleteVehicleBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/admin/vehicle-brands/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.vehicleBrands }),
  });
}

/* ------------------------------- Vehicle models ---------------------------- */

export const useVehicleModels = (brandId: string) =>
  useAuthedQuery<VehicleModel[]>(keys.vehicleModels(brandId), `/admin/vehicle-brands/${brandId}/models`);

export function useCreateVehicleModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { brandId: string; name: string; categoryKey: string }) =>
      apiFetch<VehicleModel>(`/admin/vehicle-brands/${vars.brandId}/models`, {
        method: "POST",
        body: { name: vars.name, categoryKey: vars.categoryKey },
      }),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: keys.vehicleModels(vars.brandId) }),
  });
}

export function useUpdateVehicleModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { brandId: string; modelId: string; name?: string; categoryKey?: string; active?: boolean }) =>
      apiFetch<VehicleModel>(`/admin/vehicle-brands/${vars.brandId}/models/${vars.modelId}`, {
        method: "PATCH",
        body: vars,
      }),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: keys.vehicleModels(vars.brandId) }),
  });
}

export function useDeleteVehicleModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { brandId: string; modelId: string }) =>
      apiFetch<null>(`/admin/vehicle-brands/${vars.brandId}/models/${vars.modelId}`, { method: "DELETE" }),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: keys.vehicleModels(vars.brandId) }),
  });
}

export function useCreateDiscountCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      code: string;
      type: "percent" | "flat";
      value: number;
      minOrderValue?: number;
      maxDiscount?: number | null;
      usageLimit?: number | null;
      validTill?: string | null;
      offPeakOnly?: boolean;
    }) => apiFetch<DiscountCode>("/admin/discount-codes", { method: "POST", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.discountCodes }),
  });
}

export function useUpdateDiscountCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string } & Partial<Omit<DiscountCode, "id" | "code" | "usageCount">>) =>
      apiFetch<DiscountCode>(`/admin/discount-codes/${vars.id}`, { method: "PATCH", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.discountCodes }),
  });
}

export function useDeleteDiscountCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/admin/discount-codes/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.discountCodes }),
  });
}

export function useGenerateSpecialCoupons() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      count: number;
      type: "percent" | "flat";
      value: number;
      minOrderValue?: number;
      maxDiscount?: number | null;
      validFrom?: string | null;
      validTill?: string | null;
      offPeakOnly?: boolean;
    }) => apiFetch<SpecialCoupon[]>("/admin/special-coupons/generate", { method: "POST", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.specialCoupons }),
  });
}

export function useAssignSpecialCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; customerId: string }) =>
      apiFetch<SpecialCoupon>(`/admin/special-coupons/${vars.id}/assign`, {
        method: "PATCH",
        body: { customerId: vars.customerId },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.specialCoupons }),
  });
}

export function useToggleSpecialCouponActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; active: boolean }) =>
      apiFetch<SpecialCoupon>(`/admin/special-coupons/${vars.id}/toggle-active`, {
        method: "PATCH",
        body: { active: vars.active },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.specialCoupons }),
  });
}

export function useReactivateSpecialCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<SpecialCoupon>(`/admin/special-coupons/${id}/reactivate`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.specialCoupons }),
  });
}

export function useUpdateReferralConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: Partial<ReferralConfig>) =>
      apiFetch<ReferralConfig>("/admin/referral-config", { method: "PUT", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.referralConfig }),
  });
}

/**
 * Windows are sent without the server-derived `startMinutes`/`endMinutes` —
 * those are read-only projections, and echoing them back would invite the two
 * representations to disagree.
 */
export type OffPeakWindowInput = Pick<OffPeakWindow, "day" | "start" | "end"> & { label?: string };

export function useUpdateOffPeakHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      timezone?: string;
      active?: boolean;
      peakUpgradeFee?: number;
      windows?: OffPeakWindowInput[];
    }) => apiFetch<OffPeakHoursConfig>("/admin/off-peak-hours", { method: "PUT", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.offPeakHours }),
  });
}

/**
 * Ask the server to propose windows from booking history.
 *
 * A mutation rather than a query because it is an action the admin takes, and
 * because the result should not be silently refetched underneath a draft they
 * are still reviewing.
 */
export function useSuggestOffPeakHours() {
  return useMutation({
    mutationFn: (vars: { weeks?: number; sensitivity?: number; minSamples?: number } = {}) => {
      const params = new URLSearchParams();
      if (vars.weeks !== undefined) params.set("weeks", String(vars.weeks));
      if (vars.sensitivity !== undefined) params.set("sensitivity", String(vars.sensitivity));
      if (vars.minSamples !== undefined) params.set("minSamples", String(vars.minSamples));
      const qs = params.toString();
      return apiFetch<OffPeakSuggestion>(`/admin/off-peak-hours/suggest${qs ? `?${qs}` : ""}`);
    },
  });
}

export function useUpdatePayoutConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: Partial<PayoutConfig>) =>
      apiFetch<PayoutConfig>("/admin/payout-config", { method: "PUT", body: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.payoutConfig });
      // Pending settlement on the Payments screen is derived from this rule.
      qc.invalidateQueries({ queryKey: keys.paymentStats });
    },
  });
}

export function useCreatePromoBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      title: string;
      subtitle?: string;
      imageUrl: string;
      ctaLabel?: string;
      ctaLink?: string;
      type?: BannerType;
      sortOrder?: number;
    }) => apiFetch<PromoBanner>("/admin/promo-banners", { method: "POST", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.promoBanners }),
  });
}

export function useUpdatePromoBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string } & Partial<Omit<PromoBanner, "id">>) =>
      apiFetch<PromoBanner>(`/admin/promo-banners/${vars.id}`, { method: "PATCH", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.promoBanners }),
  });
}

export function useDeletePromoBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/admin/promo-banners/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.promoBanners }),
  });
}

/* ─────────────────────────── Leads ──────────────────────────────────────── */

export const useLeads = () => useAuthedQuery<Lead[]>(keys.leads, "/admin/leads");

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/admin/leads/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.leads }),
  });
}

export function useUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; status: "new" | "contacted" | "converted" }) =>
      apiFetch<Lead>(`/admin/leads/${vars.id}/status`, { method: "PATCH", body: { status: vars.status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.leads }),
  });
}


/* ─────────────────────────── Referrals Logs ─────────────────────────────── */

export const useReferralLogs = () => useAuthedQuery<AdminReferralLog[]>(keys.referralLogs, "/admin/referral-logs");

export function useUploadMedia() {
  return useMutation({
    mutationFn: (base64Image: string) =>
      apiFetch<{ imageUrl: string }>("/admin/upload", {
        method: "POST",
        body: { image: base64Image },
      }),
  });
}

/* ─────────────────────────── Roles & Staff ───────────────────────────────── */

export const useRoles = () => useAuthedQuery<AdminRole[]>(keys.roles, "/admin/roles");
export const useStaff = () => useAuthedQuery<AdminStaff[]>(keys.staff, "/admin/staff");

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; permissions: string[] }) =>
      apiFetch<AdminRole>("/admin/roles", { method: "POST", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.roles }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; name: string; permissions: string[] }) =>
      apiFetch<AdminRole>(`/admin/roles/${vars.id}`, { method: "PATCH", body: { name: vars.name, permissions: vars.permissions } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.roles }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ success: boolean }>(`/admin/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.roles });
      qc.invalidateQueries({ queryKey: keys.staff });
    },
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; email: string; password?: string; adminRoleId: string }) =>
      apiFetch<AdminStaff>("/admin/staff", { method: "POST", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.staff }),
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; name: string; email: string; password?: string; adminRoleId: string }) =>
      apiFetch<AdminStaff>(`/admin/staff/${vars.id}`, { method: "PATCH", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.staff }),
  });
}

export function useDeleteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ success: boolean }>(`/admin/staff/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.staff }),
  });
}


