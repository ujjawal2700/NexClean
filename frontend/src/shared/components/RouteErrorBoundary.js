import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from "react";
import { RefreshCw, Home, AlertTriangle } from "lucide-react";
import { Aurora } from "@shared/components/visual/Aurora";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Logo } from "@shared/components/brand/Logo";
/**
 * Catches render crashes within one module (customer/agent/admin/landing) and
 * shows an interactive recovery screen instead of a blank page. Navigation uses
 * a full page load (not the router) so a corrupted app/query-cache state is
 * fully reset, not just re-rendered.
 */
export class RouteErrorBoundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        console.error("Route crashed:", error, info.componentStack);
    }
    getHomeDetails = () => {
        if (this.props.homePath && this.props.homePath !== "/") {
            return { homePath: this.props.homePath, homeLabel: this.props.homeLabel || "home" };
        }
        const path = typeof window !== "undefined" ? window.location.pathname : "";
        if (path.startsWith("/agent")) {
            return { homePath: "/agent", homeLabel: "cleaner home" };
        }
        if (path.startsWith("/admin")) {
            return { homePath: "/admin", homeLabel: "admin home" };
        }
        return { homePath: "/app", homeLabel: "customer home" };
    };
    handleRefresh = () => {
        window.location.reload();
    };
    handleGoHome = () => {
        const { homePath } = this.getHomeDetails();
        window.location.href = homePath;
    };
    render() {
        if (!this.state.error)
            return this.props.children;
        const { homeLabel } = this.getHomeDetails();
        return (_jsxs("main", { className: "relative grid min-h-dvh place-items-center overflow-hidden px-6", children: [_jsx(Aurora, {}), _jsxs(GlassCard, { className: "relative z-10 max-w-md text-center", children: [_jsx("div", { className: "mb-6 flex justify-center", children: _jsx(Logo, { variant: "mark", className: "text-2xl" }) }), _jsx("span", { className: "mx-auto grid size-14 place-items-center rounded-2xl bg-red-500/10 text-red-500", children: _jsx(AlertTriangle, { className: "size-7" }) }), _jsx("h1", { className: "mt-5 font-display text-2xl text-ink", children: "Something went wrong" }), _jsxs("p", { className: "mt-2 text-sm text-muted", children: ["This page hit an unexpected error. You can try refreshing, or head back to your", " ", homeLabel, "."] }), _jsxs("div", { className: "mt-7 flex flex-col gap-3 sm:flex-row", children: [_jsxs(Button, { variant: "outline", className: "flex-1", onClick: this.handleRefresh, children: [_jsx(RefreshCw, { className: "size-4" }), " Refresh page"] }), _jsxs(Button, { className: "flex-1", onClick: this.handleGoHome, children: [_jsx(Home, { className: "size-4" }), " Go to home"] })] })] })] }));
    }
}
