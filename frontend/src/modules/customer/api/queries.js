import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@shared/lib/api";
import { useSessionStore } from "../store/sessionStore";
import { useAdminSession } from "../../admin/store/sessionStore";
import { useAgentSession } from "../../agent/store/sessionStore";
export const meKey = ["me"];
export const bookingsKey = ["bookings"];
export const notificationsKey = ["notifications"];
export const plansKey = ["catalog", "plans"];
export const promoBannersKey = ["catalog", "promo-banners"];
export const referralsKey = ["referrals"];
export const walletKey = ["wallet"];
export const vehicleCategoriesKey = ["catalog", "vehicle-categories"];
export const vehicleBrandsKey = ["catalog", "vehicle-brands"];
export const vehicleModelsKey = (brandId) => ["catalog", "vehicle-brands", brandId, "models"];
export const subscriptionScheduleKey = ["subscription", "schedule"];
export const supportConfigKey = ["chat", "config"];
export const supportTicketsKey = ["chat", "tickets"];
export const ticketMessagesKey = (ticketId) => ["chat", "tickets", ticketId, "messages"];
/** Current authenticated customer (profile, vehicles, addresses, plan). */
export function useMe() {
    const token = useSessionStore((s) => s.token);
    return useQuery({
        queryKey: meKey,
        queryFn: () => apiFetch("/auth/me"),
        enabled: !!token,
    });
}
/** Active subscription plans (public catalog), priced per vehicle category. */
export function usePlans() {
    return useQuery({
        queryKey: plansKey,
        queryFn: () => apiFetch("/catalog/plans"),
    });
}
/** The customer's bookings, newest first. */
export function useBookings() {
    const token = useSessionStore((s) => s.token);
    return useQuery({
        queryKey: bookingsKey,
        queryFn: () => apiFetch("/bookings"),
        enabled: !!token,
    });
}
/** The customer's notifications, polled so the bell stays fresh. */
export function useNotifications() {
    const token = useSessionStore((s) => s.token);
    return useQuery({
        queryKey: notificationsKey,
        queryFn: () => apiFetch("/notifications"),
        enabled: !!token,
        refetchInterval: 20_000,
    });
}
/** Active promotional banners set by the admin (public catalog). */
export function usePromoBanners() {
    return useQuery({
        queryKey: promoBannersKey,
        queryFn: () => apiFetch("/catalog/promo-banners"),
    });
}
/** The customer's own referral code, earnings, and referred users. */
export function useReferralSummary() {
    const token = useSessionStore((s) => s.token);
    return useQuery({
        queryKey: referralsKey,
        queryFn: () => apiFetch("/users/me/referrals"),
        enabled: !!token,
    });
}
/** The customer's coin wallet: balance, its ₹ value, and recent transactions. */
export function useWallet() {
    const token = useSessionStore((s) => s.token);
    return useQuery({
        queryKey: walletKey,
        queryFn: () => apiFetch("/wallet"),
        enabled: !!token,
    });
}
/** Admin-managed vehicle categories (with their current base price) — what pricing is based on. */
export function useVehicleCategories() {
    return useQuery({
        queryKey: vehicleCategoriesKey,
        queryFn: () => apiFetch("/catalog/vehicle-categories"),
    });
}
/** Looks up a category's display name by key; falls back to the raw key. */
export function useCategoryLabel() {
    const { data: categories = [] } = useVehicleCategories();
    const byKey = new Map(categories.map((c) => [c.key, c.name]));
    return (key) => byKey.get(key) ?? key;
}
/** All active brands — for the Add Vehicle / booking pickers (a brand spans many categories). */
export function useVehicleBrands() {
    return useQuery({
        queryKey: vehicleBrandsKey,
        queryFn: () => apiFetch("/catalog/vehicle-brands"),
    });
}
/** Active models under a brand — each carries its own category. */
export function useVehicleModels(brandId) {
    return useQuery({
        queryKey: vehicleModelsKey(brandId ?? ""),
        queryFn: () => apiFetch(`/catalog/vehicle-brands/${brandId}/models`),
        enabled: !!brandId,
    });
}
export function useSubscriptionSchedule() {
    const token = useSessionStore((s) => s.token);
    return useQuery({
        queryKey: subscriptionScheduleKey,
        queryFn: () => apiFetch("/subscriptions/schedule"),
        enabled: !!token,
    });
}
export function useActiveToken() {
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    const customerToken = useSessionStore((s) => s.token);
    const adminToken = useAdminSession((s) => s.token);
    const agentToken = useAgentSession((s) => s.token);
    if (path.startsWith("/admin"))
        return adminToken;
    if (path.startsWith("/agent"))
        return agentToken;
    return customerToken;
}
export function useSupportConfig() {
    const token = useActiveToken();
    return useQuery({
        queryKey: supportConfigKey,
        queryFn: () => apiFetch("/chat/config"),
        enabled: !!token,
    });
}
export function useSupportTickets() {
    const token = useActiveToken();
    return useQuery({
        queryKey: supportTicketsKey,
        queryFn: () => apiFetch("/chat/tickets"),
        enabled: !!token,
    });
}
export function useTicketMessages(ticketId) {
    const token = useActiveToken();
    return useQuery({
        queryKey: ticketMessagesKey(ticketId ?? ""),
        queryFn: () => apiFetch(`/chat/tickets/${ticketId}/messages`),
        enabled: !!token && !!ticketId,
    });
}
export function useSiteContent() {
    return useQuery({
        queryKey: ["catalog", "content"],
        queryFn: () => apiFetch("/catalog/content"),
    });
}
