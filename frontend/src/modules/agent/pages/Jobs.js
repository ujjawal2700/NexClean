import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, Clock, Navigation, ChevronRight, ArrowLeft } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { SkeletonListCards } from "@shared/ui/Skeleton";
import { formatDate, formatMoney } from "@shared/lib/format";
import { useJobs } from "../api/agent.api";
import { VEHICLE_LABEL, STATUS_LABEL } from "../types";
const FILTERS = [
    { id: "active", label: "Active" },
    { id: "completed", label: "Completed" },
    { id: "all", label: "All" },
];
const STATUS_STYLES = {
    assigned: "bg-primary/10 text-primary",
    enroute: "bg-amber-500/10 text-amber-600",
    arrived: "bg-amber-500/10 text-amber-600",
    in_progress: "bg-primary/10 text-primary",
    completed: "bg-emerald-500/10 text-emerald-600",
};
export function Jobs() {
    const navigate = useNavigate();
    const { data: jobs = [], isLoading } = useJobs();
    const [filter, setFilter] = useState("active");
    const list = jobs.filter((j) => filter === "all" ? true : filter === "completed" ? j.status === "completed" : j.status !== "completed");
    return (_jsxs("div", { children: [_jsxs("div", { className: "mb-6 flex items-center gap-3", children: [_jsx("button", { onClick: () => navigate(-1), className: "flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0", "aria-label": "Back", children: _jsx(ArrowLeft, { className: "size-4" }) }), _jsx("h1", { className: "font-display text-3xl text-ink", children: "Jobs" })] }), _jsx("div", { className: "mb-6 inline-flex gap-1 rounded-pill border border-line bg-surface/70 p-1", children: FILTERS.map((f) => (_jsx("button", { onClick: () => setFilter(f.id), className: cn("rounded-pill px-4 py-1.5 text-sm font-medium transition-colors", filter === f.id ? "bg-primary text-white" : "text-muted hover:text-ink"), children: f.label }, f.id))) }), isLoading ? (_jsx(SkeletonListCards, { count: 4 })) : list.length === 0 ? (_jsx(GlassCard, { className: "py-16 text-center text-muted", children: "No jobs here." })) : (_jsx("div", { className: "space-y-4", children: list.map((j) => (_jsx(Link, { to: `/agent/jobs/${j.id}`, className: "block", children: _jsxs(GlassCard, { interactive: true, className: "flex items-center gap-4", children: [_jsx("div", { className: "w-24 shrink-0", children: _jsx(CarSilhouette, { type: j.vehicleType, uid: `job-${j.id}` }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("p", { className: "font-display text-lg font-semibold text-ink", children: j.vehicleName }), _jsx("span", { className: cn("rounded-pill px-2.5 py-0.5 text-xs font-medium", STATUS_STYLES[j.status]), children: STATUS_LABEL[j.status] })] }), _jsxs("p", { className: "text-sm text-muted", children: [j.customerName, " \u00B7 ", j.packageName, " \u00B7 ", VEHICLE_LABEL[j.vehicleType]] }), _jsxs("div", { className: "mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft", children: [_jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx(Clock, { className: "size-4 text-primary" }), " ", formatDate(j.date), " \u00B7 ", j.slot] }), _jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx(MapPin, { className: "size-4 text-primary" }), " ", j.addressLabel] }), _jsxs("span", { className: "hidden items-center gap-1.5 sm:flex", children: [_jsx(Navigation, { className: "size-4 text-primary" }), " ", j.distanceKm != null ? `${j.distanceKm} km` : "Nearby"] })] })] }), _jsxs("div", { className: "flex flex-col items-end gap-1", children: [_jsx("p", { className: "font-display text-lg font-semibold text-ink", children: formatMoney(j.payout) }), _jsx(ChevronRight, { className: "size-5 text-muted" })] })] }) }, j.id))) }))] }));
}
