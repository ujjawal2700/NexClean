import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Car, Plus, Trash2 } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { BrandModelSelect } from "../components/BrandModelSelect";
import { useMe, useCategoryLabel } from "../api/queries";
import { useAddVehicle, useRemoveVehicle } from "../api/mutations";
export function Vehicles() {
    const navigate = useNavigate();
    const { data: me } = useMe();
    const vehicles = me?.vehicles ?? [];
    const categoryLabel = useCategoryLabel();
    const addVehicle = useAddVehicle();
    const removeVehicle = useRemoveVehicle();
    const [showVehicle, setShowVehicle] = useState(false);
    const [selection, setSelection] = useState(null);
    const [vPlate, setVPlate] = useState("");
    const saveVehicle = () => {
        if (!selection)
            return;
        addVehicle.mutate({
            name: `${selection.brand} ${selection.model}`,
            type: selection.categoryKey,
            brand: selection.brand,
            model: selection.model,
            plate: vPlate.trim() || "—",
        }, {
            onSuccess: () => {
                setSelection(null);
                setVPlate("");
                setShowVehicle(false);
            },
        });
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => navigate(-1), className: "flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0", "aria-label": "Back", children: _jsx(ArrowLeft, { className: "size-4" }) }), _jsx("h1", { className: "font-display text-3xl text-ink", children: "Your garage" })] }), _jsxs(GlassCard, { children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "font-display text-lg font-semibold text-ink", children: "Vehicles" }), _jsxs(Button, { variant: "ghost", size: "sm", onClick: () => setShowVehicle((v) => !v), children: [_jsx(Plus, { className: "size-4" }), " Add vehicle"] })] }), showVehicle && (_jsxs("div", { className: "mt-4 grid gap-3 rounded-2xl border border-line bg-surface-muted/40 p-4 sm:grid-cols-2", children: [_jsx(BrandModelSelect, { onResolved: setSelection }), _jsx(Input, { name: "vplate", label: "Plate", placeholder: "GJ 01 AB 1234", value: vPlate, onChange: (e) => setVPlate(e.target.value) }), _jsx("div", { className: "sm:col-span-2", children: _jsx(Button, { size: "sm", onClick: saveVehicle, disabled: addVehicle.isPending || !selection, children: "Save vehicle" }) })] })), _jsxs("div", { className: "mt-4 grid gap-3 sm:grid-cols-2", children: [vehicles.map((v) => (_jsxs("div", { className: "flex items-center gap-3 rounded-2xl border border-line bg-surface p-4", children: [_jsx("div", { className: "w-20 shrink-0", children: _jsx(CarSilhouette, { type: v.type, uid: `prof-${v.id}` }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate font-display font-semibold text-ink", children: v.name }), _jsxs("p", { className: "text-sm text-muted", children: [categoryLabel(v.type), " \u00B7 ", v.plate] })] }), _jsx("button", { onClick: () => removeVehicle.mutate(v.id), className: "grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-500", "aria-label": `Remove ${v.name}`, children: _jsx(Trash2, { className: "size-4" }) })] }, v.id))), vehicles.length === 0 && (_jsxs("p", { className: "flex items-center gap-2 text-sm text-muted", children: [_jsx(Car, { className: "size-4" }), " No vehicles yet."] }))] })] })] }));
}
