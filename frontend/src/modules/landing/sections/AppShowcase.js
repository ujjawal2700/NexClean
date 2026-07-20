import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CalendarCheck, Repeat, Bell, Wallet, History, Apple, Play } from "lucide-react";
import { Section } from "@shared/components/layout/Section";
import { Badge } from "@shared/ui/Badge";
import { Button } from "@shared/ui/Button";
import { SplitReveal } from "@shared/motion/SplitReveal";
import { Reveal } from "@shared/motion/Reveal";
import { PhoneMockup } from "@shared/components/visual/PhoneMockup";
import { useSiteContent } from "@shared/hooks/useSiteContent";
// Icons for the quick-action mockup grid and the feature pills (labels are editable).
const FEATURE_ICONS = [CalendarCheck, Repeat, Bell, Wallet, History];
const FEATURES = [
    { icon: CalendarCheck, label: "Booking" },
    { icon: Repeat, label: "Subscriptions" },
    { icon: Bell, label: "Notifications" },
    { icon: Wallet, label: "Payments" },
    { icon: History, label: "Service history" },
];
function HomeScreen() {
    return (_jsxs("div", { className: "flex h-full flex-col p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[10px] text-muted", children: "Good morning" }), _jsx("p", { className: "font-display text-sm font-semibold text-ink", children: "Your garage" })] }), _jsx("span", { className: "size-8 rounded-full bg-primary/10" })] }), _jsxs("div", { className: "mt-3 rounded-2xl bg-gradient-to-br from-primary to-accent p-3 text-white", children: [_jsx("p", { className: "text-[10px] opacity-80", children: "Next wash" }), _jsx("p", { className: "text-sm font-semibold", children: "Tomorrow \u00B7 9:00 AM" }), _jsxs("div", { className: "mt-2 flex items-center gap-1 text-[10px]", children: [_jsx(CalendarCheck, { className: "size-3" }), " Confirmed"] })] }), _jsx("p", { className: "mt-4 text-[10px] font-medium uppercase tracking-wide text-muted", children: "Quick actions" }), _jsx("div", { className: "mt-2 grid grid-cols-3 gap-2", children: FEATURES.slice(0, 6).map((f) => (_jsx("div", { className: "grid aspect-square place-items-center rounded-xl border border-line bg-surface", children: _jsx(f.icon, { className: "size-4 text-primary" }) }, f.label))) }), _jsxs("div", { className: "mt-auto rounded-2xl border border-line bg-surface p-3", children: [_jsx("p", { className: "text-[10px] text-muted", children: "This month" }), _jsx("p", { className: "text-sm font-semibold text-ink", children: "3 washes \u00B7 \u20B91,197 saved" })] })] }));
}
export function AppShowcase() {
    const { appShowcase: c } = useSiteContent().landing;
    const features = c.features.map((label, i) => ({ label, Icon: FEATURE_ICONS[i] ?? CalendarCheck }));
    return (_jsx(Section, { id: "app", className: "relative overflow-hidden border-t border-line/60", children: _jsxs("div", { className: "grid items-center gap-16 lg:grid-cols-2", children: [_jsxs("div", { children: [_jsx(Reveal, { children: _jsx(Badge, { children: c.badge }) }), _jsx(SplitReveal, { onScroll: true, as: "h2", text: c.title, className: "mt-5 max-w-[14ch] text-4xl text-ink sm:text-5xl" }), _jsx(Reveal, { delay: 0.1, children: _jsx("p", { className: "mt-6 max-w-md text-lg text-muted", children: c.body }) }), _jsx(Reveal, { delay: 0.15, children: _jsx("div", { className: "mt-8 flex flex-wrap gap-3", children: features.map((f) => (_jsxs("span", { className: "inline-flex items-center gap-2 rounded-pill border border-line bg-surface/70 px-4 py-2 text-sm text-ink-soft", children: [_jsx(f.Icon, { className: "size-4 text-primary" }), " ", f.label] }, f.label))) }) }), _jsx(Reveal, { delay: 0.25, children: _jsxs("div", { className: "mt-8 flex flex-wrap gap-3", children: [_jsxs(Button, { variant: "primary", disabled: true, title: "Coming soon", children: [_jsx(Apple, { className: "size-5" }), " App Store \u00B7 Coming soon"] }), _jsxs(Button, { variant: "outline", disabled: true, title: "Coming soon", children: [_jsx(Play, { className: "size-5 fill-current" }), " Google Play \u00B7 Coming soon"] })] }) })] }), _jsx(Reveal, { children: _jsxs("div", { className: "relative mx-auto flex h-[420px] items-center justify-center", children: [_jsx("div", { className: "absolute z-10", style: { animation: "float-y 6s ease-in-out infinite" }, children: _jsx(PhoneMockup, { children: _jsx(HomeScreen, {}) }) }), _jsx("div", { className: "absolute -right-2 top-6 hidden rotate-6 opacity-90 sm:block", style: { animation: "float-y 7s ease-in-out infinite 0.5s" }, children: _jsx(PhoneMockup, { className: "w-[200px] scale-90", children: _jsx("div", { className: "grid h-full place-items-center bg-gradient-to-br from-primary to-accent p-6 text-center text-white", children: _jsxs("div", { children: [_jsx(Bell, { className: "mx-auto size-8" }), _jsx("p", { className: "mt-3 text-sm font-semibold", children: "NexClean Nearby" }), _jsx("p", { className: "mt-1 text-[11px] opacity-85", children: "A specialist is in your area" })] }) }) }) })] }) })] }) }));
}
