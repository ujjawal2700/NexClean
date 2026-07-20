import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { MapPin, Phone, Mail, Building2, Calendar, Trash2, Search, Users, Loader2, Rocket, } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { useLeads, useDeleteLead } from "../api/admin.api";
function formatDate(iso) {
    return new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}
function LeadCard({ lead, onDelete }) {
    return (_jsxs("div", { className: "flex flex-col gap-3 rounded-2xl border border-line bg-surface/60 p-4 sm:flex-row sm:items-start sm:justify-between", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500", children: _jsx(Rocket, { className: "size-5" }) }), _jsxs("div", { className: "min-w-0 space-y-1", children: [_jsx("p", { className: "font-semibold text-ink", children: lead.name }), _jsxs("div", { className: "flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Phone, { className: "size-3" }), " ", lead.phone] }), lead.email && (_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Mail, { className: "size-3" }), " ", lead.email] })), _jsxs("span", { className: "flex items-center gap-1", children: [_jsx(MapPin, { className: "size-3 text-amber-500" }), _jsx("strong", { className: "text-ink", children: lead.city })] }), lead.location && (_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Building2, { className: "size-3" }), " ", lead.location] })), _jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Calendar, { className: "size-3" }), " ", formatDate(lead.createdAt)] })] })] })] }), _jsx(Button, { variant: "ghost", size: "sm", className: "shrink-0 text-red-500 hover:bg-red-500/10 hover:text-red-600", onClick: onDelete, children: _jsx(Trash2, { className: "size-4" }) })] }));
}
export function Leads() {
    const { data: leads = [], isLoading } = useLeads();
    const deleteLead = useDeleteLead();
    const [search, setSearch] = useState("");
    const filtered = leads.filter((l) => {
        const q = search.toLowerCase();
        return (l.name.toLowerCase().includes(q) ||
            l.phone.includes(q) ||
            l.city.toLowerCase().includes(q) ||
            l.location.toLowerCase().includes(q) ||
            l.email.toLowerCase().includes(q));
    });
    // Group by city
    const byCityMap = new Map();
    for (const lead of filtered) {
        const existing = byCityMap.get(lead.city) ?? [];
        existing.push(lead);
        byCityMap.set(lead.city, existing);
    }
    const byCityEntries = Array.from(byCityMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-display text-2xl font-bold text-ink", children: "Leads" }), _jsx("p", { className: "mt-1 text-sm text-muted", children: "Users from cities where NexClean isn't available yet." })] }), _jsx("div", { className: "flex items-center gap-3", children: _jsxs("div", { className: "flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-1.5", children: [_jsx(Rocket, { className: "size-4 text-amber-500" }), _jsxs("span", { className: "text-sm font-semibold text-amber-700", children: [leads.length, " lead", leads.length !== 1 ? "s" : ""] })] }) })] }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-3", children: [_jsxs(GlassCard, { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex size-10 items-center justify-center rounded-xl bg-primary/10", children: _jsx(Users, { className: "size-5 text-primary" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-2xl font-bold text-ink", children: leads.length }), _jsx("p", { className: "text-xs text-muted", children: "Total leads" })] })] }), _jsxs(GlassCard, { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex size-10 items-center justify-center rounded-xl bg-amber-500/10", children: _jsx(MapPin, { className: "size-5 text-amber-500" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-2xl font-bold text-ink", children: byCityMap.size }), _jsx("p", { className: "text-xs text-muted", children: "Unique cities" })] })] }), _jsxs(GlassCard, { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex size-10 items-center justify-center rounded-xl bg-green-500/10", children: _jsx(Rocket, { className: "size-5 text-green-500" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-2xl font-bold text-ink", children: leads.filter((l) => !l.notified).length }), _jsx("p", { className: "text-xs text-muted", children: "Awaiting launch" })] })] })] }), _jsx(Input, { name: "lead-search", placeholder: "Search by name, phone, city\u2026", leading: _jsx(Search, { className: "size-4" }), value: search, onChange: (e) => setSearch(e.target.value) }), isLoading ? (_jsxs("div", { className: "flex items-center justify-center gap-2 py-12 text-muted", children: [_jsx(Loader2, { className: "size-5 animate-spin" }), " Loading leads\u2026"] })) : leads.length === 0 ? (_jsxs(GlassCard, { className: "flex flex-col items-center gap-3 py-12 text-center", children: [_jsx("div", { className: "flex size-16 items-center justify-center rounded-2xl bg-amber-500/10", children: _jsx(Rocket, { className: "size-8 text-amber-400" }) }), _jsx("p", { className: "font-semibold text-ink", children: "No leads yet" }), _jsx("p", { className: "text-sm text-muted", children: "When users from unserviced cities sign up, they'll appear here." })] })) : filtered.length === 0 ? (_jsx("p", { className: "py-8 text-center text-sm text-muted", children: "No leads match your search." })) : (_jsx("div", { className: "space-y-6", children: byCityEntries.map(([city, cityLeads]) => (_jsxs("div", { children: [_jsxs("div", { className: "mb-3 flex items-center gap-2", children: [_jsx(MapPin, { className: "size-4 text-amber-500" }), _jsx("p", { className: "text-sm font-semibold text-ink", children: city }), _jsx("span", { className: "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700", children: cityLeads.length })] }), _jsx("div", { className: "space-y-2", children: cityLeads.map((lead) => (_jsx(LeadCard, { lead: lead, onDelete: () => deleteLead.mutate(lead.id) }, lead.id))) })] }, city))) }))] }));
}
