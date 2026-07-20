import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Navigation, Clock, MapPin, Car, Sparkles, Check, X } from "lucide-react";
import { Button } from "@shared/ui/Button";
import { formatMoney } from "@shared/lib/format";
import { VEHICLE_LABEL } from "../types";
/** Full-screen incoming-offer popup with a live countdown (Uber/food-delivery style). */
export function OfferOverlay({ dispatch }) {
    const { offer, accept, decline, accepting } = dispatch;
    return (_jsx(AnimatePresence, { children: offer && (_jsx(OfferCard, { dispatch: dispatch, accept: accept, decline: decline, accepting: accepting }, offer.bookingId)) }));
}
function OfferCard({ dispatch, accept, decline, accepting, }) {
    const offer = dispatch.offer;
    // Total window captured once so the ring animates smoothly from full → empty.
    const totalMs = useRef(Math.max(1000, new Date(offer.expiresAt).getTime() - Date.now()));
    const [msLeft, setMsLeft] = useState(() => new Date(offer.expiresAt).getTime() - Date.now());
    useEffect(() => {
        const tick = () => setMsLeft(new Date(offer.expiresAt).getTime() - Date.now());
        tick();
        const id = setInterval(tick, 200);
        return () => clearInterval(id);
    }, [offer.expiresAt]);
    const secondsLeft = Math.max(0, Math.ceil(msLeft / 1000));
    const fraction = Math.max(0, Math.min(1, msLeft / totalMs.current));
    const expired = msLeft <= 0;
    const R = 26;
    const C = 2 * Math.PI * R;
    const when = useMemo(() => new Date(offer.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), [offer.date]);
    return (_jsx(motion.div, { className: "fixed inset-0 z-[60] flex items-end justify-center bg-ink/60 p-4 backdrop-blur-sm sm:items-center", initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, children: _jsxs(motion.div, { className: "w-full max-w-md overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl", initial: { y: 40, opacity: 0, scale: 0.96 }, animate: { y: 0, opacity: 1, scale: 1 }, exit: { y: 40, opacity: 0, scale: 0.96 }, transition: { type: "spring", stiffness: 260, damping: 22 }, children: [_jsxs("div", { className: "flex items-center justify-between gap-3 bg-gradient-to-br from-primary to-accent px-5 py-4 text-white", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "relative flex size-2.5", children: [_jsx("span", { className: "absolute inline-flex size-full animate-ping rounded-full bg-white/70" }), _jsx("span", { className: "relative inline-flex size-2.5 rounded-full bg-white" })] }), _jsxs("div", { children: [_jsx("p", { className: "font-display text-base font-semibold leading-tight", children: "New wash request" }), _jsx("p", { className: "text-xs text-white/80", children: offer.isSubscriptionWash ? "Subscription wash" : "On-demand booking" })] })] }), _jsxs("div", { className: "relative grid size-16 place-items-center", children: [_jsxs("svg", { className: "absolute -rotate-90", width: "64", height: "64", viewBox: "0 0 64 64", children: [_jsx("circle", { cx: "32", cy: "32", r: R, fill: "none", stroke: "rgba(255,255,255,0.25)", strokeWidth: "5" }), _jsx("circle", { cx: "32", cy: "32", r: R, fill: "none", stroke: "white", strokeWidth: "5", strokeLinecap: "round", strokeDasharray: C, strokeDashoffset: C * (1 - fraction), style: { transition: "stroke-dashoffset 0.2s linear" } })] }), _jsx("span", { className: "font-display text-lg font-bold tabular-nums", children: secondsLeft })] })] }), _jsxs("div", { className: "space-y-4 p-5", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-pill bg-primary/10 px-3 py-1 text-sm font-semibold text-primary", children: [_jsx(Navigation, { className: "size-4" }), offer.distanceKm != null ? `${offer.distanceKm} km away` : "Nearby"] }), _jsxs("span", { className: "inline-flex items-center gap-1.5 text-sm text-muted", children: [_jsx(Clock, { className: "size-4" }), " ", when, " \u00B7 ", offer.slot] })] }), _jsxs("div", { className: "rounded-2xl border border-line bg-surface-muted/40 p-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary", children: _jsx(Car, { className: "size-5" }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate font-display font-semibold text-ink", children: offer.vehicleName }), _jsxs("p", { className: "text-sm text-muted", children: [VEHICLE_LABEL[offer.vehicleType] ?? offer.vehicleType, " \u00B7 ", offer.packageName] })] })] }), _jsxs("div", { className: "mt-3 flex items-start gap-2 border-t border-line/70 pt-3 text-sm text-ink-soft", children: [_jsx(MapPin, { className: "mt-0.5 size-4 shrink-0 text-muted" }), _jsxs("span", { className: "min-w-0", children: [_jsx("span", { className: "font-medium text-ink", children: offer.addressLabel }), " \u2014 ", offer.addressLine] })] })] }), _jsxs("div", { className: "flex items-center justify-between rounded-2xl bg-emerald-500/10 px-4 py-3", children: [_jsxs("span", { className: "inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700", children: [_jsx(Sparkles, { className: "size-4" }), " Your payout"] }), _jsx("span", { className: "font-display text-2xl font-bold text-emerald-700", children: formatMoney(offer.payout) })] }), _jsxs("div", { className: "flex gap-3 pt-1", children: [_jsxs(Button, { variant: "outline", className: "flex-1", onClick: decline, disabled: accepting, children: [_jsx(X, { className: "size-4" }), " Decline"] }), _jsxs(Button, { className: "flex-[1.6] bg-emerald-600 hover:bg-emerald-700", onClick: accept, disabled: accepting || expired, children: [_jsx(Check, { className: "size-4" }), " ", expired ? "Expired" : accepting ? "Accepting…" : "Accept job"] })] })] })] }) }));
}
