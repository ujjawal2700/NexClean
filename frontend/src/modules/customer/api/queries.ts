import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { InvoiceWithTemplate } from "@shared/lib/invoice";
import type { TaxSettings } from "@shared/lib/tax";
import { apiFetch } from "@shared/lib/api";
import { useSessionStore } from "../store/sessionStore";
import { DEFAULT_LEAD_MINUTES, TIME_SLOTS } from "../data/catalog";
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
  BookingDetail,
} from "../types";

export const meKey = ["me"] as const;
export const bookingsKey = ["bookings"] as const;
export const notificationsKey = ["notifications"] as const;
export const plansKey = ["catalog", "plans"] as const;
export const promoBannersKey = ["catalog", "promo-banners"] as const;
export const offPeakHoursKey = ["catalog", "off-peak-hours"] as const;
export const timeSlotsKey = ["catalog", "time-slots"] as const;
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

/** GST settings for the checkout preview (public; the server re-checks every order). */
export function useTaxSettings(): TaxSettings | null {
  const { data } = useQuery({
    queryKey: ["catalog", "tax"],
    queryFn: () => apiFetch<TaxSettings>("/catalog/tax"),
    staleTime: 60_000,
  });
  return data ?? null;
}

/** A booking's invoice and the template to render it with; issued on first request if needed. */
export function useBookingInvoice(id: string, enabled = true) {
  const authenticated = useSessionStore((s) => s.authenticated);
  return useQuery({
    queryKey: ["bookings", id, "invoice"],
    queryFn: () => apiFetch<InvoiceWithTemplate>(`/bookings/${id}/invoice`),
    enabled: authenticated && !!id && enabled,
  });
}

export const bookingDetailKey = (id: string) => ["bookings", id] as const;

/** One of the customer's bookings, with its cleaner and review. */
export function useBookingDetail(id: string) {
  const authenticated = useSessionStore((s) => s.authenticated);
  return useQuery({
    queryKey: bookingDetailKey(id),
    queryFn: () => apiFetch<BookingDetail>(`/bookings/${id}`),
    enabled: authenticated && !!id,
  });
}

export type BookingStatusFilter = "all" | "upcoming" | "completed" | "cancelled";

export type BookingsPage = {
  items: Booking[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  counts: Record<BookingStatusFilter, number>;
};

export const BOOKINGS_PAGE_SIZE = 10;

/**
 * My bookings, one server page at a time (newest first, filtered by status
 * on the server). Keyed under "bookings" so every mutation that invalidates
 * the bookings list refreshes the loaded pages too.
 */
export function useBookingsPages(status: BookingStatusFilter) {
  const authenticated = useSessionStore((s) => s.authenticated);
  return useInfiniteQuery({
    queryKey: ["bookings", "pages", status] as const,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const data = await apiFetch<BookingsPage | Booking[]>(
        `/bookings?page=${pageParam}&limit=${BOOKINGS_PAGE_SIZE}&status=${status}`,
      );
      // An older server ignores the paging params and returns the plain list.
      if (Array.isArray(data)) {
        const items = status === "all" ? data : data.filter((b) => b.status === status);
        const counts = { all: data.length, upcoming: 0, completed: 0, cancelled: 0 };
        data.forEach((b) => (counts[b.status] += 1));
        return { items, page: 1, limit: items.length, total: items.length, hasMore: false, counts } satisfies BookingsPage;
      }
      return data;
    },
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: authenticated,
  });
}

/** The customer's working set: every upcoming booking plus the 20 most recent others, newest first. */
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
 * The bookable time slots set by the admin (public catalog). Falls back to the
 * built-in list while loading, so the picker never renders empty.
 */
function useTimeSlotConfig() {
  return useQuery({
    queryKey: timeSlotsKey,
    queryFn: () => apiFetch<{ slots: string[]; leadMinutes?: number }>("/catalog/time-slots"),
    staleTime: 60_000,
  });
}

export function useTimeSlots(): string[] {
  const { data } = useTimeSlotConfig();
  return data?.slots?.length ? data.slots : TIME_SLOTS;
}

/**
 * The admin-set minimum notice (minutes) before a slot's start for it to be
 * bookable today. Shares the time-slots query, so it costs no extra request.
 */
export function useSlotLeadMinutes(): number {
  const { data } = useTimeSlotConfig();
  return typeof data?.leadMinutes === "number" ? data.leadMinutes : DEFAULT_LEAD_MINUTES;
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
