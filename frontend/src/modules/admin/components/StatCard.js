import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import {} from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { cn } from "@shared/lib/utils";
export function StatCard({ icon: Icon, label, value, delta, trend }) {
    return (_jsxs(GlassCard, { className: "flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-muted", children: label }), _jsx("p", { className: "mt-1.5 font-display text-2xl font-semibold text-ink", children: value }), delta && (_jsxs("p", { className: cn("mt-1 text-xs font-medium", trend === "down" ? "text-red-500" : "text-emerald-600"), children: [trend === "down" ? "▼" : "▲", " ", delta] }))] }), _jsx("span", { className: "grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary", children: _jsx(Icon, { className: "size-5" }) })] }));
}
