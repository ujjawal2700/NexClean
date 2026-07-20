import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import {} from "react";
import { cn } from "@shared/lib/utils";
/**
 * Reusable phone frame. Pass screen content as children.
 * Used by real-time tracking and the mobile app showcase.
 */
export function PhoneMockup({ children, className }) {
    return (_jsxs("div", { className: cn("relative aspect-[9/19] w-[260px] rounded-[2.5rem] border border-line bg-ink p-2.5 shadow-[var(--shadow-lift)]", className), children: [_jsx("div", { className: "absolute left-1/2 top-3 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-ink" }), _jsx("div", { className: "relative h-full w-full overflow-hidden rounded-[2rem] bg-bg", children: children })] }));
}
