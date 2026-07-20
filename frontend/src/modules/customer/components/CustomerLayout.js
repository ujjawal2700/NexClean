import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, CalendarPlus, ClipboardList, CreditCard, User, Bell } from "lucide-react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@shared/lib/utils";
import { SOCKET_URL } from "@shared/lib/api";
import { Logo } from "@shared/components/brand/Logo";
import { getPushToken, saveDeviceToken } from "@shared/lib/push";
import { useMe, useNotifications, bookingsKey, notificationsKey } from "../api/queries";
import { useRegisterToken } from "../api/mutations";
import { useSessionStore } from "../store/sessionStore";
const NAV = [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/app/book", label: "Book", icon: CalendarPlus, end: false },
    { to: "/app/bookings", label: "Bookings", icon: ClipboardList, end: false },
    { to: "/app/plans", label: "Plans", icon: CreditCard, end: false },
    { to: "/app/profile", label: "Profile", icon: User, end: false },
];
export function CustomerLayout({ children }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { data: me } = useMe();
    const { data: notifications = [] } = useNotifications();
    const registerToken = useRegisterToken();
    const registered = useRef(false);
    const qc = useQueryClient();
    const token = useSessionStore((s) => s.token);
    const unread = notifications.filter((n) => !n.read).length;
    // Register this device for push once per session so the customer can
    // receive Smart Area Alerts and booking updates.
    useEffect(() => {
        if (registered.current)
            return;
        registered.current = true;
        getPushToken()
            .then((t) => {
            saveDeviceToken(t);
            registerToken.mutate(t);
        })
            .catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Live: refresh bookings/notifications the moment a cleaner is assigned.
    useEffect(() => {
        if (!token)
            return;
        const socket = io(SOCKET_URL, { auth: { token }, transports: ["websocket"] });
        socket.on("booking_assigned", () => {
            qc.invalidateQueries({ queryKey: bookingsKey });
            qc.invalidateQueries({ queryKey: notificationsKey });
        });
        return () => {
            socket.disconnect();
        };
    }, [token, qc]);
    const isHomepage = location.pathname === "/app" || location.pathname === "/app/";
    return (_jsxs("div", { className: "min-h-dvh bg-bg", children: [isHomepage && (_jsx("header", { className: "sticky top-0 z-30 border-b border-line/70 bg-surface/80 backdrop-blur-xl", children: _jsxs("div", { className: "mx-auto flex h-16 max-w-6xl items-center justify-between px-5", children: [_jsx("button", { onClick: () => navigate("/app"), className: "text-[1.1rem]", "aria-label": "Dashboard", children: _jsx(Logo, { variant: "full" }) }), _jsx("nav", { className: "hidden items-center gap-1 md:flex", children: NAV.map((item) => (_jsxs(NavLink, { to: item.to, end: item.end, className: ({ isActive }) => cn("flex items-center gap-2 rounded-pill px-4 py-2 text-sm font-medium transition-colors", isActive ? "bg-primary/10 text-primary" : "text-ink-soft hover:text-primary"), children: [_jsx(item.icon, { className: "size-4" }), item.label] }, item.to))) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Link, { to: "/app/notifications", className: "relative grid size-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-surface-muted hover:text-primary", "aria-label": `Notifications${unread ? ` (${unread} unread)` : ""}`, children: [_jsx(Bell, { className: "size-5" }), unread > 0 && (_jsx("span", { className: "absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white", children: unread > 9 ? "9+" : unread }))] }), _jsx("span", { className: "hidden text-sm text-muted sm:inline", children: me?.name || "Member" })] })] }) })), _jsx("main", { className: "mx-auto max-w-6xl px-5 pb-28 pt-8 md:pb-16", children: children }), _jsx("nav", { className: "fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-surface/90 backdrop-blur-xl md:hidden", children: _jsx("div", { className: "mx-auto flex max-w-md items-center justify-around px-2 py-2", children: NAV.map((item) => (_jsxs(NavLink, { to: item.to, end: item.end, className: ({ isActive }) => cn("flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-medium transition-colors", isActive ? "text-primary" : "text-muted"), children: [_jsx(item.icon, { className: "size-5" }), item.label] }, item.to))) }) })] }));
}
