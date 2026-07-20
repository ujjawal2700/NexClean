import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Calendar, Plus, X, Lock, RefreshCw, Trash2, Car, MapPin, AlertCircle, ArrowLeft, Coins, } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { formatMoney } from "@shared/lib/format";
import { useMe, usePlans, useCategoryLabel, useSubscriptionSchedule, useWallet } from "../api/queries";
import { useCreateSubscriptionOrder, useVerifySubscription, useUnsubscribe, usePreviewSubscription, useScheduleSubscriptionWash, useRescheduleSubscriptionWash, useCancelBooking, } from "../api/mutations";
import { loadRazorpay, openRazorpay } from "@shared/lib/razorpay";
import { TIME_SLOTS } from "../data/catalog";
const PLAN_META = {
    basic: {
        tagline: "For the weekend driver.",
        perks: ["Exterior + interior", "Doorstep service", "Free rescheduling"],
    },
    premium: {
        tagline: "Our most popular plan.",
        perks: ["Priority scheduling", "Premium products", "10% off add-ons"],
        featured: true,
    },
    elite: {
        tagline: "Nothing but the best.",
        perks: ["Same-day guaranteed", "Top specialists", "Concierge support"],
    },
};
const DEFAULT_META = { tagline: "Subscribe and save on every wash.", perks: ["Doorstep service"] };
function washesLabel(washesPerMonth) {
    return washesPerMonth < 0 ? "Unlimited washes" : `${washesPerMonth} washes / month`;
}
export function Subscriptions() {
    const navigate = useNavigate();
    const { data: me } = useMe();
    const { data: plans = [], isLoading: plansLoading } = usePlans();
    const categoryLabel = useCategoryLabel();
    const createSubOrder = useCreateSubscriptionOrder();
    const verifySub = useVerifySubscription();
    const unsubscribe = useUnsubscribe();
    const previewSub = usePreviewSubscription();
    const { data: wallet } = useWallet();
    const { data: scheduleData, isLoading: scheduleLoading } = useSubscriptionSchedule();
    const scheduleWash = useScheduleSubscriptionWash();
    const rescheduleWash = useRescheduleSubscriptionWash();
    const cancelWash = useCancelBooking();
    const [subProcessing, setSubProcessing] = useState(false);
    const busy = subProcessing ||
        createSubOrder.isPending ||
        verifySub.isPending ||
        unsubscribe.isPending ||
        scheduleWash.isPending ||
        rescheduleWash.isPending ||
        cancelWash.isPending;
    const activePlan = me?.activePlan ?? null;
    const [showCatalog, setShowCatalog] = useState(false);
    // Modal States
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);
    const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
    const [selectedVehicleId, setSelectedVehicleId] = useState("");
    const [selectedAddressId, setSelectedAddressId] = useState("");
    const [selectedDate, setSelectedDate] = useState("");
    const [selectedSlot, setSelectedSlot] = useState("");
    const [targetBooking, setTargetBooking] = useState(null);
    const [scheduleError, setScheduleError] = useState("");
    const activePlanDetails = plans.find((p) => p.id === activePlan);
    const washesLimit = activePlanDetails?.washesPerMonth ?? 0;
    const scheduledBookings = scheduleData?.bookings ?? [];
    const cycleEnd = scheduleData?.subscriptionEndDate ? new Date(scheduleData.subscriptionEndDate).toLocaleDateString() : "";
    // The distinct vehicle types the customer owns; price previews follow the selected one.
    const ownedTypes = Array.from(new Set((me?.vehicles ?? []).map((v) => v.type)));
    const [selectedType, setSelectedType] = useState(ownedTypes[0] ?? null);
    const vehicleType = selectedType ?? ownedTypes[0] ?? null;
    const priceForPlan = (plan) => vehicleType ? plan.prices[vehicleType] : plan.price;
    // Subscription checkout (with optional coin redemption)
    const walletCoins = wallet?.coins ?? 0;
    const [checkoutPlan, setCheckoutPlan] = useState(null);
    const [subUseCoins, setSubUseCoins] = useState(false);
    const [subQuote, setSubQuote] = useState(null);
    const [checkoutError, setCheckoutError] = useState("");
    const openCheckout = (plan) => {
        setCheckoutPlan(plan);
        setSubUseCoins(false);
        setSubQuote(null);
        setCheckoutError("");
    };
    const payableSub = subQuote ? subQuote.price : checkoutPlan ? priceForPlan(checkoutPlan) : 0;
    const toggleSubCoins = async () => {
        if (!checkoutPlan)
            return;
        const next = !subUseCoins;
        setSubUseCoins(next);
        if (!next) {
            setSubQuote(null);
            return;
        }
        try {
            const q = await previewSub.mutateAsync({
                planId: checkoutPlan.id,
                vehicleType: vehicleType ?? undefined,
                coinsToRedeem: walletCoins,
            });
            setSubQuote(q);
        }
        catch {
            setSubUseCoins(false);
        }
    };
    const confirmSubscribe = async () => {
        if (!checkoutPlan)
            return;
        setCheckoutError("");
        setSubProcessing(true);
        const checkoutVars = {
            planId: checkoutPlan.id,
            vehicleType: vehicleType ?? undefined,
            coinsToRedeem: subUseCoins ? walletCoins : undefined,
        };
        const finish = () => {
            setCheckoutPlan(null);
            setShowCatalog(false);
            setSubProcessing(false);
        };
        try {
            const order = await createSubOrder.mutateAsync(checkoutVars);
            // Mock/free (no Razorpay keys, or coins cover the full amount): activate directly.
            if (order.mock) {
                await verifySub.mutateAsync(checkoutVars);
                finish();
                return;
            }
            // Live mode: open Razorpay Checkout, then verify the signature server-side.
            const loaded = await loadRazorpay();
            if (!loaded)
                throw new Error("Couldn't load the payment gateway");
            openRazorpay({
                key: order.keyId,
                amount: order.amount * 100,
                currency: order.currency,
                order_id: order.orderId,
                name: "NexClean",
                description: `${checkoutPlan.name} subscription`,
                prefill: { name: me?.name, contact: me?.phone },
                theme: { color: "#4F7CFF" },
                handler: async (r) => {
                    try {
                        await verifySub.mutateAsync({ ...checkoutVars, ...r });
                        finish();
                    }
                    catch (e) {
                        setCheckoutError(e?.message || "Payment verification failed");
                        setSubProcessing(false);
                    }
                },
                modal: { ondismiss: () => setSubProcessing(false) },
            });
        }
        catch (err) {
            setCheckoutError(err?.message || "Failed to subscribe. Please try again.");
            setSubProcessing(false);
        }
    };
    const handleOpenSchedule = () => {
        setSelectedVehicleId(me?.vehicles[0]?.id || "");
        setSelectedAddressId(me?.addresses[0]?.id || "");
        setSelectedDate("");
        setSelectedSlot("");
        setScheduleError("");
        setIsScheduleOpen(true);
    };
    const handleConfirmSchedule = async () => {
        if (!selectedVehicleId || !selectedAddressId || !selectedDate || !selectedSlot) {
            return setScheduleError("Please select a vehicle, address, date, and slot.");
        }
        setScheduleError("");
        try {
            await scheduleWash.mutateAsync({
                vehicleId: selectedVehicleId,
                addressId: selectedAddressId,
                date: selectedDate,
                slot: selectedSlot,
            });
            setIsScheduleOpen(false);
        }
        catch (err) {
            setScheduleError(err?.message || "Failed to schedule wash");
        }
    };
    const handleOpenReschedule = (booking) => {
        setTargetBooking(booking);
        setSelectedDate(booking.date);
        setSelectedSlot(booking.slot);
        setScheduleError("");
        setIsRescheduleOpen(true);
    };
    const handleConfirmReschedule = async () => {
        if (!targetBooking || !selectedDate || !selectedSlot) {
            return setScheduleError("Please select a date and slot.");
        }
        setScheduleError("");
        try {
            await rescheduleWash.mutateAsync({
                bookingId: targetBooking.id,
                date: selectedDate,
                slot: selectedSlot,
            });
            setIsRescheduleOpen(false);
        }
        catch (err) {
            setScheduleError(err?.message || "Failed to reschedule wash");
        }
    };
    const handleCancelWash = async (bookingId) => {
        if (window.confirm("Are you sure you want to cancel this scheduled wash?")) {
            try {
                await cancelWash.mutateAsync(bookingId);
            }
            catch (err) {
                alert(err?.message || "Failed to cancel wash");
            }
        }
    };
    const getWashesCountText = () => {
        if (washesLimit === -1)
            return `${scheduledBookings.length} washes scheduled`;
        return `${scheduledBookings.length} / ${washesLimit} washes used`;
    };
    // Generate 30 upcoming days starting tomorrow
    const upcoming30Days = () => {
        const dates = [];
        const base = new Date();
        // Start tomorrow to avoid slot overlaps for today
        for (let i = 1; i <= 30; i++) {
            const d = new Date(base);
            d.setDate(base.getDate() + i);
            dates.push(d);
        }
        return dates;
    };
    // Check 12-hour rescheduling/cancellation window
    const isLocked = (dateStr) => {
        const diffMs = new Date(dateStr).getTime() - Date.now();
        return diffMs < 12 * 60 * 60 * 1000;
    };
    // Main Loading
    if (plansLoading || (activePlan && scheduleLoading)) {
        return _jsx("p", { className: "text-muted py-10 text-center", children: "Loading subscription dashboard\u2026" });
    }
    // --- RENDER 1: Active Subscription Wash Dashboard ---
    if (activePlan && !showCatalog) {
        const nextBooking = scheduledBookings.find((b) => new Date(b.date).getTime() > Date.now());
        // Generate array of cards to show
        // If washesLimit is 4 or 8, we render exactly that many slots.
        // If washesLimit is -1 (unlimited), we render booked washes + 1 empty slot.
        const slotsCount = washesLimit === -1 ? scheduledBookings.length + 1 : washesLimit;
        const slots = Array.from({ length: slotsCount }).map((_, i) => scheduledBookings[i] ?? null);
        return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { className: "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => navigate(-1), className: "flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0", "aria-label": "Back", children: _jsx(ArrowLeft, { className: "size-4" }) }), _jsx("h1", { className: "font-display text-3xl text-ink", children: "Active Subscription" })] }), _jsx("p", { className: "mt-2 text-sm text-muted pl-12", children: "Book and manage your washes for this billing cycle." })] }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => setShowCatalog(true), className: "sm:mt-1", children: "Upgrade / Cancel Plan" })] }), _jsxs("div", { className: "grid gap-5 md:grid-cols-3", children: [_jsxs(GlassCard, { className: "flex flex-col justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wider text-muted", children: "Current Plan" }), _jsx("h2", { className: "mt-2 font-display text-2xl font-bold capitalize text-primary", children: activePlanDetails?.name || activePlan })] }), _jsxs("p", { className: "mt-4 text-sm text-ink-soft", children: ["Cycle ends: ", _jsx("span", { className: "font-semibold text-ink", children: cycleEnd || "N/A" })] })] }), _jsxs(GlassCard, { className: "flex flex-col justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wider text-muted", children: "Cycle Usage" }), _jsx("h2", { className: "mt-2 font-display text-2xl font-bold text-ink", children: getWashesCountText() })] }), washesLimit !== -1 && (_jsx("div", { className: "mt-4", children: _jsx("div", { className: "h-2 w-full rounded-full bg-line overflow-hidden", children: _jsx("div", { className: "h-full bg-primary transition-all duration-500", style: { width: `${(scheduledBookings.length / washesLimit) * 100}%` } }) }) }))] }), _jsxs(GlassCard, { className: "flex flex-col justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wider text-muted", children: "Next Wash" }), nextBooking ? (_jsxs("div", { className: "mt-2", children: [_jsx("h3", { className: "font-display text-lg font-semibold text-ink leading-tight", children: nextBooking.vehicleName }), _jsxs("p", { className: "mt-1 text-xs text-muted flex items-center gap-1", children: [_jsx(Calendar, { className: "size-3" }), " ", new Date(nextBooking.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), " \u00B7 ", nextBooking.slot] })] })) : (_jsx("p", { className: "mt-2 text-sm text-muted", children: "No upcoming washes scheduled." }))] }), !nextBooking && washesLimit !== 0 && (_jsx(Button, { size: "sm", className: "mt-4 w-fit", onClick: handleOpenSchedule, children: "Schedule now" }))] })] }), _jsxs("div", { children: [_jsx("h2", { className: "font-display text-xl font-semibold text-ink", children: "Schedule Board" }), _jsx("p", { className: "text-sm text-muted", children: "Select slots or reschedule upcoming cleanings." })] }), _jsx("div", { className: "grid gap-5 sm:grid-cols-2 lg:grid-cols-3", children: slots.map((booking, idx) => {
                        if (booking) {
                            const locked = isLocked(booking.date);
                            return (_jsxs(GlassCard, { className: "relative flex flex-col justify-between border border-line bg-surface/40 hover:border-line transition-all", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "grid size-9 place-items-center rounded-xl bg-primary/10 text-primary", children: _jsx(Car, { className: "size-5" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-display font-semibold text-ink leading-tight", children: booking.vehicleName }), _jsx("p", { className: "text-xs text-muted capitalize", children: categoryLabel(booking.vehicleType) })] })] }), _jsx("span", { className: cn("rounded-pill px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", booking.status === "upcoming"
                                                            ? "bg-amber-100 text-amber-800"
                                                            : booking.status === "completed"
                                                                ? "bg-green-100 text-green-800"
                                                                : "bg-red-100 text-red-800"), children: booking.status })] }), _jsxs("div", { className: "mt-4 space-y-2 text-sm text-ink-soft border-t border-line/50 pt-3", children: [_jsxs("p", { className: "flex items-center gap-2", children: [_jsx(Calendar, { className: "size-4 text-primary shrink-0" }), _jsxs("span", { children: [new Date(booking.date).toLocaleDateString("en-IN", {
                                                                        day: "numeric",
                                                                        month: "short",
                                                                        weekday: "short",
                                                                    }), " ", "\u00B7 ", booking.slot] })] }), _jsxs("p", { className: "flex items-center gap-2", children: [_jsx(MapPin, { className: "size-4 text-primary shrink-0" }), _jsxs("span", { className: "truncate", title: booking.addressLine, children: [booking.addressLabel, " (", booking.addressLine, ")"] })] })] })] }), _jsx("div", { className: "mt-5 flex gap-2 border-t border-line/40 pt-3", children: locked ? (_jsxs("div", { className: "flex w-full items-center gap-1.5 justify-center text-xs text-muted py-1.5", children: [_jsx(Lock, { className: "size-3.5 text-muted/65" }), _jsx("span", { children: "Locked (12h window)" })] })) : booking.status === "upcoming" ? (_jsxs(_Fragment, { children: [_jsxs(Button, { variant: "outline", size: "sm", className: "flex-1", onClick: () => handleOpenReschedule(booking), disabled: busy, children: [_jsx(RefreshCw, { className: "size-3.5" }), " Reschedule"] }), _jsx(Button, { variant: "ghost", size: "sm", className: "text-red-500 hover:text-red-600 hover:bg-red-50/15", onClick: () => handleCancelWash(booking.id), disabled: busy, title: "Cancel Wash", children: _jsx(Trash2, { className: "size-4" }) })] })) : (_jsxs("div", { className: "text-xs text-muted italic w-full text-center py-1.5", children: ["Wash ", booking.status] })) })] }, booking.id));
                        }
                        return (_jsxs("button", { onClick: handleOpenSchedule, disabled: busy, className: "group flex min-h-48 flex-col items-center justify-center rounded-card border-2 border-dashed border-line hover:border-primary/50 hover:bg-primary/5 transition-all p-6 text-center focus:outline-none", children: [_jsx("div", { className: "grid size-11 place-items-center rounded-full bg-surface border border-line group-hover:border-primary/20 group-hover:bg-primary/10 group-hover:text-primary transition-all shadow-sm", children: _jsx(Plus, { className: "size-5" }) }), _jsxs("h3", { className: "mt-3 font-display font-semibold text-ink group-hover:text-primary transition-colors", children: ["Schedule Wash #", idx + 1] }), _jsx("p", { className: "mt-1 text-xs text-muted", children: "Configure a cleaning slot" })] }, `empty-${idx}`));
                    }) }), isScheduleOpen && (_jsx("div", { className: "fixed inset-0 z-50 grid place-items-center bg-black/60 p-5 backdrop-blur-sm", children: _jsxs(GlassCard, { className: "w-full max-w-lg overflow-y-auto max-h-[90vh] border border-line shadow-2xl space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-line pb-3", children: [_jsx("h3", { className: "font-display text-xl font-bold text-ink", children: "Schedule Subscription Wash" }), _jsx("button", { onClick: () => setIsScheduleOpen(false), className: "text-muted hover:text-ink", children: _jsx(X, { className: "size-5" }) })] }), scheduleError && (_jsxs("div", { className: "flex items-center gap-2 rounded-xl bg-red-50/15 border border-red-500/20 p-3.5 text-xs text-red-500", children: [_jsx(AlertCircle, { className: "size-4 shrink-0" }), _jsx("span", { children: scheduleError })] })), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-muted", children: "Select Vehicle" }), (me?.vehicles ?? []).length === 0 ? (_jsx("p", { className: "mt-1.5 text-sm text-red-500", children: "No vehicles found. Please add a vehicle in your profile first." })) : (_jsx("select", { value: selectedVehicleId, onChange: (e) => setSelectedVehicleId(e.target.value), className: "mt-1.5 h-12 w-full rounded-2xl border border-line bg-surface px-4 text-sm text-ink outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25", children: (me?.vehicles ?? []).map((v) => (_jsxs("option", { value: v.id, children: [v.name, " (", categoryLabel(v.type), ") \u00B7 ", v.plate] }, v.id))) }))] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-muted", children: "Select Location" }), (me?.addresses ?? []).length === 0 ? (_jsx("p", { className: "mt-1.5 text-sm text-red-500", children: "No locations found. Please add an address in your profile first." })) : (_jsx("select", { value: selectedAddressId, onChange: (e) => setSelectedAddressId(e.target.value), className: "mt-1.5 h-12 w-full rounded-2xl border border-line bg-surface px-4 text-sm text-ink outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25", children: (me?.addresses ?? []).map((a) => (_jsxs("option", { value: a.id, children: [a.label, " (", a.line, ")"] }, a.id))) }))] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-muted", children: "Pick Date" }), _jsx("div", { className: "mt-1.5 flex gap-2 overflow-x-auto pb-1.5", children: upcoming30Days().map((d) => {
                                                    const iso = d.toISOString();
                                                    const isSelected = selectedDate && new Date(selectedDate).toDateString() === d.toDateString();
                                                    return (_jsxs("button", { onClick: () => setSelectedDate(iso), className: cn("flex w-16 shrink-0 flex-col items-center rounded-2xl border py-2.5 transition-all focus:outline-none", isSelected
                                                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                                            : "border-line bg-surface hover:border-primary/45"), children: [_jsx("span", { className: "text-[10px] text-muted uppercase", children: d.toLocaleDateString("en-IN", { weekday: "short" }) }), _jsx("span", { className: "font-display text-base font-bold text-ink", children: d.getDate() }), _jsx("span", { className: "text-[9px] text-muted", children: d.toLocaleDateString("en-IN", { month: "short" }) })] }, iso));
                                                }) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-muted", children: "Select Time Slot" }), _jsx("div", { className: "mt-1.5 grid grid-cols-3 gap-2", children: TIME_SLOTS.map((slot) => {
                                                    const isSelected = selectedSlot === slot;
                                                    return (_jsx("button", { onClick: () => setSelectedSlot(slot), className: cn("rounded-xl border py-2 text-xs font-medium transition-all focus:outline-none", isSelected
                                                            ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
                                                            : "border-line bg-surface text-ink-soft hover:border-primary/45"), children: slot }, slot));
                                                }) })] })] }), _jsxs("div", { className: "flex gap-3 border-t border-line/50 pt-4", children: [_jsx(Button, { className: "flex-1", onClick: handleConfirmSchedule, disabled: busy, children: "Schedule Wash" }), _jsx(Button, { variant: "outline", className: "flex-1", onClick: () => setIsScheduleOpen(false), children: "Cancel" })] })] }) })), isRescheduleOpen && (_jsx("div", { className: "fixed inset-0 z-50 grid place-items-center bg-black/60 p-5 backdrop-blur-sm", children: _jsxs(GlassCard, { className: "w-full max-w-lg border border-line shadow-2xl space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-line pb-3", children: [_jsx("h3", { className: "font-display text-xl font-bold text-ink", children: "Reschedule Wash" }), _jsx("button", { onClick: () => setIsRescheduleOpen(false), className: "text-muted hover:text-ink", children: _jsx(X, { className: "size-5" }) })] }), scheduleError && (_jsxs("div", { className: "flex items-center gap-2 rounded-xl bg-red-50/15 border border-red-500/20 p-3.5 text-xs text-red-500", children: [_jsx(AlertCircle, { className: "size-4 shrink-0" }), _jsx("span", { children: scheduleError })] })), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-muted", children: "Pick New Date" }), _jsx("div", { className: "mt-1.5 flex gap-2 overflow-x-auto pb-1.5", children: upcoming30Days().map((d) => {
                                                    const iso = d.toISOString();
                                                    const isSelected = selectedDate && new Date(selectedDate).toDateString() === d.toDateString();
                                                    return (_jsxs("button", { onClick: () => setSelectedDate(iso), className: cn("flex w-16 shrink-0 flex-col items-center rounded-2xl border py-2.5 transition-all focus:outline-none", isSelected
                                                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                                            : "border-line bg-surface hover:border-primary/45"), children: [_jsx("span", { className: "text-[10px] text-muted uppercase", children: d.toLocaleDateString("en-IN", { weekday: "short" }) }), _jsx("span", { className: "font-display text-base font-bold text-ink", children: d.getDate() }), _jsx("span", { className: "text-[9px] text-muted", children: d.toLocaleDateString("en-IN", { month: "short" }) })] }, iso));
                                                }) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-muted", children: "Select Time Slot" }), _jsx("div", { className: "mt-1.5 grid grid-cols-3 gap-2", children: TIME_SLOTS.map((slot) => {
                                                    const isSelected = selectedSlot === slot;
                                                    return (_jsx("button", { onClick: () => setSelectedSlot(slot), className: cn("rounded-xl border py-2 text-xs font-medium transition-all focus:outline-none", isSelected
                                                            ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
                                                            : "border-line bg-surface text-ink-soft hover:border-primary/45"), children: slot }, slot));
                                                }) })] })] }), _jsxs("div", { className: "flex gap-3 border-t border-line/50 pt-4", children: [_jsx(Button, { className: "flex-1", onClick: handleConfirmReschedule, disabled: busy, children: "Confirm Reschedule" }), _jsx(Button, { variant: "outline", className: "flex-1", onClick: () => setIsRescheduleOpen(false), children: "Cancel" })] })] }) }))] }));
    }
    // --- RENDER 2: Subscriptions Catalog Catalog ---
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => navigate(-1), className: "flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0", "aria-label": "Back", children: _jsx(ArrowLeft, { className: "size-4" }) }), _jsx("h1", { className: "font-display text-3xl text-ink", children: "Subscription plans" })] }), _jsx("p", { className: "mt-2 text-sm text-muted pl-12", children: "Subscribe once, save on every wash. Cancel anytime." })] }), activePlan && (_jsx(Button, { variant: "outline", size: "sm", onClick: () => setShowCatalog(false), className: "sm:mt-1", children: "Back to Dashboard" }))] }), ownedTypes.length > 0 ? (ownedTypes.length > 1 && (_jsxs("div", { className: "mb-6 flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "text-sm text-muted", children: "Pricing for" }), ownedTypes.map((t) => (_jsx("button", { onClick: () => setSelectedType(t), className: cn("rounded-pill border px-4 py-1.5 text-sm font-medium transition-colors", t === vehicleType
                            ? "border-primary bg-primary text-white"
                            : "border-line bg-surface/70 text-ink-soft hover:border-primary/40"), children: categoryLabel(t) }, t)))] }))) : (_jsx("p", { className: "mb-6 text-sm text-muted", children: "Add a vehicle in your profile to see its exact price \u2014 showing the lowest tier for now." })), plansLoading && _jsx("p", { className: "text-muted", children: "Loading plans\u2026" }), _jsx("div", { className: "grid items-stretch gap-6 lg:grid-cols-3", children: plans.map((plan) => {
                    const meta = PLAN_META[plan.id] ?? DEFAULT_META;
                    const active = activePlan === plan.id;
                    const features = [washesLabel(plan.washesPerMonth), ...meta.perks];
                    return (_jsxs("div", { className: cn("relative flex h-full flex-col rounded-card border p-7 transition-transform", meta.featured
                            ? "border-primary/30 bg-gradient-to-br from-primary to-primary-soft text-white shadow-[var(--shadow-glow)] lg:-translate-y-3"
                            : "border-line bg-surface/70 shadow-[var(--shadow-soft)]"), children: [meta.featured && (_jsx("span", { className: "absolute right-6 top-6 rounded-pill bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur", children: "Popular" })), _jsx("h2", { className: cn("font-display text-2xl font-semibold", meta.featured ? "text-white" : "text-ink"), children: plan.name }), _jsx("p", { className: cn("mt-1 text-sm", meta.featured ? "text-white/80" : "text-muted"), children: meta.tagline }), _jsxs("div", { className: "mt-5 flex items-end gap-1", children: [!vehicleType && (_jsx("span", { className: cn("pb-1 text-sm", meta.featured ? "text-white/80" : "text-muted"), children: "from" })), _jsx("span", { className: "font-display text-4xl font-semibold", children: formatMoney(priceForPlan(plan)) }), _jsx("span", { className: cn("pb-1 text-sm", meta.featured ? "text-white/80" : "text-muted"), children: "/month" })] }), vehicleType && (_jsxs("p", { className: cn("mt-1 text-xs", meta.featured ? "text-white/70" : "text-muted"), children: ["for your ", categoryLabel(vehicleType)] })), _jsx("ul", { className: "mt-6 space-y-3", children: features.map((f) => (_jsxs("li", { className: "flex items-center gap-3 text-sm", children: [_jsx("span", { className: cn("grid size-5 shrink-0 place-items-center rounded-full", meta.featured ? "bg-white/20" : "bg-primary/10"), children: _jsx(Check, { className: cn("size-3", meta.featured ? "text-white" : "text-primary") }) }), _jsx("span", { className: meta.featured ? "text-white/95" : "text-ink-soft", children: f })] }, f))) }), _jsx("div", { className: "mt-auto pt-7", children: active ? (_jsx(Button, { variant: meta.featured ? "glass" : "outline", className: cn("w-full", meta.featured && "bg-white/20 text-white"), disabled: busy, onClick: () => unsubscribe.mutate(), children: "Cancel plan" })) : (_jsxs(Button, { variant: meta.featured ? "glass" : "primary", className: cn("w-full", meta.featured && "bg-white text-primary hover:bg-white"), disabled: busy, onClick: () => openCheckout(plan), children: ["Choose ", plan.name] })) })] }, plan.id));
                }) }), !plansLoading && plans.length === 0 && (_jsx("p", { className: "text-muted", children: "No plans available right now \u2014 please check back soon." })), activePlan && (_jsxs(GlassCard, { className: "mt-6 text-center text-sm text-muted", children: ["You're on the ", _jsx("span", { className: "font-medium text-ink capitalize", children: activePlan }), " plan. Subscription billing connects when the backend (Razorpay) is live."] })), checkoutPlan && (_jsx("div", { className: "fixed inset-0 z-50 grid place-items-center bg-black/60 p-5 backdrop-blur-sm", children: _jsxs(GlassCard, { className: "w-full max-w-md border border-line shadow-2xl space-y-5", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-line pb-3", children: [_jsx("h3", { className: "font-display text-xl font-bold text-ink", children: "Confirm subscription" }), _jsx("button", { onClick: () => setCheckoutPlan(null), className: "text-muted hover:text-ink", children: _jsx(X, { className: "size-5" }) })] }), _jsxs("div", { children: [_jsx("p", { className: "font-display text-lg font-semibold text-ink", children: checkoutPlan.name }), _jsxs("p", { className: "text-sm text-muted", children: [washesLabel(checkoutPlan.washesPerMonth), vehicleType ? ` · ${categoryLabel(vehicleType)}` : ""] })] }), checkoutError && (_jsxs("div", { className: "flex items-center gap-2 rounded-xl bg-red-50/15 border border-red-500/20 p-3.5 text-xs text-red-500", children: [_jsx(AlertCircle, { className: "size-4 shrink-0" }), _jsx("span", { children: checkoutError })] })), walletCoins > 0 && (_jsxs("button", { type: "button", onClick: toggleSubCoins, disabled: previewSub.isPending, className: cn("flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all", subUseCoins
                                ? "border-amber-400/50 bg-amber-400/10 ring-2 ring-amber-400/20"
                                : "border-line bg-surface hover:border-amber-400/40"), children: [_jsx("span", { className: "grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600", children: _jsx(Coins, { className: "size-4.5" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-sm font-medium text-ink", children: subUseCoins ? "Coins applied" : `Use your ${walletCoins.toLocaleString("en-IN")} coins` }), _jsx("p", { className: "text-xs text-muted", children: subUseCoins && subQuote && subQuote.coinDiscount > 0
                                                ? `Saving ${formatMoney(subQuote.coinDiscount)} with coins`
                                                : "Redeem coins for a discount on this plan" })] }), _jsx("span", { className: cn("flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors", subUseCoins ? "bg-amber-500 justify-end" : "bg-line justify-start"), children: _jsx("span", { className: "size-5 rounded-full bg-white shadow" }) })] })), _jsxs("dl", { className: "space-y-2 border-t border-line pt-4 text-sm", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("dt", { className: "text-muted", children: "Plan price" }), _jsxs("dd", { className: "font-medium text-ink", children: [formatMoney(priceForPlan(checkoutPlan)), "/mo"] })] }), subQuote && subQuote.coinDiscount > 0 && (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("dt", { className: "text-muted", children: ["Coins (", subQuote.coinsRedeemed.toLocaleString("en-IN"), ")"] }), _jsxs("dd", { className: "font-medium text-amber-600", children: ["\u2212", formatMoney(subQuote.coinDiscount)] })] })), _jsxs("div", { className: "flex items-center justify-between border-t border-line pt-2", children: [_jsx("dt", { className: "text-muted", children: "Due now" }), _jsx("dd", { className: "font-display text-xl font-semibold text-ink", children: formatMoney(payableSub) })] })] }), _jsxs("div", { className: "flex gap-3 border-t border-line/50 pt-4", children: [_jsx(Button, { className: "flex-1", onClick: confirmSubscribe, disabled: busy, children: subProcessing ? "Processing…" : `Pay ${formatMoney(payableSub)}` }), _jsx(Button, { variant: "outline", className: "flex-1", onClick: () => setCheckoutPlan(null), disabled: busy, children: "Cancel" })] })] }) }))] }));
}
