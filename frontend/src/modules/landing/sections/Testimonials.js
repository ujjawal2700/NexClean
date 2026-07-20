import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Star, Quote } from "lucide-react";
import { Section } from "@shared/components/layout/Section";
import { SectionHeading } from "@shared/ui/SectionHeading";
import { GlassCard } from "@shared/ui/GlassCard";
import { RevealGroup, RevealItem } from "@shared/motion/Reveal";
import { useSiteContent } from "@shared/hooks/useSiteContent";
export function Testimonials() {
    const { testimonials: c } = useSiteContent().landing;
    return (_jsxs(Section, { id: "reviews", className: "border-t border-line/60 bg-surface-muted/40", children: [_jsx(SectionHeading, { align: "center", eyebrow: c.eyebrow, title: c.title, subtitle: c.subtitle }), _jsx(RevealGroup, { className: "mt-14 grid gap-6 lg:grid-cols-3", children: c.reviews.map((r) => (_jsx(RevealItem, { children: _jsxs(GlassCard, { className: "flex h-full flex-col", children: [_jsx(Quote, { className: "size-8 text-primary/30" }), _jsx("div", { className: "mt-3 flex gap-0.5", children: [...Array(5)].map((_, i) => (_jsx(Star, { className: "size-4 fill-primary text-primary" }, i))) }), _jsxs("p", { className: "mt-4 flex-1 text-ink-soft", children: ["\u201C", r.quote, "\u201D"] }), _jsxs("div", { className: "mt-6 flex items-center gap-3 border-t border-line/70 pt-5", children: [_jsx("span", { className: "grid size-11 place-items-center rounded-full bg-gradient-to-br from-primary to-accent font-display font-semibold text-white", children: r.initials }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold text-ink", children: r.name }), _jsx("p", { className: "text-sm text-muted", children: r.role })] })] })] }) }, r.name))) })] }));
}
