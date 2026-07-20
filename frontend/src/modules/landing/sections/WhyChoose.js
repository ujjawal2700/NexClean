import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BadgeCheck, Clock, Leaf, Home, Lock, CalendarClock, Sparkles, ShieldCheck, } from "lucide-react";
import { Section } from "@shared/components/layout/Section";
import { SectionHeading } from "@shared/ui/SectionHeading";
import { GlassCard } from "@shared/ui/GlassCard";
import { RevealGroup, RevealItem } from "@shared/motion/Reveal";
import { useSiteContent } from "@shared/hooks/useSiteContent";
const REASON_ICONS = [BadgeCheck, Clock, Leaf, Home, Lock, CalendarClock, Sparkles, ShieldCheck];
export function WhyChoose() {
    const { whyChoose: c } = useSiteContent().landing;
    const reasons = c.reasons.map((r, i) => ({ ...r, Icon: REASON_ICONS[i] ?? BadgeCheck }));
    return (_jsxs(Section, { id: "benefits", className: "border-t border-line/60 bg-surface-muted/40", children: [_jsx(SectionHeading, { align: "center", eyebrow: c.eyebrow, title: c.title, subtitle: c.subtitle }), _jsx(RevealGroup, { className: "mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4", children: reasons.map((r) => (_jsx(RevealItem, { children: _jsxs(GlassCard, { interactive: true, className: "h-full", children: [_jsx("span", { className: "grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-[var(--shadow-glow)]", children: _jsx(r.Icon, { className: "size-6" }) }), _jsx("h3", { className: "mt-5 font-display text-lg font-semibold text-ink", children: r.title }), _jsx("p", { className: "mt-1.5 text-sm text-muted", children: r.body })] }) }, r.title))) })] }));
}
