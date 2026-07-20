import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ChevronDown } from "lucide-react";
import { StaticPageShell } from "../components/StaticPageShell";
import { useSiteContent } from "@shared/hooks/useSiteContent";
export function Help() {
    const { help } = useSiteContent();
    return (_jsx(StaticPageShell, { eyebrow: help.eyebrow, title: help.title, subtitle: help.subtitle, children: _jsx("div", { className: "space-y-3", children: help.faqs.map((f) => (_jsxs("details", { className: "group rounded-card border border-line bg-surface/60 p-5 open:bg-surface", children: [_jsxs("summary", { className: "flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink", children: [f.q, _jsx(ChevronDown, { className: "size-4 shrink-0 text-muted transition-transform group-open:rotate-180" })] }), _jsx("p", { className: "mt-3 text-sm leading-relaxed text-muted", children: f.a })] }, f.q))) }) }));
}
