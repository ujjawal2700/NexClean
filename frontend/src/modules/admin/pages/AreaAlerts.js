import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Radar, Bell, Check, MapPin, Loader2 } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { formatDate } from "@shared/lib/format";
import { useAlertSettings, useUpdateAlertSettings, useTriggered } from "../api/admin.api";
import { ApiError } from "@shared/lib/api";
const SAMPLE_SOCIETY = "Green Valley Society";
function renderTemplate(body, minutes) {
    return body.replace(/\{\{\s*society\s*\}\}/g, SAMPLE_SOCIETY).replace(/\{\{\s*minutes\s*\}\}/g, String(minutes));
}
export function AreaAlerts() {
    const { data: alertSettings } = useAlertSettings();
    const updateSettings = useUpdateAlertSettings();
    const { data: triggered = [] } = useTriggered();
    const [draft, setDraft] = useState(null);
    const [saved, setSaved] = useState(false);
    useEffect(() => {
        if (alertSettings) {
            setDraft(alertSettings);
        }
    }, [alertSettings]);
    if (!alertSettings || !draft)
        return _jsx("p", { className: "text-muted", children: "Loading\u2026" });
    const save = () => {
        updateSettings.mutate(draft, {
            onSuccess: () => {
                setSaved(true);
                setTimeout(() => setSaved(false), 1600);
            },
        });
    };
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-display text-3xl text-ink", children: "Smart Area Alert" }), _jsx("p", { className: "mt-1 text-muted", children: "Configure the signature NexClean Nearby notifications." })] }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-[1.4fr_1fr]", children: [_jsxs("div", { className: "space-y-6", children: [_jsxs(GlassCard, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("span", { className: "mt-1 grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary", children: _jsx(Radar, { className: "size-5" }) }), _jsxs("div", { children: [_jsx("p", { className: "font-display text-lg font-semibold text-ink", children: "Area alerts" }), _jsx("p", { className: "text-sm text-muted", children: "Configure Smart Area Alert notifications." })] })] }), _jsx("button", { type: "button", role: "switch", "aria-checked": draft.enabled, onClick: () => setDraft((d) => (d ? { ...d, enabled: !d.enabled } : null)), className: cn("relative h-7 w-12 shrink-0 overflow-hidden rounded-full border-0 p-0 transition-colors", draft.enabled ? "bg-primary" : "bg-line"), children: _jsx("span", { className: cn("absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform", draft.enabled ? "translate-x-5" : "translate-x-0") }) })] }), _jsxs("p", { className: cn("text-sm font-medium", draft.enabled ? "text-emerald-600" : "text-muted"), children: [_jsx("span", { className: cn("inline-block size-2.5 rounded-full mr-2", draft.enabled ? "bg-emerald-500" : "bg-muted") }), draft.enabled ? "Active and monitoring" : "Paused"] })] }), _jsxs(GlassCard, { className: "space-y-5", children: [_jsx("p", { className: "font-display text-lg font-semibold text-ink", children: "Trigger rules" }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1.5 block text-sm font-medium text-ink", children: "Radius (km)" }), _jsx("input", { type: "range", min: 0.5, max: 5, step: 0.5, value: draft.radiusKm, onChange: (e) => setDraft((d) => (d ? { ...d, radiusKm: Number(e.target.value) } : null)), className: "w-full accent-[var(--color-primary)]" }), _jsxs("p", { className: "mt-1 text-sm text-muted", children: ["Notify customers within ", _jsxs("span", { className: "font-medium text-ink", children: [draft.radiusKm, " km"] })] })] }), _jsx(Input, { name: "window", type: "number", label: "Booking window (minutes)", value: draft.windowMinutes, onChange: (e) => setDraft((d) => (d ? { ...d, windowMinutes: Number(e.target.value) || 0 } : null)) })] })] }), _jsxs(GlassCard, { className: "space-y-4", children: [_jsx("p", { className: "font-display text-lg font-semibold text-ink", children: "Notification template" }), _jsx(Input, { name: "title", label: "Title", value: draft.title, onChange: (e) => setDraft((d) => (d ? { ...d, title: e.target.value } : null)) }), _jsxs("div", { children: [_jsx("label", { className: "mb-1.5 block text-sm font-medium text-ink", children: "Body" }), _jsx("textarea", { rows: 3, value: draft.body, onChange: (e) => setDraft((d) => (d ? { ...d, body: e.target.value } : null)), className: "w-full rounded-2xl border border-line bg-surface px-4 py-3 text-ink outline-none focus:border-primary/50" }), _jsxs("p", { className: "mt-1.5 text-xs text-muted", children: ["Placeholders: ", _jsx("code", { className: "rounded bg-surface-muted px-1", children: "{{society}}" }), " ", _jsx("code", { className: "rounded bg-surface-muted px-1", children: "{{minutes}}" })] })] }), _jsxs("div", { className: "flex flex-col items-start gap-2", children: [_jsx(Button, { onClick: save, disabled: updateSettings.isPending, size: "sm", children: updateSettings.isPending ? (_jsx(Loader2, { className: "size-4 animate-spin" })) : saved ? (_jsxs(_Fragment, { children: [_jsx(Check, { className: "size-4" }), " Saved"] })) : ("Save settings") }), updateSettings.isError && (_jsx("p", { className: "text-sm text-red-500 mt-2", children: updateSettings.error instanceof ApiError && Array.isArray(updateSettings.error.details)
                                                    ? updateSettings.error.details.map((issue) => issue.message).join(", ")
                                                    : updateSettings.error.message || "Failed to save settings" }))] })] })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs(GlassCard, { children: [_jsx("p", { className: "mb-3 text-xs font-medium uppercase tracking-wide text-muted", children: "Live preview" }), _jsx("div", { className: "rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-soft)]", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("span", { className: "grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-white", children: _jsx(Bell, { className: "size-4" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-sm font-semibold text-ink", children: draft.title || "NexClean Nearby" }), _jsx("p", { className: "mt-1 text-xs leading-relaxed text-muted", children: renderTemplate(draft.body, draft.windowMinutes) })] })] }) })] }), _jsxs(GlassCard, { children: [_jsx("p", { className: "font-display text-lg font-semibold text-ink", children: "Trigger triggered history" }), _jsx("div", { className: "mt-4 space-y-3", children: triggered.map((t) => (_jsxs("div", { className: "flex items-center gap-3 rounded-2xl border border-line bg-surface/60 p-3", children: [_jsx("span", { className: "grid size-9 place-items-center rounded-xl bg-primary/10 text-primary", children: _jsx(MapPin, { className: "size-4" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate text-sm font-medium text-ink", children: t.society }), _jsxs("p", { className: "text-xs text-muted", children: [t.agentName, " \u00B7 ", formatDate(t.createdAt)] })] }), _jsxs("span", { className: "text-sm font-semibold text-primary", children: [t.sentCount, " sent"] })] }, t.id))) })] })] })] })] }));
}
