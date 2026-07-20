import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Radar, BellRing, Check, Loader2 } from "lucide-react";
import { Button } from "@shared/ui/Button";
import { ApiError } from "@shared/lib/api";
import { useNotifyArea } from "../api/agent.api";
/**
 * Agent-side trigger for the Smart Area Alert (NexClean Nearby). Calls the
 * backend, which finds nearby customers in the society and pushes each one.
 */
export function AreaAlertCard({ society }) {
    const notifyArea = useNotifyArea();
    const [sentCount, setSentCount] = useState(null);
    const [error, setError] = useState("");
    const send = async () => {
        setError("");
        try {
            const alert = await notifyArea.mutateAsync(society);
            setSentCount(alert.sentCount);
        }
        catch (e) {
            setError(e instanceof ApiError ? e.message : "Couldn't send the alert");
        }
    };
    return (_jsxs("div", { className: "relative overflow-hidden rounded-card border border-primary/20 bg-gradient-to-br from-primary to-primary-soft p-6 text-white shadow-[var(--shadow-glow)]", children: [_jsx("div", { className: "pointer-events-none absolute -right-12 -top-12 size-48 rounded-full opacity-40 blur-2xl", style: { background: "radial-gradient(circle, #00C2FF, transparent 70%)" } }), _jsxs("div", { className: "relative", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Radar, { className: "size-5" }), _jsx("p", { className: "font-display text-lg font-semibold", children: "NexClean Nearby" })] }), _jsxs("p", { className: "mt-2 max-w-sm text-sm text-white/85", children: ["You're servicing ", _jsx("span", { className: "font-semibold", children: society }), ". Notify nearby customers about a cleaning opportunity in their area."] }), _jsx("div", { className: "mt-5", children: _jsx(AnimatePresence, { mode: "wait", children: sentCount === null ? (_jsxs(motion.div, { exit: { opacity: 0 }, children: [_jsx(Button, { variant: "glass", className: "bg-white text-primary hover:bg-white", onClick: send, disabled: notifyArea.isPending, children: notifyArea.isPending ? (_jsx(Loader2, { className: "size-4 animate-spin" })) : (_jsxs(_Fragment, { children: [_jsx(BellRing, { className: "size-4" }), " Notify nearby customers"] })) }), error && _jsx("p", { className: "mt-2 text-sm text-white/90", children: error })] }, "cta")) : (_jsxs(motion.div, { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, className: "flex items-center gap-2 rounded-pill bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur", children: [_jsx(Check, { className: "size-4" }), " Alert sent to ", sentCount, " nearby customer(s)"] }, "done")) }) })] })] }));
}
