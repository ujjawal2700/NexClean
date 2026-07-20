import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { Radio, Clock, MapPin, UserCheck, Wand2, AlertTriangle, Loader2, CalendarClock, ChevronDown, } from "lucide-react";
import { SOCKET_URL } from "@shared/lib/api";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { SkeletonTableRows } from "@shared/ui/Skeleton";
import { formatMoney, formatDate } from "@shared/lib/format";
import { useAdminSession } from "../store/sessionStore";
import { useDispatchQueue, useAssignableAgents, useAssignBooking, useAutoAssignBooking, } from "../api/admin.api";
const STATUS_STYLE = {
    pending_admin: "bg-red-500/10 text-red-600 border-red-500/20",
    offered: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    searching: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    scheduled: "bg-violet-500/10 text-violet-600 border-violet-500/20",
    assigned: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    cancelled: "bg-ink/5 text-muted border-line",
};
const STATUS_LABEL = {
    pending_admin: "Needs assignment",
    offered: "Offer out",
    searching: "Searching",
    scheduled: "Scheduled",
    assigned: "Assigned",
    cancelled: "Cancelled",
};
// Order the queue so the items needing a human come first.
const STATUS_RANK = {
    pending_admin: 0,
    offered: 1,
    searching: 2,
    scheduled: 3,
    assigned: 4,
    cancelled: 5,
};
export function Dispatch() {
    const { data: queue = [], isLoading } = useDispatchQueue();
    const token = useAdminSession((s) => s.token);
    const qc = useQueryClient();
    // Live refresh: the backend emits on every dispatch state change.
    useEffect(() => {
        if (!token)
            return;
        const socket = io(SOCKET_URL, { auth: { token }, transports: ["websocket"] });
        const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "dispatch"] });
        socket.on("dispatch_update", refresh);
        socket.on("dispatch_pending", refresh);
        return () => {
            socket.disconnect();
        };
    }, [token, qc]);
    const sorted = useMemo(() => [...queue].sort((a, b) => STATUS_RANK[a.dispatchStatus] - STATUS_RANK[b.dispatchStatus] || +new Date(a.date) - +new Date(b.date)), [queue]);
    const pendingCount = queue.filter((q) => q.dispatchStatus === "pending_admin").length;
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-wrap items-end justify-between gap-3", children: [_jsxs("div", { children: [_jsxs("h1", { className: "flex items-center gap-2 font-display text-3xl text-ink", children: [_jsx(Radio, { className: "size-7 text-primary" }), " Dispatch"] }), _jsxs("p", { className: "mt-1 text-muted", children: ["Live view of jobs finding a cleaner. ", pendingCount > 0 ? `${pendingCount} need manual assignment.` : "All flowing automatically."] })] }), _jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-pill border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-600", children: [_jsxs("span", { className: "relative flex size-2", children: [_jsx("span", { className: "absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" }), _jsx("span", { className: "relative inline-flex size-2 rounded-full bg-emerald-500" })] }), "Live"] })] }), pendingCount > 0 && (_jsxs("div", { className: "flex items-center gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600", children: [_jsx(AlertTriangle, { className: "size-4 shrink-0" }), _jsxs("span", { children: [pendingCount, " job", pendingCount > 1 ? "s" : "", " had no takers and are waiting for you to assign a cleaner."] })] })), isLoading ? (_jsx(GlassCard, { children: _jsx("table", { className: "w-full", children: _jsx("tbody", { children: _jsx(SkeletonTableRows, { rows: 4, cols: 1 }) }) }) })) : sorted.length === 0 ? (_jsxs(GlassCard, { className: "py-16 text-center text-muted", children: [_jsx(Radio, { className: "mx-auto mb-3 size-8 opacity-40" }), "Nothing in the dispatch queue right now. New bookings will appear here while they find a cleaner."] })) : (_jsx("div", { className: "grid gap-3", children: sorted.map((item) => (_jsx(DispatchRow, { item: item }, item.id))) }))] }));
}
function DispatchRow({ item }) {
    return (_jsxs(GlassCard, { className: "flex flex-col gap-4 md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: cn("rounded-pill border px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLE[item.dispatchStatus]), children: STATUS_LABEL[item.dispatchStatus] }), item.isSubscriptionWash && (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-pill bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-600", children: [_jsx(CalendarClock, { className: "size-3" }), " Subscription"] })), !item.hasLocation && (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-pill bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600", children: [_jsx(MapPin, { className: "size-3" }), " No location"] }))] }), _jsxs("p", { className: "mt-2 font-display font-semibold text-ink", children: [item.vehicleName, " \u00B7 ", item.packageName] }), _jsxs("div", { className: "mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted", children: [_jsx("span", { children: item.customerName }), _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Clock, { className: "size-3.5" }), " ", formatDate(item.date), " \u00B7 ", item.slot] }), _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(MapPin, { className: "size-3.5" }), " ", item.society || item.addressLine] })] }), _jsx("div", { className: "mt-1.5 text-xs text-muted", children: item.dispatchStatus === "offered" && item.currentOfferAgentName ? (_jsxs("span", { children: ["Offer out to ", _jsx("span", { className: "font-medium text-ink", children: item.currentOfferAgentName }), item.offerExpiresAt && _jsx(OfferCountdown, { expiresAt: item.offerExpiresAt })] })) : item.dispatchStatus === "searching" ? (_jsxs("span", { children: ["Searching nearby cleaners \u00B7 ", item.dispatchAttempts, " offer", item.dispatchAttempts === 1 ? "" : "s", " tried"] })) : item.dispatchStatus === "scheduled" ? (_jsx("span", { children: "Will auto-assign the nearest cleaner before the slot" })) : item.dispatchStatus === "pending_admin" ? (_jsxs("span", { className: "text-red-500", children: ["No cleaner accepted after ", item.dispatchAttempts, " attempt", item.dispatchAttempts === 1 ? "" : "s"] })) : null })] }), _jsxs("div", { className: "flex shrink-0 items-center gap-2", children: [_jsx("span", { className: "font-display font-semibold text-ink", children: formatMoney(item.price) }), _jsx(AssignControls, { item: item })] })] }));
}
function OfferCountdown({ expiresAt }) {
    const [left, setLeft] = useState(() => Math.max(0, Math.ceil((+new Date(expiresAt) - Date.now()) / 1000)));
    useEffect(() => {
        const id = setInterval(() => setLeft(Math.max(0, Math.ceil((+new Date(expiresAt) - Date.now()) / 1000))), 500);
        return () => clearInterval(id);
    }, [expiresAt]);
    return _jsxs("span", { className: "ml-1 tabular-nums text-amber-600", children: ["\u00B7 ", left, "s left"] });
}
function AssignControls({ item }) {
    const [open, setOpen] = useState(false);
    const assign = useAssignBooking();
    const autoAssign = useAutoAssignBooking();
    const { data: agents = [], isLoading } = useAssignableAgents(open ? item.id : null);
    const ref = useRef(null);
    useEffect(() => {
        if (!open)
            return;
        const onClick = (e) => {
            if (ref.current && !ref.current.contains(e.target))
                setOpen(false);
        };
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, [open]);
    return (_jsxs("div", { className: "relative flex items-center gap-1.5", ref: ref, children: [_jsxs(Button, { variant: "ghost", size: "sm", title: "Auto-assign the nearest available cleaner", disabled: autoAssign.isPending || !item.hasLocation, onClick: () => autoAssign.mutate(item.id), children: [autoAssign.isPending ? _jsx(Loader2, { className: "size-4 animate-spin" }) : _jsx(Wand2, { className: "size-4" }), _jsx("span", { className: "hidden sm:inline", children: "Auto" })] }), _jsxs(Button, { size: "sm", onClick: () => setOpen((v) => !v), disabled: assign.isPending, children: [_jsx(UserCheck, { className: "size-4" }), " Assign ", _jsx(ChevronDown, { className: "size-3.5" })] }), open && (_jsx("div", { className: "absolute right-0 top-full z-20 mt-1.5 max-h-72 w-64 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-xl", children: isLoading ? (_jsxs("p", { className: "flex items-center gap-2 px-3 py-4 text-sm text-muted", children: [_jsx(Loader2, { className: "size-4 animate-spin" }), " Finding cleaners\u2026"] })) : agents.length === 0 ? (_jsx("p", { className: "px-3 py-4 text-sm text-muted", children: "No verified cleaners found." })) : (agents.map((a) => (_jsxs("button", { onClick: () => {
                        assign.mutate({ id: item.id, agentId: a.id });
                        setOpen(false);
                    }, className: "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-primary/5", children: [_jsxs("span", { className: "min-w-0", children: [_jsx("span", { className: "block truncate font-medium text-ink", children: a.name }), _jsx("span", { className: "text-xs text-muted", children: a.distanceKm != null ? `${a.distanceKm} km` : a.area || "—" })] }), _jsx("span", { className: cn("shrink-0 rounded-pill px-2 py-0.5 text-[10px] font-medium", a.online ? "bg-emerald-500/10 text-emerald-600" : "bg-ink/5 text-muted"), children: a.online ? "online" : "offline" })] }, a.id)))) }))] }));
}
