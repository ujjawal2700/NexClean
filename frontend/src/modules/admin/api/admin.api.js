import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@shared/lib/api";
import { useAdminSession } from "../store/sessionStore";
const keys = {
    stats: ["admin", "stats"],
    bookings: ["admin", "bookings"],
    agents: ["admin", "agents"],
    agent: (id) => ["admin", "agents", id],
    agentActivity: (id) => ["admin", "agents", id, "activity"],
    pricing: ["admin", "pricing"],
    plans: ["admin", "plans"],
    campaigns: ["admin", "campaigns"],
    settings: ["admin", "alert-settings"],
    triggered: ["admin", "triggered"],
    customers: ["admin", "customers"],
    customer: (id) => ["admin", "customers", id],
    customerActivity: (id) => ["admin", "customers", id, "activity"],
    payments: ["admin", "payments"],
    paymentStats: ["admin", "payments", "stats"],
    cities: ["admin", "cities"],
    zones: ["admin", "zones"],
    vehicleCategories: ["admin", "vehicle-categories"],
    vehicleBrands: ["admin", "vehicle-brands"],
    vehicleModels: (brandId) => ["admin", "vehicle-brands", brandId, "models"],
    discountCodes: ["admin", "discount-codes"],
    specialCoupons: ["admin", "special-coupons"],
    referralConfig: ["admin", "referral-config"],
    promoBanners: ["admin", "promo-banners"],
    reports: ["admin", "reports"],
    audienceSizes: ["admin", "campaigns", "audience-sizes"],
    content: ["admin", "content"],
    leads: ["admin", "leads"],
    referralLogs: ["admin", "referral-logs"],
    roles: ["admin", "roles"],
    staff: ["admin", "staff"],
    dispatch: ["admin", "dispatch"],
    assignable: (id) => ["admin", "bookings", id, "assignable"],
};
function useAuthedQuery(key, path, opts) {
    const token = useAdminSession((s) => s.token);
    return useQuery({
        queryKey: key,
        queryFn: () => apiFetch(path),
        enabled: !!token,
        refetchInterval: opts?.refetchInterval,
    });
}
/* -------------------------------- Auth ----------------------------------- */
export function useAdminLogin() {
    return useMutation({
        mutationFn: (vars) => apiFetch("/auth/admin-login", {
            method: "POST",
            body: vars,
        }),
    });
}
export const useAdminMe = () => useAuthedQuery(["admin", "me"], "/auth/me");
/* ------------------------------- Queries --------------------------------- */
export const useStats = () => useAuthedQuery(keys.stats, "/admin/stats", { refetchInterval: 20_000 });
export const useBookings = () => useAuthedQuery(keys.bookings, "/admin/bookings");
export const useAgents = () => useAuthedQuery(keys.agents, "/admin/agents", { refetchInterval: 20_000 });
export const useAgent = (id) => useAuthedQuery(keys.agent(id), `/admin/agents/${id}`);
export const useAgentActivity = (id) => useAuthedQuery(keys.agentActivity(id), `/admin/agents/${id}/activity`);
export const usePricing = () => useAuthedQuery(keys.pricing, "/admin/pricing");
export const usePlans = () => useAuthedQuery(keys.plans, "/admin/plans");
export const useCampaigns = () => useAuthedQuery(keys.campaigns, "/admin/campaigns");
export const useAlertSettings = () => useAuthedQuery(keys.settings, "/area-alerts/settings");
export const useTriggered = () => useAuthedQuery(keys.triggered, "/area-alerts/triggered");
export const useCustomers = () => useAuthedQuery(keys.customers, "/admin/customers");
export const useCustomer = (id) => useAuthedQuery(keys.customer(id), `/admin/customers/${id}`);
export const useCustomerActivity = (id) => useAuthedQuery(keys.customerActivity(id), `/admin/customers/${id}/activity`);
export const usePayments = () => useAuthedQuery(keys.payments, "/admin/payments");
export const usePaymentStats = () => useAuthedQuery(keys.paymentStats, "/admin/payments/stats");
export const useCities = () => useAuthedQuery(keys.cities, "/admin/cities");
export const useZones = () => useAuthedQuery(keys.zones, "/admin/zones");
export const useVehicleBrands = () => useAuthedQuery(keys.vehicleBrands, "/admin/vehicle-brands");
export const useDiscountCodes = () => useAuthedQuery(keys.discountCodes, "/admin/discount-codes");
export const useSpecialCoupons = () => useAuthedQuery(keys.specialCoupons, "/admin/special-coupons");
export const useReferralConfig = () => useAuthedQuery(keys.referralConfig, "/admin/referral-config");
export const usePromoBanners = () => useAuthedQuery(keys.promoBanners, "/admin/promo-banners");
export const useReports = () => useAuthedQuery(keys.reports, "/admin/reports");
export const useContent = () => useAuthedQuery(keys.content, "/admin/content");
export const useAudienceSizes = () => useAuthedQuery(keys.audienceSizes, "/admin/campaigns/audience-sizes");
/* ------------------------------ Mutations -------------------------------- */
export function useCancelBooking() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => apiFetch(`/admin/bookings/${id}/cancel`, { method: "PATCH" }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: keys.bookings });
            qc.invalidateQueries({ queryKey: keys.stats });
        },
    });
}
export function useSetAgentStatus() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch(`/admin/agents/${vars.id}/status`, { method: "PATCH", body: { status: vars.status } }),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: keys.agents });
            qc.invalidateQueries({ queryKey: keys.agent(vars.id) });
        },
    });
}
export function useSetCustomerStatus() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch(`/admin/customers/${vars.id}/status`, { method: "PATCH", body: { status: vars.status } }),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: keys.customers });
            qc.invalidateQueries({ queryKey: keys.customer(vars.id) });
        },
    });
}
export function useUpdatePricing() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (patch) => apiFetch("/admin/pricing", { method: "PUT", body: patch }),
        onSuccess: (data) => qc.setQueryData(keys.pricing, data),
    });
}
export function useUpdateContent() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (patch) => apiFetch("/admin/content", { method: "PUT", body: patch }),
        onSuccess: (data) => qc.setQueryData(keys.content, data),
    });
}
export function useUpdateAlertSettings() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (patch) => apiFetch("/area-alerts/settings", { method: "PUT", body: patch }),
        onSuccess: (data) => qc.setQueryData(keys.settings, data),
    });
}
export function useSendCampaign() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch("/admin/campaigns", { method: "POST", body: vars }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.campaigns }),
    });
}
export function useSetBookingStatus() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch(`/admin/bookings/${vars.id}/status`, { method: "PATCH", body: { status: vars.status } }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: keys.bookings });
            qc.invalidateQueries({ queryKey: keys.stats });
        },
    });
}
export function useAssignBooking() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch(`/admin/bookings/${vars.id}/assign`, { method: "PATCH", body: { agentId: vars.agentId } }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: keys.bookings });
            qc.invalidateQueries({ queryKey: keys.dispatch });
        },
    });
}
export function useAutoAssignBooking() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => apiFetch(`/admin/bookings/${id}/auto-assign`, { method: "POST" }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: keys.bookings });
            qc.invalidateQueries({ queryKey: keys.dispatch });
        },
    });
}
/* ------------------------------ Dispatch --------------------------------- */
/** Live dispatch queue (searching / offered / pending / scheduled). */
export const useDispatchQueue = () => useAuthedQuery(keys.dispatch, "/admin/dispatch/queue", { refetchInterval: 15_000 });
/** Cleaners assignable to a booking, ranked by distance. Fetched lazily when a picker opens. */
export function useAssignableAgents(bookingId) {
    const token = useAdminSession((s) => s.token);
    return useQuery({
        queryKey: bookingId ? keys.assignable(bookingId) : ["admin", "assignable", "none"],
        queryFn: () => apiFetch(`/admin/bookings/${bookingId}/assignable-agents`),
        enabled: !!token && !!bookingId,
    });
}
export function useRefundPayment() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch(`/admin/payments/${vars.id}/refund`, {
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
        mutationFn: (id) => apiFetch(`/admin/payments/${id}/settle`, { method: "PATCH" }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: keys.payments });
            qc.invalidateQueries({ queryKey: keys.paymentStats });
        },
    });
}
export function useUpdateAgentArea() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch(`/admin/agents/${vars.id}/area`, { method: "PATCH", body: { area: vars.area } }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.agents }),
    });
}
export function useCreatePlan() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch("/admin/plans", { method: "POST", body: vars }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.plans }),
    });
}
export function useUpdatePlan() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch(`/admin/plans/${vars.id}`, { method: "PATCH", body: vars }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.plans }),
    });
}
export function useDeletePlan() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => apiFetch(`/admin/plans/${id}`, { method: "DELETE" }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.plans }),
    });
}
export function useCreateCity() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch("/admin/cities", { method: "POST", body: vars }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.cities }),
    });
}
export function useUpdateCity() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch(`/admin/cities/${vars.id}`, { method: "PATCH", body: vars }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.cities }),
    });
}
export function useDeleteCity() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => apiFetch(`/admin/cities/${id}`, { method: "DELETE" }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.cities }),
    });
}
export function useCreateZone() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch("/admin/zones", { method: "POST", body: vars }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.zones }),
    });
}
export function useUpdateZone() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch(`/admin/zones/${vars.id}`, { method: "PATCH", body: vars }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.zones }),
    });
}
export function useDeleteZone() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => apiFetch(`/admin/zones/${id}`, { method: "DELETE" }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.zones }),
    });
}
/* ----------------------------- Vehicle categories -------------------------- */
export const useVehicleCategories = () => useAuthedQuery(keys.vehicleCategories, "/admin/vehicle-categories");
/** Looks up a category's display name by key; falls back to the raw key for historical/deleted categories. */
export function useCategoryLabel() {
    const { data: categories = [] } = useVehicleCategories();
    const byKey = new Map(categories.map((c) => [c.key, c.name]));
    return (key) => byKey.get(key) ?? key;
}
export function useCreateVehicleCategory() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch("/admin/vehicle-categories", { method: "POST", body: vars }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.vehicleCategories }),
    });
}
export function useUpdateVehicleCategory() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch(`/admin/vehicle-categories/${vars.id}`, { method: "PATCH", body: vars }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.vehicleCategories }),
    });
}
export function useDeleteVehicleCategory() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => apiFetch(`/admin/vehicle-categories/${id}`, { method: "DELETE" }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.vehicleCategories }),
    });
}
/* ------------------------------- Vehicle brands ---------------------------- */
export function useCreateVehicleBrand() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch("/admin/vehicle-brands", { method: "POST", body: vars }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.vehicleBrands }),
    });
}
export function useUpdateVehicleBrand() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch(`/admin/vehicle-brands/${vars.id}`, { method: "PATCH", body: vars }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.vehicleBrands }),
    });
}
export function useDeleteVehicleBrand() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => apiFetch(`/admin/vehicle-brands/${id}`, { method: "DELETE" }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.vehicleBrands }),
    });
}
/* ------------------------------- Vehicle models ---------------------------- */
export const useVehicleModels = (brandId) => useAuthedQuery(keys.vehicleModels(brandId), `/admin/vehicle-brands/${brandId}/models`);
export function useCreateVehicleModel() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch(`/admin/vehicle-brands/${vars.brandId}/models`, {
            method: "POST",
            body: { name: vars.name, categoryKey: vars.categoryKey },
        }),
        onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: keys.vehicleModels(vars.brandId) }),
    });
}
export function useUpdateVehicleModel() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch(`/admin/vehicle-brands/${vars.brandId}/models/${vars.modelId}`, {
            method: "PATCH",
            body: vars,
        }),
        onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: keys.vehicleModels(vars.brandId) }),
    });
}
export function useDeleteVehicleModel() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch(`/admin/vehicle-brands/${vars.brandId}/models/${vars.modelId}`, { method: "DELETE" }),
        onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: keys.vehicleModels(vars.brandId) }),
    });
}
export function useCreateDiscountCode() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch("/admin/discount-codes", { method: "POST", body: vars }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.discountCodes }),
    });
}
export function useUpdateDiscountCode() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch(`/admin/discount-codes/${vars.id}`, { method: "PATCH", body: vars }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.discountCodes }),
    });
}
export function useDeleteDiscountCode() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => apiFetch(`/admin/discount-codes/${id}`, { method: "DELETE" }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.discountCodes }),
    });
}
export function useGenerateSpecialCoupons() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch("/admin/special-coupons/generate", { method: "POST", body: vars }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.specialCoupons }),
    });
}
export function useAssignSpecialCoupon() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch(`/admin/special-coupons/${vars.id}/assign`, {
            method: "PATCH",
            body: { customerId: vars.customerId },
        }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.specialCoupons }),
    });
}
export function useToggleSpecialCouponActive() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch(`/admin/special-coupons/${vars.id}/toggle-active`, {
            method: "PATCH",
            body: { active: vars.active },
        }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.specialCoupons }),
    });
}
export function useReactivateSpecialCoupon() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => apiFetch(`/admin/special-coupons/${id}/reactivate`, { method: "PATCH" }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.specialCoupons }),
    });
}
export function useUpdateReferralConfig() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch("/admin/referral-config", { method: "PUT", body: vars }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.referralConfig }),
    });
}
export function useCreatePromoBanner() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch("/admin/promo-banners", { method: "POST", body: vars }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.promoBanners }),
    });
}
export function useUpdatePromoBanner() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch(`/admin/promo-banners/${vars.id}`, { method: "PATCH", body: vars }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.promoBanners }),
    });
}
export function useDeletePromoBanner() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => apiFetch(`/admin/promo-banners/${id}`, { method: "DELETE" }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.promoBanners }),
    });
}
/* ─────────────────────────── Leads ──────────────────────────────────────── */
export const useLeads = () => useAuthedQuery(keys.leads, "/admin/leads");
export function useDeleteLead() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => apiFetch(`/admin/leads/${id}`, { method: "DELETE" }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.leads }),
    });
}
/* ─────────────────────────── Referrals Logs ─────────────────────────────── */
export const useReferralLogs = () => useAuthedQuery(keys.referralLogs, "/admin/referral-logs");
export function useUploadMedia() {
    return useMutation({
        mutationFn: (base64Image) => apiFetch("/admin/upload", {
            method: "POST",
            body: { image: base64Image },
        }),
    });
}
/* ─────────────────────────── Roles & Staff ───────────────────────────────── */
export const useRoles = () => useAuthedQuery(keys.roles, "/admin/roles");
export const useStaff = () => useAuthedQuery(keys.staff, "/admin/staff");
export function useCreateRole() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch("/admin/roles", { method: "POST", body: vars }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.roles }),
    });
}
export function useUpdateRole() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch(`/admin/roles/${vars.id}`, { method: "PATCH", body: { name: vars.name, permissions: vars.permissions } }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.roles }),
    });
}
export function useDeleteRole() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => apiFetch(`/admin/roles/${id}`, { method: "DELETE" }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: keys.roles });
            qc.invalidateQueries({ queryKey: keys.staff });
        },
    });
}
export function useCreateStaff() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch("/admin/staff", { method: "POST", body: vars }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.staff }),
    });
}
export function useUpdateStaff() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars) => apiFetch(`/admin/staff/${vars.id}`, { method: "PATCH", body: vars }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.staff }),
    });
}
export function useDeleteStaff() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => apiFetch(`/admin/staff/${id}`, { method: "DELETE" }),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.staff }),
    });
}
