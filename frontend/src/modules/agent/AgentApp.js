import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { RouteErrorBoundary } from "@shared/components/RouteErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { KycGate } from "./components/KycGate";
import { AgentLayout } from "./components/AgentLayout";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Dashboard } from "./pages/Dashboard";
import { Jobs } from "./pages/Jobs";
import { JobDetail } from "./pages/JobDetail";
import { Earnings } from "./pages/Earnings";
import { Profile } from "./pages/Profile";
import { EditProfile } from "./pages/EditProfile";
import { HelpSupport } from "./pages/HelpSupport";
/**
 * Agent module router (base path /agent). Login is public; everything else
 * is wrapped in AgentLayout behind the auth guard.
 */
export function AgentApp() {
    return (_jsx(RouteErrorBoundary, { homePath: "/agent", homeLabel: "cleaner home", children: _jsxs(Routes, { children: [_jsx(Route, { path: "login", element: _jsx(Login, {}) }), _jsx(Route, { path: "signup", element: _jsx(Signup, {}) }), _jsxs(Route, { element: _jsx(ProtectedRoute, { children: _jsx(KycGate, { children: _jsx(AgentLayout, { children: _jsx(Outlet, {}) }) }) }), children: [_jsx(Route, { index: true, element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "jobs", element: _jsx(Jobs, {}) }), _jsx(Route, { path: "jobs/:id", element: _jsx(JobDetail, {}) }), _jsx(Route, { path: "earnings", element: _jsx(Earnings, {}) }), _jsx(Route, { path: "profile", element: _jsx(Profile, {}) }), _jsx(Route, { path: "profile/edit", element: _jsx(EditProfile, {}) }), _jsx(Route, { path: "help", element: _jsx(HelpSupport, {}) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/agent", replace: true }) })] }) }));
}
