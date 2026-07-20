import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { Users, IndianRupee, Repeat, Plus, Trash2, Check, X } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { formatMoney } from "@shared/lib/format";
import { StatCard } from "../components/StatCard";
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan, useVehicleCategories } from "../api/admin.api";
function emptyDraft(categories) {
    return Object.fromEntries(categories.map((c) => [c.key, ""]));
}
/** Turn a string price draft into numeric PlanPrices (blank/invalid → 0). */
function toPrices(draft, categories) {
    return Object.fromEntries(categories.map((c) => [c.key, Number(draft[c.key]) || 0]));
}
function VehiclePriceInputs({ categories, draft, onChange, }) {
    return (_jsx("div", { className: "grid gap-2 sm:grid-cols-2", children: categories.map((c) => (_jsxs("label", { className: "flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3", children: [_jsx("span", { className: "text-sm text-muted", children: c.name }), _jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-muted", children: "\u20B9" }), _jsx("input", { type: "number", value: draft[c.key] ?? "", onChange: (e) => onChange(c.key, e.target.value), placeholder: "0", className: "h-9 w-24 bg-transparent text-right text-ink outline-none" })] })] }, c.key))) }));
}
function PlanCard({ plan, categories }) {
    const update = useUpdatePlan();
    const remove = useDeletePlan();
    const [editing, setEditing] = useState(false);
    const [prices, setPrices] = useState(() => Object.fromEntries(categories.map((c) => [c.key, String(plan.prices[c.key] ?? "")])));
    const [washes, setWashes] = useState(String(plan.washesPerMonth));
    const save = () => {
        update.mutate({ id: plan.id, prices: toPrices(prices, categories), washesPerMonth: Number(washes) || 0 }, { onSuccess: () => setEditing(false) });
    };
    const remove_ = () => {
        if (window.confirm(`Delete the "${plan.name}" plan? This can't be undone.`)) {
            remove.mutate(plan.id);
        }
    };
    return (_jsxs(GlassCard, { className: plan.active ? "" : "opacity-60", children: [_jsxs("div", { className: "flex items-baseline justify-between", children: [_jsx("p", { className: "font-display text-xl font-semibold text-ink", children: plan.name }), !editing && (_jsxs("p", { className: "font-display text-lg font-semibold text-primary", children: [_jsx("span", { className: "text-sm font-normal text-muted", children: "from " }), formatMoney(plan.price), _jsx("span", { className: "text-sm font-normal text-muted", children: "/mo" })] }))] }), editing ? (_jsxs("div", { className: "mt-4 space-y-3", children: [_jsx(VehiclePriceInputs, { categories: categories, draft: prices, onChange: (key, value) => setPrices((p) => ({ ...p, [key]: value })) }), _jsxs("label", { className: "flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3", children: [_jsx("span", { className: "text-sm text-muted", children: "Washes / month (-1 = unlimited)" }), _jsx("input", { type: "number", value: washes, onChange: (e) => setWashes(e.target.value), className: "h-9 w-16 bg-transparent text-right text-ink outline-none" })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "mt-5 flex items-end justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "font-display text-3xl font-semibold text-ink", children: plan.subscribers }), _jsx("p", { className: "text-sm text-muted", children: "subscribers" })] }), _jsxs("p", { className: "text-sm font-medium text-muted", children: [plan.washesPerMonth < 0 ? "Unlimited" : `${plan.washesPerMonth}/mo`, " washes"] })] }), _jsx("dl", { className: "mt-4 space-y-1 border-t border-line/70 pt-4 text-sm", children: categories.map((c) => (_jsxs("div", { className: "flex justify-between", children: [_jsx("dt", { className: "text-muted", children: c.name }), _jsxs("dd", { className: "font-medium text-ink", children: [formatMoney(plan.prices[c.key] ?? 0), "/mo"] })] }, c.key))) })] })), _jsx("div", { className: "mt-4 flex gap-2 border-t border-line/70 pt-4", children: editing ? (_jsxs(_Fragment, { children: [_jsxs(Button, { size: "sm", className: "flex-1", disabled: update.isPending, onClick: save, children: [_jsx(Check, { className: "size-4" }), " Save"] }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => setEditing(false), children: _jsx(X, { className: "size-4" }) })] })) : (_jsxs(_Fragment, { children: [_jsx(Button, { size: "sm", variant: "outline", className: "flex-1", onClick: () => setEditing(true), children: "Edit" }), _jsx(Button, { size: "sm", variant: "outline", disabled: update.isPending, onClick: () => update.mutate({ id: plan.id, active: !plan.active }), children: plan.active ? "Deactivate" : "Activate" }), _jsx(Button, { size: "sm", variant: "ghost", disabled: remove.isPending, onClick: remove_, children: _jsx(Trash2, { className: "size-4" }) })] })) })] }));
}
function NewPlanForm({ categories, onClose }) {
    const create = useCreatePlan();
    const [name, setName] = useState("");
    const [washes, setWashes] = useState("");
    const [prices, setPrices] = useState(() => emptyDraft(categories));
    const submit = () => {
        if (!name.trim())
            return;
        create.mutate({ name: name.trim(), prices: toPrices(prices, categories), washesPerMonth: Number(washes) || 0 }, { onSuccess: () => onClose() });
    };
    return (_jsxs(GlassCard, { children: [_jsx("p", { className: "font-display text-lg font-semibold text-ink", children: "New plan" }), _jsxs("div", { className: "mt-4 grid gap-3 sm:grid-cols-2", children: [_jsx(Input, { name: "name", label: "Name", placeholder: "Gold", value: name, onChange: (e) => setName(e.target.value) }), _jsx(Input, { name: "washesPerMonth", label: "Washes / month (-1 = unlimited)", type: "number", placeholder: "6", value: washes, onChange: (e) => setWashes(e.target.value) })] }), _jsx("p", { className: "mt-5 mb-2 text-sm font-medium text-ink", children: "Monthly price per vehicle category" }), _jsx(VehiclePriceInputs, { categories: categories, draft: prices, onChange: (key, value) => setPrices((p) => ({ ...p, [key]: value })) }), _jsxs("div", { className: "mt-4 flex gap-2", children: [_jsxs(Button, { onClick: submit, disabled: create.isPending || !name.trim(), children: [_jsx(Check, { className: "size-4" }), " Create plan"] }), _jsx(Button, { variant: "ghost", onClick: onClose, children: "Cancel" })] })] }));
}
export function Plans() {
    const { data: plans = [] } = usePlans();
    const { data: categories = [] } = useVehicleCategories();
    const [adding, setAdding] = useState(false);
    const activePlans = plans.filter((p) => p.active);
    const totalSubs = plans.reduce((s, p) => s + p.subscribers, 0);
    const mrr = plans.reduce((s, p) => s + p.subscribers * p.price, 0);
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-display text-3xl text-ink", children: "Subscriptions" }), _jsx("p", { className: "mt-1 text-muted", children: "Recurring revenue across all plans." })] }), !adding && (_jsxs(Button, { onClick: () => setAdding(true), children: [_jsx(Plus, { className: "size-4" }), " New plan"] }))] }), adding && _jsx(NewPlanForm, { categories: categories, onClose: () => setAdding(false) }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-3", children: [_jsx(StatCard, { icon: Users, label: "Total subscribers", value: totalSubs.toLocaleString("en-IN") }), _jsx(StatCard, { icon: IndianRupee, label: "Monthly recurring revenue", value: formatMoney(mrr), delta: "8.2%", trend: "up" }), _jsx(StatCard, { icon: Repeat, label: "Active plans", value: String(activePlans.length) })] }), _jsxs("div", { className: "grid gap-5 lg:grid-cols-3", children: [plans.map((p) => (_jsx(PlanCard, { plan: p, categories: categories }, p.id))), plans.length === 0 && _jsx("p", { className: "text-muted", children: "No plans yet \u2014 create one above." })] })] }));
}
