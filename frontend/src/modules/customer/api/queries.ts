import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@shared/lib/api";
import { useSessionStore } from "../store/sessionStore";
import type { User, Booking, AppNotification } from "../types";

export const meKey = ["me"] as const;
export const bookingsKey = ["bookings"] as const;
export const notificationsKey = ["notifications"] as const;

/** Current authenticated customer (profile, vehicles, addresses, plan). */
export function useMe() {
  const token = useSessionStore((s) => s.token);
  return useQuery({
    queryKey: meKey,
    queryFn: () => apiFetch<User>("/auth/me"),
    enabled: !!token,
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
