import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { formatMoney } from "@shared/lib/format";
import { usePricing, useUpdatePricing, useVehicleCategories } from "../api/admin.api";
function slugify(name) {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}
export function Pricing() {
    const { data: serverPricing } = usePricing();
    const { data: categories = [] } = useVehicleCategories();
    const update = useUpdatePricing();
    const [draft, setDraft] = useState(null);
    const [saved, setSaved] = useState(false);
    useEffect(() => {
        if (serverPricing)
            setDraft({ base: serverPricing.base, packages: serverPricing.packages });
    }, [serverPricing]);
    if (!draft) {
        return _jsx("p", { className: "text-muted", children: "Loading pricing\u2026" });
    }
    const setBase = (type, value) => setDraft((d) => (d ? { ...d, base: { ...d.base, [type]: value } } : d));
    const patchPackage = (id, patch) => setDraft((d) => (d ? { ...d, packages: d.packages.map((p) => (p.id === id ? { ...p, ...patch } : p)) } : d));
    const removePackage = (id) => setDraft((d) => (d ? { ...d, packages: d.packages.filter((p) => p.id !== id) } : d));
    const addPackage = () => setDraft((d) => {
        if (!d)
            return d;
        let name = "New package";
        let id = slugify(name);
        let i = 1;
        while (d.packages.some((p) => p.id === id)) {
            i += 1;
            name = `New package ${i}`;
            id = slugify(name);
        }
        return { ...d, packages: [...d.packages, { id, name, factor: 1, durationMinutes: null, active: true }] };
    });
    const save = () => {
        update.mutate(draft, {
            onSuccess: () => {
                setSaved(true);
                setTimeout(() => setSaved(false), 1600);
            },
        });
    };
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-display text-3xl text-ink", children: "Pricing" }), _jsx("p", { className: "mt-1 text-muted", children: "Set base prices per vehicle and package multipliers." })] }), _jsxs(GlassCard, { children: [_jsx("p", { className: "font-display text-lg font-semibold text-ink", children: "Base price by vehicle" }), _jsxs("p", { className: "mt-1 text-sm text-muted", children: ["Need a new category? Add it from", " ", _jsx("a", { href: "/admin/vehicle-categories", className: "text-primary hover:underline", children: "Vehicle Categories" }), "."] }), _jsx("div", { className: "mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: categories.map((c) => (_jsxs("div", { className: "rounded-2xl border border-line bg-surface/60 p-4", children: [_jsx("div", { className: "mb-2 h-14", children: _jsx(CarSilhouette, { type: c.key, uid: `price-${c.key}`, className: "mx-auto h-full w-auto" }) }), _jsx("p", { className: "text-center text-sm font-medium text-ink", children: c.name }), _jsxs("div", { className: "mt-3 flex items-center gap-1 rounded-xl border border-line bg-surface px-3 focus-within:border-primary/50", children: [_jsx("span", { className: "text-muted", children: "\u20B9" }), _jsx("input", { type: "number", value: draft.base[c.key] ?? 0, onChange: (e) => setBase(c.key, Number(e.target.value) || 0), className: "h-10 w-full bg-transparent text-ink outline-none" })] })] }, c.key))) })] }), _jsxs(GlassCard, { children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "font-display text-lg font-semibold text-ink", children: "Service packages" }), _jsx("p", { className: "mt-1 text-sm text-muted", children: "Final price = base \u00D7 multiplier (rounded to \u20B910)." })] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: addPackage, children: [_jsx(Plus, { className: "size-4" }), " Add package"] })] }), _jsxs("div", { className: "mt-5 space-y-3", children: [draft.packages.map((p) => (_jsxs("div", { className: `flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/60 p-4 ${p.active === false ? "opacity-50" : ""}`, children: [_jsxs("div", { className: "min-w-40 flex-1 space-y-1", children: [_jsx("input", { type: "text", value: p.name, onChange: (e) => patchPackage(p.id, { name: e.target.value }), className: "h-9 w-full rounded-lg border border-line bg-surface px-2 font-display font-semibold text-ink outline-none focus:border-primary/50" }), categories[0] && (_jsxs("p", { className: "text-xs text-muted", children: ["e.g. ", categories[0].name, " \u2192", " ", formatMoney(Math.round(((draft.base[categories[0].key] ?? 0) * p.factor) / 10) * 10)] }))] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm text-muted", children: "\u00D7" }), _jsx("input", { type: "number", step: "0.1", value: p.factor, onChange: (e) => patchPackage(p.id, { factor: Number(e.target.value) || 0 }), className: "h-10 w-20 rounded-xl border border-line bg-surface px-3 text-ink outline-none focus:border-primary/50" })] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("input", { type: "number", value: p.durationMinutes ?? "", placeholder: "min", onChange: (e) => patchPackage(p.id, { durationMinutes: e.target.value ? Number(e.target.value) : null }), className: "h-10 w-20 rounded-xl border border-line bg-surface px-3 text-ink outline-none focus:border-primary/50" }), _jsx("span", { className: "text-xs text-muted", children: "min" })] }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => patchPackage(p.id, { active: p.active === false }), children: p.active === false ? "Inactive" : "Active" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => removePackage(p.id), children: _jsx(Trash2, { className: "size-4" }) })] }, p.id))), draft.packages.length === 0 && _jsx("p", { className: "text-sm text-muted", children: "No packages \u2014 add one above." })] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Button, { onClick: save, disabled: update.isPending, children: update.isPending ? _jsx(Loader2, { className: "size-4 animate-spin" }) : saved ? (_jsxs(_Fragment, { children: [_jsx(Check, { className: "size-4" }), " Saved"] })) : "Save pricing" }), _jsx("p", { className: "text-xs text-muted", children: "Applies to new bookings immediately." })] })] }));
}
