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
  OffPeakHoursConfig,
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
export const offPeakHoursKey = ["catalog", "off-peak-hours"] as const;
export const paymentModeKey = ["catalog", "payment-mode"] as const;
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
  const authenticated = useSessionStore((s) => s.authenticated);
  return useQuery({
    queryKey: meKey,
    queryFn: () => apiFetch<User>("/auth/me"),
    enabled: authenticated,
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
  const authenticated = useSessionStore((s) => s.authenticated);
  return useQuery({
    queryKey: bookingsKey,
    queryFn: () => apiFetch<Booking[]>("/bookings"),
    enabled: authenticated,
  });
}

/** The customer's notifications, polled so the bell stays fresh. */
export function useNotifications() {
  const authenticated = useSessionStore((s) => s.authenticated);
  return useQuery({
    queryKey: notificationsKey,
    queryFn: () => apiFetch<AppNotification[]>("/notifications"),
    enabled: authenticated,
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

/**
 * Off-peak windows set by the admin (public catalog), used to flag the discounted slots in the
 * booking picker. Config changes rarely, so a long stale time keeps the schedule
 * step from refetching on every revisit.
 */
export function useOffPeakHours() {
  return useQuery({
    queryKey: offPeakHoursKey,
    queryFn: () => apiFetch<OffPeakHoursConfig>("/catalog/off-peak-hours"),
    staleTime: 5 * 60_000,
  });
}

/**
 * Whether checkout goes through a gateway or is settled in cash.
 *
 * Screens need this to label a pay button honestly *before* the customer taps
 * it. Rarely changes — it only moves when the deployment's keys do.
 */
export function usePaymentMode() {
  return useQuery({
    queryKey: paymentModeKey,
    queryFn: () => apiFetch<{ online: boolean }>("/catalog/payment-mode"),
    staleTime: 10 * 60_000,
  });
}

/** The customer's own referral code, earnings, and referred users. */
export function useReferralSummary() {
  const authenticated = useSessionStore((s) => s.authenticated);
  return useQuery({
    queryKey: referralsKey,
    queryFn: () => apiFetch<ReferralSummary>("/users/me/referrals"),
    enabled: authenticated,
  });
}

/** The customer's coin wallet: balance, its ₹ value, and recent transactions. */
export function useWallet() {
  const authenticated = useSessionStore((s) => s.authenticated);
  return useQuery({
    queryKey: walletKey,
    queryFn: () => apiFetch<Wallet>("/wallet"),
    enabled: authenticated,
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
  const authenticated = useSessionStore((s) => s.authenticated);
  return useQuery({
    queryKey: subscriptionScheduleKey,
    queryFn: () => apiFetch<SubscriptionScheduleResponse>("/subscriptions/schedule"),
    enabled: authenticated,
  });
}

/** Whether the app matching the current route has an active session. */
export function useActiveSession() {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const customerAuthed = useSessionStore((s) => s.authenticated);
  const adminAuthed = useAdminSession((s) => s.authenticated);
  const agentAuthed = useAgentSession((s) => s.authenticated);
  
  if (path.startsWith("/admin")) return adminAuthed;
  if (path.startsWith("/agent")) return agentAuthed;
  return customerAuthed;
}

export function useSupportConfig() {
  const authenticated = useActiveSession();
  return useQuery({
    queryKey: supportConfigKey,
    queryFn: () => apiFetch<SupportConfig>("/chat/config"),
    enabled: authenticated,
  });
}

export function useSupportTickets() {
  const authenticated = useActiveSession();
  return useQuery({
    queryKey: supportTicketsKey,
    queryFn: () => apiFetch<SupportTicket[]>("/chat/tickets"),
    enabled: authenticated,
  });
}

export function useTicketMessages(ticketId: string | null) {
  const authenticated = useActiveSession();
  return useQuery({
    queryKey: ticketMessagesKey(ticketId ?? ""),
    queryFn: () => apiFetch<ChatMessage[]>(`/chat/tickets/${ticketId}/messages`),
    enabled: authenticated && !!ticketId,
  });
}

export function useSiteContent() {
  return useQuery({
    queryKey: ["catalog", "content"],
    queryFn: () => apiFetch<any>("/catalog/content"),
  });
}
