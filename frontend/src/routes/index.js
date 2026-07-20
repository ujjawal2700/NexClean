import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { LandingPage } from "@modules/landing/LandingPage";
import { PageLoader } from "@shared/components/PageLoader";
// Role modules are code-split: landing visitors never download
// customer/agent/admin bundles until those routes are visited.
const CustomerApp = lazy(() => import("@modules/customer/CustomerApp").then((m) => ({ default: m.CustomerApp })));
const AgentApp = lazy(() => import("@modules/agent/AgentApp").then((m) => ({ default: m.AgentApp })));
const AdminApp = lazy(() => import("@modules/admin/AdminApp").then((m) => ({ default: m.AdminApp })));
// Marketing/legal content pages — split out so they don't bloat the landing bundle.
const About = lazy(() => import("@modules/landing/pages/About").then((m) => ({ default: m.About })));
const Careers = lazy(() => import("@modules/landing/pages/Careers").then((m) => ({ default: m.Careers })));
const Contact = lazy(() => import("@modules/landing/pages/Contact").then((m) => ({ default: m.Contact })));
const Help = lazy(() => import("@modules/landing/pages/Help").then((m) => ({ default: m.Help })));
const Privacy = lazy(() => import("@modules/landing/pages/Privacy").then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import("@modules/landing/pages/Terms").then((m) => ({ default: m.Terms })));
const Refund = lazy(() => import("@modules/landing/pages/Refund").then((m) => ({ default: m.Refund })));
const Support = lazy(() => import("@modules/landing/pages/Support").then((m) => ({ default: m.Support })));
/**
 * Central route map. Each role owns a base path; real sub-routes are added
 * as each module is built. Auth/role guards will wrap these in later phases.
 */
export function AppRoutes() {
    return (_jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(LandingPage, {}) }), _jsx(Route, { path: "/about", element: _jsx(About, {}) }), _jsx(Route, { path: "/careers", element: _jsx(Careers, {}) }), _jsx(Route, { path: "/contact", element: _jsx(Contact, {}) }), _jsx(Route, { path: "/support", element: _jsx(Support, {}) }), _jsx(Route, { path: "/help", element: _jsx(Help, {}) }), _jsx(Route, { path: "/privacy", element: _jsx(Privacy, {}) }), _jsx(Route, { path: "/terms", element: _jsx(Terms, {}) }), _jsx(Route, { path: "/refund", element: _jsx(Refund, {}) }), _jsx(Route, { path: "/app/*", element: _jsx(CustomerApp, {}) }), _jsx(Route, { path: "/agent/*", element: _jsx(AgentApp, {}) }), _jsx(Route, { path: "/admin/*", element: _jsx(AdminApp, {}) }), _jsx(Route, { path: "*", element: _jsx(LandingPage, {}) })] }) }));
}
