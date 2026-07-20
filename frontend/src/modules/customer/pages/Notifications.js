import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CalendarCheck, Radar, Info, ArrowLeft } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Skeleton } from "@shared/ui/Skeleton";
import { cn } from "@shared/lib/utils";
import { useNotifications } from "../api/queries";
import { useMarkNotificationsRead } from "../api/mutations";
const ICON = {
    booking: CalendarCheck,
    area_alert: Radar,
    system: Info,
};
function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 1)
        return "just now";
    if (mins < 60)
        return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24)
        return `${hrs}h ago`;
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
export function Notifications() {
    const navigate = useNavigate();
    const { data: items = [], isLoading } = useNotifications();
    const markRead = useMarkNotificationsRead();
    // Mark everything read once when the inbox is opened.
    useEffect(() => {
        markRead.mutate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (_jsxs("div", { className: "mx-auto max-w-2xl", children: [_jsxs("div", { className: "mb-6 flex items-center gap-3", children: [_jsx("button", { onClick: () => navigate(-1), className: "flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0", "aria-label": "Back", children: _jsx(ArrowLeft, { className: "size-4" }) }), _jsx("h1", { className: "font-display text-3xl text-ink", children: "Notifications" })] }), isLoading ? (_jsx("div", { className: "space-y-3", children: Array.from({ length: 4 }).map((_, i) => (_jsxs(GlassCard, { className: "flex items-start gap-4", children: [_jsx(Skeleton, { className: "size-11 shrink-0 rounded-2xl" }), _jsxs("div", { className: "min-w-0 flex-1 space-y-2", children: [_jsx(Skeleton, { className: "h-4 w-1/3" }), _jsx(Skeleton, { className: "h-3 w-2/3" })] })] }, i))) })) : items.length === 0 ? (_jsxs(GlassCard, { className: "py-16 text-center", children: [_jsx(Bell, { className: "mx-auto size-8 text-muted/50" }), _jsx("p", { className: "mt-3 text-muted", children: "You're all caught up. No notifications yet." })] })) : (_jsx("div", { className: "space-y-3", children: items.map((n) => {
                    const Icon = ICON[n.type];
                    return (_jsxs(GlassCard, { className: cn("flex items-start gap-4", !n.read && "ring-1 ring-primary/20"), children: [_jsx("span", { className: cn("grid size-11 shrink-0 place-items-center rounded-2xl", n.type === "area_alert"
                                    ? "bg-gradient-to-br from-primary to-accent text-white"
                                    : "bg-primary/10 text-primary"), children: _jsx(Icon, { className: "size-5" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("p", { className: "font-display font-semibold text-ink", children: n.title }), _jsx("span", { className: "shrink-0 text-xs text-muted", children: timeAgo(n.createdAt) })] }), _jsx("p", { className: "mt-1 text-sm text-ink-soft", children: n.body })] }), !n.read && _jsx("span", { className: "mt-1.5 size-2 shrink-0 rounded-full bg-primary" })] }, n.id));
                }) }))] }));
}
