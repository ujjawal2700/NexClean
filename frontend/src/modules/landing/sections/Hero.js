import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Play, MapPin, Car, ShieldCheck, Star } from "lucide-react";
import { Aurora } from "@shared/components/visual/Aurora";
import { Badge } from "@shared/ui/Badge";
import { MagneticButton } from "@shared/ui/MagneticButton";
import { Button } from "@shared/ui/Button";
import { Container } from "@shared/components/layout/Container";
import { SplitReveal } from "@shared/motion/SplitReveal";
import { Reveal } from "@shared/motion/Reveal";
import { easing } from "@shared/theme/tokens";
import { useSectionLink } from "@shared/hooks/useSectionLink";
import { useSiteContent } from "@shared/hooks/useSiteContent";
const VEHICLES = ["Hatchback", "Sedan", "SUV", "Luxury"];
const TRUST_ICONS = [ShieldCheck, Star, MapPin];
export function Hero() {
    const navigate = useNavigate();
    const goToSection = useSectionLink();
    const { hero } = useSiteContent().landing;
    return (_jsxs("section", { className: "relative flex min-h-dvh items-center overflow-hidden pt-28 pb-16", children: [_jsx(Aurora, {}), _jsx("div", { className: "bg-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" }), _jsxs(Container, { className: "relative z-10 grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]", children: [_jsxs("div", { children: [_jsx(Reveal, { children: _jsxs(Badge, { children: [_jsx("span", { className: "size-1.5 rounded-full bg-accent" }), hero.badge] }) }), _jsx(SplitReveal, { as: "h1", text: hero.title, className: "mt-6 max-w-[14ch] text-5xl leading-[1.02] text-ink sm:text-6xl lg:text-7xl" }), _jsx(Reveal, { delay: 0.5, children: _jsx("p", { className: "mt-7 max-w-md text-lg text-muted", children: hero.subtitle }) }), _jsx(Reveal, { delay: 0.65, children: _jsxs("div", { className: "mt-9 flex flex-wrap items-center gap-3", children: [_jsx(MagneticButton, { size: "lg", onClick: () => navigate("/app/book"), children: hero.primaryCta }), _jsxs(Button, { variant: "outline", size: "lg", onClick: () => goToSection("#how-it-works"), children: [_jsx(Play, { className: "size-4 fill-current" }), hero.secondaryCta] })] }) }), _jsx(Reveal, { delay: 0.8, children: _jsx("div", { className: "mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-muted", children: hero.trust.map((item, i) => {
                                        const Icon = TRUST_ICONS[i] ?? ShieldCheck;
                                        return (_jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(Icon, { className: "size-4 text-primary" }), " ", item] }, item));
                                    }) }) })] }), _jsx(motion.div, { initial: { opacity: 0, y: 40, rotateX: 8 }, animate: { opacity: 1, y: 0, rotateX: 0 }, transition: { duration: 1, delay: 0.4, ease: easing.outExpo }, className: "relative mx-auto w-full max-w-sm [perspective:1200px]", children: _jsxs("div", { style: { animation: "float-y 6s ease-in-out infinite" }, children: [_jsxs("div", { className: "glass rounded-card p-6 shadow-[var(--shadow-lift)]", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-sm font-semibold text-ink", children: "Book in 30 seconds" }), _jsx("span", { className: "rounded-pill bg-primary/10 px-3 py-1 text-xs font-medium text-primary", children: "Doorstep" })] }), _jsx("p", { className: "mt-5 text-xs font-medium uppercase tracking-[0.18em] text-muted", children: "Your vehicle" }), _jsx("div", { className: "mt-3 flex flex-wrap gap-2", children: VEHICLES.map((v, i) => (_jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm " +
                                                    (i === 1
                                                        ? "border-primary/40 bg-primary/10 text-primary"
                                                        : "border-line bg-surface/60 text-ink-soft"), children: [_jsx(Car, { className: "size-3.5" }), " ", v] }, v))) }), _jsxs("div", { className: "mt-6 space-y-3", children: [_jsx(Row, { label: "Package", value: "Premium Detail" }), _jsx(Row, { label: "When", value: "Tomorrow \u00B7 9:00 AM" }), _jsx(Row, { label: "Where", value: "Green Valley Society" })] }), _jsxs("div", { className: "mt-6 flex items-center justify-between border-t border-line pt-5", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-muted", children: "Total" }), _jsx("p", { className: "font-display text-2xl font-semibold text-ink", children: "\u20B9399" })] }), _jsx(Button, { children: "Confirm booking" })] })] }), _jsxs(motion.div, { initial: { opacity: 0, x: -16 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.7, delay: 1.1, ease: easing.outExpo }, className: "glass absolute -left-6 bottom-16 flex items-center gap-3 rounded-pill px-4 py-2.5 shadow-[var(--shadow-soft)]", children: [_jsxs("span", { className: "relative flex size-2.5", children: [_jsx("span", { className: "absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-70" }), _jsx("span", { className: "relative inline-flex size-2.5 rounded-full bg-accent" })] }), _jsx("span", { className: "text-xs font-medium text-ink", children: "Booking confirmed \u00B7 Tomorrow 9:00 AM" })] })] }) })] })] }));
}
function Row({ label, value }) {
    return (_jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsx("span", { className: "text-muted", children: label }), _jsx("span", { className: "font-medium text-ink", children: value })] }));
}
