import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { Plus, Trash2, Layers } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { formatMoney } from "@shared/lib/format";
import { useVehicleCategories, useCreateVehicleCategory, useUpdateVehicleCategory, useDeleteVehicleCategory, } from "../api/admin.api";
function CategoryCard({ category }) {
    const update = useUpdateVehicleCategory();
    const remove = useDeleteVehicleCategory();
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(category.name);
    const [basePrice, setBasePrice] = useState(String(category.basePrice));
    const save = () => {
        update.mutate({ id: category.id, name: name.trim() || category.name, basePrice: Number(basePrice) || category.basePrice }, { onSuccess: () => setEditing(false) });
    };
    const remove_ = () => {
        if (window.confirm(`Delete the "${category.name}" category? This can't be undone.`)) {
            remove.mutate(category.id);
        }
    };
    return (_jsxs(GlassCard, { className: category.active ? "" : "opacity-60", children: [_jsx("div", { className: "mb-2 h-14", children: _jsx(CarSilhouette, { type: category.key, uid: `cat-${category.key}`, className: "mx-auto h-full w-auto" }) }), editing ? (_jsxs("div", { className: "space-y-3", children: [_jsx(Input, { name: `name-${category.id}`, label: "Name", value: name, onChange: (e) => setName(e.target.value) }), _jsxs("div", { className: "flex items-center gap-1 rounded-xl border border-line bg-surface px-3 focus-within:border-primary/50", children: [_jsx("span", { className: "text-muted", children: "\u20B9" }), _jsx("input", { type: "number", value: basePrice, onChange: (e) => setBasePrice(e.target.value), className: "h-10 w-full bg-transparent text-ink outline-none" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { size: "sm", className: "flex-1", disabled: update.isPending, onClick: save, children: "Save" }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => setEditing(false), children: "Cancel" })] })] })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-center font-display text-lg font-semibold text-ink", children: category.name }), _jsxs("p", { className: "text-center text-sm text-muted", children: [formatMoney(category.basePrice), " base price"] }), _jsxs("div", { className: "mt-4 flex gap-2", children: [_jsx(Button, { variant: "outline", size: "sm", className: "flex-1", onClick: () => setEditing(true), children: "Edit" }), _jsx(Button, { variant: "outline", size: "sm", disabled: update.isPending, onClick: () => update.mutate({ id: category.id, active: !category.active }), children: category.active ? "Active" : "Inactive" }), _jsx(Button, { size: "sm", variant: "ghost", disabled: remove.isPending, onClick: remove_, children: _jsx(Trash2, { className: "size-4" }) })] })] }))] }));
}
function NewCategoryForm({ onClose }) {
    const create = useCreateVehicleCategory();
    const [name, setName] = useState("");
    const [basePrice, setBasePrice] = useState("");
    const submit = () => {
        if (!name.trim() || !basePrice)
            return;
        create.mutate({ name: name.trim(), basePrice: Number(basePrice) || 0 }, { onSuccess: () => onClose() });
    };
    return (_jsxs(GlassCard, { children: [_jsx("p", { className: "font-display text-lg font-semibold text-ink", children: "New category" }), _jsxs("div", { className: "mt-4 grid gap-3 sm:grid-cols-2", children: [_jsx(Input, { name: "catName", label: "Name", placeholder: "Convertible", value: name, onChange: (e) => setName(e.target.value) }), _jsx(Input, { name: "catPrice", label: "Base price", type: "number", placeholder: "599", value: basePrice, onChange: (e) => setBasePrice(e.target.value) })] }), _jsx("p", { className: "mt-2 text-xs text-muted", children: "This price is wired into Pricing and every existing plan automatically \u2014 nothing's left unconfigured." }), _jsxs("div", { className: "mt-4 flex gap-2", children: [_jsxs(Button, { onClick: submit, disabled: create.isPending || !name.trim() || !basePrice, children: [_jsx(Plus, { className: "size-4" }), " Create category"] }), _jsx(Button, { variant: "ghost", onClick: onClose, children: "Cancel" })] })] }));
}
export function VehicleCategories() {
    const { data: categories = [] } = useVehicleCategories();
    const [adding, setAdding] = useState(false);
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-display text-3xl text-ink", children: "Vehicle Categories" }), _jsx("p", { className: "mt-1 text-muted", children: "The top-level categories (Hatchback, SUV, ...) that pricing and plans are based on." })] }), !adding && (_jsxs(Button, { onClick: () => setAdding(true), children: [_jsx(Plus, { className: "size-4" }), " New category"] }))] }), adding && _jsx(NewCategoryForm, { onClose: () => setAdding(false) }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4", children: [categories.map((c) => (_jsx(CategoryCard, { category: c }, c.id))), categories.length === 0 && (_jsxs(GlassCard, { className: "flex items-center gap-2 py-12 text-center text-muted sm:col-span-2 lg:col-span-4", children: [_jsx(Layers, { className: "size-4" }), " No categories yet \u2014 create one above."] }))] })] }));
}
