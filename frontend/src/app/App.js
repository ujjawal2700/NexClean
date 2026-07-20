import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { SmoothScroll } from "@shared/motion/SmoothScroll";
import { Grain } from "@shared/components/visual/Grain";
import { RouteScrollReset } from "@shared/components/RouteScrollReset";
import { RouteErrorBoundary } from "@shared/components/RouteErrorBoundary";
import { queryClient } from "@shared/lib/queryClient";
import { AppRoutes } from "@/routes";
/**
 * Root application shell: server-state provider + router + smooth scrolling.
 * The top-level boundary only catches crashes outside the customer/agent/admin
 * modules (e.g. marketing pages) — each module has its own inner boundary.
 */
export function App() {
    return (_jsx(QueryClientProvider, { client: queryClient, children: _jsx(BrowserRouter, { children: _jsxs(SmoothScroll, { children: [_jsx(Grain, {}), _jsx(RouteScrollReset, {}), _jsx(RouteErrorBoundary, { homePath: "/", homeLabel: "home page", children: _jsx(AppRoutes, {}) })] }) }) }));
}
