import type { SiteContent } from "@shared/types/content";
import type { AdminStats, AdminBooking, AdminAgent, AdminAgentDetail, AgentActivity, AdminPlan, PlanPrices, Pricing, AlertSettings, TriggeredAlert, Campaign, AgentStatus, AdminCustomer, AdminCustomerDetail, CustomerActivity, CustomerStatus, AdminPayment, PaymentStats, BookingStatus, ServiceCity, ServiceZone, VehicleCategory, VehicleBrand, VehicleModel, DiscountCode, SpecialCoupon, ReferralConfig, PromoBanner, AdminReports, AudienceSizes, Lead, AdminReferralLog, AdminRole, AdminStaff, DispatchQueueItem, AssignableAgent } from "../types";
export declare function useAdminLogin(): import("@tanstack/react-query").UseMutationResult<{
    token: string;
    user: {
        name: string;
    };
}, Error, {
    email: string;
    password: string;
}, unknown>;
export declare const useAdminMe: () => import("@tanstack/react-query").UseQueryResult<NoInfer<{
    name: string;
    permissions: string[];
}>, Error>;
export declare const useStats: () => import("@tanstack/react-query").UseQueryResult<NoInfer<AdminStats>, Error>;
export declare const useBookings: () => import("@tanstack/react-query").UseQueryResult<NoInfer<AdminBooking[]>, Error>;
export declare const useAgents: () => import("@tanstack/react-query").UseQueryResult<NoInfer<AdminAgent[]>, Error>;
export declare const useAgent: (id: string) => import("@tanstack/react-query").UseQueryResult<NoInfer<AdminAgentDetail>, Error>;
export declare const useAgentActivity: (id: string) => import("@tanstack/react-query").UseQueryResult<NoInfer<AgentActivity>, Error>;
export declare const usePricing: () => import("@tanstack/react-query").UseQueryResult<NoInfer<Pricing>, Error>;
export declare const usePlans: () => import("@tanstack/react-query").UseQueryResult<NoInfer<AdminPlan[]>, Error>;
export declare const useCampaigns: () => import("@tanstack/react-query").UseQueryResult<NoInfer<Campaign[]>, Error>;
export declare const useAlertSettings: () => import("@tanstack/react-query").UseQueryResult<NoInfer<AlertSettings>, Error>;
export declare const useTriggered: () => import("@tanstack/react-query").UseQueryResult<NoInfer<TriggeredAlert[]>, Error>;
export declare const useCustomers: () => import("@tanstack/react-query").UseQueryResult<NoInfer<AdminCustomer[]>, Error>;
export declare const useCustomer: (id: string) => import("@tanstack/react-query").UseQueryResult<NoInfer<AdminCustomerDetail>, Error>;
export declare const useCustomerActivity: (id: string) => import("@tanstack/react-query").UseQueryResult<NoInfer<CustomerActivity>, Error>;
export declare const usePayments: () => import("@tanstack/react-query").UseQueryResult<NoInfer<AdminPayment[]>, Error>;
export declare const usePaymentStats: () => import("@tanstack/react-query").UseQueryResult<NoInfer<PaymentStats>, Error>;
export declare const useCities: () => import("@tanstack/react-query").UseQueryResult<NoInfer<ServiceCity[]>, Error>;
export declare const useZones: () => import("@tanstack/react-query").UseQueryResult<NoInfer<ServiceZone[]>, Error>;
export declare const useVehicleBrands: () => import("@tanstack/react-query").UseQueryResult<NoInfer<VehicleBrand[]>, Error>;
export declare const useDiscountCodes: () => import("@tanstack/react-query").UseQueryResult<NoInfer<DiscountCode[]>, Error>;
export declare const useSpecialCoupons: () => import("@tanstack/react-query").UseQueryResult<NoInfer<SpecialCoupon[]>, Error>;
export declare const useReferralConfig: () => import("@tanstack/react-query").UseQueryResult<NoInfer<ReferralConfig>, Error>;
export declare const usePromoBanners: () => import("@tanstack/react-query").UseQueryResult<NoInfer<PromoBanner[]>, Error>;
export declare const useReports: () => import("@tanstack/react-query").UseQueryResult<NoInfer<AdminReports>, Error>;
export declare const useContent: () => import("@tanstack/react-query").UseQueryResult<NoInfer<SiteContent>, Error>;
export declare const useAudienceSizes: () => import("@tanstack/react-query").UseQueryResult<NoInfer<AudienceSizes>, Error>;
export declare function useCancelBooking(): import("@tanstack/react-query").UseMutationResult<AdminBooking, Error, string, unknown>;
export declare function useSetAgentStatus(): import("@tanstack/react-query").UseMutationResult<AdminAgent, Error, {
    id: string;
    status: AgentStatus;
}, unknown>;
export declare function useSetCustomerStatus(): import("@tanstack/react-query").UseMutationResult<AdminCustomer, Error, {
    id: string;
    status: CustomerStatus;
}, unknown>;
export declare function useUpdatePricing(): import("@tanstack/react-query").UseMutationResult<Pricing, Error, Partial<Pricing>, unknown>;
export declare function useUpdateContent(): import("@tanstack/react-query").UseMutationResult<SiteContent, Error, Partial<SiteContent>, unknown>;
export declare function useUpdateAlertSettings(): import("@tanstack/react-query").UseMutationResult<AlertSettings, Error, Partial<AlertSettings>, unknown>;
export declare function useSendCampaign(): import("@tanstack/react-query").UseMutationResult<Campaign, Error, {
    title: string;
    body: string;
    audience: string;
}, unknown>;
export declare function useSetBookingStatus(): import("@tanstack/react-query").UseMutationResult<AdminBooking, Error, {
    id: string;
    status: BookingStatus;
}, unknown>;
export declare function useAssignBooking(): import("@tanstack/react-query").UseMutationResult<AdminBooking, Error, {
    id: string;
    agentId: string;
}, unknown>;
export declare function useAutoAssignBooking(): import("@tanstack/react-query").UseMutationResult<AdminBooking, Error, string, unknown>;
/** Live dispatch queue (searching / offered / pending / scheduled). */
export declare const useDispatchQueue: () => import("@tanstack/react-query").UseQueryResult<NoInfer<DispatchQueueItem[]>, Error>;
/** Cleaners assignable to a booking, ranked by distance. Fetched lazily when a picker opens. */
export declare function useAssignableAgents(bookingId: string | null): import("@tanstack/react-query").UseQueryResult<NoInfer<AssignableAgent[]>, Error>;
export declare function useRefundPayment(): import("@tanstack/react-query").UseMutationResult<AdminPayment, Error, {
    id: string;
    amount?: number;
    reason?: string;
}, unknown>;
export declare function useSettlePayment(): import("@tanstack/react-query").UseMutationResult<AdminPayment, Error, string, unknown>;
export declare function useUpdateAgentArea(): import("@tanstack/react-query").UseMutationResult<AdminAgent, Error, {
    id: string;
    area: string;
}, unknown>;
export declare function useCreatePlan(): import("@tanstack/react-query").UseMutationResult<AdminPlan, Error, {
    name: string;
    prices: PlanPrices;
    washesPerMonth: number;
}, unknown>;
export declare function useUpdatePlan(): import("@tanstack/react-query").UseMutationResult<AdminPlan, Error, {
    id: string;
    name?: string;
    prices?: PlanPrices;
    washesPerMonth?: number;
    active?: boolean;
}, unknown>;
export declare function useDeletePlan(): import("@tanstack/react-query").UseMutationResult<null, Error, string, unknown>;
export declare function useCreateCity(): import("@tanstack/react-query").UseMutationResult<ServiceCity, Error, {
    name: string;
}, unknown>;
export declare function useUpdateCity(): import("@tanstack/react-query").UseMutationResult<ServiceCity, Error, {
    id: string;
    name?: string;
    active?: boolean;
}, unknown>;
export declare function useDeleteCity(): import("@tanstack/react-query").UseMutationResult<null, Error, string, unknown>;
export declare function useCreateZone(): import("@tanstack/react-query").UseMutationResult<ServiceZone, Error, {
    name: string;
    cityId: string;
}, unknown>;
export declare function useUpdateZone(): import("@tanstack/react-query").UseMutationResult<ServiceZone, Error, {
    id: string;
    name?: string;
    active?: boolean;
    cityId?: string;
}, unknown>;
export declare function useDeleteZone(): import("@tanstack/react-query").UseMutationResult<null, Error, string, unknown>;
export declare const useVehicleCategories: () => import("@tanstack/react-query").UseQueryResult<NoInfer<VehicleCategory[]>, Error>;
/** Looks up a category's display name by key; falls back to the raw key for historical/deleted categories. */
export declare function useCategoryLabel(): (key: string) => string;
export declare function useCreateVehicleCategory(): import("@tanstack/react-query").UseMutationResult<VehicleCategory, Error, {
    name: string;
    basePrice: number;
}, unknown>;
export declare function useUpdateVehicleCategory(): import("@tanstack/react-query").UseMutationResult<VehicleCategory, Error, {
    id: string;
    name?: string;
    basePrice?: number;
    active?: boolean;
    sortOrder?: number;
}, unknown>;
export declare function useDeleteVehicleCategory(): import("@tanstack/react-query").UseMutationResult<null, Error, string, unknown>;
export declare function useCreateVehicleBrand(): import("@tanstack/react-query").UseMutationResult<VehicleBrand, Error, {
    name: string;
}, unknown>;
export declare function useUpdateVehicleBrand(): import("@tanstack/react-query").UseMutationResult<VehicleBrand, Error, {
    id: string;
    name?: string;
    active?: boolean;
}, unknown>;
export declare function useDeleteVehicleBrand(): import("@tanstack/react-query").UseMutationResult<null, Error, string, unknown>;
export declare const useVehicleModels: (brandId: string) => import("@tanstack/react-query").UseQueryResult<NoInfer<VehicleModel[]>, Error>;
export declare function useCreateVehicleModel(): import("@tanstack/react-query").UseMutationResult<VehicleModel, Error, {
    brandId: string;
    name: string;
    categoryKey: string;
}, unknown>;
export declare function useUpdateVehicleModel(): import("@tanstack/react-query").UseMutationResult<VehicleModel, Error, {
    brandId: string;
    modelId: string;
    name?: string;
    categoryKey?: string;
    active?: boolean;
}, unknown>;
export declare function useDeleteVehicleModel(): import("@tanstack/react-query").UseMutationResult<null, Error, {
    brandId: string;
    modelId: string;
}, unknown>;
export declare function useCreateDiscountCode(): import("@tanstack/react-query").UseMutationResult<DiscountCode, Error, {
    code: string;
    type: "percent" | "flat";
    value: number;
    minOrderValue?: number;
    maxDiscount?: number | null;
    usageLimit?: number | null;
    validTill?: string | null;
}, unknown>;
export declare function useUpdateDiscountCode(): import("@tanstack/react-query").UseMutationResult<DiscountCode, Error, {
    id: string;
} & Partial<Omit<DiscountCode, "code" | "id" | "usageCount">>, unknown>;
export declare function useDeleteDiscountCode(): import("@tanstack/react-query").UseMutationResult<null, Error, string, unknown>;
export declare function useGenerateSpecialCoupons(): import("@tanstack/react-query").UseMutationResult<SpecialCoupon[], Error, {
    count: number;
    type: "percent" | "flat";
    value: number;
    minOrderValue?: number;
    maxDiscount?: number | null;
    validFrom?: string | null;
    validTill?: string | null;
}, unknown>;
export declare function useAssignSpecialCoupon(): import("@tanstack/react-query").UseMutationResult<SpecialCoupon, Error, {
    id: string;
    customerId: string;
}, unknown>;
export declare function useToggleSpecialCouponActive(): import("@tanstack/react-query").UseMutationResult<SpecialCoupon, Error, {
    id: string;
    active: boolean;
}, unknown>;
export declare function useReactivateSpecialCoupon(): import("@tanstack/react-query").UseMutationResult<SpecialCoupon, Error, string, unknown>;
export declare function useUpdateReferralConfig(): import("@tanstack/react-query").UseMutationResult<ReferralConfig, Error, Partial<ReferralConfig>, unknown>;
export declare function useCreatePromoBanner(): import("@tanstack/react-query").UseMutationResult<PromoBanner, Error, {
    title: string;
    subtitle?: string;
    imageUrl: string;
    ctaLabel?: string;
    ctaLink?: string;
}, unknown>;
export declare function useUpdatePromoBanner(): import("@tanstack/react-query").UseMutationResult<PromoBanner, Error, {
    id: string;
} & Partial<Omit<PromoBanner, "id">>, unknown>;
export declare function useDeletePromoBanner(): import("@tanstack/react-query").UseMutationResult<null, Error, string, unknown>;
export declare const useLeads: () => import("@tanstack/react-query").UseQueryResult<NoInfer<Lead[]>, Error>;
export declare function useDeleteLead(): import("@tanstack/react-query").UseMutationResult<null, Error, string, unknown>;
export declare const useReferralLogs: () => import("@tanstack/react-query").UseQueryResult<NoInfer<AdminReferralLog[]>, Error>;
export declare function useUploadMedia(): import("@tanstack/react-query").UseMutationResult<{
    imageUrl: string;
}, Error, string, unknown>;
export declare const useRoles: () => import("@tanstack/react-query").UseQueryResult<NoInfer<AdminRole[]>, Error>;
export declare const useStaff: () => import("@tanstack/react-query").UseQueryResult<NoInfer<AdminStaff[]>, Error>;
export declare function useCreateRole(): import("@tanstack/react-query").UseMutationResult<AdminRole, Error, {
    name: string;
    permissions: string[];
}, unknown>;
export declare function useUpdateRole(): import("@tanstack/react-query").UseMutationResult<AdminRole, Error, {
    id: string;
    name: string;
    permissions: string[];
}, unknown>;
export declare function useDeleteRole(): import("@tanstack/react-query").UseMutationResult<{
    success: boolean;
}, Error, string, unknown>;
export declare function useCreateStaff(): import("@tanstack/react-query").UseMutationResult<AdminStaff, Error, {
    name: string;
    email: string;
    password?: string;
    adminRoleId: string;
}, unknown>;
export declare function useUpdateStaff(): import("@tanstack/react-query").UseMutationResult<AdminStaff, Error, {
    id: string;
    name: string;
    email: string;
    password?: string;
    adminRoleId: string;
}, unknown>;
export declare function useDeleteStaff(): import("@tanstack/react-query").UseMutationResult<{
    success: boolean;
}, Error, string, unknown>;
