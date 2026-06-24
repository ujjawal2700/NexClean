import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@shared/lib/api";
import { useSessionStore } from "../store/sessionStore";
import type { User, Booking, AppNotification, CatalogPlan, PromoBanner, ReferralSummary } from "../types";

export const meKey = ["me"] as const;
export const bookingsKey = ["bookings"] as const;
export const notificationsKey = ["notifications"] as const;
export const plansKey = ["catalog", "plans"] as const;
export const promoBannersKey = ["catalog", "promo-banners"] as const;
export const referralsKey = ["referrals"] as const;

/** Current authenticated customer (profile, vehicles, addresses, plan). */
export function useMe() {
  const token = useSessionStore((s) => s.token);
  return useQuery({
    queryKey: meKey,
    queryFn: () => apiFetch<User>("/auth/me"),
    enabled: !!token,
  });
}

/** Active subscription plans (public catalog), priced per vehicle type. */
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
