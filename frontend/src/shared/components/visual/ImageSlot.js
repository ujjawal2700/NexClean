import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@shared/lib/utils";
/**
 * Branded media placeholder. Renders the image when `src` is provided,
 * otherwise a tasteful gradient slot indicating what asset belongs here.
 * Lets the whole landing page ship before real photography/video exists.
 */
export function ImageSlot({ src, alt = "", label, className, rounded = "rounded-card" }) {
    if (src) {
        return (_jsx("img", { src: src, alt: alt, loading: "lazy", className: cn("h-full w-full object-cover", rounded, className) }));
    }
    return (_jsxs("div", { className: cn("relative grid h-full w-full place-items-center overflow-hidden border border-line/70", rounded, className), style: {
            background: "linear-gradient(135deg, #eef2fb 0%, #dfe8fb 45%, #d7ecfb 100%)",
        }, "aria-hidden": true, children: [_jsx("div", { className: "bg-grid absolute inset-0 opacity-50" }), _jsx("div", { className: "absolute -right-10 -top-10 size-48 rounded-full opacity-50 blur-2xl", style: { background: "radial-gradient(circle, #6EA8FF, transparent 70%)" } }), label && (_jsx("span", { className: "relative z-10 rounded-pill bg-surface/70 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-muted backdrop-blur", children: label }))] }));
}
