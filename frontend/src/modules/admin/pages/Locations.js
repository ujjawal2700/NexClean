import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef } from "react";
import { Plus, Trash2, MapPin, Building2 } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { usePlacesAutocomplete } from "@shared/hooks/usePlacesAutocomplete";
import { useCities, useZones, useCreateCity, useUpdateCity, useDeleteCity, useCreateZone, useUpdateZone, useDeleteZone, } from "../api/admin.api";
function CitiesPanel() {
    const { data: cities = [] } = useCities();
    const create = useCreateCity();
    const update = useUpdateCity();
    const remove = useDeleteCity();
    const [name, setName] = useState("");
    const inputRef = useRef(null);
    usePlacesAutocomplete({
        inputRef,
        types: ["(cities)"],
        onSelect: (placeName) => {
            const cityOnly = placeName.split(",")[0].trim();
            setName(cityOnly);
        },
    });
    const submit = () => {
        if (!name.trim())
            return;
        create.mutate({ name: name.trim() }, { onSuccess: () => setName("") });
    };
    return (_jsxs(GlassCard, { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Building2, { className: "size-5 text-primary" }), _jsx("p", { className: "font-display text-lg font-semibold text-ink", children: "Cities" })] }), _jsx("p", { className: "mt-1 text-sm text-muted", children: "Disabling a city marks it unavailable for service." }), _jsxs("div", { className: "mt-4 flex gap-2", children: [_jsx(Input, { ref: inputRef, name: "cityName", placeholder: "Search and select city (e.g. Bengaluru)", value: name, onChange: (e) => setName(e.target.value) }), _jsxs(Button, { onClick: submit, disabled: create.isPending || !name.trim(), children: [_jsx(Plus, { className: "size-4" }), " Add"] })] }), _jsxs("div", { className: "mt-5 space-y-2", children: [cities.map((c) => (_jsxs("div", { className: "flex items-center justify-between rounded-xl border border-line bg-surface/60 px-3 py-2.5", children: [_jsx("p", { className: `text-sm font-medium ${c.active ? "text-ink" : "text-muted line-through"}`, children: c.name }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(Button, { variant: "outline", size: "sm", disabled: update.isPending, onClick: () => update.mutate({ id: c.id, active: !c.active }), children: c.active ? "Active" : "Inactive" }), _jsx(Button, { variant: "ghost", size: "sm", disabled: remove.isPending, onClick: () => remove.mutate(c.id), children: _jsx(Trash2, { className: "size-4" }) })] })] }, c.id))), cities.length === 0 && _jsx("p", { className: "text-sm text-muted", children: "No cities yet." })] })] }));
}
function ZonesPanel() {
    const { data: cities = [] } = useCities();
    const { data: zones = [] } = useZones();
    const create = useCreateZone();
    const update = useUpdateZone();
    const remove = useDeleteZone();
    const [name, setName] = useState("");
    const [cityId, setCityId] = useState("");
    const inputRef = useRef(null);
    const selectedCity = cities.find((c) => c.id === cityId);
    usePlacesAutocomplete({
        inputRef,
        types: ["geocode", "establishment"],
        cityName: selectedCity?.name,
        onSelect: (placeName) => {
            const zoneOnly = placeName.split(",")[0].trim();
            setName(zoneOnly);
        },
    });
    const submit = () => {
        if (!name.trim() || !cityId)
            return;
        create.mutate({ name: name.trim(), cityId }, { onSuccess: () => setName("") });
    };
    return (_jsxs(GlassCard, { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(MapPin, { className: "size-5 text-primary" }), _jsx("p", { className: "font-display text-lg font-semibold text-ink", children: "Service zones" })] }), _jsx("p", { className: "mt-1 text-sm text-muted", children: "Areas/societies grouped by city. Used to assign agents to a service area." }), _jsxs("div", { className: "mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-end", children: [_jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "mb-1 text-xs font-medium text-muted", children: "Service Zone / Society" }), _jsx(Input, { ref: inputRef, name: "zoneName", placeholder: "Search location (e.g. Indiranagar)", value: name, onChange: (e) => setName(e.target.value), disabled: !cityId, hint: !cityId ? "Please select a city first" : undefined })] }), _jsxs("div", { className: "flex flex-col", children: [_jsx("p", { className: "mb-1.5 text-xs font-medium text-muted", children: "City" }), _jsxs("select", { value: cityId, onChange: (e) => setCityId(e.target.value), className: "h-12 rounded-2xl border border-line bg-surface px-4 text-sm text-ink outline-none focus:border-primary/50", children: [_jsx("option", { value: "", children: "Select city" }), cities.map((c) => (_jsx("option", { value: c.id, children: c.name }, c.id)))] })] }), _jsxs(Button, { onClick: submit, disabled: create.isPending || !name.trim() || !cityId, className: "h-12 rounded-2xl", children: [_jsx(Plus, { className: "size-4" }), " Add"] })] }), _jsxs("div", { className: "mt-5 space-y-2", children: [zones.map((z) => (_jsxs("div", { className: "flex items-center justify-between rounded-xl border border-line bg-surface/60 px-3 py-2.5", children: [_jsxs("div", { children: [_jsx("p", { className: `text-sm font-medium ${z.active ? "text-ink" : "text-muted line-through"}`, children: z.name }), _jsx("p", { className: "text-xs text-muted", children: z.cityName })] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(Button, { variant: "outline", size: "sm", disabled: update.isPending, onClick: () => update.mutate({ id: z.id, active: !z.active }), children: z.active ? "Active" : "Inactive" }), _jsx(Button, { variant: "ghost", size: "sm", disabled: remove.isPending, onClick: () => remove.mutate(z.id), children: _jsx(Trash2, { className: "size-4" }) })] })] }, z.id))), zones.length === 0 && _jsx("p", { className: "text-sm text-muted", children: "No zones yet." })] })] }));
}
export function Locations() {
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-display text-3xl text-ink", children: "Locations" }), _jsx("p", { className: "mt-1 text-muted", children: "Manage serviceable cities and zones, and control availability." })] }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-2", children: [_jsx(CitiesPanel, {}), _jsx(ZonesPanel, {})] })] }));
}
