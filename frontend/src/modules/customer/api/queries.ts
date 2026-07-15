import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@shared/lib/api";
import { useSessionStore } from "../store/sessionStore";
import { useAdminSession } from "../../admin/store/sessionStore";
import { useAgentSession } from "../../agent/store/sessionStore";
import type {
  User,
  Booking,
  AppNotification,
  CatalogPlan,
  PromoBanner,
  ReferralSummary,
  Wallet,
  VehicleCategory,
  VehicleBrand,
  VehicleModel,
  SubscriptionScheduleResponse,
  SupportConfig,
  SupportTicket,
  ChatMessage,
} from "../types";

export const meKey = ["me"] as const;
export const bookingsKey = ["bookings"] as const;
export const notificationsKey = ["notifications"] as const;
export const plansKey = ["catalog", "plans"] as const;
export const promoBannersKey = ["catalog", "promo-banners"] as const;
export const referralsKey = ["referrals"] as const;
export const walletKey = ["wallet"] as const;
export const vehicleCategoriesKey = ["catalog", "vehicle-categories"] as const;
export const vehicleBrandsKey = ["catalog", "vehicle-brands"] as const;
export const vehicleModelsKey = (brandId: string) => ["catalog", "vehicle-brands", brandId, "models"] as const;
export const subscriptionScheduleKey = ["subscription", "schedule"] as const;
export const supportConfigKey = ["chat", "config"] as const;
export const supportTicketsKey = ["chat", "tickets"] as const;
export const ticketMessagesKey = (ticketId: string) => ["chat", "tickets", ticketId, "messages"] as const;

/** Current authenticated customer (profile, vehicles, addresses, plan). */
export function useMe() {
  const token = useSessionStore((s) => s.token);
  return useQuery({
    queryKey: meKey,
    queryFn: () => apiFetch<User>("/auth/me"),
    enabled: !!token,
  });
}

/** Active subscription plans (public catalog), priced per vehicle category. */
export function usePlans() {
  return useQuery({
    queryKey: plansKey,
    queryFn: () => apiFetch<CatalogPlan[]>("/catalog/plans"),
  });
}

/** The customer's bookings, newest first. */
export function useBookings() {
  const token = useSessionStore((s) => s.token);
  return useQuery({
    queryKey: bookingsKey,
    queryFn: () => apiFetch<Booking[]>("/bookings"),
    enabled: !!token,
  });
}

/** The customer's notifications, polled so the bell stays fresh. */
export function useNotifications() {
  const token = useSessionStore((s) => s.token);
  return useQuery({
    queryKey: notificationsKey,
    queryFn: () => apiFetch<AppNotification[]>("/notifications"),
    enabled: !!token,
    refetchInterval: 20_000,
  });
}

/** Active promotional banners set by the admin (public catalog). */
export function usePromoBanners() {
  return useQuery({
    queryKey: promoBannersKey,
    queryFn: () => apiFetch<PromoBanner[]>("/catalog/promo-banners"),
  });
}

/** The customer's own referral code, earnings, and referred users. */
export function useReferralSummary() {
  const token = useSessionStore((s) => s.token);
  return useQuery({
    queryKey: referralsKey,
    queryFn: () => apiFetch<ReferralSummary>("/users/me/referrals"),
    enabled: !!token,
  });
}

/** The customer's coin wallet: balance, its ₹ value, and recent transactions. */
export function useWallet() {
  const token = useSessionStore((s) => s.token);
  return useQuery({
    queryKey: walletKey,
    queryFn: () => apiFetch<Wallet>("/wallet"),
    enabled: !!token,
  });
}

/** Admin-managed vehicle categories (with their current base price) — what pricing is based on. */
export function useVehicleCategories() {
  return useQuery({
    queryKey: vehicleCategoriesKey,
    queryFn: () => apiFetch<VehicleCategory[]>("/catalog/vehicle-categories"),
  });
}

/** Looks up a category's display name by key; falls back to the raw key. */
export function useCategoryLabel() {
  const { data: categories = [] } = useVehicleCategories();
  const byKey = new Map(categories.map((c) => [c.key, c.name]));
  return (key: string) => byKey.get(key) ?? key;
}

/** All active brands — for the Add Vehicle / booking pickers (a brand spans many categories). */
export function useVehicleBrands() {
  return useQuery({
    queryKey: vehicleBrandsKey,
    queryFn: () => apiFetch<VehicleBrand[]>("/catalog/vehicle-brands"),
  });
}

/** Active models under a brand — each carries its own category. */
export function useVehicleModels(brandId: string | null) {
  return useQuery({
    queryKey: vehicleModelsKey(brandId ?? ""),
    queryFn: () => apiFetch<VehicleModel[]>(`/catalog/vehicle-brands/${brandId}/models`),
    enabled: !!brandId,
  });
}

export function useSubscriptionSchedule() {
  const token = useSessionStore((s) => s.token);
  return useQuery({
    queryKey: subscriptionScheduleKey,
    queryFn: () => apiFetch<SubscriptionScheduleResponse>("/subscriptions/schedule"),
    enabled: !!token,
  });
}

export function useActiveToken() {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const customerToken = useSessionStore((s) => s.token);
  const adminToken = useAdminSession((s) => s.token);
  const agentToken = useAgentSession((s) => s.token);
  
  if (path.startsWith("/admin")) return adminToken;
  if (path.startsWith("/agent")) return agentToken;
  return customerToken;
}

export function useSupportConfig() {
  const token = useActiveToken();
  return useQuery({
    queryKey: supportConfigKey,
    queryFn: () => apiFetch<SupportConfig>("/chat/config"),
    enabled: !!token,
  });
}

export function useSupportTickets() {
  const token = useActiveToken();
  return useQuery({
    queryKey: supportTicketsKey,
    queryFn: () => apiFetch<SupportTicket[]>("/chat/tickets"),
    enabled: !!token,
  });
}

export function useTicketMessages(ticketId: string | null) {
  const token = useActiveToken();
  return useQuery({
    queryKey: ticketMessagesKey(ticketId ?? ""),
    queryFn: () => apiFetch<ChatMessage[]>(`/chat/tickets/${ticketId}/messages`),
    enabled: !!token && !!ticketId,
  });
}

export function useSiteContent() {
  return useQuery({
    queryKey: ["catalog", "content"],
    queryFn: () => apiFetch<any>("/catalog/content"),
  });
}
