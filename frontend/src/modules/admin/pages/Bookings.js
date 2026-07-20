import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Search, X, Wand2 } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { SkeletonTableRows } from "@shared/ui/Skeleton";
import { formatMoney, formatDate } from "@shared/lib/format";
import { useBookings, useCancelBooking, useAgents, useAssignBooking, useAutoAssignBooking, useSetBookingStatus, useCategoryLabel, } from "../api/admin.api";
import {} from "../types";
import { BOOKING_STATUS_STYLE } from "../lib/status";
const FILTERS = [
    { id: "all", label: "All" },
    { id: "upcoming", label: "Upcoming" },
    { id: "in_progress", label: "In progress" },
    { id: "completed", label: "Completed" },
    { id: "cancelled", label: "Cancelled" },
];
const STATUS_OPTIONS = [
    { id: "upcoming", label: "Upcoming" },
    { id: "in_progress", label: "In progress" },
    { id: "completed", label: "Completed" },
    { id: "cancelled", label: "Cancelled" },
];
function AgentCell({ booking }) {
    const { data: agents = [] } = useAgents();
    const assign = useAssignBooking();
    const autoAssign = useAutoAssignBooking();
    const verifiedAgents = agents.filter((a) => a.status === "verified");
    if (booking.status === "cancelled" || booking.status === "completed") {
        return _jsx("span", { className: "text-ink-soft", children: booking.agentName ?? "—" });
    }
    return (_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsxs("select", { value: booking.assignedAgentId ?? "", onChange: (e) => e.target.value && assign.mutate({ id: booking.id, agentId: e.target.value }), disabled: assign.isPending, className: "h-9 rounded-xl border border-line bg-surface px-2 text-xs text-ink outline-none focus:border-primary/50", children: [_jsx("option", { value: "", children: booking.agentName ?? "Unassigned" }), verifiedAgents.map((a) => (_jsx("option", { value: a.id, children: a.name }, a.id)))] }), _jsx("button", { title: "Auto-assign nearest available agent", disabled: autoAssign.isPending, onClick: () => autoAssign.mutate(booking.id), className: "grid size-8 shrink-0 place-items-center rounded-xl border border-line text-muted transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50", children: _jsx(Wand2, { className: "size-3.5" }) })] }));
}
function StatusCell({ booking }) {
    const setStatus = useSetBookingStatus();
    return (_jsx("select", { value: booking.status, onChange: (e) => setStatus.mutate({ id: booking.id, status: e.target.value }), disabled: setStatus.isPending, className: cn("h-8 rounded-pill border-none px-2.5 text-xs font-medium outline-none", BOOKING_STATUS_STYLE[booking.status]), children: STATUS_OPTIONS.map((s) => (_jsx("option", { value: s.id, children: s.label }, s.id))) }));
}
export function Bookings() {
    const { data: bookings = [], isLoading } = useBookings();
    const cancelBooking = useCancelBooking();
    const categoryLabel = useCategoryLabel();
    const [filter, setFilter] = useState("all");
    const [query, setQuery] = useState("");
    const list = bookings.filter((b) => {
        const matchesStatus = filter === "all" || b.status === filter;
        const q = query.toLowerCase();
        const matchesQuery = !q ||
            b.customerName.toLowerCase().includes(q) ||
            b.vehicleName.toLowerCase().includes(q) ||
            b.id.toLowerCase().includes(q) ||
            b.society.toLowerCase().includes(q);
        return matchesStatus && matchesQuery;
    });
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-display text-3xl text-ink", children: "Bookings" }), _jsxs("p", { className: "mt-1 text-muted", children: [bookings.length, " total \u00B7 assign agents and control status."] })] }), _jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [_jsx("div", { className: "inline-flex flex-wrap gap-1 rounded-pill border border-line bg-surface/70 p-1", children: FILTERS.map((f) => (_jsx("button", { onClick: () => setFilter(f.id), className: cn("rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors", filter === f.id ? "bg-primary text-white" : "text-muted hover:text-ink"), children: f.label }, f.id))) }), _jsx("div", { className: "sm:w-64", children: _jsx(Input, { name: "search", placeholder: "Search bookings\u2026", leading: _jsx(Search, { className: "size-4" }), value: query, onChange: (e) => setQuery(e.target.value) }) })] }), _jsx(GlassCard, { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full min-w-[860px] text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs uppercase tracking-wide text-muted", children: [_jsx("th", { className: "px-2 py-2 font-medium", children: "Booking" }), _jsx("th", { className: "px-2 py-2 font-medium", children: "Customer" }), _jsx("th", { className: "px-2 py-2 font-medium", children: "When" }), _jsx("th", { className: "px-2 py-2 font-medium", children: "Society" }), _jsx("th", { className: "px-2 py-2 font-medium", children: "Agent" }), _jsx("th", { className: "px-2 py-2 font-medium", children: "Status" }), _jsx("th", { className: "px-2 py-2 text-right font-medium", children: "Amount" }), _jsx("th", { className: "px-2 py-2" })] }) }), _jsxs("tbody", { children: [isLoading && _jsx(SkeletonTableRows, { rows: 6, cols: 8 }), !isLoading && list.map((b) => (_jsxs("tr", { className: "border-t border-line/70", children: [_jsxs("td", { className: "px-2 py-3", children: [_jsx("p", { className: "font-medium text-ink", children: b.vehicleName }), _jsxs("p", { className: "text-xs text-muted", children: [categoryLabel(b.vehicleType), " \u00B7 #", b.id] })] }), _jsx("td", { className: "px-2 py-3 text-ink-soft", children: b.customerName }), _jsxs("td", { className: "px-2 py-3 text-ink-soft", children: [formatDate(b.date), " \u00B7 ", b.slot] }), _jsx("td", { className: "px-2 py-3 text-ink-soft", children: b.society }), _jsx("td", { className: "px-2 py-3", children: _jsx(AgentCell, { booking: b }) }), _jsx("td", { className: "px-2 py-3", children: _jsx(StatusCell, { booking: b }) }), _jsx("td", { className: "px-2 py-3 text-right font-medium text-ink", children: formatMoney(b.price) }), _jsx("td", { className: "px-2 py-3 text-right", children: b.status === "upcoming" || b.status === "in_progress" ? (_jsxs(Button, { variant: "ghost", size: "sm", disabled: cancelBooking.isPending, onClick: () => cancelBooking.mutate(b.id), children: [_jsx(X, { className: "size-4" }), " Cancel"] })) : (_jsx("span", { className: "text-xs text-muted", children: "\u2014" })) })] }, b.id))), !isLoading && list.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 8, className: "px-2 py-12 text-center text-muted", children: "No bookings match your filters." }) }))] })] }) })] }));
}
