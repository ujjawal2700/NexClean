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
import { ReferEarn } from "./pages/ReferEarn";
import { Vehicles } from "./pages/Vehicles";
import { Addresses } from "./pages/Addresses";
import { Notifications } from "./pages/Notifications";
import { BookingFlow } from "./pages/booking/BookingFlow";

/**
 * Customer module router (base path /app). Login is public; everything else
 * is wrapped in CustomerLayout behind the auth guard.
 */
export function CustomerApp() {
  return (
    <RouteErrorBoundary homePath="/app" homeLabel="customer home">
      <Routes>
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="coming-soon" element={<ComingSoon />} />

        <Route
          element={
            <ProtectedRoute>
              <CustomerLayout>
                <Outlet />
              </CustomerLayout>
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="book" element={<BookingFlow />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="plans" element={<Subscriptions />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
          <Route path="profile/refer" element={<ReferEarn />} />
          <Route path="profile/vehicles" element={<Vehicles />} />
          <Route path="profile/addresses" element={<Addresses />} />
        </Route>

        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </RouteErrorBoundary>
  );
}
