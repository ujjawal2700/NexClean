import type { User, Booking, AppNotification, CatalogPlan, PromoBanner, ReferralSummary, Wallet, VehicleCategory, VehicleBrand, VehicleModel, SubscriptionScheduleResponse, SupportConfig, SupportTicket, ChatMessage } from "../types";
export declare const meKey: readonly ["me"];
export declare const bookingsKey: readonly ["bookings"];
export declare const notificationsKey: readonly ["notifications"];
export declare const plansKey: readonly ["catalog", "plans"];
export declare const promoBannersKey: readonly ["catalog", "promo-banners"];
export declare const referralsKey: readonly ["referrals"];
export declare const walletKey: readonly ["wallet"];
export declare const vehicleCategoriesKey: readonly ["catalog", "vehicle-categories"];
export declare const vehicleBrandsKey: readonly ["catalog", "vehicle-brands"];
export declare const vehicleModelsKey: (brandId: string) => readonly ["catalog", "vehicle-brands", string, "models"];
export declare const subscriptionScheduleKey: readonly ["subscription", "schedule"];
export declare const supportConfigKey: readonly ["chat", "config"];
export declare const supportTicketsKey: readonly ["chat", "tickets"];
export declare const ticketMessagesKey: (ticketId: string) => readonly ["chat", "tickets", string, "messages"];
/** Current authenticated customer (profile, vehicles, addresses, plan). */
export declare function useMe(): import("@tanstack/react-query").UseQueryResult<NoInfer<User>, Error>;
/** Active subscription plans (public catalog), priced per vehicle category. */
export declare function usePlans(): import("@tanstack/react-query").UseQueryResult<NoInfer<CatalogPlan[]>, Error>;
/** The customer's bookings, newest first. */
export declare function useBookings(): import("@tanstack/react-query").UseQueryResult<NoInfer<Booking[]>, Error>;
/** The customer's notifications, polled so the bell stays fresh. */
export declare function useNotifications(): import("@tanstack/react-query").UseQueryResult<NoInfer<AppNotification[]>, Error>;
/** Active promotional banners set by the admin (public catalog). */
export declare function usePromoBanners(): import("@tanstack/react-query").UseQueryResult<NoInfer<PromoBanner[]>, Error>;
/** The customer's own referral code, earnings, and referred users. */
export declare function useReferralSummary(): import("@tanstack/react-query").UseQueryResult<NoInfer<ReferralSummary>, Error>;
/** The customer's coin wallet: balance, its ₹ value, and recent transactions. */
export declare function useWallet(): import("@tanstack/react-query").UseQueryResult<NoInfer<Wallet>, Error>;
/** Admin-managed vehicle categories (with their current base price) — what pricing is based on. */
export declare function useVehicleCategories(): import("@tanstack/react-query").UseQueryResult<NoInfer<VehicleCategory[]>, Error>;
/** Looks up a category's display name by key; falls back to the raw key. */
export declare function useCategoryLabel(): (key: string) => string;
/** All active brands — for the Add Vehicle / booking pickers (a brand spans many categories). */
export declare function useVehicleBrands(): import("@tanstack/react-query").UseQueryResult<NoInfer<VehicleBrand[]>, Error>;
/** Active models under a brand — each carries its own category. */
export declare function useVehicleModels(brandId: string | null): import("@tanstack/react-query").UseQueryResult<NoInfer<VehicleModel[]>, Error>;
export declare function useSubscriptionSchedule(): import("@tanstack/react-query").UseQueryResult<NoInfer<SubscriptionScheduleResponse>, Error>;
export declare function useActiveToken(): string | null;
export declare function useSupportConfig(): import("@tanstack/react-query").UseQueryResult<NoInfer<SupportConfig>, Error>;
export declare function useSupportTickets(): import("@tanstack/react-query").UseQueryResult<NoInfer<SupportTicket[]>, Error>;
export declare function useTicketMessages(ticketId: string | null): import("@tanstack/react-query").UseQueryResult<NoInfer<ChatMessage[]>, Error>;
export declare function useSiteContent(): import("@tanstack/react-query").UseQueryResult<any, Error>;
