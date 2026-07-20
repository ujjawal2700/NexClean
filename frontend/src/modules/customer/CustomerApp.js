import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
/**
 * Customer module router (base path /app). Login is public; everything else
 * is wrapped in CustomerLayout behind the auth guard.
 */
export function CustomerApp() {
    return (_jsx(RouteErrorBoundary, { homePath: "/app", homeLabel: "customer home", children: _jsxs(Routes, { children: [_jsx(Route, { path: "login", element: _jsx(Login, {}) }), _jsx(Route, { path: "signup", element: _jsx(Signup, {}) }), _jsx(Route, { path: "coming-soon", element: _jsx(ComingSoon, {}) }), _jsxs(Route, { element: _jsx(ProtectedRoute, { children: _jsx(CustomerLayout, { children: _jsx(Outlet, {}) }) }), children: [_jsx(Route, { index: true, element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "book", element: _jsx(BookingFlow, {}) }), _jsx(Route, { path: "bookings", element: _jsx(Bookings, {}) }), _jsx(Route, { path: "plans", element: _jsx(Subscriptions, {}) }), _jsx(Route, { path: "notifications", element: _jsx(Notifications, {}) }), _jsx(Route, { path: "profile", element: _jsx(Profile, {}) }), _jsx(Route, { path: "profile/edit", element: _jsx(EditProfile, {}) }), _jsx(Route, { path: "profile/refer", element: _jsx(ReferEarn, {}) }), _jsx(Route, { path: "wallet", element: _jsx(Wallet, {}) }), _jsx(Route, { path: "profile/vehicles", element: _jsx(Vehicles, {}) }), _jsx(Route, { path: "profile/addresses", element: _jsx(Addresses, {}) }), _jsx(Route, { path: "help", element: _jsx(HelpSupport, {}) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/app", replace: true }) })] }) }));
}
