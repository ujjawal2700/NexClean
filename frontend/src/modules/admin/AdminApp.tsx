import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminLayout } from "./components/AdminLayout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Bookings } from "./pages/Bookings";
import { Agents } from "./pages/Agents";
import { Customers } from "./pages/Customers";
import { CustomerDetail } from "./pages/CustomerDetail";
import { Payments } from "./pages/Payments";
import { Pricing } from "./pages/Pricing";
import { AreaAlerts } from "./pages/AreaAlerts";
import { Notifications } from "./pages/Notifications";
import { Plans } from "./pages/Plans";
import { Locations } from "./pages/Locations";
import { Reports } from "./pages/Reports";
import { ContentManagement } from "./pages/ContentManagement";

/**
 * Admin module router (base path /admin). Login is public; everything else
 * is wrapped in AdminLayout behind the auth guard.
 */
export function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <AdminLayout>
              <Outlet />
            </AdminLayout>
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="agents" element={<Agents />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="payments" element={<Payments />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="area-alerts" element={<AreaAlerts />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="plans" element={<Plans />} />
        <Route path="locations" element={<Locations />} />
        <Route path="reports" element={<Reports />} />
        <Route path="content" element={<ContentManagement />} />
      </Route>

      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
