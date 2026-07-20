import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { motion } from "motion/react";
/** Lightweight CSS/SVG-free bar chart — no charting dependency. */
export function BarChart({ data, format }) {
    const max = Math.max(...data.map((d) => d.value), 1);
    return (_jsx("div", { className: "flex h-48 items-end gap-3", children: data.map((d, i) => (_jsxs("div", { className: "flex flex-1 flex-col items-center gap-2", children: [_jsx("div", { className: "flex w-full flex-1 items-end", children: _jsx(motion.div, { initial: { height: 0 }, whileInView: { height: `${(d.value / max) * 100}%` }, viewport: { once: true }, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] }, className: "group relative w-full rounded-t-lg bg-gradient-to-t from-primary to-accent", children: _jsx("span", { className: "absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-ink opacity-0 transition-opacity group-hover:opacity-100", children: format ? format(d.value) : d.value }) }) }), _jsx("span", { className: "text-xs text-muted", children: d.label })] }, `${d.label}-${i}`))) }));
}
