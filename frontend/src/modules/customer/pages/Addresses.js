import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Plus, Trash2 } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { usePlacesAutocomplete } from "@shared/hooks/usePlacesAutocomplete";
import { useMe } from "../api/queries";
import { useAddAddress, useRemoveAddress } from "../api/mutations";
export function Addresses() {
    const navigate = useNavigate();
    const { data: me } = useMe();
    const addresses = me?.addresses ?? [];
    const addAddress = useAddAddress();
    const removeAddress = useRemoveAddress();
    const [showAddr, setShowAddr] = useState(false);
    const [aLabel, setALabel] = useState("");
    const [aLine, setALine] = useState("");
    const [aCoords, setACoords] = useState(null);
    const [aPlaceId, setAPlaceId] = useState("");
    const lineRef = useRef(null);
    usePlacesAutocomplete({
        inputRef: lineRef,
        types: ["geocode", "establishment"],
        onSelect: (placeName, placeId, coords) => {
            setALine(placeName);
            setAPlaceId(placeId);
            setACoords(coords ?? null);
        },
    });
    const saveAddress = () => {
        if (!aLabel.trim() || !aLine.trim())
            return;
        addAddress.mutate({
            label: aLabel.trim(),
            line: aLine.trim(),
            society: aLine.trim(),
            lat: aCoords?.lat,
            lng: aCoords?.lng,
            placeId: aPlaceId || undefined,
        }, {
            onSuccess: () => {
                setALabel("");
                setALine("");
                setACoords(null);
                setAPlaceId("");
                setShowAddr(false);
            },
        });
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => navigate(-1), className: "flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0", "aria-label": "Back", children: _jsx(ArrowLeft, { className: "size-4" }) }), _jsx("h1", { className: "font-display text-3xl text-ink", children: "Saved addresses" })] }), _jsxs(GlassCard, { children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "font-display text-lg font-semibold text-ink", children: "Addresses" }), _jsxs(Button, { variant: "ghost", size: "sm", onClick: () => setShowAddr((v) => !v), children: [_jsx(Plus, { className: "size-4" }), " Add address"] })] }), showAddr && (_jsxs("div", { className: "mt-4 grid gap-3 rounded-2xl border border-line bg-surface-muted/40 p-4 sm:grid-cols-2", children: [_jsx(Input, { name: "alabel", label: "Label", placeholder: "Home / Office", value: aLabel, onChange: (e) => setALabel(e.target.value) }), _jsx(Input, { ref: lineRef, name: "aline", label: "Address", placeholder: "Search your address", value: aLine, onChange: (e) => {
                                    setALine(e.target.value);
                                    // Typing manually invalidates the previously picked pin.
                                    setACoords(null);
                                    setAPlaceId("");
                                }, hint: aCoords ? "📍 Location pinned" : "Pick a suggestion to pin the exact location" }), _jsx("div", { className: "sm:col-span-2", children: _jsx(Button, { size: "sm", onClick: saveAddress, disabled: addAddress.isPending, children: "Save address" }) })] })), _jsxs("div", { className: "mt-4 space-y-3", children: [addresses.map((a) => (_jsxs("div", { className: "flex items-center gap-3 rounded-2xl border border-line bg-surface p-4", children: [_jsx("span", { className: "grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary", children: _jsx(MapPin, { className: "size-5" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "font-display font-semibold text-ink", children: a.label }), _jsx("p", { className: "truncate text-sm text-muted", children: a.line })] }), _jsx("button", { onClick: () => removeAddress.mutate(a.id), className: "grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-500", "aria-label": `Remove ${a.label}`, children: _jsx(Trash2, { className: "size-4" }) })] }, a.id))), addresses.length === 0 && (_jsxs("p", { className: "flex items-center gap-2 text-sm text-muted", children: [_jsx(MapPin, { className: "size-4" }), " No addresses yet."] }))] })] })] }));
}
