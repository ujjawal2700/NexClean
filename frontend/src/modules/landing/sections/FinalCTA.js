import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Section } from "@shared/components/layout/Section";
import { MagneticButton } from "@shared/ui/MagneticButton";
import { Button } from "@shared/ui/Button";
import { SplitReveal } from "@shared/motion/SplitReveal";
import { Reveal } from "@shared/motion/Reveal";
import { useSectionLink } from "@shared/hooks/useSectionLink";
import { useSiteContent } from "@shared/hooks/useSiteContent";
export function FinalCTA() {
    const navigate = useNavigate();
    const goToSection = useSectionLink();
    const { finalCta: c } = useSiteContent().landing;
    return (_jsx(Section, { bleed: true, className: "px-6 py-24", children: _jsxs("div", { className: "relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#1a2a6c] via-primary to-[#0a1f5c] px-8 py-20 text-center shadow-[var(--shadow-lift)] sm:px-16", children: [_jsx("div", { className: "pointer-events-none absolute -left-20 -top-20 size-72 rounded-full opacity-50 blur-3xl", style: { background: "radial-gradient(circle, #00C2FF, transparent 70%)" } }), _jsx("div", { className: "pointer-events-none absolute -bottom-24 -right-16 size-80 rounded-full opacity-40 blur-3xl", style: { background: "radial-gradient(circle, #6EA8FF, transparent 70%)" } }), _jsx("div", { className: "bg-grid pointer-events-none absolute inset-0 opacity-10" }), _jsxs("div", { className: "relative", children: [_jsx(SplitReveal, { onScroll: true, as: "h2", text: c.title, className: "mx-auto max-w-[18ch] text-balance text-4xl text-white sm:text-5xl lg:text-6xl" }), _jsx(Reveal, { delay: 0.1, children: _jsx("p", { className: "mx-auto mt-6 max-w-md text-lg text-white/80", children: c.body }) }), _jsx(Reveal, { delay: 0.2, children: _jsxs("div", { className: "mt-10 flex flex-wrap justify-center gap-3", children: [_jsxs(MagneticButton, { size: "lg", className: "bg-none bg-white text-primary hover:bg-white", onClick: () => navigate("/app/book"), children: [c.primaryCta, " ", _jsx(ArrowRight, { className: "size-5" })] }), _jsx(Button, { size: "lg", variant: "glass", className: "text-white", onClick: () => goToSection("#plans"), children: c.secondaryCta })] }) })] })] }) }));
}
