import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, MapPin, Clock, Plus, ArrowLeft, UserCheck, Loader2 } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { SkeletonListCards } from "@shared/ui/Skeleton";
import { useBookings } from "../api/queries";
import { useCancelBooking } from "../api/mutations";
import { formatDate, formatMoney } from "@shared/lib/format";
/** A small live indicator of where the booking is in the dispatch pipeline. */
function CleanerStatus({ booking }) {
    if (booking.status !== "upcoming")
        return null;
    if (booking.agentName) {
        return (_jsxs("p", { className: "mt-2 flex items-center gap-1.5 text-sm font-medium text-emerald-600", children: [_jsx(UserCheck, { className: "size-4" }), " ", booking.agentName, " assigned"] }));
    }
    const d = booking.dispatchStatus;
    if (d === "scheduled") {
        return (_jsxs("p", { className: "mt-2 flex items-center gap-1.5 text-sm text-violet-600", children: [_jsx(Clock, { className: "size-4" }), " A cleaner will be auto-assigned before your slot"] }));
    }
    if (d === "pending_admin") {
        return (_jsxs("p", { className: "mt-2 flex items-center gap-1.5 text-sm text-amber-600", children: [_jsx(Clock, { className: "size-4" }), " Assigning a cleaner shortly"] }));
    }
    // searching / offered (or unknown-but-upcoming) → actively finding someone.
    return (_jsxs("p", { className: "mt-2 flex items-center gap-1.5 text-sm text-primary", children: [_jsx(Loader2, { className: "size-4 animate-spin" }), " Finding your nearest cleaner\u2026"] }));
}
const FILTERS = [
    { id: "all", label: "All" },
    { id: "upcoming", label: "Upcoming" },
    { id: "completed", label: "Completed" },
    { id: "cancelled", label: "Cancelled" },
];
const STATUS_STYLES = {
    upcoming: "bg-primary/10 text-primary",
    completed: "bg-emerald-500/10 text-emerald-600",
    cancelled: "bg-muted/15 text-muted",
};
export function Bookings() {
    const navigate = useNavigate();
    const { data: bookings = [], isLoading } = useBookings();
    const cancelBooking = useCancelBooking();
    const [filter, setFilter] = useState("all");
    const list = filter === "all" ? bookings : bookings.filter((b) => b.status === filter);
    return (_jsxs("div", { children: [_jsxs("div", { className: "mb-6 flex flex-wrap items-center justify-between gap-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => navigate(-1), className: "flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer", "aria-label": "Back", children: _jsx(ArrowLeft, { className: "size-4" }) }), _jsx("h1", { className: "font-display text-3xl text-ink", children: "My bookings" })] }), _jsx(Button, { asChild: true, size: "sm", children: _jsxs(Link, { to: "/app/book", children: [_jsx(Plus, { className: "size-4" }), " New booking"] }) })] }), _jsx("div", { className: "mb-6 inline-flex gap-1 rounded-pill border border-line bg-surface/70 p-1", children: FILTERS.map((f) => (_jsx("button", { onClick: () => setFilter(f.id), className: cn("rounded-pill px-4 py-1.5 text-sm font-medium transition-colors", filter === f.id ? "bg-primary text-white" : "text-muted hover:text-ink"), children: f.label }, f.id))) }), isLoading ? (_jsx(SkeletonListCards, { count: 3 })) : list.length === 0 ? (_jsxs(GlassCard, { className: "py-16 text-center", children: [_jsx("p", { className: "text-muted", children: "No bookings here yet." }), _jsx(Button, { asChild: true, className: "mt-4", children: _jsx(Link, { to: "/app/book", children: "Book a cleaning" }) })] })) : (_jsx("div", { className: "space-y-4", children: list.map((b) => (_jsxs(GlassCard, { className: "flex flex-col gap-4 sm:flex-row sm:items-center", children: [_jsx("div", { className: "w-24 shrink-0", children: _jsx(CarSilhouette, { type: b.vehicleType, uid: `bk-${b.id}` }) }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("p", { className: "font-display text-lg font-semibold text-ink", children: b.vehicleName }), _jsx("span", { className: cn("rounded-pill px-2.5 py-0.5 text-xs font-medium capitalize", STATUS_STYLES[b.status]), children: b.status })] }), _jsxs("p", { className: "text-sm text-muted", children: [b.packageName, " \u00B7 #", b.id] }), _jsxs("div", { className: "mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft", children: [_jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx(CalendarDays, { className: "size-4 text-primary" }), " ", formatDate(b.date)] }), _jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx(Clock, { className: "size-4 text-primary" }), " ", b.slot] }), _jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx(MapPin, { className: "size-4 text-primary" }), " ", b.addressLabel] })] }), _jsx(CleanerStatus, { booking: b })] }), _jsxs("div", { className: "flex items-center justify-between gap-4 sm:flex-col sm:items-end", children: [_jsx("p", { className: "font-display text-xl font-semibold text-ink", children: formatMoney(b.price) }), b.status === "upcoming" && (_jsx(Button, { variant: "ghost", size: "sm", disabled: cancelBooking.isPending, onClick: () => cancelBooking.mutate(b.id), children: "Cancel" }))] })] }, b.id))) }))] }));
}
