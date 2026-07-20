import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { Plus, Sparkles, Search, RotateCcw, UserPlus } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Badge } from "@shared/ui/Badge";
import { formatMoney } from "@shared/lib/format";
import { useSpecialCoupons, useGenerateSpecialCoupons, useAssignSpecialCoupon, useToggleSpecialCouponActive, useReactivateSpecialCoupon, useCustomers, } from "../api/admin.api";
function discountLabel(coupon) {
    const base = coupon.type === "percent" ? `${coupon.value}% off` : `${formatMoney(coupon.value)} off`;
    const extras = [
        coupon.type === "percent" && coupon.maxDiscount ? `up to ${formatMoney(coupon.maxDiscount)}` : null,
        coupon.minOrderValue ? `min order ${formatMoney(coupon.minOrderValue)}` : null,
    ].filter(Boolean);
    return extras.length ? `${base} · ${extras.join(" · ")}` : base;
}
function statusBadgeClass(status) {
    if (status === "used")
        return "border-line/70 bg-surface-muted text-muted";
    if (status === "inactive")
        return "border-red-500/20 bg-red-500/10 text-red-500";
    return "border-primary/15 bg-primary/8 text-primary";
}
function GenerateCouponsSection() {
    const generate = useGenerateSpecialCoupons();
    const [open, setOpen] = useState(false);
    const [count, setCount] = useState("10");
    const [type, setType] = useState("percent");
    const [value, setValue] = useState("");
    const [minOrderValue, setMinOrderValue] = useState("");
    const [maxDiscount, setMaxDiscount] = useState("");
    const [validFrom, setValidFrom] = useState("");
    const [validTill, setValidTill] = useState("");
    const reset = () => {
        setCount("10");
        setValue("");
        setMinOrderValue("");
        setMaxDiscount("");
        setValidFrom("");
        setValidTill("");
    };
    const submit = () => {
        const n = Number(count);
        if (!n || n < 1 || !value)
            return;
        generate.mutate({
            count: n,
            type,
            value: Number(value),
            minOrderValue: minOrderValue ? Number(minOrderValue) : undefined,
            maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
            validFrom: validFrom ? new Date(validFrom).toISOString() : undefined,
            validTill: validTill ? new Date(validTill).toISOString() : undefined,
        }, { onSuccess: () => { reset(); setOpen(false); } });
    };
    return (_jsxs(GlassCard, { className: "space-y-5", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Sparkles, { className: "size-5 text-primary" }), _jsx("p", { className: "font-display text-lg font-semibold text-ink", children: "Special Coupons" })] }), _jsxs(Button, { size: "sm", onClick: () => setOpen((v) => !v), children: [_jsx(Plus, { className: "size-4" }), " Generate coupons"] })] }), _jsx("p", { className: "text-sm text-muted", children: "Generate a batch of one-time, auto-coded coupons and gift them to specific customers. Each coupon can only be redeemed by the customer it's assigned to, and only once." }), open && (_jsxs("div", { className: "space-y-3 rounded-2xl border border-line bg-surface/60 p-4", children: [_jsxs("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3", children: [_jsx(Input, { name: "count", type: "number", min: 1, max: 500, placeholder: "How many coupons?", value: count, onChange: (e) => setCount(e.target.value) }), _jsxs("select", { value: type, onChange: (e) => setType(e.target.value), className: "h-12 rounded-2xl border border-line bg-surface px-4 text-ink outline-none focus:border-primary/50", children: [_jsx("option", { value: "percent", children: "% off" }), _jsx("option", { value: "flat", children: "\u20B9 flat off" })] }), _jsx(Input, { name: "value", type: "number", placeholder: type === "percent" ? "e.g. 20" : "e.g. 100", value: value, onChange: (e) => setValue(e.target.value) }), _jsx(Input, { name: "minOrderValue", type: "number", placeholder: "Min order (optional)", value: minOrderValue, onChange: (e) => setMinOrderValue(e.target.value) }), type === "percent" && (_jsx(Input, { name: "maxDiscount", type: "number", placeholder: "Max discount cap (optional)", value: maxDiscount, onChange: (e) => setMaxDiscount(e.target.value) })), _jsx(Input, { name: "validFrom", type: "date", placeholder: "Available from", value: validFrom, onChange: (e) => setValidFrom(e.target.value) }), _jsx(Input, { name: "validTill", type: "date", placeholder: "Available till", value: validTill, onChange: (e) => setValidTill(e.target.value) })] }), _jsx(Button, { size: "sm", onClick: submit, disabled: generate.isPending || !count || !value, children: generate.isPending ? "Generating…" : `Generate ${count || 0} coupon(s)` })] }))] }));
}
function AssignPanel({ coupon }) {
    const { data: customers = [] } = useCustomers();
    const assign = useAssignSpecialCoupon();
    const [query, setQuery] = useState("");
    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q)
            return [];
        return customers
            .filter((c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
            .slice(0, 8);
    }, [customers, query]);
    return (_jsxs("div", { className: "mt-2 space-y-2", children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { className: "pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" }), _jsx(Input, { name: `assign-${coupon.id}`, placeholder: "Search customer by name, phone, or email\u2026", value: query, onChange: (e) => setQuery(e.target.value), className: "pl-10" })] }), matches.length > 0 && (_jsx("div", { className: "space-y-1 rounded-xl border border-line bg-surface/80 p-1.5", children: matches.map((c) => (_jsxs("button", { onClick: () => assign.mutate({ id: coupon.id, customerId: c.id }), disabled: assign.isPending, className: "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-surface-muted", children: [_jsx("span", { className: "font-medium text-ink", children: c.name }), _jsx("span", { className: "text-xs text-muted", children: c.phone })] }, c.id))) })), query.trim() && matches.length === 0 && _jsx("p", { className: "px-1 text-xs text-muted", children: "No customers match." })] }));
}
function CouponRow({ coupon }) {
    const toggleActive = useToggleSpecialCouponActive();
    const reactivate = useReactivateSpecialCoupon();
    const [assigning, setAssigning] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const unassigned = !coupon.assignedCustomer;
    return (_jsxs("div", { className: "rounded-2xl border border-line bg-surface/60 p-3", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("p", { className: "font-mono text-sm font-semibold text-ink", children: coupon.code }), _jsx(Badge, { className: statusBadgeClass(coupon.status), children: coupon.status })] }), _jsxs("p", { className: "text-xs text-muted", children: [discountLabel(coupon), coupon.validTill ? ` · valid till ${new Date(coupon.validTill).toLocaleDateString("en-IN")}` : ""] }), _jsx("p", { className: "text-xs text-muted", children: coupon.assignedCustomer
                                    ? `Assigned to ${coupon.assignedCustomer.name} · ${coupon.assignedCustomer.phone}`
                                    : "Unassigned" })] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [unassigned && coupon.status === "active" && (_jsxs(Button, { variant: "outline", size: "sm", onClick: () => setAssigning((v) => !v), children: [_jsx(UserPlus, { className: "size-4" }), " Assign"] })), coupon.status === "used" && (_jsxs(_Fragment, { children: [coupon.usageHistory.length > 0 && (_jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowHistory((v) => !v), children: "History" })), _jsxs(Button, { variant: "outline", size: "sm", disabled: reactivate.isPending, onClick: () => reactivate.mutate(coupon.id), children: [_jsx(RotateCcw, { className: "size-4" }), " Reactivate"] })] })), coupon.status !== "used" && (_jsx(Button, { variant: "outline", size: "sm", disabled: toggleActive.isPending, onClick: () => toggleActive.mutate({ id: coupon.id, active: coupon.status !== "active" }), children: coupon.status === "active" ? "Active" : "Inactive" }))] })] }), assigning && unassigned && coupon.status === "active" && _jsx(AssignPanel, { coupon: coupon }), showHistory && coupon.usageHistory.length > 0 && (_jsx("div", { className: "mt-2 space-y-1 rounded-xl border border-line bg-surface/80 p-2.5 text-xs text-muted", children: coupon.usageHistory.map((h, i) => (_jsxs("p", { children: ["Used ", new Date(h.usedAt).toLocaleString("en-IN"), " \u00B7 discount ", formatMoney(h.discountAmount)] }, i))) }))] }));
}
function CouponBatches() {
    const { data: coupons = [], isLoading } = useSpecialCoupons();
    const batches = useMemo(() => {
        const map = new Map();
        for (const c of coupons) {
            const list = map.get(c.batchId) ?? [];
            list.push(c);
            map.set(c.batchId, list);
        }
        return Array.from(map.entries());
    }, [coupons]);
    if (isLoading)
        return _jsx("p", { className: "text-sm text-muted", children: "Loading coupons\u2026" });
    if (batches.length === 0)
        return _jsx("p", { className: "text-sm text-muted", children: "No special coupons yet. Generate a batch above." });
    return (_jsx("div", { className: "space-y-5", children: batches.map(([batchId, batch]) => (_jsxs(GlassCard, { className: "space-y-3", children: [_jsxs("p", { className: "text-sm font-semibold text-ink", children: ["Batch of ", batch.length, " \u00B7 generated ", new Date(batch[0].createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })] }), _jsx("div", { className: "space-y-2", children: batch.map((c) => (_jsx(CouponRow, { coupon: c }, c.id))) })] }, batchId))) }));
}
export function SpecialCoupons() {
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-display text-3xl text-ink", children: "Special Coupons" }), _jsx("p", { className: "mt-1 text-muted", children: "Generate one-time, auto-coded coupons and gift them to specific customers \u2014 separate from the shared discount codes managed under Coupon & Promotions." })] }), _jsx(GenerateCouponsSection, {}), _jsx(CouponBatches, {})] }));
}
