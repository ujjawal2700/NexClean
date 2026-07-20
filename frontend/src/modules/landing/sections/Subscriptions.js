import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Section } from "@shared/components/layout/Section";
import { SectionHeading } from "@shared/ui/SectionHeading";
import { Button } from "@shared/ui/Button";
import { RevealGroup, RevealItem } from "@shared/motion/Reveal";
import { cn } from "@shared/lib/utils";
import { useSiteContent } from "@shared/hooks/useSiteContent";
const PLANS = [
    {
        name: "Basic",
        price: "₹999",
        cadence: "/month",
        tagline: "Perfect for the weekend driver.",
        features: ["4 washes / month", "Exterior + interior clean", "Doorstep service", "Free rescheduling"],
    },
    {
        name: "Premium",
        price: "₹1,799",
        cadence: "/month",
        tagline: "Our most popular plan.",
        features: [
            "8 washes / month",
            "Priority scheduling",
            "Premium detailing products",
            "Dedicated support",
            "10% off add-ons",
        ],
        featured: true,
    },
    {
        name: "Elite",
        price: "₹2,999",
        cadence: "/month",
        tagline: "For those who expect the best.",
        features: [
            "Unlimited priority washes",
            "Same-day booking guaranteed",
            "Top-rated specialists",
            "Complimentary interior detail",
            "Concierge support",
        ],
    },
];
export function Subscriptions() {
    const navigate = useNavigate();
    const { subscriptions: c } = useSiteContent().landing;
    return (_jsxs(Section, { id: "plans", className: "border-t border-line/60", children: [_jsx(SectionHeading, { align: "center", eyebrow: c.eyebrow, title: c.title, subtitle: c.subtitle }), _jsx(RevealGroup, { className: "mt-14 grid items-stretch gap-6 lg:grid-cols-3", children: PLANS.map((plan) => (_jsx(RevealItem, { children: _jsxs("div", { className: cn("relative flex h-full flex-col rounded-card border p-8 transition-transform duration-300", plan.featured
                            ? "border-primary/30 bg-gradient-to-br from-primary to-primary-soft text-white shadow-[var(--shadow-glow)] lg:-translate-y-4"
                            : "border-line bg-surface/70 shadow-[var(--shadow-soft)]"), children: [plan.featured && (_jsx("span", { className: "absolute right-6 top-6 rounded-pill bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur", children: "Most popular" })), _jsx("h3", { className: cn("font-display text-2xl font-semibold", plan.featured ? "text-white" : "text-ink"), children: plan.name }), _jsx("p", { className: cn("mt-1 text-sm", plan.featured ? "text-white/80" : "text-muted"), children: plan.tagline }), _jsxs("div", { className: "mt-6 flex items-end gap-1", children: [_jsx("span", { className: "font-display text-4xl font-semibold", children: plan.price }), _jsx("span", { className: cn("pb-1 text-sm", plan.featured ? "text-white/80" : "text-muted"), children: plan.cadence })] }), _jsx("ul", { className: "mt-7 space-y-3", children: plan.features.map((f) => (_jsxs("li", { className: "flex items-center gap-3 text-sm", children: [_jsx("span", { className: cn("grid size-5 shrink-0 place-items-center rounded-full", plan.featured ? "bg-white/20" : "bg-primary/10"), children: _jsx(Check, { className: cn("size-3", plan.featured ? "text-white" : "text-primary") }) }), _jsx("span", { className: plan.featured ? "text-white/95" : "text-ink-soft", children: f })] }, f))) }), _jsx("div", { className: "mt-auto pt-8", children: _jsxs(Button, { variant: plan.featured ? "glass" : "primary", className: cn("w-full", plan.featured && "bg-none bg-white text-primary hover:bg-white"), onClick: () => navigate("/app/plans"), children: ["Choose ", plan.name] }) })] }) }, plan.name))) }), _jsx("p", { className: "mt-8 text-center text-sm text-muted", children: c.footnote })] }));
}
