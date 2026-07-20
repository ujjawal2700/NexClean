import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Input } from "@shared/ui/Input";
import { SkeletonTableRows } from "@shared/ui/Skeleton";
import { formatMoney, formatDate } from "@shared/lib/format";
import { useCustomers, usePlans } from "../api/admin.api";
import { CUSTOMER_STATUS_STYLE } from "../lib/status";
const STATUS_FILTERS = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "suspended", label: "Suspended" },
];
export function Customers() {
    const { data: customers = [], isLoading } = useCustomers();
    const { data: plans = [] } = usePlans();
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [planFilter, setPlanFilter] = useState("all");
    const planLabel = (planId) => {
        if (!planId)
            return "—";
        return plans.find((p) => p.id === planId)?.name ?? planId;
    };
    const planFilters = [{ id: "all", label: "All" }, { id: "none", label: "None" }, ...plans.map((p) => ({ id: p.id, label: p.name }))];
    const q = query.toLowerCase();
    const list = customers.filter((c) => {
        const matchesStatus = statusFilter === "all" || c.status === statusFilter;
        const matchesPlan = planFilter === "all" || (planFilter === "none" ? !c.activePlan : c.activePlan === planFilter);
        const matchesQuery = !q ||
            c.name.toLowerCase().includes(q) ||
            c.phone.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q);
        return matchesStatus && matchesPlan && matchesQuery;
    });
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-display text-3xl text-ink", children: "Customers" }), _jsxs("p", { className: "mt-1 text-muted", children: [customers.length, " registered \u00B7 manage and review activity."] })] }), _jsxs(GlassCard, { className: "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", children: [_jsxs("div", { className: "flex flex-wrap gap-5", children: [_jsxs("div", { children: [_jsx("p", { className: "mb-1.5 text-xs font-medium uppercase tracking-wide text-muted", children: "Status" }), _jsx("div", { className: "inline-flex flex-wrap gap-1 rounded-pill border border-line bg-surface/70 p-1", children: STATUS_FILTERS.map((f) => (_jsx("button", { onClick: () => setStatusFilter(f.id), className: cn("rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors", statusFilter === f.id ? "bg-primary text-white" : "text-muted hover:text-ink"), children: f.label }, f.id))) })] }), _jsxs("div", { children: [_jsx("p", { className: "mb-1.5 text-xs font-medium uppercase tracking-wide text-muted", children: "Plan" }), _jsx("div", { className: "inline-flex flex-wrap gap-1 rounded-pill border border-line bg-surface/70 p-1", children: planFilters.map((f) => (_jsx("button", { onClick: () => setPlanFilter(f.id), className: cn("rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors", planFilter === f.id ? "bg-primary text-white" : "text-muted hover:text-ink"), children: f.label }, f.id))) })] })] }), _jsx("div", { className: "sm:w-64", children: _jsx(Input, { name: "search", placeholder: "Search customers\u2026", leading: _jsx(Search, { className: "size-4" }), value: query, onChange: (e) => setQuery(e.target.value) }) })] }), _jsx(GlassCard, { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full min-w-[820px] text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs uppercase tracking-wide text-muted", children: [_jsx("th", { className: "px-2 py-2 font-medium", children: "Customer" }), _jsx("th", { className: "px-2 py-2 font-medium", children: "Phone" }), _jsx("th", { className: "px-2 py-2 font-medium", children: "Joined" }), _jsx("th", { className: "px-2 py-2 font-medium", children: "Status" }), _jsx("th", { className: "px-2 py-2 font-medium", children: "Plan" }), _jsx("th", { className: "px-2 py-2 text-right font-medium", children: "Bookings" }), _jsx("th", { className: "px-2 py-2 text-right font-medium", children: "Total spend" })] }) }), _jsxs("tbody", { children: [isLoading && _jsx(SkeletonTableRows, { rows: 6, cols: 7 }), !isLoading && list.map((c) => (_jsxs("tr", { onClick: () => navigate(`/admin/customers/${c.id}`), className: "cursor-pointer border-t border-line/70 transition-colors hover:bg-surface-muted/60", children: [_jsxs("td", { className: "px-2 py-3", children: [_jsx("p", { className: "font-medium text-ink", children: c.name }), _jsx("p", { className: "text-xs text-muted", children: c.email || "No email" })] }), _jsx("td", { className: "px-2 py-3 text-ink-soft", children: c.phone }), _jsx("td", { className: "px-2 py-3 text-ink-soft", children: formatDate(c.joinedAt) }), _jsx("td", { className: "px-2 py-3", children: _jsx("span", { className: cn("rounded-pill px-2.5 py-0.5 text-xs font-medium capitalize", CUSTOMER_STATUS_STYLE[c.status]), children: c.status }) }), _jsx("td", { className: "px-2 py-3 text-ink-soft", children: planLabel(c.activePlan) }), _jsx("td", { className: "px-2 py-3 text-right text-ink-soft", children: c.totalBookings }), _jsx("td", { className: "px-2 py-3 text-right font-medium text-ink", children: formatMoney(c.totalSpend) })] }, c.id))), !isLoading && list.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "px-2 py-12 text-center text-muted", children: "No customers match your filters." }) }))] })] }) })] }));
}
