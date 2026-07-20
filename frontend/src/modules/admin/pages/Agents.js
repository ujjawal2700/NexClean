import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Star, MapPin, BadgeCheck, Ban, RotateCcw, CreditCard, Pencil, Check, X } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { useAgents, useSetAgentStatus, useUpdateAgentArea } from "../api/admin.api";
import { AGENT_STATUS_STYLE } from "../lib/status";
const FILTERS = [
    { id: "all", label: "All" },
    { id: "verified", label: "Verified" },
    { id: "suspended", label: "Suspended" },
];
function AreaEditor({ agent }) {
    const updateArea = useUpdateAgentArea();
    const [editing, setEditing] = useState(false);
    const [area, setArea] = useState(agent.area);
    if (!editing) {
        return (_jsxs("p", { className: "flex items-center gap-1.5 text-sm text-muted", children: [_jsx(MapPin, { className: "size-4 text-primary" }), " ", agent.area, _jsx("button", { onClick: () => {
                        setArea(agent.area);
                        setEditing(true);
                    }, "aria-label": "Edit area", className: "ml-auto text-muted hover:text-ink", children: _jsx(Pencil, { className: "size-3.5" }) })] }));
    }
    return (_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(MapPin, { className: "size-4 shrink-0 text-primary" }), _jsx("input", { value: area, onChange: (e) => setArea(e.target.value), className: "h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-sm text-ink outline-none focus:border-primary/50" }), _jsx("button", { disabled: updateArea.isPending || !area.trim(), onClick: () => updateArea.mutate({ id: agent.id, area: area.trim() }, { onSuccess: () => setEditing(false) }), "aria-label": "Save area", className: "text-emerald-600 disabled:opacity-50", children: _jsx(Check, { className: "size-4" }) }), _jsx("button", { onClick: () => setEditing(false), "aria-label": "Cancel", className: "text-muted hover:text-ink", children: _jsx(X, { className: "size-4" }) })] }));
}
export function Agents() {
    const { data: agents = [] } = useAgents();
    const setAgentStatus = useSetAgentStatus();
    const [filter, setFilter] = useState("all");
    const [query, setQuery] = useState("");
    const verifiedAgents = agents.filter((a) => a.status !== "pending");
    const online = verifiedAgents.filter((a) => a.online).length;
    const q = query.toLowerCase();
    const list = verifiedAgents.filter((a) => {
        const matchesStatus = filter === "all" || a.status === filter;
        const matchesQuery = !q ||
            a.name.toLowerCase().includes(q) ||
            a.phone.toLowerCase().includes(q) ||
            a.area.toLowerCase().includes(q) ||
            a.id.toLowerCase().includes(q);
        return matchesStatus && matchesQuery;
    });
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-display text-3xl text-ink", children: "Agents" }), _jsxs("p", { className: "mt-1 text-muted", children: [verifiedAgents.length, " specialists \u00B7 ", online, " online."] })] }), _jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [_jsx("div", { className: "inline-flex flex-wrap gap-1 rounded-pill border border-line bg-surface/70 p-1", children: FILTERS.map((f) => (_jsx("button", { onClick: () => setFilter(f.id), className: cn("rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors", filter === f.id ? "bg-primary text-white" : "text-muted hover:text-ink"), children: f.label }, f.id))) }), _jsx("div", { className: "sm:w-64", children: _jsx(Input, { name: "search", placeholder: "Search agents\u2026", leading: _jsx(Search, { className: "size-4" }), value: query, onChange: (e) => setQuery(e.target.value) }) })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2 xl:grid-cols-3", children: [list.map((a) => (_jsxs(GlassCard, { className: "flex flex-col", children: [_jsxs(Link, { to: `/admin/agents/${a.id}`, className: "flex items-start gap-3", children: [_jsx("span", { className: "grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-accent font-display font-semibold text-white", children: a.name.split(" ").map((n) => n[0]).join("") }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("p", { className: "truncate font-display font-semibold text-ink hover:text-primary", children: a.name }), a.status === "verified" && _jsx(BadgeCheck, { className: "size-4 shrink-0 text-primary" })] }), _jsxs("p", { className: "text-xs text-muted", children: [a.id, " \u00B7 ", a.phone] })] }), _jsx("span", { className: cn("rounded-pill px-2.5 py-0.5 text-xs font-medium capitalize", AGENT_STATUS_STYLE[a.status]), children: a.status })] }), _jsxs("div", { className: "mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-line bg-surface/60 p-3 text-center", children: [_jsxs("div", { children: [_jsxs("p", { className: "flex items-center justify-center gap-1 font-display font-semibold text-ink", children: [_jsx(Star, { className: "size-3.5 fill-primary text-primary" }), " ", a.rating] }), _jsx("p", { className: "text-[11px] text-muted", children: "Rating" })] }), _jsxs("div", { children: [_jsx("p", { className: "font-display font-semibold text-ink", children: a.jobsDone }), _jsx("p", { className: "text-[11px] text-muted", children: "Jobs" })] }), _jsxs("div", { children: [_jsx("p", { className: cn("font-display font-semibold", a.online ? "text-emerald-600" : "text-muted"), children: a.online ? "Online" : "Off" }), _jsx("p", { className: "text-[11px] text-muted", children: "Now" })] })] }), _jsx("div", { className: "mt-3", children: _jsx(AreaEditor, { agent: a }) }), (a.aadharFrontUrl || a.aadharBackUrl) && (_jsxs("div", { className: "mt-3 rounded-2xl border border-line bg-surface/60 p-3", children: [_jsxs("p", { className: "flex items-center gap-1.5 text-xs font-medium text-muted", children: [_jsx(CreditCard, { className: "size-3.5 text-primary" }), " Aadhar ", a.aadharNumber || "—"] }), _jsx("div", { className: "mt-2 grid grid-cols-2 gap-2", children: [
                                            { label: "Front", url: a.aadharFrontUrl },
                                            { label: "Back", url: a.aadharBackUrl },
                                        ].map((doc) => doc.url && (_jsx("a", { href: doc.url, target: "_blank", rel: "noreferrer", className: "block overflow-hidden rounded-xl border border-line", children: _jsx("img", { src: doc.url, alt: `Aadhar ${doc.label}`, className: "aspect-[4/3] w-full object-cover" }) }, doc.label))) })] })), _jsxs("div", { className: "mt-4 flex gap-2 border-t border-line/70 pt-4", children: [a.status === "verified" && (_jsxs(Button, { size: "sm", variant: "outline", className: "flex-1", onClick: () => setAgentStatus.mutate({ id: a.id, status: "suspended" }), children: [_jsx(Ban, { className: "size-4" }), " Suspend"] })), a.status === "suspended" && (_jsxs(Button, { size: "sm", variant: "outline", className: "flex-1", onClick: () => setAgentStatus.mutate({ id: a.id, status: "verified" }), children: [_jsx(RotateCcw, { className: "size-4" }), " Reinstate"] }))] })] }, a.id))), list.length === 0 && (_jsx("p", { className: "col-span-full py-12 text-center text-muted", children: "No agents match your search." }))] })] }));
}
