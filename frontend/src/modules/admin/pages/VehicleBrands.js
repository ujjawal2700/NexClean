import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Plus, Trash2, X, Car } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { useVehicleBrands, useCreateVehicleBrand, useUpdateVehicleBrand, useDeleteVehicleBrand, useVehicleModels, useCreateVehicleModel, useUpdateVehicleModel, useDeleteVehicleModel, useVehicleCategories, } from "../api/admin.api";
function ModelRows({ brand }) {
    const { data: models = [] } = useVehicleModels(brand.id);
    const { data: categories = [] } = useVehicleCategories();
    const create = useCreateVehicleModel();
    const update = useUpdateVehicleModel();
    const remove = useDeleteVehicleModel();
    const [name, setName] = useState("");
    const [categoryKey, setCategoryKey] = useState(categories[0]?.key ?? "");
    // `categories` loads asynchronously — if it was still empty on mount, the
    // useState initializer above never gets a real value, permanently disabling
    // "Add model" (its category select LOOKS populated once the fetch resolves,
    // but categoryKey stays ""). Sync it once real categories arrive.
    useEffect(() => {
        if (!categoryKey && categories.length > 0)
            setCategoryKey(categories[0].key);
    }, [categories, categoryKey]);
    const categoryName = (key) => categories.find((c) => c.key === key)?.name ?? key;
    const submit = () => {
        if (!name.trim() || !categoryKey)
            return;
        create.mutate({ brandId: brand.id, name: name.trim(), categoryKey }, { onSuccess: () => setName("") });
    };
    return (_jsxs("div", { className: "mt-4", children: [_jsxs("div", { className: "grid gap-2 sm:grid-cols-[1fr_1fr_auto]", children: [_jsx(Input, { name: `model-${brand.id}`, placeholder: "e.g. Creta", value: name, onChange: (e) => setName(e.target.value), onKeyDown: (e) => e.key === "Enter" && submit() }), _jsx("select", { value: categoryKey, onChange: (e) => setCategoryKey(e.target.value), className: "h-12 w-full rounded-2xl border border-line bg-surface px-4 text-ink outline-none focus:border-primary/50", children: categories.map((c) => (_jsx("option", { value: c.key, children: c.name }, c.key))) }), _jsxs(Button, { size: "sm", onClick: submit, disabled: create.isPending || !name.trim() || !categoryKey, children: [_jsx(Plus, { className: "size-4" }), " Add model"] })] }), _jsxs("div", { className: "mt-3 flex flex-wrap gap-2", children: [models.map((m) => (_jsxs("span", { className: `flex items-center gap-1.5 rounded-pill border px-3 py-1 text-sm ${m.active ? "border-line bg-surface/60 text-ink" : "border-line bg-surface/30 text-muted line-through"}`, children: [m.name, _jsxs("span", { className: "text-xs text-muted", children: ["\u00B7 ", categoryName(m.categoryKey)] }), _jsx("button", { onClick: () => update.mutate({ brandId: brand.id, modelId: m.id, active: !m.active }), disabled: update.isPending, className: "text-muted hover:text-primary", "aria-label": m.active ? `Deactivate ${m.name}` : `Activate ${m.name}`, children: m.active ? "•" : "○" }), _jsx("button", { onClick: () => remove.mutate({ brandId: brand.id, modelId: m.id }), disabled: remove.isPending, "aria-label": `Remove ${m.name}`, className: "text-muted hover:text-red-500", children: _jsx(X, { className: "size-3.5" }) })] }, m.id))), models.length === 0 && _jsx("p", { className: "text-sm text-muted", children: "No models added yet." })] })] }));
}
export function VehicleBrands() {
    const { data: brands = [] } = useVehicleBrands();
    const create = useCreateVehicleBrand();
    const update = useUpdateVehicleBrand();
    const remove = useDeleteVehicleBrand();
    const [name, setName] = useState("");
    const submit = () => {
        if (!name.trim())
            return;
        create.mutate({ name: name.trim() }, { onSuccess: () => setName("") });
    };
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-display text-3xl text-ink", children: "Vehicle Brands" }), _jsx("p", { className: "mt-1 text-muted", children: "Manage car brands and their models. Each model carries its own category \u2014 a brand like Hyundai can span Hatchback, Sedan and SUV models all at once." })] }), _jsxs(GlassCard, { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Car, { className: "size-5 text-primary" }), _jsx("p", { className: "font-display text-lg font-semibold text-ink", children: "Add a brand" })] }), _jsxs("div", { className: "mt-4 flex gap-2", children: [_jsx(Input, { name: "brandName", placeholder: "e.g. Hyundai", value: name, onChange: (e) => setName(e.target.value), onKeyDown: (e) => e.key === "Enter" && submit() }), _jsxs(Button, { onClick: submit, disabled: create.isPending || !name.trim(), children: [_jsx(Plus, { className: "size-4" }), " Add brand"] })] })] }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-2", children: [brands.map((b) => (_jsxs(GlassCard, { children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("p", { className: `font-display text-lg font-semibold ${b.active ? "text-ink" : "text-muted line-through"}`, children: b.name }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(Button, { variant: "outline", size: "sm", disabled: update.isPending, onClick: () => update.mutate({ id: b.id, active: !b.active }), children: b.active ? "Active" : "Inactive" }), _jsx(Button, { variant: "ghost", size: "sm", disabled: remove.isPending, onClick: () => remove.mutate(b.id), children: _jsx(Trash2, { className: "size-4" }) })] })] }), _jsx(ModelRows, { brand: b })] }, b.id))), brands.length === 0 && (_jsx(GlassCard, { className: "py-12 text-center text-muted lg:col-span-2", children: "No brands yet. Add one above." }))] })] }));
}
