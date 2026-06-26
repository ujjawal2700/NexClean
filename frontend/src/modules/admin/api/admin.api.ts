import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@shared/lib/api";
import type { SiteContent } from "@shared/types/content";
import { useAdminSession } from "../store/sessionStore";
import type {
  AdminStats,
  AdminBooking,
  AdminAgent,
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
  AdminPayment,
  PaymentStats,
  BookingStatus,
  ServiceCity,
  ServiceZone,
  VehicleCategory,
  VehicleBrand,
  VehicleModel,
  DiscountCode,
  ReferralCampaign,
  PromoBanner,
  AdminReports,
  AudienceSizes,
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
  referralCampaigns: ["admin", "referral-campaigns"] as const,
  promoBanners: ["admin", "promo-banners"] as const,
  reports: ["admin", "reports"] as const,
  audienceSizes: ["admin", "campaigns", "audience-sizes"] as const,
  content: ["admin", "content"] as const,
};

function useAuthedQuery<T>(key: readonly unknown[], path: string, opts?: { refetchInterval?: number }) {
  const token = useAdminSession((s) => s.token);
  return useQuery({
    queryKey: key,
    queryFn: () => apiFetch<T>(path),
    enabled: !!token,
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

/* ------------------------------- Queries --------------------------------- */

export const useStats = () => useAuthedQuery<AdminStats>(keys.stats, "/admin/stats", { refetchInterval: 20_000 });
export const useBookings = () => useAuthedQuery<AdminBooking[]>(keys.bookings, "/admin/bookings");
export const useAgents = () => useAuthedQuery<AdminAgent[]>(keys.agents, "/admin/agents", { refetchInterval: 20_000 });
export const usePricing = () => useAuthedQuery<Pricing>(keys.pricing, "/admin/pricing");
export const usePlans = () => useAuthedQuery<AdminPlan[]>(keys.plans, "/admin/plans");
export const useCampaigns = () => useAuthedQuery<Campaign[]>(keys.campaigns, "/admin/campaigns");
export const useAlertSettings = () => useAuthedQuery<AlertSettings>(keys.settings, "/area-alerts/settings");
export const useTriggered = () => useAuthedQuery<TriggeredAlert[]>(keys.triggered, "/area-alerts/triggered");
export const useCustomers = () => useAuthedQuery<AdminCustomer[]>(keys.customers, "/admin/customers");
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
export const useReferralCampaigns = () =>
  useAuthedQuery<ReferralCampaign[]>(keys.referralCampaigns, "/admin/referral-campaigns");
export const usePromoBanners = () => useAuthedQuery<PromoBanner[]>(keys.promoBanners, "/admin/promo-banners");
export const useReports = () => useAuthedQuery<AdminReports>(keys.reports, "/admin/reports");
export const useContent = () => useAuthedQuery<SiteContent>(keys.content, "/admin/content");
export const useAudienceSizes = () =>
  useAuthedQuery<AudienceSizes>(keys.audienceSizes, "/admin/campaigns/audience-sizes");

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
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.bookings }),
  });
}

export function useAutoAssignBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<AdminBooking>(`/admin/bookings/${id}/auto-assign`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.bookings }),
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

export function useCreateZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; cityId: string }) =>
      apiFetch<ServiceZone>("/admin/zones", { method: "POST", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.zones }),
  });
}

export function useUpdateZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; name?: string; active?: boolean; cityId?: string }) =>
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
    mutationFn: (vars: { name: string; basePrice: number }) =>
      apiFetch<VehicleCategory>("/admin/vehicle-categories", { method: "POST", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.vehicleCategories }),
  });
}

export function useUpdateVehicleCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; name?: string; basePrice?: number; active?: boolean; sortOrder?: number }) =>
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

export function useCreateReferralCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; referrerReward: number; refereeReward: number; description?: string }) =>
      apiFetch<ReferralCampaign>("/admin/referral-campaigns", { method: "POST", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.referralCampaigns }),
  });
}

export function useUpdateReferralCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string } & Partial<Omit<ReferralCampaign, "id">>) =>
      apiFetch<ReferralCampaign>(`/admin/referral-campaigns/${vars.id}`, { method: "PATCH", body: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.referralCampaigns }),
  });
}

export function useDeleteReferralCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/admin/referral-campaigns/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.referralCampaigns }),
  });
}

export function useCreatePromoBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { title: string; subtitle?: string; imageUrl: string; ctaLabel?: string; ctaLink?: string }) =>
      apiFetch<PromoBanner>("/admin/promo-banners", { method: "POST", body: vars }),
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
