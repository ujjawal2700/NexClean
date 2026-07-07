import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { RouteErrorBoundary } from "@shared/components/RouteErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminLayout } from "./components/AdminLayout";
import { PermissionGuard } from "./components/PermissionGuard";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Bookings } from "./pages/Bookings";
import { Agents } from "./pages/Agents";
import { AgentVerification } from "./pages/AgentVerification";
import { AgentDetail } from "./pages/AgentDetail";
import { Customers } from "./pages/Customers";
import { CustomerDetail } from "./pages/CustomerDetail";
import { Payments } from "./pages/Payments";
import { Pricing } from "./pages/Pricing";
import { AreaAlerts } from "./pages/AreaAlerts";
import { Notifications } from "./pages/Notifications";
import { Plans } from "./pages/Plans";
import { Locations } from "./pages/Locations";
import { VehicleCategories } from "./pages/VehicleCategories";
import { VehicleBrands } from "./pages/VehicleBrands";
import { Promotions } from "./pages/Promotions";
import { SpecialCoupons } from "./pages/SpecialCoupons";
import { Reports } from "./pages/Reports";
import { ContentManagement } from "./pages/ContentManagement";
import { Leads } from "./pages/Leads";
import { Referrals } from "./pages/Referrals";
import { RoleManagement } from "./pages/RoleManagement"; // Role Management Dashboard Page

/**
 * Admin module router (base path /admin). Login is public; everything else
 * is wrapped in AdminLayout behind the auth guard.
 */
export function AdminApp() {
  return (
    <RouteErrorBoundary homePath="/admin" homeLabel="admin home">
      <Routes>
        <Route path="login" element={<Login />} />

        <Route
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Outlet />
              </AdminLayout>
            </ProtectedRoute>
          }>
          <Route index element={<PermissionGuard permission="dashboard"><Dashboard /></PermissionGuard>} />
          <Route path="bookings" element={<PermissionGuard permission="bookings"><Bookings /></PermissionGuard>} />
          <Route path="agents" element={<PermissionGuard permission="agents"><Agents /></PermissionGuard>} />
          <Route path="agent-verification" element={<PermissionGuard permission="agents"><AgentVerification /></PermissionGuard>} />
          <Route path="agents/:id" element={<PermissionGuard permission="agents"><AgentDetail /></PermissionGuard>} />
          <Route path="customers" element={<PermissionGuard permission="customers"><Customers /></PermissionGuard>} />
          <Route path="customers/:id" element={<PermissionGuard permission="customers"><CustomerDetail /></PermissionGuard>} />
          <Route path="payments" element={<PermissionGuard permission="payments"><Payments /></PermissionGuard>} />
          <Route path="pricing" element={<PermissionGuard permission="pricing"><Pricing /></PermissionGuard>} />
          <Route path="area-alerts" element={<PermissionGuard permission="area-alerts"><AreaAlerts /></PermissionGuard>} />
          <Route path="notifications" element={<PermissionGuard permission="notifications"><Notifications /></PermissionGuard>} />
          <Route path="plans" element={<PermissionGuard permission="plans"><Plans /></PermissionGuard>} />
          <Route path="locations" element={<PermissionGuard permission="locations"><Locations /></PermissionGuard>} />
          <Route path="vehicle-categories" element={<PermissionGuard permission="vehicle-categories"><VehicleCategories /></PermissionGuard>} />
          <Route path="vehicle-brands" element={<PermissionGuard permission="vehicle-brands"><VehicleBrands /></PermissionGuard>} />
          <Route path="promotions" element={<PermissionGuard permission="promotions"><Promotions /></PermissionGuard>} />
          <Route path="special-coupons" element={<PermissionGuard permission="special-coupons"><SpecialCoupons /></PermissionGuard>} />
          <Route path="referrals" element={<PermissionGuard permission="referrals"><Referrals /></PermissionGuard>} />
          <Route path="content" element={<PermissionGuard permission="content"><ContentManagement /></PermissionGuard>} />
          <Route path="leads" element={<PermissionGuard permission="leads"><Leads /></PermissionGuard>} />
          <Route path="reports" element={<PermissionGuard permission="reports"><Reports /></PermissionGuard>} />
          <Route path="roles" element={<PermissionGuard permission="roles"><RoleManagement /></PermissionGuard>} />
        </Route>

        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </RouteErrorBoundary>
  );
}
