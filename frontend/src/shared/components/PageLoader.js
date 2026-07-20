import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Logo } from "@shared/components/brand/Logo";
/** Full-screen branded fallback while a lazily-loaded module is fetched. */
export function PageLoader() {
    return (_jsx("div", { className: "grid min-h-dvh place-items-center bg-bg", role: "status", "aria-live": "polite", children: _jsxs("div", { className: "flex flex-col items-center gap-5", children: [_jsx(Logo, { variant: "mark", className: "text-[2rem] motion-safe:animate-pulse" }), _jsx("span", { className: "text-sm text-muted", children: "Loading\u2026" })] }) }));
}
