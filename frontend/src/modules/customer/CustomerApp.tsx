import { useEffect, useRef, useState } from "react";
import { Routes, Route, Outlet, useNavigate } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch, SOCKET_URL } from "@shared/lib/api";
import { RouteErrorBoundary } from "@shared/components/RouteErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { CustomerLayout } from "./components/CustomerLayout";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { ComingSoon } from "./pages/ComingSoon";
import { Dashboard } from "./pages/Dashboard";
import { Bookings } from "./pages/Bookings";
import { Subscriptions } from "./pages/Subscriptions";
import { Profile } from "./pages/Profile";
import { EditProfile } from "./pages/EditProfile";
import { ReferEarn } from "./pages/ReferEarn";
import { ReferredUsers } from "./pages/ReferredUsers";
import { Wallet } from "./pages/Wallet";
import { Vehicles } from "./pages/Vehicles";
import { Addresses } from "./pages/Addresses";
import { Notifications } from "./pages/Notifications";
import { BookingFlow } from "./pages/booking/BookingFlow";
import { HelpSupport } from "./pages/HelpSupport";
import { TrackBooking } from "./pages/tracking/TrackBooking";
import { CustomerNotFound } from "./pages/NotFound";
import { ServiceCompletedDialog } from "./components/ServiceCompletedDialog";
import { useSessionStore } from "./store/sessionStore";
import { bookingsKey, notificationsKey } from "./api/queries";
import type { Booking } from "./types";

type BookingProgress = {
  bookingId: string;
  status: "upcoming" | "completed" | "cancelled";
  jobStatus: "assigned" | "enroute" | "arrived" | "in_progress" | "completed";
};

/**
 * Customer-wide live listener: the app's one socket connection. It lives above
 * the route groups so the completion confirmation appears on both
 * CustomerLayout pages and the standalone live tracking screen — and so the
 * connection isn't torn down and reopened every time the customer moves
 * between those route groups (CustomerLayout remounts on that switch).
 */
function CustomerCompletionListener() {
  const authenticated = useSessionStore((s) => s.authenticated);
  const [completedBookingId, setCompletedBookingId] = useState<string | null>(null);
  const activeBookingIds = useRef(new Set<string>());
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authenticated) return;
    let alive = true;
    const reconcile = async (initial = false) => {
      try {
        // Through the query cache, not a bare fetch: on page load this shares
        // the /bookings request the dashboard is already making instead of
        // firing a second one, and the 5s safety poll refreshes the same data
        // the screens render.
        const bookings = await qc.fetchQuery({
          queryKey: bookingsKey,
          queryFn: () => apiFetch<Booking[]>("/bookings"),
          staleTime: initial ? 30_000 : 0,
        });
        if (!alive) return;
        const nextActive = new Set(bookings.filter((b) => b.status === "upcoming").map((b) => b.id));
        if (!initial) {
          const newlyCompleted = bookings.find(
            (b) => b.status === "completed" && activeBookingIds.current.has(b.id),
          );
          if (newlyCompleted) setCompletedBookingId(newlyCompleted.id);
        }
        activeBookingIds.current = nextActive;
      } catch {
        // The socket remains the primary path; a failed safety poll is retried.
      }
    };

    void reconcile(true);
    const socket: Socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket"],
      auth: { role: "customer" },
    });

    socket.on("booking_progress", (progress: BookingProgress) => {
      qc.invalidateQueries({ queryKey: bookingsKey });
      if (progress.status === "completed" || progress.jobStatus === "completed") {
        activeBookingIds.current.delete(progress.bookingId);
        setCompletedBookingId(progress.bookingId);
        qc.invalidateQueries({ queryKey: notificationsKey });
      } else if (progress.status === "upcoming") {
        activeBookingIds.current.add(progress.bookingId);
      }
    });

    socket.on("booking_assigned", () => {
      qc.invalidateQueries({ queryKey: bookingsKey });
      qc.invalidateQueries({ queryKey: notificationsKey });
    });
    socket.on("notification", () => {
      qc.invalidateQueries({ queryKey: notificationsKey });
      qc.invalidateQueries({ queryKey: bookingsKey });
    });
    socket.on("push_notification", () => {
      qc.invalidateQueries({ queryKey: notificationsKey });
    });

    // WebSockets are immediate; this only runs while a service is active and
    // recovers completion within five seconds if a mobile handoff or proxy
    // drops the one terminal event.
    const fallback = window.setInterval(() => {
      if (activeBookingIds.current.size > 0) void reconcile();
    }, 5_000);

    return () => {
      alive = false;
      window.clearInterval(fallback);
      socket.disconnect();
      activeBookingIds.current.clear();
    };
  }, [authenticated, qc]);

  if (!completedBookingId) return null;
  return (
    <ServiceCompletedDialog
      onConfirm={() => {
        setCompletedBookingId(null);
        navigate("/app", { replace: true });
      }}
    />
  );
}

/**
 * Customer module router (base path /app). Login is public; everything else
 * is wrapped in CustomerLayout behind the auth guard.
 *
 * Two guarded groups share the same layout: the browse group (dashboard,
 * plans) also admits the "skip login" guest, while the account group —
 * booking, bookings, profile and everything under it — always requires a
 * real session and bounces a guest to the login.
 */
export function CustomerApp() {
  return (
    <RouteErrorBoundary homePath="/app" homeLabel="customer home">
      <CustomerCompletionListener />
      <Routes>
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="coming-soon" element={<ComingSoon />} />

        <Route
          path="track/:id"
          element={
            <ProtectedRoute>
              <TrackBooking />
            </ProtectedRoute>
          }
        />

        {/* Browsable without an account */}
        <Route
          element={
            <ProtectedRoute allowGuest>
              <CustomerLayout>
                <Outlet />
              </CustomerLayout>
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="plans" element={<Subscriptions />} />
        </Route>

        {/* Account-only */}
        <Route
          element={
            <ProtectedRoute>
              <CustomerLayout>
                <Outlet />
              </CustomerLayout>
            </ProtectedRoute>
          }
        >
          <Route path="book" element={<BookingFlow />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
          <Route path="profile/edit" element={<EditProfile />} />
          <Route path="profile/refer" element={<ReferEarn />} />
          <Route path="profile/refer/users" element={<ReferredUsers />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="profile/vehicles" element={<Vehicles />} />
          <Route path="profile/addresses" element={<Addresses />} />
          <Route path="help" element={<HelpSupport />} />
        </Route>

        <Route path="*" element={<CustomerNotFound />} />
      </Routes>
    </RouteErrorBoundary>
  );
}
