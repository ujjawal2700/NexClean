import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { RouteErrorBoundary } from "@shared/components/RouteErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminLayout } from "./components/AdminLayout";
import { PermissionGuard } from "./components/PermissionGuard";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Bookings } from "./pages/Bookings";
import { Dispatch } from "./pages/Dispatch";
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
import { ChatPanel } from "./pages/ChatPanel";
/**
 * Admin module router (base path /admin). Login is public; everything else
 * is wrapped in AdminLayout behind the auth guard.
 */
export function AdminApp() {
    return (_jsx(RouteErrorBoundary, { homePath: "/admin", homeLabel: "admin home", children: _jsxs(Routes, { children: [_jsx(Route, { path: "login", element: _jsx(Login, {}) }), _jsxs(Route, { element: _jsx(ProtectedRoute, { children: _jsx(AdminLayout, { children: _jsx(Outlet, {}) }) }), children: [_jsx(Route, { index: true, element: _jsx(PermissionGuard, { permission: "dashboard", children: _jsx(Dashboard, {}) }) }), _jsx(Route, { path: "bookings", element: _jsx(PermissionGuard, { permission: "bookings", children: _jsx(Bookings, {}) }) }), _jsx(Route, { path: "dispatch", element: _jsx(PermissionGuard, { permission: "bookings", children: _jsx(Dispatch, {}) }) }), _jsx(Route, { path: "agents", element: _jsx(PermissionGuard, { permission: "agents", children: _jsx(Agents, {}) }) }), _jsx(Route, { path: "agent-verification", element: _jsx(PermissionGuard, { permission: "agents", children: _jsx(AgentVerification, {}) }) }), _jsx(Route, { path: "agents/:id", element: _jsx(PermissionGuard, { permission: "agents", children: _jsx(AgentDetail, {}) }) }), _jsx(Route, { path: "customers", element: _jsx(PermissionGuard, { permission: "customers", children: _jsx(Customers, {}) }) }), _jsx(Route, { path: "customers/:id", element: _jsx(PermissionGuard, { permission: "customers", children: _jsx(CustomerDetail, {}) }) }), _jsx(Route, { path: "payments", element: _jsx(PermissionGuard, { permission: "payments", children: _jsx(Payments, {}) }) }), _jsx(Route, { path: "pricing", element: _jsx(PermissionGuard, { permission: "pricing", children: _jsx(Pricing, {}) }) }), _jsx(Route, { path: "area-alerts", element: _jsx(PermissionGuard, { permission: "area-alerts", children: _jsx(AreaAlerts, {}) }) }), _jsx(Route, { path: "notifications", element: _jsx(PermissionGuard, { permission: "notifications", children: _jsx(Notifications, {}) }) }), _jsx(Route, { path: "plans", element: _jsx(PermissionGuard, { permission: "plans", children: _jsx(Plans, {}) }) }), _jsx(Route, { path: "locations", element: _jsx(PermissionGuard, { permission: "locations", children: _jsx(Locations, {}) }) }), _jsx(Route, { path: "vehicle-categories", element: _jsx(PermissionGuard, { permission: "vehicle-categories", children: _jsx(VehicleCategories, {}) }) }), _jsx(Route, { path: "vehicle-brands", element: _jsx(PermissionGuard, { permission: "vehicle-brands", children: _jsx(VehicleBrands, {}) }) }), _jsx(Route, { path: "promotions", element: _jsx(PermissionGuard, { permission: "promotions", children: _jsx(Promotions, {}) }) }), _jsx(Route, { path: "special-coupons", element: _jsx(PermissionGuard, { permission: "special-coupons", children: _jsx(SpecialCoupons, {}) }) }), _jsx(Route, { path: "referrals", element: _jsx(PermissionGuard, { permission: "referrals", children: _jsx(Referrals, {}) }) }), _jsx(Route, { path: "content", element: _jsx(PermissionGuard, { permission: "content", children: _jsx(ContentManagement, {}) }) }), _jsx(Route, { path: "leads", element: _jsx(PermissionGuard, { permission: "leads", children: _jsx(Leads, {}) }) }), _jsx(Route, { path: "reports", element: _jsx(PermissionGuard, { permission: "reports", children: _jsx(Reports, {}) }) }), _jsx(Route, { path: "roles", element: _jsx(PermissionGuard, { permission: "roles", children: _jsx(RoleManagement, {}) }) }), _jsx(Route, { path: "support", element: _jsx(PermissionGuard, { permission: "chat", children: _jsx(ChatPanel, {}) }) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/admin", replace: true }) })] }) }));
}
