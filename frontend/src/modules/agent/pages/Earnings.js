import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from "react-router-dom";
import { Wallet, TrendingUp, CheckCircle2, Briefcase, ArrowLeft } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { Skeleton, SkeletonStatCards } from "@shared/ui/Skeleton";
import { formatDate, formatMoney } from "@shared/lib/format";
import { useJobs, useSummary } from "../api/agent.api";
export function Earnings() {
    const navigate = useNavigate();
    const { data: jobs = [], isLoading: jobsLoading } = useJobs();
    const { data: summary, isLoading: summaryLoading } = useSummary();
    const completed = jobs.filter((j) => j.status === "completed");
    const isLoading = jobsLoading || summaryLoading;
    const total = completed.reduce((s, j) => s + j.payout, 0);
    const stats = [
        { icon: Wallet, label: "Total earned", value: formatMoney(total) },
        { icon: TrendingUp, label: "Today", value: formatMoney(summary?.earnedToday ?? 0) },
        { icon: CheckCircle2, label: "Jobs done", value: String(completed.length) },
        { icon: Briefcase, label: "Jobs today", value: String(summary?.jobsToday ?? 0) },
    ];
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => navigate(-1), className: "flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0", "aria-label": "Back", children: _jsx(ArrowLeft, { className: "size-4" }) }), _jsx("h1", { className: "font-display text-3xl text-ink", children: "Earnings" })] }), _jsx("div", { className: "grid grid-cols-2 gap-4 lg:grid-cols-4", children: isLoading ? (_jsx(SkeletonStatCards, { count: 4 })) : (stats.map((s) => (_jsxs(GlassCard, { className: "flex items-center gap-3", children: [_jsx("span", { className: "grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary", children: _jsx(s.icon, { className: "size-5" }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "font-display text-xl font-semibold text-ink", children: s.value }), _jsx("p", { className: "truncate text-xs text-muted", children: s.label })] })] }, s.label)))) }), _jsxs("section", { children: [_jsx("h2", { className: "mb-4 font-display text-xl font-semibold text-ink", children: "Payout history" }), isLoading ? (_jsx("div", { className: "space-y-3", children: Array.from({ length: 3 }).map((_, i) => (_jsxs(GlassCard, { className: "flex items-center gap-4", children: [_jsx(Skeleton, { className: "h-16 w-20 shrink-0 rounded-2xl" }), _jsxs("div", { className: "min-w-0 flex-1 space-y-2", children: [_jsx(Skeleton, { className: "h-4 w-1/3" }), _jsx(Skeleton, { className: "h-3 w-1/2" })] }), _jsx(Skeleton, { className: "h-5 w-16 shrink-0" })] }, i))) })) : completed.length === 0 ? (_jsx(GlassCard, { className: "py-12 text-center text-muted", children: "No completed jobs yet." })) : (_jsx("div", { className: "space-y-3", children: completed.map((j) => (_jsxs(GlassCard, { className: "flex items-center gap-4", children: [_jsx("div", { className: "w-20 shrink-0", children: _jsx(CarSilhouette, { type: j.vehicleType, uid: `earn-${j.id}` }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate font-display font-semibold text-ink", children: j.vehicleName }), _jsxs("p", { className: "text-sm text-muted", children: [j.customerName, " \u00B7 ", formatDate(j.date)] })] }), _jsxs("p", { className: "font-display text-lg font-semibold text-emerald-600", children: ["+", formatMoney(j.payout)] })] }, j.id))) }))] })] }));
}
