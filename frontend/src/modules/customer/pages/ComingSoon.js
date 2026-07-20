import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from "react-router-dom";
import { Rocket, MapPin, Bell, CheckCircle2, ArrowLeft } from "lucide-react";
import { Aurora } from "@shared/components/visual/Aurora";
import { Logo } from "@shared/components/brand/Logo";
import { Button } from "@shared/ui/Button";
/**
 * Shown after a customer from an unserviced city verifies their number.
 * Their lead record has already been saved — this is the confirmation screen.
 */
export function ComingSoon() {
    return (_jsxs("main", { className: "relative grid min-h-dvh place-items-center overflow-hidden px-5 py-10", children: [_jsx(Aurora, {}), _jsxs("div", { className: "relative z-10 w-full max-w-md text-center", children: [_jsx("div", { className: "mb-8 flex justify-center", children: _jsx(Link, { to: "/app", children: _jsx(Logo, { variant: "full" }) }) }), _jsx("div", { className: "mx-auto mb-6 flex size-24 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_8px_32px_rgba(251,146,60,0.35)]", children: _jsx(Rocket, { className: "size-12 text-white", strokeWidth: 1.5 }) }), _jsx("h1", { className: "text-3xl font-bold text-ink", children: "You're on the list! \uD83C\uDF89" }), _jsx("p", { className: "mt-3 text-sm leading-relaxed text-muted", children: "We're not in your city yet, but we're growing fast. Your account is ready and your spot has been saved. We'll send you a notification the moment NexClean launches near you." }), _jsx("div", { className: "mt-8 space-y-3 text-left", children: [
                            {
                                icon: _jsx(CheckCircle2, { className: "size-5 text-green-500" }),
                                title: "Account created",
                                desc: "Your NexClean account is active and waiting.",
                            },
                            {
                                icon: _jsx(MapPin, { className: "size-5 text-amber-500" }),
                                title: "City registered",
                                desc: "Your location is on our expansion radar.",
                            },
                            {
                                icon: _jsx(Bell, { className: "size-5 text-primary" }),
                                title: "Notification incoming",
                                desc: "You'll be the first to know when we go live.",
                            },
                        ].map((item) => (_jsxs("div", { className: "flex items-start gap-3 rounded-2xl border border-line bg-surface/60 px-4 py-3", children: [_jsx("div", { className: "mt-0.5 shrink-0", children: item.icon }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-ink", children: item.title }), _jsx("p", { className: "text-xs text-muted", children: item.desc })] })] }, item.title))) }), _jsxs("div", { className: "mt-8 space-y-3", children: [_jsx(Link, { to: "/app", children: _jsxs(Button, { className: "w-full", variant: "outline", children: [_jsx(ArrowLeft, { className: "size-4" }), " Back to home"] }) }), _jsxs("p", { className: "text-xs text-muted", children: ["Have questions?", " ", _jsx("a", { href: "mailto:hello@nexclean.in", className: "text-primary hover:underline", children: "hello@nexclean.in" })] })] })] })] }));
}
