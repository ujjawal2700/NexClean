import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Section } from "@shared/components/layout/Section";
import { Container } from "@shared/components/layout/Container";
import { useCountUp } from "@shared/hooks/useCountUp";
import { useSiteContent } from "@shared/hooks/useSiteContent";
function StatItem({ stat }) {
    const factor = stat.decimals ? 10 ** stat.decimals : 1;
    const { ref, value } = useCountUp(Math.round(stat.value * factor));
    const display = stat.decimals
        ? (value / factor).toFixed(stat.decimals)
        : value.toLocaleString("en-IN");
    return (_jsxs("div", { className: "text-center", children: [_jsxs("p", { className: "font-display text-5xl font-semibold text-white sm:text-6xl", children: [_jsx("span", { ref: ref, children: display }), _jsx("span", { className: "text-accent", children: stat.suffix })] }), _jsx("p", { className: "mt-2 text-sm uppercase tracking-[0.18em] text-white/60", children: stat.label })] }));
}
export function Stats() {
    const { stats } = useSiteContent().landing;
    return (_jsx(Section, { bleed: true, className: "py-0", children: _jsxs("div", { className: "relative overflow-hidden bg-ink", children: [_jsx("div", { className: "pointer-events-none absolute inset-0 opacity-60", style: { background: "radial-gradient(ellipse at 50% 0%, rgba(79,124,255,0.35), transparent 60%)" } }), _jsx(Container, { className: "relative grid grid-cols-2 gap-y-12 py-20 lg:grid-cols-4", children: stats.items.map((s) => (_jsx(StatItem, { stat: s }, s.label))) })] }) }));
}
