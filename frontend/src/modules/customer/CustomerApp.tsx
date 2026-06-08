import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { CustomerLayout } from "./components/CustomerLayout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Bookings } from "./pages/Bookings";
import { Subscriptions } from "./pages/Subscriptions";
import { Profile } from "./pages/Profile";
import { BookingFlow } from "./pages/booking/BookingFlow";

/**
 * Customer module router (base path /app). Login is public; everything else
 * is wrapped in CustomerLayout behind the auth guard.
 */
export function CustomerApp() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />

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
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
