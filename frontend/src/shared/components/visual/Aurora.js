import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@shared/lib/utils";
/**
 * Soft drifting gradient-mesh atmosphere. Sits behind content to add depth
 * without the flatness of a solid background. Pointer-events disabled.
 */
export function Aurora({ className }) {
    return (_jsxs("div", { className: cn("pointer-events-none absolute inset-0 overflow-hidden", className), "aria-hidden": true, children: [_jsx("div", { className: "absolute -top-[20%] -left-[10%] size-[55vw] rounded-full blur-[110px] opacity-60", style: {
                    background: "radial-gradient(circle at 30% 30%, #6EA8FF 0%, transparent 65%)",
                    animation: "drift 18s ease-in-out infinite",
                } }), _jsx("div", { className: "absolute top-[10%] -right-[12%] size-[48vw] rounded-full blur-[120px] opacity-50", style: {
                    background: "radial-gradient(circle at 60% 40%, #00C2FF 0%, transparent 65%)",
                    animation: "drift 22s ease-in-out infinite reverse",
                } }), _jsx("div", { className: "absolute bottom-[-15%] left-[25%] size-[40vw] rounded-full blur-[120px] opacity-40", style: {
                    background: "radial-gradient(circle at 50% 50%, #4F7CFF 0%, transparent 60%)",
                    animation: "drift 26s ease-in-out infinite",
                } })] }));
}
