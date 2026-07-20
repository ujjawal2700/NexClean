import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Aurora } from "@shared/components/visual/Aurora";
import { Badge } from "@shared/ui/Badge";
import { Logo } from "@shared/components/brand/Logo";
/**
 * Temporary landing surface for modules not yet built (customer/agent/admin).
 * Keeps routing wired and the design system visible until each phase begins.
 */
export function ModulePlaceholder({ module, phase, description }) {
    return (_jsxs("main", { className: "relative grid min-h-dvh place-items-center overflow-hidden px-6", children: [_jsx(Aurora, {}), _jsxs("div", { className: "relative z-10 max-w-xl text-center", children: [_jsx("div", { className: "mb-8 flex justify-center", children: _jsx(Logo, { variant: "full" }) }), _jsx(Badge, { className: "mb-6", children: phase }), _jsxs("h1", { className: "text-balance text-4xl md:text-5xl", children: [module, " ", _jsx("span", { className: "text-gradient", children: "module" })] }), _jsx("p", { className: "mx-auto mt-5 max-w-md text-pretty text-muted", children: description }), _jsxs(Link, { to: "/app", className: "mt-8 inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-ink", children: [_jsx(ArrowLeft, { className: "size-4" }), "Back to home"] })] })] }));
}
