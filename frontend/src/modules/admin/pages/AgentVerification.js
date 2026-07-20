import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, BadgeCheck, CreditCard, ArrowRight } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { useAgents, useSetAgentStatus } from "../api/admin.api";
import { AGENT_STATUS_STYLE } from "../lib/status";
export function AgentVerification() {
    const { data: agents = [] } = useAgents();
    const setAgentStatus = useSetAgentStatus();
    const [query, setQuery] = useState("");
    // Filter to pending status only
    const pendingAgents = agents.filter((a) => a.status === "pending");
    const q = query.toLowerCase();
    const list = pendingAgents.filter((a) => {
        const matchesQuery = !q ||
            a.name.toLowerCase().includes(q) ||
            a.phone.toLowerCase().includes(q) ||
            a.area.toLowerCase().includes(q) ||
            a.id.toLowerCase().includes(q);
        return matchesQuery;
    });
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-display text-3xl text-ink", children: "Agent Verification" }), _jsxs("p", { className: "mt-1 text-muted", children: [pendingAgents.length, " ", pendingAgents.length === 1 ? "specialist" : "specialists", " pending identity and KYC verification."] })] }), _jsx("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: _jsx("div", { className: "sm:w-80", children: _jsx(Input, { name: "search", placeholder: "Search pending agents\u2026", leading: _jsx(Search, { className: "size-4" }), value: query, onChange: (e) => setQuery(e.target.value) }) }) }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2 xl:grid-cols-3", children: [list.map((a) => {
                        return (_jsxs(GlassCard, { className: "flex flex-col", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("span", { className: "grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 font-display font-semibold text-white", children: a.name.split(" ").map((n) => n[0]).join("") }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "flex items-center gap-1.5", children: _jsx(Link, { to: `/admin/agents/${a.id}`, className: "truncate font-display font-semibold text-ink hover:text-primary transition-colors", children: a.name }) }), _jsxs("p", { className: "text-xs text-muted", children: [a.id, " \u00B7 ", a.phone] })] }), _jsx("span", { className: cn("rounded-pill px-2.5 py-0.5 text-xs font-medium capitalize", AGENT_STATUS_STYLE[a.status]), children: a.status })] }), _jsxs("div", { className: "mt-4 flex items-center gap-1.5 text-sm text-muted", children: [_jsx(MapPin, { className: "size-4 text-primary" }), " ", a.area || "No area set"] }), _jsxs("div", { className: "mt-4 rounded-2xl border border-line bg-surface/60 p-3", children: [_jsxs("p", { className: "flex items-center gap-1.5 text-xs font-medium text-muted", children: [_jsx(CreditCard, { className: "size-3.5 text-primary" }), " Aadhar: ", a.aadharNumber || "—"] }), (a.aadharFrontUrl || a.aadharBackUrl) ? (_jsx("div", { className: "mt-3 grid grid-cols-2 gap-2", children: [
                                                { label: "Front", url: a.aadharFrontUrl },
                                                { label: "Back", url: a.aadharBackUrl },
                                            ].map((doc) => doc.url && (_jsx("a", { href: doc.url, target: "_blank", rel: "noreferrer", className: "block overflow-hidden rounded-xl border border-line hover:border-primary/50 transition-colors", children: _jsx("img", { src: doc.url, alt: `Aadhar ${doc.label}`, className: "aspect-[4/3] w-full object-cover" }) }, doc.label))) })) : (_jsx("p", { className: "mt-2 text-xs text-muted/80 italic", children: "No KYC documents uploaded yet." }))] }), _jsxs("div", { className: "mt-auto pt-4 flex gap-2 border-t border-line/70 mt-4", children: [_jsxs(Button, { size: "sm", className: "flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium shadow-sm", onClick: () => setAgentStatus.mutate({ id: a.id, status: "verified" }), children: [_jsx(BadgeCheck, { className: "size-4" }), " Verify Agent"] }), _jsx(Link, { to: `/admin/agents/${a.id}`, className: "inline-flex", children: _jsx(Button, { size: "sm", variant: "outline", "aria-label": "View details", children: _jsx(ArrowRight, { className: "size-4" }) }) })] })] }, a.id));
                    }), list.length === 0 && (_jsx("p", { className: "col-span-full py-12 text-center text-muted", children: "No agents pending verification match your search." }))] })] }));
}
