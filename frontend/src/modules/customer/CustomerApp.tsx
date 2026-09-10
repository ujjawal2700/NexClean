import { Routes, Route, Navigate, Outlet } from "react-router-dom";
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
import { Wallet } from "./pages/Wallet";
import { Vehicles } from "./pages/Vehicles";
import { Addresses } from "./pages/Addresses";
import { Notifications } from "./pages/Notifications";
import { BookingFlow } from "./pages/booking/BookingFlow";
import { HelpSupport } from "./pages/HelpSupport";
import { TrackBooking } from "./pages/tracking/TrackBooking";

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
          <Route path="wallet" element={<Wallet />} />
          <Route path="profile/vehicles" element={<Vehicles />} />
          <Route path="profile/addresses" element={<Addresses />} />
          <Route path="help" element={<HelpSupport />} />
        </Route>

        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </RouteErrorBoundary>
  );
}
