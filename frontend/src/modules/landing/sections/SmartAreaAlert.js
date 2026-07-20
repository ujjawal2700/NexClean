import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { motion, useReducedMotion } from "motion/react";
import { Car, Bell, MapPin } from "lucide-react";
import { Section } from "@shared/components/layout/Section";
import { Badge } from "@shared/ui/Badge";
import { Button } from "@shared/ui/Button";
import { SplitReveal } from "@shared/motion/SplitReveal";
import { Reveal } from "@shared/motion/Reveal";
import { useSiteContent } from "@shared/hooks/useSiteContent";
// Nearby cars that "light up" when the specialist enters the area
const CARS = [
    { top: "22%", left: "24%", delay: 0.6 },
    { top: "30%", left: "70%", delay: 1.0 },
    { top: "62%", left: "30%", delay: 1.4 },
    { top: "70%", left: "66%", delay: 1.8 },
    { top: "48%", left: "82%", delay: 2.2 },
];
function MapStage() {
    const reduceMotion = useReducedMotion();
    return (_jsxs("div", { className: "relative aspect-square w-full overflow-hidden rounded-card border border-line bg-gradient-to-br from-surface to-surface-muted shadow-[var(--shadow-lift)]", children: [_jsx("div", { className: "bg-grid absolute inset-0 opacity-60" }), _jsxs("div", { className: "absolute inset-0", children: [_jsx("div", { className: "absolute left-0 right-0 top-[38%] h-3 bg-line/70" }), _jsx("div", { className: "absolute left-0 right-0 top-[72%] h-3 bg-line/70" }), _jsx("div", { className: "absolute bottom-0 top-0 left-[30%] w-3 bg-line/70" }), _jsx("div", { className: "absolute bottom-0 top-0 left-[68%] w-3 bg-line/70" })] }), _jsxs("span", { className: "glass absolute left-4 top-4 rounded-pill px-3 py-1.5 text-xs font-medium text-ink", children: [_jsx(MapPin, { className: "mr-1 inline size-3.5 text-primary" }), "Green Valley Society"] }), !reduceMotion &&
                [0, 1].map((i) => (_jsx(motion.span, { className: "absolute left-1/2 top-1/2 rounded-full border-2 border-primary/40", style: { translateX: "-50%", translateY: "-50%" }, animate: { width: ["0px", "92%"], height: ["0px", "92%"], opacity: [0.5, 0] }, transition: { duration: 3, repeat: Infinity, delay: i * 1.5, ease: "easeOut" } }, i))), _jsx("div", { className: "absolute left-1/2 top-1/2 size-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full", style: { background: "radial-gradient(circle, rgba(79,124,255,0.16), transparent 70%)" } }), CARS.map((c, i) => (_jsx(motion.div, { className: "absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl", style: { top: c.top, left: c.left }, initial: { opacity: 0.45 }, animate: reduceMotion
                    ? { opacity: 1, backgroundColor: "#4F7CFF", color: "#ffffff" }
                    : {
                        opacity: [0.45, 1, 0.45],
                        scale: [1, 1.12, 1],
                        backgroundColor: ["#eef2fb", "#4F7CFF", "#eef2fb"],
                        color: ["#70798B", "#ffffff", "#70798B"],
                    }, transition: reduceMotion
                    ? { duration: 0.3 }
                    : { duration: 2.4, repeat: Infinity, delay: c.delay, ease: "easeInOut" }, children: _jsx(Car, { className: "size-4" }) }, i))), _jsx("div", { className: "absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2", children: _jsxs("span", { className: "relative grid size-12 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-[var(--shadow-glow)]", children: [_jsx("span", { className: "absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-40" }), _jsx(MapPin, { className: "relative size-5" })] }) })] }));
}
function PushCard() {
    return (_jsx(motion.div, { initial: { opacity: 0, y: 18, scale: 0.96 }, whileInView: { opacity: 1, y: 0, scale: 1 }, viewport: { once: true }, transition: { duration: 0.7, delay: 0.3 }, className: "glass absolute -bottom-6 left-1/2 w-[88%] max-w-sm -translate-x-1/2 rounded-card p-4 shadow-[var(--shadow-lift)] sm:-right-8 sm:left-auto sm:bottom-10 sm:translate-x-0", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("span", { className: "grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-white", children: _jsx(Bell, { className: "size-4" }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm font-semibold text-ink", children: "\uD83D\uDE97 NexClean Nearby" }), _jsx("p", { className: "mt-1 text-xs leading-relaxed text-muted", children: "A cleaning specialist is servicing vehicles in Green Valley Society. Book within 30 minutes for priority service." }), _jsxs("div", { className: "mt-3 flex gap-2", children: [_jsx(Button, { size: "sm", className: "h-8 px-3 text-xs", children: "Book now" }), _jsx(Button, { size: "sm", variant: "ghost", className: "h-8 px-3 text-xs", children: "Remind me later" })] })] })] }) }));
}
export function SmartAreaAlert() {
    const { smartAreaAlert: c } = useSiteContent().landing;
    return (_jsxs(Section, { id: "nearby", className: "relative overflow-hidden border-t border-line/60", children: [_jsx("div", { className: "pointer-events-none absolute inset-0 opacity-70", style: { background: "radial-gradient(ellipse at 70% 30%, rgba(110,168,255,0.12), transparent 60%)" } }), _jsxs("div", { className: "relative grid items-center gap-16 lg:grid-cols-2", children: [_jsxs("div", { children: [_jsx(Reveal, { children: _jsxs(Badge, { children: [_jsx("span", { className: "size-1.5 rounded-full bg-accent" }), c.badge] }) }), _jsx(SplitReveal, { onScroll: true, as: "h2", text: c.title, className: "mt-5 max-w-[16ch] text-4xl text-ink sm:text-5xl" }), _jsx(Reveal, { delay: 0.1, children: _jsx("p", { className: "mt-6 max-w-md text-lg text-muted", children: c.body }) }), _jsx(Reveal, { delay: 0.2, children: _jsx("ul", { className: "mt-8 space-y-3", children: c.features.map((item) => (_jsxs("li", { className: "flex items-start gap-3 text-ink-soft", children: [_jsx("span", { className: "mt-2 size-1.5 shrink-0 rounded-full bg-gradient-to-r from-primary to-accent" }), item] }, item))) }) })] }), _jsx(Reveal, { children: _jsxs("div", { className: "relative mx-auto w-full max-w-md pb-10 sm:pb-0", children: [_jsx(MapStage, {}), _jsx(PushCard, {})] }) })] })] }));
}
