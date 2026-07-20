import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
/** Base shimmer block — compose with width/height classes for any shape. */
export function Skeleton({ className, ...props }) {
    return (_jsx("div", { "aria-hidden": true, className: cn("rounded-xl bg-surface-muted", "bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.85)_50%,transparent_70%)]", "bg-[length:200%_100%] motion-safe:animate-shimmer", className), ...props }));
}
/** One or more shimmer text lines; the last line is shorter when lines > 1. */
export function SkeletonText({ lines = 1, className }) {
    return (_jsx("div", { className: cn("space-y-2", className), "aria-hidden": true, children: Array.from({ length: lines }).map((_, i) => (_jsx(Skeleton, { className: cn("h-3.5", i === lines - 1 && lines > 1 ? "w-2/3" : "w-full") }, i))) }));
}
/** Stat-card grid placeholders — icon chip + value + label, matching StatCard/GlassCard layout. */
export function SkeletonStatCards({ count = 4 }) {
    return (_jsx(_Fragment, { children: Array.from({ length: count }).map((_, i) => (_jsxs(GlassCard, { className: "flex items-center gap-3", children: [_jsx(Skeleton, { className: "size-11 shrink-0 rounded-2xl" }), _jsxs("div", { className: "min-w-0 flex-1 space-y-2", children: [_jsx(Skeleton, { className: "h-5 w-16" }), _jsx(Skeleton, { className: "h-3 w-20" })] })] }, i))) }));
}
/** Table row placeholders — drop inside an existing <tbody>. */
export function SkeletonTableRows({ rows = 6, cols = 6 }) {
    return (_jsx(_Fragment, { children: Array.from({ length: rows }).map((_, r) => (_jsx("tr", { className: "border-t border-line/70", children: Array.from({ length: cols }).map((_, c) => (_jsx("td", { className: "px-2 py-3", children: _jsx(Skeleton, { className: "h-4 w-full max-w-32" }) }, c))) }, r))) }));
}
/** Stacked list-card placeholders — image/icon block + lines + trailing value, matching GlassCard list rows. */
export function SkeletonListCards({ count = 3 }) {
    return (_jsx("div", { className: "space-y-4", children: Array.from({ length: count }).map((_, i) => (_jsxs(GlassCard, { className: "flex flex-col gap-4 sm:flex-row sm:items-center", children: [_jsx(Skeleton, { className: "h-16 w-24 shrink-0 rounded-2xl" }), _jsxs("div", { className: "min-w-0 flex-1 space-y-2.5", children: [_jsx(Skeleton, { className: "h-4 w-1/3" }), _jsx(Skeleton, { className: "h-3 w-1/2" }), _jsx(Skeleton, { className: "h-3 w-2/5" })] }), _jsx(Skeleton, { className: "h-6 w-16 shrink-0 self-start sm:self-center" })] }, i))) }));
}
