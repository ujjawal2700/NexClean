import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Clock, MapPin, Plus, CheckCircle2, Loader2, Tag, X, Coins, } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { GlassCard } from "@shared/ui/GlassCard";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { BrandModelSelect } from "../../components/BrandModelSelect";
import { ApiError } from "@shared/lib/api";
import { loadRazorpay, openRazorpay } from "@shared/lib/razorpay";
import { useMe, useVehicleCategories, useCategoryLabel, useWallet } from "../../api/queries";
import { useCreateOrder, useVerifyPayment, usePreviewDiscount } from "../../api/mutations";
import { PACKAGES, TIME_SLOTS, upcomingDates, priceFor } from "../../data/catalog";
import { formatMoney } from "@shared/lib/format";
import { Stepper, STEP_LABELS } from "./Stepper";
const EMPTY = {
    vehicleType: null,
    vehicleName: "",
    packageId: null,
    date: null,
    slot: null,
    addressId: null,
};
export function BookingFlow() {
    const navigate = useNavigate();
    const { data: me } = useMe();
    const { data: categories = [] } = useVehicleCategories();
    const categoryLabel = useCategoryLabel();
    const vehicles = me?.vehicles ?? [];
    const addresses = me?.addresses ?? [];
    const createOrder = useCreateOrder();
    const verifyPayment = useVerifyPayment();
    const previewDiscount = usePreviewDiscount();
    const { data: wallet } = useWallet();
    const [step, setStep] = useState(0);
    const [draft, setDraft] = useState(EMPTY);
    const [payError, setPayError] = useState("");
    const [processing, setProcessing] = useState(false);
    const [confirmed, setConfirmed] = useState(null);
    const [discountInput, setDiscountInput] = useState("");
    const [appliedDiscount, setAppliedDiscount] = useState(null);
    const [discountError, setDiscountError] = useState("");
    const [coinsToRedeem, setCoinsToRedeem] = useState(0);
    const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
    const basePriceFor = (key) => categories.find((c) => c.key === key)?.basePrice ?? 0;
    const pkg = useMemo(() => PACKAGES.find((p) => p.id === draft.packageId) ?? null, [draft.packageId]);
    const total = draft.vehicleType && pkg ? priceFor(basePriceFor(draft.vehicleType), pkg) : 0;
    const payable = appliedDiscount ? appliedDiscount.price : total;
    const address = addresses.find((a) => a.id === draft.addressId) ?? null;
    const walletCoins = wallet?.coins ?? 0;
    /** Re-price with the server, factoring in the applied code and any coins redeemed. */
    const refreshQuote = async (code, coins) => {
        if (!draft.vehicleType || !pkg)
            return;
        if (!code && coins <= 0) {
            setAppliedDiscount(null);
            return;
        }
        const result = await previewDiscount.mutateAsync({
            vehicleType: draft.vehicleType,
            packageId: pkg.id,
            discountCode: code,
            coinsToRedeem: coins > 0 ? coins : undefined,
        });
        setAppliedDiscount(result);
        return result;
    };
    const applyDiscount = async () => {
        if (!draft.vehicleType || !pkg || !discountInput.trim())
            return;
        setDiscountError("");
        try {
            await refreshQuote(discountInput.trim(), coinsToRedeem);
        }
        catch (e) {
            setDiscountError(e instanceof ApiError ? e.message : "Invalid discount code");
        }
    };
    const clearDiscount = async () => {
        setDiscountInput("");
        setDiscountError("");
        try {
            await refreshQuote(undefined, coinsToRedeem);
        }
        catch { /* leave prior quote in place */ }
    };
    const toggleCoins = async () => {
        const next = coinsToRedeem > 0 ? 0 : walletCoins;
        const code = appliedDiscount?.discountCode ? discountInput.trim() : undefined;
        try {
            await refreshQuote(code, next);
            setCoinsToRedeem(next);
        }
        catch { /* ignore */ }
    };
    const canContinue = [
        !!draft.vehicleType,
        !!draft.packageId,
        !!draft.date && !!draft.slot,
        !!draft.addressId,
        true,
    ][step];
    const pay = async () => {
        if (!draft.vehicleType || !pkg || !draft.date || !draft.slot || !address)
            return;
        setPayError("");
        setProcessing(true);
        const bookingInput = {
            vehicleType: draft.vehicleType,
            vehicleName: draft.vehicleName || categoryLabel(draft.vehicleType),
            packageId: pkg.id,
            date: draft.date,
            slot: draft.slot,
            addressLabel: address.label,
            addressLine: address.line,
            discountCode: appliedDiscount?.discountCode ? discountInput.trim() : undefined,
            coinsToRedeem: coinsToRedeem > 0 ? coinsToRedeem : undefined,
            // GeoJSON stores [lng, lat]; the API expects lat/lng.
            lat: address.coordinates?.[1],
            lng: address.coordinates?.[0],
        };
        try {
            const order = await createOrder.mutateAsync(bookingInput);
            // Mock mode (no Razorpay keys): confirm + book without the checkout modal.
            if (order.mock) {
                const booking = await verifyPayment.mutateAsync({ booking: bookingInput });
                setConfirmed(booking);
                setProcessing(false);
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
                description: `${pkg.name} · ${bookingInput.vehicleName}`,
                prefill: { name: me?.name, contact: me?.phone },
                theme: { color: "#4F7CFF" },
                handler: async (r) => {
                    try {
                        const booking = await verifyPayment.mutateAsync({ booking: bookingInput, ...r });
                        setConfirmed(booking);
                    }
                    catch (e) {
                        setPayError(e instanceof ApiError ? e.message : "Payment verification failed");
                    }
                    finally {
                        setProcessing(false);
                    }
                },
                modal: { ondismiss: () => setProcessing(false) },
            });
        }
        catch (e) {
            setPayError(e instanceof ApiError ? e.message : "Payment failed. Please try again.");
            setProcessing(false);
        }
    };
    if (confirmed)
        return _jsx(Confirmation, { booking: confirmed });
    return (_jsxs("div", { className: "mx-auto max-w-4xl", children: [_jsxs("div", { className: "mb-8 flex items-center gap-3", children: [_jsx("button", { onClick: () => navigate(-1), className: "flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer", "aria-label": "Back", children: _jsx(ArrowLeft, { className: "size-4" }) }), _jsx("h1", { className: "font-display text-2xl font-semibold text-ink", children: "Book a cleaning" })] }), _jsx(Stepper, { current: step }), _jsxs("div", { className: "mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]", children: [_jsxs("div", { children: [_jsx(AnimatePresence, { mode: "wait", children: _jsxs(motion.div, { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.3 }, children: [step === 0 && _jsx(VehicleStep, { draft: draft, set: set, vehicles: vehicles, categoryLabel: categoryLabel }), step === 1 && _jsx(PackageStep, { draft: draft, set: set, categories: categories }), step === 2 && _jsx(ScheduleStep, { draft: draft, set: set }), step === 3 && _jsx(AddressStep, { draft: draft, set: set, addresses: addresses }), step === 4 && (_jsx(PaymentSummary, { draft: draft, categoryLabel: categoryLabel, total: payable, discountInput: discountInput, setDiscountInput: setDiscountInput, appliedDiscount: appliedDiscount, discountError: discountError, applyDiscount: applyDiscount, clearDiscount: clearDiscount, applying: previewDiscount.isPending, walletCoins: walletCoins, coinsUsed: coinsToRedeem, coinDiscount: appliedDiscount?.coinDiscount ?? 0, toggleCoins: toggleCoins }))] }, step) }), _jsxs("div", { className: "mt-8 flex items-center justify-between", children: [_jsxs(Button, { variant: "ghost", onClick: () => setStep((s) => Math.max(0, s - 1)), disabled: step === 0, children: [_jsx(ArrowLeft, { className: "size-4" }), " Back"] }), step < 4 ? (_jsxs(Button, { onClick: () => setStep((s) => s + 1), disabled: !canContinue, children: ["Continue ", _jsx(ArrowRight, { className: "size-4" })] })) : (_jsx(Button, { onClick: pay, disabled: processing, className: "min-w-44", children: processing ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "size-4 animate-spin" }), " Processing\u2026"] })) : (_jsxs(_Fragment, { children: ["Pay ", formatMoney(payable)] })) }))] }), payError && _jsx("p", { className: "mt-3 text-right text-sm text-red-500", children: payError })] }), _jsx(OrderSummary, { draft: draft, total: total, discount: appliedDiscount, step: step, address: address?.label })] })] }));
}
/* ------------------------------- Steps ---------------------------------- */
function StepHeading({ title, subtitle }) {
    return (_jsxs("div", { className: "mb-5", children: [_jsx("h2", { className: "font-display text-xl font-semibold text-ink", children: title }), _jsx("p", { className: "mt-1 text-sm text-muted", children: subtitle })] }));
}
function VehicleStep({ draft, set, vehicles, categoryLabel, }) {
    const usingSavedVehicle = vehicles.some((v) => v.name === draft.vehicleName && v.type === draft.vehicleType);
    const onResolved = (selection) => {
        if (selection)
            set({ vehicleType: selection.categoryKey, vehicleName: `${selection.brand} ${selection.model}` });
    };
    return (_jsxs("div", { children: [_jsx(StepHeading, { title: "Which vehicle?", subtitle: "Choose from your garage or search your brand & model." }), vehicles.length > 0 && (_jsx("div", { className: "grid gap-3 sm:grid-cols-2", children: vehicles.map((v) => {
                    const selected = draft.vehicleName === v.name && draft.vehicleType === v.type;
                    return (_jsxs("button", { onClick: () => set({ vehicleType: v.type, vehicleName: v.name }), className: cn("flex items-center gap-3 rounded-card border p-4 text-left transition-all", selected
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                            : "border-line bg-surface hover:border-primary/40"), children: [_jsx("div", { className: "w-20 shrink-0", children: _jsx(CarSilhouette, { type: v.type, uid: `pick-${v.id}` }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate font-display font-semibold text-ink", children: v.name }), _jsx("p", { className: "text-sm text-muted", children: categoryLabel(v.type) })] }), selected && _jsx(Check, { className: "ml-auto size-5 text-primary" })] }, v.id));
                }) })), _jsx("p", { className: "mb-3 mt-6 text-sm font-medium text-muted", children: "Or search your brand & model" }), _jsx("div", { className: "grid gap-3 rounded-2xl border border-line bg-surface-muted/40 p-4 sm:grid-cols-2", children: _jsx(BrandModelSelect, { onResolved: onResolved }) }), !usingSavedVehicle && draft.vehicleType && (_jsxs("p", { className: "mt-3 flex items-center gap-1.5 text-sm text-muted", children: [_jsx(Check, { className: "size-4 text-primary" }), " ", draft.vehicleName, " \u00B7 ", categoryLabel(draft.vehicleType)] }))] }));
}
function PackageStep({ draft, set, categories, }) {
    const basePriceFor = (key) => categories.find((c) => c.key === key)?.basePrice ?? 0;
    return (_jsxs("div", { children: [_jsx(StepHeading, { title: "Choose a package", subtitle: "Pricing shown for your selected vehicle." }), _jsx("div", { className: "space-y-3", children: PACKAGES.map((p) => {
                    const selected = draft.packageId === p.id;
                    const price = draft.vehicleType ? priceFor(basePriceFor(draft.vehicleType), p) : null;
                    return (_jsxs("button", { onClick: () => set({ packageId: p.id }), className: cn("flex w-full items-start gap-4 rounded-card border p-5 text-left transition-all", selected
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                            : "border-line bg-surface hover:border-primary/40"), children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("p", { className: "font-display text-lg font-semibold text-ink", children: p.name }), _jsxs("span", { className: "flex items-center gap-1 text-xs text-muted", children: [_jsx(Clock, { className: "size-3.5" }), " ", p.durationLabel] })] }), _jsx("p", { className: "mt-0.5 text-sm text-muted", children: p.tagline }), _jsx("ul", { className: "mt-3 flex flex-wrap gap-x-4 gap-y-1", children: p.features.map((f) => (_jsxs("li", { className: "flex items-center gap-1.5 text-xs text-ink-soft", children: [_jsx(Check, { className: "size-3 text-primary" }), " ", f] }, f))) })] }), _jsxs("div", { className: "text-right", children: [price !== null && (_jsx("p", { className: "font-display text-xl font-semibold text-ink", children: formatMoney(price) })), _jsx("span", { className: cn("mt-2 inline-grid size-6 place-items-center rounded-full", selected ? "bg-primary text-white" : "border border-line"), children: selected && _jsx(Check, { className: "size-3.5" }) })] })] }, p.id));
                }) })] }));
}
function ScheduleStep({ draft, set }) {
    const dates = upcomingDates(7);
    return (_jsxs("div", { children: [_jsx(StepHeading, { title: "Pick a date & time", subtitle: "When should the specialist arrive?" }), _jsx("div", { className: "flex gap-2.5 overflow-x-auto pb-2", children: dates.map((d) => {
                    const iso = d.toISOString();
                    const selected = draft.date && new Date(draft.date).toDateString() === d.toDateString();
                    return (_jsxs("button", { onClick: () => set({ date: iso }), className: cn("flex w-16 shrink-0 flex-col items-center rounded-2xl border py-3 transition-all", selected
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                            : "border-line bg-surface hover:border-primary/40"), children: [_jsx("span", { className: "text-xs text-muted", children: d.toLocaleDateString("en-IN", { weekday: "short" }) }), _jsx("span", { className: "font-display text-lg font-semibold text-ink", children: d.getDate() }), _jsx("span", { className: "text-xs text-muted", children: d.toLocaleDateString("en-IN", { month: "short" }) })] }, iso));
                }) }), _jsx("p", { className: "mb-3 mt-6 text-sm font-medium text-muted", children: "Time slot" }), _jsx("div", { className: "grid grid-cols-3 gap-2.5 sm:grid-cols-4", children: TIME_SLOTS.map((slot) => {
                    const selected = draft.slot === slot;
                    return (_jsx("button", { onClick: () => set({ slot }), className: cn("rounded-xl border py-2.5 text-sm font-medium transition-all", selected
                            ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
                            : "border-line bg-surface text-ink-soft hover:border-primary/40"), children: slot }, slot));
                }) })] }));
}
function AddressStep({ draft, set, addresses, }) {
    return (_jsxs("div", { children: [_jsx(StepHeading, { title: "Where should we come?", subtitle: "Select a saved address." }), _jsx("div", { className: "space-y-3", children: addresses.map((a) => {
                    const selected = draft.addressId === a.id;
                    return (_jsxs("button", { onClick: () => set({ addressId: a.id }), className: cn("flex w-full items-center gap-4 rounded-card border p-4 text-left transition-all", selected
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                            : "border-line bg-surface hover:border-primary/40"), children: [_jsx("span", { className: "grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary", children: _jsx(MapPin, { className: "size-5" }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "font-display font-semibold text-ink", children: a.label }), _jsx("p", { className: "truncate text-sm text-muted", children: a.line })] }), selected && _jsx(Check, { className: "ml-auto size-5 text-primary" })] }, a.id));
                }) }), _jsx(Button, { asChild: true, variant: "outline", className: "mt-4", children: _jsxs(Link, { to: "/app/profile", children: [_jsx(Plus, { className: "size-4" }), " Add a new address"] }) })] }));
}
function PaymentSummary({ draft, categoryLabel, total, discountInput, setDiscountInput, appliedDiscount, discountError, applyDiscount, clearDiscount, applying, walletCoins, coinsUsed, coinDiscount, toggleCoins, }) {
    const [method, setMethod] = useState("upi");
    const methods = [
        { id: "upi", label: "UPI" },
        { id: "card", label: "Card" },
        { id: "wallet", label: "Wallet" },
        { id: "cod", label: "Pay after service" },
    ];
    return (_jsxs("div", { children: [_jsx(StepHeading, { title: "Payment", subtitle: "Choose how you'd like to pay." }), _jsx("div", { className: "grid grid-cols-2 gap-2.5 sm:grid-cols-4", children: methods.map((m) => (_jsx("button", { onClick: () => setMethod(m.id), className: cn("rounded-xl border py-3 text-sm font-medium transition-all", method === m.id
                        ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
                        : "border-line bg-surface text-ink-soft hover:border-primary/40"), children: m.label }, m.id))) }), _jsxs("div", { className: "mt-5", children: [_jsxs("p", { className: "mb-2 flex items-center gap-1.5 text-sm font-medium text-ink", children: [_jsx(Tag, { className: "size-4 text-muted" }), " Have a discount code?"] }), appliedDiscount ? (_jsxs("div", { className: "flex items-center justify-between rounded-2xl border border-primary/40 bg-primary/5 px-4 py-3", children: [_jsxs("div", { children: [_jsxs("p", { className: "text-sm font-medium text-ink", children: [appliedDiscount.discountCode, " applied"] }), _jsxs("p", { className: "text-xs text-muted", children: ["You saved ", formatMoney(appliedDiscount.discountAmount)] })] }), _jsx("button", { onClick: clearDiscount, className: "grid size-8 place-items-center rounded-full text-muted hover:bg-red-50 hover:text-red-500", "aria-label": "Remove discount code", children: _jsx(X, { className: "size-4" }) })] })) : (_jsxs("div", { className: "flex gap-2.5", children: [_jsx(Input, { name: "discountCode", placeholder: "Enter discount code", value: discountInput, onChange: (e) => setDiscountInput(e.target.value.toUpperCase()), onKeyDown: (e) => e.key === "Enter" && applyDiscount(), className: "flex-1", error: discountError }), _jsx(Button, { variant: "outline", onClick: applyDiscount, disabled: !discountInput.trim() || applying, children: applying ? _jsx(Loader2, { className: "size-4 animate-spin" }) : "Apply" })] }))] }), walletCoins > 0 && (_jsx("div", { className: "mt-4", children: _jsxs("button", { type: "button", onClick: toggleCoins, className: cn("flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all", coinsUsed > 0
                        ? "border-amber-400/50 bg-amber-400/10 ring-2 ring-amber-400/20"
                        : "border-line bg-surface hover:border-amber-400/40"), children: [_jsx("span", { className: "grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600", children: _jsx(Coins, { className: "size-4.5" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-sm font-medium text-ink", children: coinsUsed > 0 ? "Coins applied" : `Use your ${walletCoins.toLocaleString("en-IN")} coins` }), _jsx("p", { className: "text-xs text-muted", children: coinsUsed > 0 && coinDiscount > 0
                                        ? `Saving ${formatMoney(coinDiscount)} with coins`
                                        : "Redeem coins for a discount on this booking" })] }), _jsx("span", { className: cn("flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors", coinsUsed > 0 ? "bg-amber-500 justify-end" : "bg-line justify-start"), children: _jsx("span", { className: "size-5 rounded-full bg-white shadow" }) })] }) })), _jsxs("div", { className: "mt-5 rounded-2xl border border-line bg-surface-muted/50 p-4 text-sm text-muted", children: ["Secured by ", _jsx("span", { className: "font-medium text-ink", children: "Razorpay" }), ". ", formatMoney(total), " will be collected on confirmation. Without test keys configured, payment is simulated and the booking is still created."] }), draft.vehicleType && (_jsxs("p", { className: "mt-4 text-xs text-muted", children: ["Securing your slot for ", categoryLabel(draft.vehicleType), " \u00B7 ", draft.slot] }))] }));
}
/* ----------------------------- Summary ---------------------------------- */
function OrderSummary({ draft, total, discount, step, address, }) {
    const pkg = PACKAGES.find((p) => p.id === draft.packageId);
    const rows = [
        { label: "Vehicle", value: draft.vehicleName || "—" },
        { label: "Package", value: pkg?.name ?? "—" },
        {
            label: "When",
            value: draft.date && draft.slot
                ? `${new Date(draft.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${draft.slot}`
                : "—",
        },
        { label: "Address", value: address ?? "—" },
    ];
    return (_jsxs(GlassCard, { className: "h-fit lg:sticky lg:top-24", children: [_jsx("p", { className: "font-display text-lg font-semibold text-ink", children: "Summary" }), _jsxs("p", { className: "mt-1 text-xs text-muted", children: ["Step ", step + 1, " of ", STEP_LABELS.length] }), _jsxs("dl", { className: "mt-5 space-y-3", children: [rows.map((r) => (_jsxs("div", { className: "flex items-start justify-between gap-4 text-sm", children: [_jsx("dt", { className: "text-muted", children: r.label }), _jsx("dd", { className: "max-w-[60%] text-right font-medium text-ink", children: r.value })] }, r.label))), discount?.discountCode && discount.discountAmount > 0 && (_jsxs("div", { className: "flex items-start justify-between gap-4 text-sm", children: [_jsxs("dt", { className: "text-muted", children: ["Discount (", discount.discountCode, ")"] }), _jsxs("dd", { className: "max-w-[60%] text-right font-medium text-emerald-600", children: ["\u2212", formatMoney(discount.discountAmount)] })] })), discount && discount.coinDiscount > 0 && (_jsxs("div", { className: "flex items-start justify-between gap-4 text-sm", children: [_jsxs("dt", { className: "text-muted", children: ["Coins (", discount.coinsRedeemed.toLocaleString("en-IN"), ")"] }), _jsxs("dd", { className: "max-w-[60%] text-right font-medium text-amber-600", children: ["\u2212", formatMoney(discount.coinDiscount)] })] }))] }), _jsxs("div", { className: "mt-5 flex items-center justify-between border-t border-line pt-4", children: [_jsx("span", { className: "text-sm text-muted", children: "Total" }), _jsx("span", { className: "font-display text-2xl font-semibold text-ink", children: total ? formatMoney(total) : "—" })] })] }));
}
/* --------------------------- Confirmation ------------------------------- */
function Confirmation({ booking }) {
    return (_jsxs("div", { className: "mx-auto max-w-lg py-10 text-center", children: [_jsx(motion.div, { initial: { scale: 0, rotate: -20 }, animate: { scale: 1, rotate: 0 }, transition: { type: "spring", stiffness: 200, damping: 14 }, className: "mx-auto grid size-20 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-[var(--shadow-glow)]", children: _jsx(CheckCircle2, { className: "size-10" }) }), _jsx("h1", { className: "mt-6 font-display text-3xl font-semibold text-ink", children: "Booking confirmed!" }), _jsxs("p", { className: "mt-2 text-muted", children: ["We're finding you the nearest available cleaner \u2014 you'll be notified the moment one accepts. Booking ID ", _jsx("span", { className: "font-medium text-ink", children: booking.id }), "."] }), _jsx(GlassCard, { className: "mt-8 text-left", children: _jsxs("dl", { className: "space-y-3 text-sm", children: [_jsx(Row, { label: "Vehicle", value: booking.vehicleName }), _jsx(Row, { label: "Package", value: booking.packageName }), _jsx(Row, { label: "When", value: `${new Date(booking.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · ${booking.slot}` }), _jsx(Row, { label: "Address", value: `${booking.addressLabel} — ${booking.addressLine}` }), !!booking.discountAmount && (_jsx(Row, { label: `Discount${booking.discountCode ? ` (${booking.discountCode})` : ""}`, value: `−${formatMoney(booking.discountAmount)}` })), !!booking.coinDiscount && (_jsx(Row, { label: `Coins (${(booking.coinsRedeemed ?? 0).toLocaleString("en-IN")})`, value: `−${formatMoney(booking.coinDiscount)}` })), _jsxs("div", { className: "flex items-center justify-between border-t border-line pt-3", children: [_jsx("span", { className: "text-muted", children: "Paid" }), _jsx("span", { className: "font-display text-xl font-semibold text-ink", children: formatMoney(booking.price) })] })] }) }), _jsxs("div", { className: "mt-8 flex justify-center gap-3", children: [_jsx(Button, { asChild: true, variant: "outline", children: _jsx(Link, { to: "/app", children: "Back to dashboard" }) }), _jsx(Button, { asChild: true, children: _jsx(Link, { to: "/app/bookings", children: "View my bookings" }) })] })] }));
}
function Row({ label, value }) {
    return (_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsx("span", { className: "text-muted", children: label }), _jsx("span", { className: "max-w-[60%] text-right font-medium text-ink", children: value })] }));
}
