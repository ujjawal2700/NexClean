import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useVehicleBrands, useVehicleModels, useVehicleCategories } from "../api/queries";
const selectClass = "h-12 w-full rounded-2xl border border-line bg-surface px-4 text-ink outline-none focus:border-primary/50 disabled:opacity-50";
/**
 * Brand > model picker. The category is derived from whichever model is
 * picked (a brand spans many categories) and reported via onResolved — the
 * parent never has to ask the customer for a category directly. Falls back
 * to a manual name + category entry if their car isn't in the catalog yet.
 */
export function BrandModelSelect({ onResolved }) {
    const { data: brands = [], isLoading: loadingBrands } = useVehicleBrands();
    const [brandId, setBrandId] = useState("");
    const [modelId, setModelId] = useState("");
    const { data: models = [], isLoading: loadingModels } = useVehicleModels(brandId || null);
    const [manual, setManual] = useState(false);
    const [manualBrand, setManualBrand] = useState("");
    const [manualModel, setManualModel] = useState("");
    const [manualCategory, setManualCategory] = useState("");
    const { data: categories = [] } = useVehicleCategories();
    const selectedBrand = brands.find((b) => b.id === brandId);
    const pickBrand = (id) => {
        setBrandId(id);
        setModelId("");
        onResolved(null);
    };
    const pickModel = (id) => {
        setModelId(id);
        const model = models.find((m) => m.id === id);
        if (model && selectedBrand)
            onResolved({ brand: selectedBrand.name, model: model.name, categoryKey: model.categoryKey });
        else
            onResolved(null);
    };
    const updateManual = (patch) => {
        const brand = patch.brand ?? manualBrand;
        const model = patch.model ?? manualModel;
        const category = patch.category ?? manualCategory;
        if (patch.brand !== undefined)
            setManualBrand(patch.brand);
        if (patch.model !== undefined)
            setManualModel(patch.model);
        if (patch.category !== undefined)
            setManualCategory(patch.category);
        if (brand.trim() && model.trim() && category)
            onResolved({ brand: brand.trim(), model: model.trim(), categoryKey: category });
        else
            onResolved(null);
    };
    if (manual) {
        return (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1.5 block text-sm font-medium text-ink", children: "Brand" }), _jsx("input", { className: "h-12 w-full rounded-2xl border border-line bg-surface px-4 text-ink outline-none focus:border-primary/50", placeholder: "e.g. Hyundai", value: manualBrand, onChange: (e) => updateManual({ brand: e.target.value }) })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1.5 block text-sm font-medium text-ink", children: "Model" }), _jsx("input", { className: "h-12 w-full rounded-2xl border border-line bg-surface px-4 text-ink outline-none focus:border-primary/50", placeholder: "e.g. Creta", value: manualModel, onChange: (e) => updateManual({ model: e.target.value }) })] }), _jsxs("div", { className: "sm:col-span-2", children: [_jsx("label", { className: "mb-1.5 block text-sm font-medium text-ink", children: "Vehicle category" }), _jsxs("select", { value: manualCategory, onChange: (e) => updateManual({ category: e.target.value }), className: selectClass, children: [_jsx("option", { value: "", children: "Select category" }), categories.map((c) => (_jsx("option", { value: c.key, children: c.name }, c.key)))] }), _jsx("button", { type: "button", onClick: () => {
                                setManual(false);
                                onResolved(null);
                            }, className: "mt-2 text-sm font-medium text-primary hover:underline", children: "Search the catalog instead" })] })] }));
    }
    return (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1.5 block text-sm font-medium text-ink", children: "Brand" }), _jsxs("select", { value: brandId, onChange: (e) => pickBrand(e.target.value), className: selectClass, children: [_jsx("option", { value: "", children: loadingBrands ? "Loading…" : "Select brand" }), brands.map((b) => (_jsx("option", { value: b.id, children: b.name }, b.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1.5 block text-sm font-medium text-ink", children: "Model" }), _jsxs("select", { value: modelId, onChange: (e) => pickModel(e.target.value), disabled: !brandId, className: selectClass, children: [_jsx("option", { value: "", children: !brandId ? "Choose a brand first" : loadingModels ? "Loading…" : "Select model" }), models.map((m) => (_jsx("option", { value: m.id, children: m.name }, m.id)))] })] }), _jsx("div", { className: "sm:col-span-2", children: _jsx("button", { type: "button", onClick: () => {
                        setManual(true);
                        onResolved(null);
                    }, className: "text-sm font-medium text-primary hover:underline", children: "Can't find your car? Enter it manually" }) })] }));
}
